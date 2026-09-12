import { describe, expect, it } from 'vitest'; import type { Entity } from '../../workspace/types'; import { constructionHandoff } from './DomainDepthPanel';
const row=(id:string,kind:string,status:string,fields:Entity['fields']={}):Entity=>({id,kind,status,title:id,revision:1,fields});
describe('constructionHandoff',()=>{it('combines drawing, inspection, and change blockers',()=>{const result=constructionHandoff('c',[row('d','drawing','issued',{contract:'c'}),row('i','inspection','failed',{drawing:'d'}),row('x','change','approved',{contract:'c'})]);expect(result).toMatchObject({ready:false,evidence:3});expect(result.blockers).toHaveLength(3);});it('accepts completed controls',()=>expect(constructionHandoff('c',[row('d','drawing','issued',{contract:'c'}),row('i','inspection','passed',{drawing:'d'}),row('x','change','executed',{contract:'c'})]).ready).toBe(true));});

import { product } from '../../product/definition';
import { execute, fresh } from '../../workspace/engine';
import type { Snapshot, Value } from '../../workspace/types';
const at = '2026-09-12T12:00:00Z';
function run(state: Snapshot, operation: string, entityId: string, actorId: string, input: Record<string, Value> = {}) {
    return execute(state, {id: operation + '-' + String(state.revision), type: 'operate', operation, entityId, actorId, input, expectedRevision: state.revision}, product, at);
}
function ready() {
    const state = run(fresh(product), 'issue', 'drawing-1', 'actor-1');
    state.entities.push(row('inspection-1', 'inspection', 'passed', {drawing: 'drawing-1', observation: 'Verified site construction.'}));
    return state;
}
function request(state = ready()) { return run(state, 'handoff-request', 'contract-1', 'actor-2', {note: 'All field evidence checked for practical completion.'}); }
function handoff(state: Snapshot) { const item = state.entities.find(item => item.kind === 'handoff' && item.status === 'requested'); if (!item) throw new Error('Missing handoff'); return item.id; }
describe('contract handoff execution', () => {
    it('closes and revokes while preserving the approval evidence', () => {
        const requested = request(); const id = handoff(requested);
        const approved = run(requested, 'handoff-approve', id, 'actor-0');
        expect(approved.entities.find(item => item.id === 'contract-1')?.status).toBe('closed');
        const record = approved.entities.find(item => item.id === id);
        const revoked = run(approved, 'handoff-revoke', id, 'actor-0', {reason: 'New field defect requires reopening this contract.'});
        expect(revoked.entities.find(item => item.id === id)?.fields).toMatchObject({approval: record?.fields['approval'], evidence: record?.fields['evidence']});
        expect(revoked.entities.find(item => item.id === 'contract-1')?.status).toBe('active');
        expect(request(revoked).entities.filter(item => item.kind === 'handoff')).toHaveLength(2);
    });
    it('rejects missing field evidence and unresolved RFIs without mutation', () => {
        const issued = run(fresh(product), 'issue', 'drawing-1', 'actor-1');
        expect(() => request(issued)).toThrow('passed field inspection');
        const withRfi = run(ready(), 'rfi-open', 'drawing-1', 'actor-2', {question: 'Please clarify the structural connection.'});
        expect(() => request(withRfi)).toThrow('all RFI');
    });
    it('rejects changed evidence then permits cancellation and a fresh request', () => {
        const requested = request(); const id = handoff(requested);
        const changed = run(requested, 'price', 'change-1', 'actor-3');
        expect(() => run(changed, 'handoff-approve', id, 'actor-0')).toThrow('evidence changed');
        const cancelled = run(changed, 'handoff-cancel', id, 'actor-2');
        const renewed = request(cancelled);
        expect(run(renewed, 'handoff-approve', handoff(renewed), 'actor-0').entities.find(item => item.id === 'contract-1')?.status).toBe('closed');
    });
    it('enforces authority and freezes evidence until revocation', () => {
        const requested = request(); const id = handoff(requested);
        expect(() => run(requested, 'handoff-approve', id, 'actor-2')).toThrow('role');
        expect(() => run(requested, 'handoff-cancel', id, 'actor-1')).toThrow('requester');
        const approved = run(requested, 'handoff-approve', id, 'actor-0');
        const before = structuredClone(approved);
        expect(() => run(approved, 'price', 'change-1', 'actor-3')).toThrow('Revoke handoff');
        expect(approved).toEqual(before);
    });
});
