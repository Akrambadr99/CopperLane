import { describe, expect, it } from 'vitest';
import { product } from '../product/definition';
import { execute, fresh } from '../workspace/engine';
import type { Snapshot, Value } from '../workspace/types';

const at = '2026-09-12T12:00:00Z';
function act(state: Snapshot, operation: string, entityId: string, actorId: string, input: Record<string, Value> = {}) {
    return execute(state, { id: 'command-' + String(state.revision), expectedRevision: state.revision,
        type: 'operate', operation, entityId, actorId, input }, product, at);
}
function draft() {
    const issued = act(fresh(product), 'issue', 'drawing-1', 'actor-1');
    return act(issued, 'submittal-open', 'drawing-1', 'actor-2', { note: 'Product evidence for the station slab connection.' });
}
const id = 'command-1-1';
describe('executable construction submittals', () => {
    it('pins drawing evidence and releases after independent sequential review', () => {
        const original = draft();
        const submitted = act(original, 'submittal-submit', id, 'actor-2');
        const reviewed = act(submitted, 'submittal-review', id, 'actor-1', { note: 'The supplied evidence satisfies the issued detail.' });
        const released = act(reviewed, 'submittal-release', id, 'actor-0');
        expect(released.entities.find(item => item.id === id)?.status).toBe('released');
        expect(original.entities.find(item => item.id === id)?.status).toBe('draft');
        expect(released.audit.slice(-3).map(item => item.action)).toEqual(['submittal-submit', 'submittal-review', 'submittal-release']);
    });
    it('rejects another submitter and premature release without changing state', () => {
        const state = draft(); const before = JSON.stringify(state);
        expect(() => act(state, 'submittal-submit', id, 'actor-3')).toThrow(/submitting actor/);
        expect(() => act(state, 'submittal-release', id, 'actor-0')).toThrow(/current state/);
        expect(JSON.stringify(state)).toBe(before);
    });
    it('retains a rejection in audit after revision and resubmission', () => {
        let state = act(draft(), 'submittal-submit', id, 'actor-2');
        state = act(state, 'submittal-reject', id, 'actor-1', { note: 'Provide the missing material certification evidence.' });
        state = act(state, 'submittal-revise', id, 'actor-2', { drawing: 'drawing-1', note: 'Material certification is now included with the package.' });
        state = act(state, 'submittal-submit', id, 'actor-2');
        expect(state.audit.some(event => event.summary.includes('missing material'))).toBe(true);
        expect(state.entities.find(item => item.id === id)?.fields['review']).toBe('');
    });
    it('requires repinning stale drawing evidence before submission', () => {
        const state = draft();
        state.entities.find(item => item.id === 'drawing-1')!.revision++;
        expect(() => act(state, 'submittal-submit', id, 'actor-2')).toThrow(/Drawing changed/);
        const revised = act(state, 'submittal-revise', id, 'actor-2', { drawing: 'drawing-1', note: 'Rechecked evidence against the latest drawing version.' });
        expect(act(revised, 'submittal-submit', id, 'actor-2').entities.find(item => item.id === id)?.status).toBe('submitted');
    });
    it('blocks handoff for unresolved submittals and allows withdrawal', () => {
        const state = draft();
        expect(() => act(state, 'handoff-request', 'contract-1', 'actor-2', { note: 'Ready to request practical completion handoff.' })).toThrow(/outstanding submittals/);
        const withdrawn = act(state, 'submittal-withdraw', id, 'actor-2', { note: 'The proposed material package is no longer required.' });
        expect(withdrawn.entities.find(item => item.id === id)?.status).toBe('withdrawn');
        expect(() => act(withdrawn, 'submittal-submit', id, 'actor-2')).toThrow(/current state/);
    });
    it('rejects stale workspace commands atomically', () => {
        const state = draft();
        expect(() => execute(state, { id: 'stale', expectedRevision: 0, actorId: 'actor-2', type: 'operate',
            operation: 'submittal-submit', entityId: id, input: {} }, product, at)).toThrow(/workspace changed/);
    });
});
