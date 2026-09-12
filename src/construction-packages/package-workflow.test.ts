import { describe, expect, it } from 'vitest';
import { product } from '../product/definition';
import { execute, fresh } from '../workspace/engine';
import type { Snapshot, Value } from '../workspace/types';

const now = '2026-09-13T12:00:00Z';
function act(state: Snapshot, operation: string, entityId: string, actorId: string, input: Record<string, Value> = {}) {
    return execute(state, { id: 'phase3-' + String(state.revision), expectedRevision: state.revision, actorId,
        type: 'operate', entityId, operation, input }, product, now);
}
function releasedSubmittal() {
    let state = act(fresh(product), 'issue', 'drawing-1', 'actor-1');
    state = act(state, 'submittal-open', 'drawing-1', 'actor-2', { note: 'Coordinated structural material and installation evidence.' });
    const id = 'phase3-1-1';
    state = act(state, 'submittal-submit', id, 'actor-2');
    state = act(state, 'submittal-review', id, 'actor-1', { note: 'Evidence meets the current issued structural requirements.' });
    return { state: act(state, 'submittal-release', id, 'actor-0'), submittalId: id };
}
function releasedPackage() {
    const prepared = releasedSubmittal();
    let state = act(prepared.state, 'package-open', 'contract-1', 'actor-3', { scope: 'Structural slab material and installation release package.', dependencies: prepared.submittalId });
    const packageId = 'phase3-5-1';
    state = act(state, 'package-submit', packageId, 'actor-3');
    state = act(state, 'package-approve', packageId, 'actor-1', { review: 'Package dependencies satisfy architectural coordination requirements.' });
    return { state: act(state, 'package-release', packageId, 'actor-0'), packageId };
}

describe('construction submittal packages', () => {
    it('pins released submittals and completes after independent inspection', () => {
        const prepared = releasedPackage();
        let state = act(prepared.state, 'package-inspection-schedule', prepared.packageId, 'actor-2', { scheduledOn: '2026-09-20' });
        const inspectionId = 'phase3-9-1';
        state = act(state, 'package-inspection-ready', inspectionId, 'actor-2', { readiness: 'Installed work and signed field checklist are available.' });
        state = act(state, 'package-inspection-complete', inspectionId, 'actor-1', { result: 'passed', note: 'Field work matches the released coordinated package evidence.' });
        state = act(state, 'package-complete', prepared.packageId, 'actor-0');
        expect(state.entities.find(item => item.id === prepared.packageId)?.status).toBe('completed');
        expect(state.audit.slice(-4).map(event => event.action)).toEqual(['package-inspection-schedule', 'package-inspection-ready', 'package-inspection-complete', 'package-complete']);
    });
    it('blocks submission when a dependency is no longer released', () => {
        const prepared = releasedSubmittal();
        const opened = act(prepared.state, 'package-open', 'contract-1', 'actor-3', { scope: 'Structural slab material and installation release package.', dependencies: prepared.submittalId });
        opened.entities.find(item => item.id === prepared.submittalId)!.status = 'withdrawn';
        expect(() => act(opened, 'package-submit', 'phase3-5-1', 'actor-3')).toThrow(/Release every dependency/);
    });
    it('blocks completion after failed inspection and supports readiness retry', () => {
        const prepared = releasedPackage();
        let state = act(prepared.state, 'package-inspection-schedule', prepared.packageId, 'actor-2', { scheduledOn: '2026-09-20' });
        const inspectionId = 'phase3-9-1';
        state = act(state, 'package-inspection-ready', inspectionId, 'actor-2', { readiness: 'Installed work and signed field checklist are available.' });
        state = act(state, 'package-inspection-complete', inspectionId, 'actor-1', { result: 'failed', note: 'Anchor alignment differs from the coordinated release package.' });
        expect(() => act(state, 'package-complete', prepared.packageId, 'actor-0')).toThrow(/must pass/);
        expect(act(state, 'package-inspection-ready', inspectionId, 'actor-2', { readiness: 'Anchor alignment was corrected and independently measured.' }).entities.find(item => item.id === inspectionId)?.status).toBe('ready');
    });
    it('rejects stale commands without partially creating a package', () => {
        const prepared = releasedSubmittal(), before = structuredClone(prepared.state);
        expect(() => execute(prepared.state, { id: 'stale', expectedRevision: 0, actorId: 'actor-3', type: 'operate',
            entityId: 'contract-1', operation: 'package-open', input: { scope: 'Structural slab material and installation release package.', dependencies: prepared.submittalId } }, product, now)).toThrow(/workspace changed/);
        expect(prepared.state).toEqual(before);
    });
});
