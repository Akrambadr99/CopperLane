export type MaterialTraceRole = 'Package Engineer' | 'Design Reviewer' | 'Procurement Manager' | 'Site Inspector' | 'Site Engineer' | 'Quality Manager';
export interface MaterialTraceState {
  revision: number;
  specification: { id: string; version: number; requiredGrade: string; approvedProduct: string | null };
  package: { id: string; version: number; status: 'planned' | 'procured' | 'delivered' | 'installed' | 'verified'; installedLocation: string | null };
  submittal: null | { id: string; status: 'drafted' | 'approved' | 'ordered' | 'delivered' | 'installed' | 'verified'; product: string; grade: string; manufacturerCertificate: string; author: string; reviewer: string | null; specificationVersion: number; packageVersion: number; orderVersion: number; deliveryVersion: number };
  order: { id: string; version: number; status: 'blocked' | 'released' | 'received'; orderedQuantity: number };
  delivery: { id: string; version: number; status: 'expected' | 'accepted' | 'installed'; batch: string | null; acceptedQuantity: number };
  evidence: { id: string; kind: 'manufacturer-certificate' | 'design-approval' | 'delivery-inspection' | 'installation-record' | 'traceability-release'; reference: string; immutable: true }[];
  events: { id: string; action: string; actor: string; immutable: true }[];
}

export const initialMaterialTraceState: MaterialTraceState = {
  revision: 0,
  specification: { id: 'SPEC-03-21', version: 5, requiredGrade: 'B500B', approvedProduct: null },
  package: { id: 'REBAR-L04', version: 3, status: 'planned', installedLocation: null },
  submittal: null,
  order: { id: 'PO-441', version: 2, status: 'blocked', orderedQuantity: 24 },
  delivery: { id: 'DEL-441', version: 1, status: 'expected', batch: null, acceptedQuantity: 0 },
  evidence: [],
  events: [],
};

interface Meta { id: string; expectedRevision: number; actor: { id: string; role: MaterialTraceRole } }
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
function begin(state: MaterialTraceState, command: Meta) {
  assert(state.revision === command.expectedRevision, 'Material traceability changed. Refresh before retrying.');
  assert(!state.events.some((event) => event.id === command.id), 'Material command already applied.');
  return structuredClone(state);
}
function current(state: MaterialTraceState) { assert(state.submittal, 'No material submittal exists.'); return state.submittal; }
function assertCurrent(state: MaterialTraceState) {
  const submittal = current(state);
  assert(submittal.specificationVersion === state.specification.version, 'Specification changed after material submission.');
  assert(submittal.packageVersion === state.package.version, 'Construction package changed after material submission.');
  assert(submittal.orderVersion === state.order.version, 'Purchase order changed after material submission.');
  assert(submittal.deliveryVersion === state.delivery.version, 'Delivery record changed after material submission.');
}
function sync(state: MaterialTraceState) {
  const submittal = current(state);
  submittal.specificationVersion = state.specification.version;
  submittal.packageVersion = state.package.version;
  submittal.orderVersion = state.order.version;
  submittal.deliveryVersion = state.delivery.version;
}
function finish(state: MaterialTraceState, command: Meta, action: string) {
  state.revision += 1;
  state.events.push({ id: command.id, action, actor: command.actor.id, immutable: true });
  return state;
}

export function draftMaterialSubmittal(state: MaterialTraceState, command: Meta & { product: string; grade: string; certificate: string }) {
  assert(command.actor.role === 'Package Engineer', 'Only package engineers can draft material submittals.');
  const next = begin(state, command);
  assert(!next.submittal && next.package.status === 'planned', 'A planned package without a submittal is required.');
  assert(command.grade === next.specification.requiredGrade, 'Material grade does not satisfy the current specification.');
  assert(command.certificate === 'MTC-STEEL-778', 'A verified manufacturer certificate is required.');
  next.submittal = { id: 'SUB-441', status: 'drafted', product: command.product, grade: command.grade, manufacturerCertificate: command.certificate, author: command.actor.id, reviewer: null, specificationVersion: next.specification.version, packageVersion: next.package.version, orderVersion: next.order.version, deliveryVersion: next.delivery.version };
  next.evidence.push({ id: `${command.id}-certificate`, kind: 'manufacturer-certificate', reference: command.certificate, immutable: true });
  return finish(next, command, 'material-submittal-drafted');
}

export function approveMaterialSubmittal(state: MaterialTraceState, command: Meta) {
  assert(command.actor.role === 'Design Reviewer', 'Only design reviewers can approve material submittals.');
  const next = begin(state, command), submittal = current(next);
  assert(submittal.status === 'drafted', 'A drafted material submittal is required.');
  assert(command.actor.id !== submittal.author, 'Material approval must be independent of authorship.');
  assertCurrent(next);
  next.specification.approvedProduct = submittal.product;
  next.specification.version += 1;
  submittal.status = 'approved';
  submittal.reviewer = command.actor.id;
  next.evidence.push({ id: `${command.id}-approval`, kind: 'design-approval', reference: `${next.specification.id}:${submittal.product}`, immutable: true });
  sync(next);
  return finish(next, command, 'material-submittal-approved');
}

