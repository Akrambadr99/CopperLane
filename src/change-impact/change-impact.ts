export type ChangeRole = 'Contractor' | 'Cost Engineer' | 'Project Manager' | 'Executive';

export interface ChangeActor {
  id: string;
  role: ChangeRole;
}

export interface LinkedDesignBasis {
  drawingId: string;
  drawingRevision: number;
  rfiId: string;
  rfiRevision: number;
}

export interface ChangeAssessment {
  directCost: number;
  contingency: number;
  delayDays: number;
  rationale: string;
  assessor: string;
}

export interface ChangeRequest {
  id: string;
  owner: string;
  title: string;
  status: 'draft' | 'submitted' | 'assessed' | 'approved' | 'rejected' | 'incorporated' | 'cancelled';
  basis: LinkedDesignBasis;
  evidence: string;
  assessment: ChangeAssessment | null;
  approver?: string;
}

export interface ChangeImpactState {
  revision: number;
  design: {
    drawingId: string;
    drawingRevision: number;
    rfiId: string;
    rfiRevision: number;
    rfiStatus: 'answered';
  };
  contract: {
    approvedValue: number;
    forecastValue: number;
    version: number;
  };
  schedule: {
    completion: string;
    version: number;
  };
  request: ChangeRequest | null;
  events: { id: string; action: string; actor: string; detail: string }[];
}

export const initialChangeImpactState: ChangeImpactState = {
  revision: 0,
  design: {
    drawingId: 'A-412',
    drawingRevision: 7,
    rfiId: 'RFI-238',
    rfiRevision: 3,
    rfiStatus: 'answered',
  },
  contract: {
    approvedValue: 4_000_000,
    forecastValue: 4_000_000,
    version: 5,
  },
  schedule: {
    completion: '2026-12-21',
    version: 5,
  },
  request: null,
  events: [],
};

interface CommandMeta {
  id: string;
  expectedRevision: number;
  actor: ChangeActor;
}

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

function meaningful(value: string, field: string) {
  const normalized = value.trim();
  assert(normalized.length >= 20, `${field} must contain at least 20 characters.`);
  return normalized;
}

function begin(state: ChangeImpactState, command: CommandMeta) {
  assert(state.revision === command.expectedRevision, 'Change impact changed. Refresh before retrying.');
  assert(!state.events.some((event) => event.id === command.id), 'Command already applied.');
  return structuredClone(state);
}

function finish(state: ChangeImpactState, command: CommandMeta, action: string, detail: string) {
  state.revision += 1;
  state.events.push({ id: command.id, action, actor: command.actor.id, detail });
  return state;
}

function assertCurrentBasis(state: ChangeImpactState, request: ChangeRequest) {
  assert(request.basis.drawingRevision === state.design.drawingRevision, 'Linked drawing changed. Revise the request.');
  assert(request.basis.rfiRevision === state.design.rfiRevision, 'Linked RFI changed. Revise the request.');
}

export function createChangeDraft(
  state: ChangeImpactState,
  command: CommandMeta & { title: string; evidence: string },
) {
  assert(command.actor.role === 'Contractor', 'Only the contractor can create a change request.');
  const next = begin(state, command);
  assert(!next.request || ['rejected', 'incorporated', 'cancelled'].includes(next.request.status), 'An active change request exists.');
  next.request = {
    id: `${command.id}-change`,
    owner: command.actor.id,
    title: meaningful(command.title, 'Change title'),
    status: 'draft',
    basis: {
      drawingId: next.design.drawingId,
      drawingRevision: next.design.drawingRevision,
      rfiId: next.design.rfiId,
      rfiRevision: next.design.rfiRevision,
    },
    evidence: meaningful(command.evidence, 'Change evidence'),
    assessment: null,
  };
  return finish(next, command, 'change-draft-created', next.request.id);
}

export function reviseChangeDraft(
  state: ChangeImpactState,
  command: CommandMeta & { evidence: string },
) {
  assert(command.actor.role === 'Contractor', 'Only the contractor can revise the change request.');
  const next = begin(state, command);
  const request = next.request;
  assert(request?.owner === command.actor.id, 'Only the request owner can revise this draft.');
  assert(['draft', 'rejected'].includes(request.status), 'The change request can no longer be revised.');
  request.evidence = meaningful(command.evidence, 'Change evidence');
  request.basis.drawingRevision = next.design.drawingRevision;
  request.basis.rfiRevision = next.design.rfiRevision;
  request.assessment = null;
  request.status = 'draft';
  return finish(next, command, 'change-draft-revised', request.id);
}

