import { describe, expect, it } from 'vitest';
import { execute, fresh } from '../workspace/engine';
import type { Command, Snapshot, Value } from '../workspace/types';
import { product } from '../product/definition';

const at = '2026-09-13T10:00:00.000Z';
function run(state: Snapshot, id: string, actorId: string, entityId: string, operation: string, input: Record<string, Value> = {}) {
    const command: Command = { id, expectedRevision: state.revision, actorId, type: 'operate', entityId, operation, input };
    return execute(state, command, product, at);
}
function issuedDrawing() {
    return run(fresh(product), 'issue-drawing', 'actor-1', 'drawing-1', 'issue');
}

describe('construction closeout workflows', () => {
    it('opens a dated punch item against an issued drawing', () => {
        const state = run(issuedDrawing(), 'punch-open', 'actor-2', 'drawing-1', 'punch-open', {
            description: 'Anchor bolts do not match the issued slab detail.', due: '2026-09-20',
        });
        const punch = state.entities.find(item => item.kind === 'punch');
        expect(punch).toMatchObject({ status: 'open', fields: { drawing: 'drawing-1', owner: 'actor-2' } });
    });

    it('requires independent punch verification and retains resolution evidence', () => {
        let state = run(issuedDrawing(), 'punch-open', 'actor-2', 'drawing-1', 'punch-open', {
            description: 'Anchor bolts do not match the issued slab detail.', due: '2026-09-20',
        });
        const punch = state.entities.find(item => item.kind === 'punch')!;
        state = run(state, 'resolve', 'actor-2', punch.id, 'punch-resolve', { evidence: 'Bolts replaced and torque report attached.' });
        expect(() => run(state, 'self-verify', 'actor-2', punch.id, 'punch-verify', { verification: 'Correction inspected against current detail.' })).toThrow('cannot verify');
        state = run(state, 'verify', 'actor-2', punch.id, 'punch-reopen', { reason: 'Torque values require another correction cycle.' });
        expect(state.entities.find(item => item.id === punch.id)?.status).toBe('reopened');
    });

    it('allows a cost controller submission to be independently verified by the inspector', () => {
        let state = run(issuedDrawing(), 'punch-open', 'actor-2', 'drawing-1', 'punch-open', {
            description: 'Anchor bolts do not match the issued slab detail.', due: '2026-09-20',
        });
        const punch = state.entities.find(item => item.kind === 'punch')!;
        state = run(state, 'resolve', 'actor-3', punch.id, 'punch-resolve', { evidence: 'Contractor replaced bolts and uploaded signed evidence.' });
        state = run(state, 'verify', 'actor-2', punch.id, 'punch-verify', { verification: 'Site inspection confirms correction is complete.' });
        expect(state.entities.find(item => item.id === punch.id)).toMatchObject({ status: 'verified', fields: { verifiedBy: 'actor-2' } });
    });

    it('enforces maker-checker approval and completion for contractor commitments', () => {
        let state = run(fresh(product), 'create-commitment', 'actor-3', 'contract-1', 'commitment-create', {
            description: 'Deliver complete commissioning manuals before handoff.', due: '2026-10-01', owner: 'Commissioning contractor',
        });
        const commitment = state.entities.find(item => item.kind === 'commitment')!;
        state = run(state, 'submit-commitment', 'actor-3', commitment.id, 'commitment-submit');
        expect(() => run(state, 'self-approve', 'actor-3', commitment.id, 'commitment-approve')).toThrow('cannot perform');
        state = run(state, 'approve-commitment', 'actor-0', commitment.id, 'commitment-approve');
        state = run(state, 'complete-commitment', 'actor-3', commitment.id, 'commitment-complete', {
            completion: 'Signed commissioning manuals were received and indexed.',
        });
        expect(state.entities.find(item => item.id === commitment.id)?.status).toBe('completed');
    });

    it('blocks handoff while closeout obligations remain open', () => {
        const state = run(issuedDrawing(), 'create-commitment', 'actor-3', 'contract-1', 'commitment-create', {
            description: 'Deliver complete commissioning manuals before handoff.', due: '2026-10-01', owner: 'Commissioning contractor',
        });
        expect(() => run(state, 'handoff', 'actor-2', 'contract-1', 'handoff-request', {
            note: 'Request handoff after checking all available evidence.',
        })).toThrow('Complete or cancel every contractor commitment');
    });

    it('registers one active warranty and executes its claim lifecycle', () => {
        const state = fresh(product);
        state.entities.find(item => item.id === 'contract-1')!.status = 'closed';
        let next = run(state, 'register-warranty', 'actor-0', 'contract-1', 'warranty-register', {
            asset: 'Central station waterproofing installation', expires: '2028-09-13', provider: 'Northstar Envelope Contractors Ltd',
        });
        const warranty = next.entities.find(item => item.kind === 'warranty')!;
        expect(() => run(next, 'duplicate', 'actor-3', 'contract-1', 'warranty-register', {
            asset: 'Central station waterproofing installation', expires: '2028-09-13', provider: 'Northstar Envelope Contractors Ltd',
        })).toThrow('already covers');
        next = run(next, 'claim', 'actor-2', warranty.id, 'warranty-claim', { claim: 'Water ingress observed along the eastern construction joint.' });
        next = run(next, 'remediate', 'actor-3', warranty.id, 'warranty-remediate', { resolution: 'Provider resealed the joint and completed flood testing.' });
        expect(next.entities.find(item => item.id === warranty.id)?.status).toBe('remediated');
    });
});
