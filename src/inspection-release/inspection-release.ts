export type InspectionRole = 'Site Engineer' | 'Document Controller' | 'Quality Manager' | 'Site Inspector' | 'Design Reviewer' | 'Construction Manager';
export type PackageFilter = 'all' | 'ready' | 'blocked';
export interface WorkPackage {
  id: string;
  version: number;
  zone: string;
  drawingId: string;
  drawingRevision: number;
  concreteTestsPassed: boolean;
  predecessorComplete: boolean;
  status: 'awaiting-inspection' | 'inspection-booked' | 'passed' | 'released';
}
export interface InspectionReleaseState {
  revision: number;
  queueVersion: number;
  readinessFeedVersion: number;
  filter: PackageFilter;
  selectedIds: string[];
  packages: WorkPackage[];
  successorActivities: { packageId: string; status: 'blocked' | 'ready'; version: number }[];
  batch: null | {
    id: string;
    status: 'requested' | 'assigned' | 'inspected' | 'approved' | 'released';
    requester: string;
    inspector: string | null;
    reviewer: string | null;
    packageIds: string[];
    expectedVersions: Record<string, number>;
    readinessFeedVersion: number;
  };
  evidence: { id: string; kind: 'readiness' | 'inspection' | 'design-review' | 'release'; reference: string; immutable: true }[];
  events: { id: string; action: string; actor: string; immutable: true }[];
}

export const initialInspectionReleaseState: InspectionReleaseState = {
  revision: 0,
  queueVersion: 21,
  readinessFeedVersion: 8,
  filter: 'all',
  selectedIds: [],
  packages: [
    { id: 'PKG-SLAB-41', version: 5, zone: 'LEVEL-04', drawingId: 'S-441', drawingRevision: 9, concreteTestsPassed: true, predecessorComplete: true, status: 'awaiting-inspection' },
    { id: 'PKG-SLAB-42', version: 7, zone: 'LEVEL-04', drawingId: 'S-441', drawingRevision: 9, concreteTestsPassed: true, predecessorComplete: true, status: 'awaiting-inspection' },
    { id: 'PKG-WALL-43', version: 3, zone: 'LEVEL-05', drawingId: 'S-510', drawingRevision: 4, concreteTestsPassed: false, predecessorComplete: true, status: 'awaiting-inspection' },
  ],
  successorActivities: [
    { packageId: 'PKG-SLAB-41', status: 'blocked', version: 2 },
    { packageId: 'PKG-SLAB-42', status: 'blocked', version: 4 },
    { packageId: 'PKG-WALL-43', status: 'blocked', version: 1 },
  ],
  batch: null,
  evidence: [],
  events: [],
};