export function submitChange(state: ChangeImpactState, command: CommandMeta) {
  assert(command.actor.role === 'Contractor', 'Only the contractor can submit the change request.');
  const next = begin(state, command);
  const request = next.request;
  assert(request?.owner === command.actor.id && request.status === 'draft', 'Owned draft is required for submission.');
  assertCurrentBasis(next, request);
  request.status = 'submitted';
  return finish(next, command, 'change-submitted', request.id);
}

export function assessChange(
  state: ChangeImpactState,
  command: CommandMeta & { directCost: number; contingency: number; delayDays: number; rationale: string },
) {
  assert(command.actor.role === 'Cost Engineer', 'Only cost engineering can assess change impact.');
  const next = begin(state, command);
  const request = next.request;
  assert(request?.status === 'submitted', 'Submitted change request is required.');
  assertCurrentBasis(next, request);
  assert(command.actor.id !== request.owner, 'Assessment must be independent from the request owner.');
  assert(Number.isInteger(command.directCost) && command.directCost > 0, 'Direct cost must be a positive whole amount.');
  assert(Number.isInteger(command.contingency) && command.contingency >= 0, 'Contingency must be a nonnegative whole amount.');
  assert(command.contingency <= command.directCost / 4, 'Contingency exceeds the 25 percent control limit.');
  assert(Number.isInteger(command.delayDays) && command.delayDays >= 0 && command.delayDays <= 30, 'Delay must be between 0 and 30 days.');
  request.assessment = {
    directCost: command.directCost,
    contingency: command.contingency,
    delayDays: command.delayDays,
    rationale: meaningful(command.rationale, 'Assessment rationale'),
    assessor: command.actor.id,
  };
  request.status = 'assessed';
  return finish(next, command, 'change-assessed', String(command.directCost + command.contingency));
}

export function decideChange(
  state: ChangeImpactState,
  command: CommandMeta & { approve: boolean; rationale: string },
) {
  assert(command.actor.role === 'Project Manager', 'Only the project manager can decide the change.');
  const next = begin(state, command);
  const request = next.request;
  assert(request?.status === 'assessed' && request.assessment, 'Assessed change request is required.');
  assertCurrentBasis(next, request);
  assert(command.actor.id !== request.assessment.assessor, 'Approval must be independent from assessment.');
  meaningful(command.rationale, 'Decision rationale');
  request.status = command.approve ? 'approved' : 'rejected';
  request.approver = command.actor.id;
  return finish(next, command, command.approve ? 'change-approved' : 'change-rejected', request.id);
}

export function incorporateChange(state: ChangeImpactState, command: CommandMeta) {
  assert(command.actor.role === 'Executive', 'Only the executive can incorporate an approved change.');
  const next = begin(state, command);
  const request = next.request;
  assert(request?.status === 'approved' && request.assessment, 'Approved assessed change is required.');
  assertCurrentBasis(next, request);
  const impact = request.assessment.directCost + request.assessment.contingency;
  next.contract.forecastValue += impact;
  next.contract.version += 1;
  const completion = new Date(`${next.schedule.completion}T00:00:00Z`);
  completion.setUTCDate(completion.getUTCDate() + request.assessment.delayDays);
  next.schedule.completion = completion.toISOString().slice(0, 10);
  next.schedule.version += 1;
  request.status = 'incorporated';
  return finish(next, command, 'change-incorporated', String(impact) + ' and ' + String(request.assessment.delayDays) + ' days');
}

export class ChangeImpactRepository {
  static key = 'buildledger:change-impact:v1';
  private storage: Pick<Storage, 'getItem' | 'setItem'>;

  constructor(storage: Pick<Storage, 'getItem' | 'setItem'>) {
    this.storage = storage;
  }

  read() {
    const raw = this.storage.getItem(ChangeImpactRepository.key);
    return raw ? JSON.parse(raw) as ChangeImpactState : structuredClone(initialChangeImpactState);
  }

  commit(expectedRevision: number, change: (state: ChangeImpactState) => ChangeImpactState) {
    const current = this.read();
    assert(current.revision === expectedRevision, 'Another session changed impact control. Refresh before retrying.');
    const next = change(current);
    this.storage.setItem(ChangeImpactRepository.key, JSON.stringify(next));
    return next;
  }
}
