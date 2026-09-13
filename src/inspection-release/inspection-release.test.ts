import { describe, expect, it } from 'vitest';
import { applyReadinessRefresh, approveInspectionRelease, assignJointInspector, changePackageFilter, initialInspectionReleaseState, recordJointInspection, releaseInspectedPackages, requestJointInspection, togglePackageSelection, type InspectionReleaseState, type InspectionRole } from './inspection-release';
const meta = (id: string, revision: number, actor: string, role: InspectionRole) => ({ id, expectedRevision: revision, actor: { id: actor, role } });
function selected() {
  let state = changePackageFilter(initialInspectionReleaseState, { ...meta('filter', 0, 'engineer-a', 'Site Engineer'), filter: 'ready' });
  state = togglePackageSelection(state, { ...meta('one', 1, 'engineer-a', 'Site Engineer'), packageId: 'PKG-SLAB-41' });
  return togglePackageSelection(state, { ...meta('two', 2, 'engineer-a', 'Site Engineer'), packageId: 'PKG-SLAB-42' });
}
function inspected() {
  let state = selected();
  state = applyReadinessRefresh(state, { ...meta('refresh', 3, 'documents-a', 'Document Controller'), capturedQueueVersion: state.queueVersion, responseVersion: 9, packageVersions: { 'PKG-SLAB-41': 5, 'PKG-SLAB-42': 7, 'PKG-WALL-43': 3 } });
  state = requestJointInspection(state, { ...meta('request', 4, 'engineer-a', 'Site Engineer'), expectedVersions: { 'PKG-SLAB-41': 5, 'PKG-SLAB-42': 7 } });
  state = assignJointInspector(state, { ...meta('assign', 5, 'quality-a', 'Quality Manager'), inspectorId: 'inspector-a' });
  return recordJointInspection(state, meta('inspect', 6, 'inspector-a', 'Site Inspector'));
}
describe('inspection release', () => {
  it('releases two inspected packages and unblocks both successor activities', () => {
    let state = inspected();
    state = approveInspectionRelease(state, meta('approve', 7, 'design-a', 'Design Reviewer'));
    state = releaseInspectedPackages(state, meta('release', 8, 'construction-a', 'Construction Manager'));
    expect(state.batch?.status).toBe('released');
    expect(state.packages.slice(0, 2).every((item) => item.status === 'released')).toBe(true);
    expect(state.successorActivities.slice(0, 2).every((item) => item.status === 'ready')).toBe(true);
    expect(state.evidence).toHaveLength(4);
  });
  it('rejects readiness evidence captured before a queue change', () => {
    const state = selected();
    expect(() => applyReadinessRefresh(state, { ...meta('refresh', 3, 'documents-a', 'Document Controller'), capturedQueueVersion: state.queueVersion - 1, responseVersion: 9, packageVersions: { 'PKG-SLAB-41': 5, 'PKG-SLAB-42': 7, 'PKG-WALL-43': 3 } })).toThrow('changed while readiness evidence was loading');
  });
  it('blocks design approval after readiness becomes stale', () => {
    const stale: InspectionReleaseState = inspected();
    stale.readinessFeedVersion += 1;
    expect(() => approveInspectionRelease(stale, meta('approve', 7, 'design-a', 'Design Reviewer'))).toThrow('Readiness evidence became stale');
  });
});