interface Meta { id: string; expectedRevision: number; actor: { id: string; role: InspectionRole } }
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
function begin(state: InspectionReleaseState, command: Meta) {
  assert(state.revision === command.expectedRevision, 'Inspection queue changed. Refresh before retrying.');
  assert(!state.events.some((event) => event.id === command.id), 'Inspection command already applied.');
  return structuredClone(state);
}
function finish(state: InspectionReleaseState, command: Meta, action: string) {
  state.revision += 1;
  state.queueVersion += 1;
  state.events.push({ id: command.id, action, actor: command.actor.id, immutable: true });
  return state;
}
export function visiblePackages(state: InspectionReleaseState) {
  if (state.filter === 'ready') return state.packages.filter((item) => item.predecessorComplete && item.concreteTestsPassed && item.status === 'awaiting-inspection');
  if (state.filter === 'blocked') return state.packages.filter((item) => !item.predecessorComplete || !item.concreteTestsPassed);
  return state.packages;
}
export function changePackageFilter(state: InspectionReleaseState, command: Meta & { filter: PackageFilter }) {
  const next = begin(state, command);
  next.filter = command.filter;
  const visible = new Set(visiblePackages(next).map((item) => item.id));
  next.selectedIds = next.selectedIds.filter((id) => visible.has(id));
  return finish(next, command, 'inspection-filter-changed');
}
export function togglePackageSelection(state: InspectionReleaseState, command: Meta & { packageId: string }) {
  assert(command.actor.role === 'Site Engineer', 'Only site engineers can select work packages.');
  const next = begin(state, command);
  assert(visiblePackages(next).some((item) => item.id === command.packageId), 'Only visible work packages can be selected.');
  next.selectedIds = next.selectedIds.includes(command.packageId) ? next.selectedIds.filter((id) => id !== command.packageId) : [...next.selectedIds, command.packageId];
  return finish(next, command, 'inspection-package-selection-changed');
}
export function applyReadinessRefresh(state: InspectionReleaseState, command: Meta & { capturedQueueVersion: number; responseVersion: number; packageVersions: Record<string, number> }) {
  assert(command.actor.role === 'Document Controller', 'Only document controllers can refresh readiness evidence.');
  const next = begin(state, command);
  assert(command.capturedQueueVersion === state.queueVersion, 'Inspection queue changed while readiness evidence was loading. Retry refresh.');
  assert(command.responseVersion > next.readinessFeedVersion, 'Stale readiness response ignored.');
  for (const item of next.packages) assert(command.packageVersions[item.id] === item.version, `Package ${item.id} changed before readiness refresh.`);
  next.readinessFeedVersion = command.responseVersion;
  next.evidence.push({ id: `${command.id}-readiness`, kind: 'readiness', reference: `feed-${String(command.responseVersion)}`, immutable: true });
  return finish(next, command, 'inspection-readiness-refreshed');
}
export function requestJointInspection(state: InspectionReleaseState, command: Meta & { expectedVersions: Record<string, number> }) {
  assert(command.actor.role === 'Site Engineer', 'Only site engineers can request joint inspections.');
  const next = begin(state, command);
  assert(!next.batch && next.readinessFeedVersion === 9, 'Fresh readiness evidence without an active inspection is required.');
  assert(next.selectedIds.length === 2, 'Select exactly two work packages.');
  const packages = next.selectedIds.map((id) => next.packages.find((item) => item.id === id));
  assert(packages.every((item) => item), 'A selected work package no longer exists.');
  const selected = packages as WorkPackage[];
  const primary = selected[0];
  assert(primary, 'A primary work package is required.');
  assert(selected.every((item) => item.status === 'awaiting-inspection' && item.predecessorComplete && item.concreteTestsPassed), 'Every package must pass readiness prerequisites.');
  assert(selected.every((item) => item.zone === primary.zone && item.drawingId === primary.drawingId && item.drawingRevision === primary.drawingRevision), 'Joint inspection packages must share a current zone and drawing revision.');
  for (const item of selected) assert(command.expectedVersions[item.id] === item.version, `Package ${item.id} changed before inspection request.`);
  for (const item of selected) { item.status = 'inspection-booked'; item.version += 1; }
  next.batch = { id: 'INSPECTION-L04-41', status: 'requested', requester: command.actor.id, inspector: null, reviewer: null, packageIds: next.selectedIds, expectedVersions: Object.fromEntries(selected.map((item) => [item.id, item.version])), readinessFeedVersion: next.readinessFeedVersion };
  return finish(next, command, 'joint-inspection-requested');
}
export function assignJointInspector(state: InspectionReleaseState, command: Meta & { inspectorId: string }) {
  assert(command.actor.role === 'Quality Manager', 'Only quality managers can assign inspectors.');
  const next = begin(state, command);
  assert(next.batch?.status === 'requested', 'A requested joint inspection is required.');
  assert(command.inspectorId !== next.batch.requester, 'Inspection ownership must remain independent from the requester.');
  next.batch.inspector = command.inspectorId;
  next.batch.status = 'assigned';
  return finish(next, command, 'joint-inspector-assigned');
}
export function recordJointInspection(state: InspectionReleaseState, command: Meta) {
  assert(command.actor.role === 'Site Inspector', 'Only site inspectors can record joint inspections.');
  const next = begin(state, command);
  assert(next.batch?.status === 'assigned' && next.batch.inspector === command.actor.id, 'The assigned inspector must record the inspection.');
  for (const id of next.batch.packageIds) {
    const item = next.packages.find((candidate) => candidate.id === id);
    assert(item, `Package ${id} no longer exists.`);
    assert(item.version === next.batch.expectedVersions[id] && item.status === 'inspection-booked', `Package ${id} became stale before inspection.`);
    item.status = 'passed';
    item.version += 1;
    next.batch.expectedVersions[id] = item.version;
  }
  next.batch.status = 'inspected';
  next.evidence.push({ id: `${command.id}-inspection`, kind: 'inspection', reference: next.batch.packageIds.join(','), immutable: true });
  return finish(next, command, 'joint-inspection-recorded');
}
export function approveInspectionRelease(state: InspectionReleaseState, command: Meta) {
  assert(command.actor.role === 'Design Reviewer', 'Only design reviewers can approve inspection release.');
  const next = begin(state, command);
  assert(next.batch?.status === 'inspected' && next.batch.inspector !== command.actor.id, 'Independent design review of completed inspection is required.');
  assert(next.batch.readinessFeedVersion === next.readinessFeedVersion, 'Readiness evidence became stale before design review.');
  next.batch.reviewer = command.actor.id;
  next.batch.status = 'approved';
  next.evidence.push({ id: `${command.id}-design`, kind: 'design-review', reference: 'S-441 rev 9', immutable: true });
  return finish(next, command, 'inspection-release-approved');
}
export function releaseInspectedPackages(state: InspectionReleaseState, command: Meta) {
  assert(command.actor.role === 'Construction Manager', 'Only construction managers can release inspected packages.');
  const next = begin(state, command);
  assert(next.batch?.status === 'approved' && next.batch.reviewer, 'An independently approved inspection batch is required.');
  for (const id of next.batch.packageIds) {
    const item = next.packages.find((candidate) => candidate.id === id);
    const successor = next.successorActivities.find((candidate) => candidate.packageId === id);
    assert(item && successor, `Package ${id} dependencies are incomplete.`);
    assert(item.version === next.batch.expectedVersions[id] && item.status === 'passed', `Package ${id} became stale before release.`);
    item.status = 'released'; item.version += 1;
    successor.status = 'ready'; successor.version += 1;
  }
  next.batch.status = 'released';
  next.selectedIds = [];
  next.evidence.push({ id: `${command.id}-release`, kind: 'release', reference: next.batch.id, immutable: true });
  return finish(next, command, 'inspected-packages-released');
}
export class InspectionReleaseRepository {
  static key = 'buildledger:inspection-release:v1';
  private storage: Pick<Storage, 'getItem' | 'setItem'>;
  constructor(storage: Pick<Storage, 'getItem' | 'setItem'>) { this.storage = storage; }
  read() { const raw = this.storage.getItem(InspectionReleaseRepository.key); return raw ? JSON.parse(raw) as InspectionReleaseState : structuredClone(initialInspectionReleaseState); }
  commit(expectedRevision: number, operation: (state: InspectionReleaseState) => InspectionReleaseState) { const state = this.read(); assert(state.revision === expectedRevision, 'Another session changed inspection release. Refresh before retrying.'); const next = operation(state); this.storage.setItem(InspectionReleaseRepository.key, JSON.stringify(next)); return next; }
}
