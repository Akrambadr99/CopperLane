export type PourRole = 'Site Engineer' | 'Quality Inspector' | 'Design Reviewer' | 'Construction Manager' | 'Laboratory Technician';
export interface PourState {
  revision: number;
  element: { id: string; drawingRevision: number; volumeM3: number; status: 'planned' | 'released' | 'poured' | 'accepted' | 'held'; version: number };
  batch: { id: string; mix: string; availableM3: number; certificateVersion: number; status: 'available' | 'allocated' | 'consumed' };
  permit: null | { id: string; status: 'draft' | 'inspected' | 'design-cleared' | 'released' | 'poured' | 'accepted'; elementVersion: number; drawingRevision: number; batchCertificateVersion: number; owner: string; inspector?: string; designer?: string; manager?: string; cubeStrength?: number };
  evidence: { id: string; kind: string; detail: string; immutable: true }[];
  events: { id: string; action: string; actor: string; detail: string }[];
}
export const initialPourState: PourState = { revision: 0, element: { id: 'SLAB-L04-ZB', drawingRevision: 12, volumeM3: 85, status: 'planned', version: 7 }, batch: { id: 'BATCH-C40-91', mix: 'C40/50', availableM3: 100, certificateVersion: 5, status: 'available' }, permit: null, evidence: [], events: [] };
interface Meta { id: string; expectedRevision: number; actor: { id: string; role: PourRole } }
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
function begin(state: PourState, command: Meta) { assert(state.revision === command.expectedRevision, 'Pour permit changed. Refresh before retrying.'); assert(!state.events.some((event) => event.id === command.id), 'Command already applied.'); return structuredClone(state); }
function finish(state: PourState, command: Meta, action: string, detail: string) { state.revision += 1; state.events.push({ id: command.id, action, actor: command.actor.id, detail }); return state; }
function currentPermit(state: PourState) { assert(state.permit, 'No permit to pour exists.'); return state.permit; }
function assertCurrent(state: PourState) { const permit = currentPermit(state); assert(permit.elementVersion === state.element.version, 'Structural element changed after permit drafting.'); assert(permit.drawingRevision === state.element.drawingRevision, 'Issued drawing changed after permit drafting.'); assert(permit.batchCertificateVersion === state.batch.certificateVersion, 'Concrete certificate changed after permit drafting.'); }

export function draftPourPermit(state: PourState, command: Meta) {
  assert(command.actor.role === 'Site Engineer', 'Only site engineers can draft pour permits.');
  const next = begin(state, command);
  assert(!next.permit && next.element.status === 'planned', 'Planned structural element without a permit is required.');
  assert(next.batch.status === 'available' && next.batch.availableM3 >= next.element.volumeM3, 'Concrete batch cannot cover the planned volume.');
  next.permit = { id: `${command.id}-permit`, status: 'draft', elementVersion: next.element.version, drawingRevision: next.element.drawingRevision, batchCertificateVersion: next.batch.certificateVersion, owner: command.actor.id };
  return finish(next, command, 'pour-permit-drafted', next.element.id);
}

export function recordPrePourInspection(state: PourState, command: Meta & { reinforcementPassed: boolean; embedmentsPassed: boolean }) {
  assert(command.actor.role === 'Quality Inspector', 'Only quality inspectors can record pre-pour inspections.');
  const next = begin(state, command), permit = currentPermit(next);
  assert(permit.status === 'draft' && command.actor.id !== permit.owner, 'Independent pre-pour inspection is required.');
  assertCurrent(next);
  assert(command.reinforcementPassed && command.embedmentsPassed, 'Reinforcement and embedment checks must pass.');
  permit.status = 'inspected'; permit.inspector = command.actor.id;
  next.evidence.push({ id: `${command.id}-inspection`, kind: 'pre-pour-inspection', detail: 'reinforcement:pass;embedments:pass', immutable: true });
  return finish(next, command, 'pre-pour-inspection-passed', permit.id);
}