export function releaseMaterialPurchase(state: MaterialTraceState, command: Meta) {
  assert(command.actor.role === 'Procurement Manager', 'Only procurement managers can release material purchases.');
  const next = begin(state, command), submittal = current(next);
  assert(submittal.status === 'approved' && next.specification.approvedProduct === submittal.product, 'An approved current product is required.');
  assertCurrent(next);
  next.order.status = 'released';
  next.order.version += 1;
  next.package.status = 'procured';
  next.package.version += 1;
  submittal.status = 'ordered';
  sync(next);
  return finish(next, command, 'material-purchase-released');
}

export function inspectMaterialDelivery(state: MaterialTraceState, command: Meta & { batch: string; quantity: number; certificate: string }) {
  assert(command.actor.role === 'Site Inspector', 'Only site inspectors can accept material deliveries.');
  const next = begin(state, command), submittal = current(next);
  assert(submittal.status === 'ordered' && next.order.status === 'released', 'A released material order is required.');
  assertCurrent(next);
  assert(command.quantity === next.order.orderedQuantity, 'Delivered quantity does not match the released order.');
  assert(command.certificate === submittal.manufacturerCertificate, 'Delivery certificate does not match the approved material.');
  assert(command.batch === 'HEAT-BATCH-778', 'The delivered heat batch is not registered for this certificate.');
  next.delivery.status = 'accepted';
  next.delivery.batch = command.batch;
  next.delivery.acceptedQuantity = command.quantity;
  next.delivery.version += 1;
  next.order.status = 'received';
  next.order.version += 1;
  next.package.status = 'delivered';
  next.package.version += 1;
  submittal.status = 'delivered';
  next.evidence.push({ id: `${command.id}-delivery`, kind: 'delivery-inspection', reference: `${command.batch}:${String(command.quantity)}t`, immutable: true });
  sync(next);
  return finish(next, command, 'material-delivery-accepted');
}

export function recordMaterialInstallation(state: MaterialTraceState, command: Meta & { location: string; batch: string }) {
  assert(command.actor.role === 'Site Engineer', 'Only site engineers can record material installation.');
  const next = begin(state, command), submittal = current(next);
  assert(submittal.status === 'delivered' && next.delivery.status === 'accepted', 'Accepted delivered material is required.');
  assertCurrent(next);
  assert(command.batch === next.delivery.batch, 'Installed batch does not match the accepted delivery.');
  assert(command.location === 'SLAB-L04-ZB', 'Installation location is outside the approved package.');
  next.delivery.status = 'installed';
  next.delivery.version += 1;
  next.package.status = 'installed';
  next.package.installedLocation = command.location;
  next.package.version += 1;
  submittal.status = 'installed';
  next.evidence.push({ id: `${command.id}-installation`, kind: 'installation-record', reference: `${command.location}:${command.batch}`, immutable: true });
  sync(next);
  return finish(next, command, 'approved-material-installed');
}

export function verifyMaterialTraceability(state: MaterialTraceState, command: Meta) {
  assert(command.actor.role === 'Quality Manager', 'Only quality managers can verify installed material.');
  const next = begin(state, command), submittal = current(next);
  assert(submittal.status === 'installed' && next.package.installedLocation, 'Installed material evidence is required.');
  assertCurrent(next);
  assert(next.evidence.length === 4 && next.delivery.batch, 'Complete certificate, approval, delivery and installation evidence is required.');
  next.package.status = 'verified';
  next.package.version += 1;
  submittal.status = 'verified';
  next.evidence.push({ id: `${command.id}-release`, kind: 'traceability-release', reference: `${next.delivery.batch}->${next.package.installedLocation}`, immutable: true });
  sync(next);
  return finish(next, command, 'installed-material-traceability-verified');
}

export class MaterialTraceRepository {
  static key = 'buildledger:material-traceability:v1';
  private storage: Pick<Storage, 'getItem' | 'setItem'>;
  constructor(storage: Pick<Storage, 'getItem' | 'setItem'>) { this.storage = storage; }
  read() { const raw = this.storage.getItem(MaterialTraceRepository.key); return raw ? JSON.parse(raw) as MaterialTraceState : structuredClone(initialMaterialTraceState); }
  commit(expectedRevision: number, operation: (state: MaterialTraceState) => MaterialTraceState) {
    const state = this.read();
    assert(state.revision === expectedRevision, 'Another session changed material traceability. Refresh before retrying.');
    const next = operation(state);
    this.storage.setItem(MaterialTraceRepository.key, JSON.stringify(next));
    return next;
  }
}
