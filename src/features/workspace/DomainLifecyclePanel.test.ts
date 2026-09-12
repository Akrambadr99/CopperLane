import { describe, expect, it } from 'vitest';
import type { Entity } from '../../workspace/types';
import { rfiAnswerGate } from './DomainLifecyclePanel';
import { product } from '../../product/definition';
import { execute, fresh } from '../../workspace/engine';
import type { Snapshot, Value } from '../../workspace/types';
import { Repository } from '../../workspace/repository';

const at = '2026-09-12T12:00:00Z';
function action(state: Snapshot, id: string, actorId: string, entityId: string, operation: string, input: Record<string, Value> = {}) {
    return execute(state, { id, actorId, entityId, operation, input, type: 'operate', expectedRevision: state.revision }, product, at);
}
function submittedRfi() {
    let state = action(fresh(product), 'issue-d', 'actor-1', 'drawing-1', 'issue');
    state = action(state, 'open-r', 'actor-2', 'drawing-1', 'rfi-open', { question: 'Confirm the structural slab connection.' });
    return action(state, 'submit-r', 'actor-2', 'open-r-1', 'rfi-submit');
}
describe('durable RFI execution', () => {
    it('rejects, revises, resubmits, approves and issues while retaining decisions', () => {
        let state = submittedRfi();
        state = action(state, 'reject-r', 'actor-1', 'open-r-1', 'rfi-reject', { reason: 'Please clarify the proposed connection.' });
        state = action(state, 'revise-r', 'actor-2', 'open-r-1', 'rfi-revise', { drawing: 'drawing-1', question: 'Confirm detail four for the slab connection.' });
        state = action(state, 'resubmit-r', 'actor-2', 'open-r-1', 'rfi-submit');
        state = action(state, 'approve-r', 'actor-1', 'open-r-1', 'rfi-approve', { response: 'Use detail four on the issued slab plan.' });
        state = action(state, 'issue-r', 'actor-1', 'open-r-1', 'rfi-issue');
        expect(state.entities.find(item => item.id === 'open-r-1')?.status).toBe('issued');
        expect(state.audit.map(item => item.action)).toContain('rfi-reject');
        expect(state.audit.at(-1)?.summary).toContain('detail four');
        const storage = new Map<string, string>();
        const repository = new Repository(product, { getItem: key => storage.get(key) ?? null, setItem: (key, value) => { storage.set(key, value); } });
        storage.set(repository.key, JSON.stringify(state));
        expect(repository.read()).toEqual(state);
    });
    it('rejects stale pinned drawings and leaves the submitted state unchanged', () => {
        const state = submittedRfi();
        const drawing = state.entities.find(item => item.id === 'drawing-1');
        if (!drawing) throw new Error('Missing fixture');
        drawing.revision += 1;
        const before = structuredClone(state);
        expect(() => action(state, 'approve', 'actor-1', 'open-r-1', 'rfi-approve', { response: 'Use the revised structural connection.' })).toThrow('Drawing changed');
        expect(state).toEqual(before);
    });
    it('enforces author ownership and architect approval authority', () => {
        const state = submittedRfi();
        expect(() => action(state, 'approve', 'actor-2', 'open-r-1', 'rfi-approve', { response: 'Use the revised structural connection.' })).toThrow('role');
        const rejected = action(state, 'reject', 'actor-1', 'open-r-1', 'rfi-reject', { reason: 'Please revise the structural question.' });
        expect(() => action(rejected, 'revise', 'actor-3', 'open-r-1', 'rfi-revise', { drawing: 'drawing-1', question: 'Confirm the slab connection detail.' })).toThrow('submitting actor');
    });
    it('refuses a stale workspace command without writing to durable storage', () => {
        const state = submittedRfi();
        const repository = new Repository(product, { getItem: () => JSON.stringify(state), setItem: () => { throw new Error('Unexpected write'); } });
        expect(() => repository.commit({ id: 'stale', actorId: 'actor-1', entityId: 'open-r-1', operation: 'rfi-approve', type: 'operate', input: { response: 'Use the revised structural connection.' }, expectedRevision: 0 }, at)).toThrow('workspace changed');
    });
});
const entity = (id: string, kind: string, status: string, fields: Entity['fields'] = {}): Entity => ({ id, kind, status, fields, title: id, revision: 1 });
describe('rfiAnswerGate', () => {
    it('requires issued drawing evidence and a specific response', () => expect(rfiAnswerGate(entity('d', 'drawing', 'draft'), [], 'short', true).blockers).toHaveLength(3));
    it('accepts an issued response with passed field evidence', () => expect(rfiAnswerGate(entity('d', 'drawing', 'issued'), [entity('i', 'inspection', 'passed', { drawing: 'd' })], 'Proceed to issued detail B.', true).ready).toBe(true));
});