export function clearDesignRevision(state: PourState, command: Meta) {
  assert(command.actor.role === 'Design Reviewer', 'Only design reviewers can clear drawings.');
  const next = begin(state, command), permit = currentPermit(next);
  assert(permit.status === 'inspected', 'Passing pre-pour inspection is required.');
  assert(command.actor.id !== permit.owner && command.actor.id !== permit.inspector, 'Design clearance must be independent.');
  assertCurrent(next);
  permit.status = 'design-cleared'; permit.designer = command.actor.id;
  next.evidence.push({ id: `${command.id}-drawing`, kind: 'drawing-clearance', detail: `revision:${String(permit.drawingRevision)}`, immutable: true });
  return finish(next, command, 'pour-drawing-cleared', String(permit.drawingRevision));
}

export function releasePour(state: PourState, command: Meta) {
  assert(command.actor.role === 'Construction Manager', 'Only construction managers can release pours.');
  const next = begin(state, command), permit = currentPermit(next);
  assert(permit.status === 'design-cleared', 'Design-cleared permit is required.');
  assert(command.actor.id !== permit.owner && command.actor.id !== permit.inspector && command.actor.id !== permit.designer, 'Pour release must be independent.');
  assertCurrent(next);
  next.batch.status = 'allocated'; next.element.status = 'released'; next.element.version += 1; permit.elementVersion = next.element.version; permit.status = 'released'; permit.manager = command.actor.id;
  return finish(next, command, 'pour-released', next.batch.id);
}

export function recordPour(state: PourState, command: Meta & { placedM3: number }) {
  assert(command.actor.role === 'Site Engineer', 'Only site engineers can record concrete placement.');
  const next = begin(state, command), permit = currentPermit(next);
  assert(permit.status === 'released' && next.batch.status === 'allocated', 'Released permit and allocated batch are required.');
  assertCurrent(next);
  assert(command.placedM3 >= next.element.volumeM3 * 0.98 && command.placedM3 <= next.batch.availableM3, 'Placed concrete volume is outside tolerance.');
  next.batch.availableM3 -= command.placedM3; next.batch.status = 'consumed'; next.element.status = 'poured'; next.element.version += 1; permit.elementVersion = next.element.version; permit.status = 'poured';
  next.evidence.push({ id: `${command.id}-placement`, kind: 'placement-record', detail: `${String(command.placedM3)}m3`, immutable: true });
  return finish(next, command, 'concrete-pour-recorded', String(command.placedM3));
}

export function acceptCubeResult(state: PourState, command: Meta & { strengthMpa: number }) {
  assert(command.actor.role === 'Laboratory Technician', 'Only laboratory technicians can record cube results.');
  const next = begin(state, command), permit = currentPermit(next);
  assert(permit.status === 'poured' && next.element.status === 'poured', 'Recorded concrete pour is required.');
  assert(command.strengthMpa >= 40, 'Cube strength is below the specified concrete grade.');
  permit.cubeStrength = command.strengthMpa; permit.status = 'accepted'; next.element.status = 'accepted'; next.element.version += 1; permit.elementVersion = next.element.version;
  next.evidence.push({ id: `${command.id}-cube`, kind: 'cube-result', detail: `${String(command.strengthMpa)}MPa`, immutable: true });
  return finish(next, command, 'structural-element-accepted', next.element.id);
}

export class PourRepository { static key = 'buildledger:permit-to-pour:v1'; private storage: Pick<Storage, 'getItem' | 'setItem'>; constructor(storage: Pick<Storage, 'getItem' | 'setItem'>) { this.storage = storage; } read() { const raw = this.storage.getItem(PourRepository.key); return raw ? JSON.parse(raw) as PourState : structuredClone(initialPourState); } commit(expectedRevision: number, operation: (state: PourState) => PourState) { const current = this.read(); assert(current.revision === expectedRevision, 'Another session changed the pour permit. Refresh before retrying.'); const next = operation(current); this.storage.setItem(PourRepository.key, JSON.stringify(next)); return next; } }
