import { assessCloseoutPortfolio, seededCloseoutPortfolio, type ProjectCloseoutRecord } from './closeout-portfolio'

export type PortfolioAuthority = 'Portfolio Viewer' | 'Commercial Director'
export class CloseoutControlError extends Error {
  readonly code: 'STALE_REVISION' | 'UNAUTHORIZED' | 'UNRESOLVED_OBLIGATION' | 'MISSING_EVIDENCE' | 'INVALID_WAIVER' | 'IMMUTABLE_CLOSURE'
  readonly projectId: string
  constructor(code: CloseoutControlError['code'], projectId: string, message: string) { super(message); this.code = code; this.projectId = projectId; this.name = 'CloseoutControlError' }
}
export function closeoutPermissions(authority: PortfolioAuthority) {
  return { canIntervene: authority === 'Commercial Director', canAuthorizeClosure: authority === 'Commercial Director' } as const
}
export interface CloseoutIntervention {
  id: string
  projectId: string
  obligationReference: string
  previousManager: string
  assignedManager: string
  reviewOn: string
  reason: string
  immutable: true
}
export interface ProjectClosure { id: string; projectId: string; interventionId: string; evidenceIds: string[]; satisfiedDocuments: number; waivedDocuments: number; waiverAuthority: string | null; waiverRationale: string | null; waivedExposureCents: number; finalAccountReference: string; custodyReference: string; authorizedBy: string; closedOn: string; immutable: true }
export interface FinalAccountRecord { id: string; projectId: string; contractor: string; revision: number; sourceReference: string; finalReference: string; commercialExposureCents: number; approvedBy: string; approvedOn: string; immutable: true }
export interface CloseoutDocumentCustodyRecord { id: string; projectId: string; documentReference: string; custodyReference: string; status: 'verified' | 'waived'; responsibleManager: string; recordedOn: string; closureId: string; immutable: true }
export interface CloseoutWaiverRecord { id: string; projectId: string; closureId: string; waivedDocuments: number; authority: string; rationale: string; retainedExposureCents: number; recordedOn: string; immutable: true }
export interface FinalAccountAdjustment { id: string; projectId: string; reason: string; category: 'variation' | 'retention' | 'claim'; valueCents: number; evidenceIds: string[]; submittedRevision: number; status: 'proposed' | 'accepted' | 'rejected' | 'superseded'; proposedBy: string; proposedOn: string; reviewedBy: string | null; reviewedOn: string | null; resultingAccountRevision: number | null; direction?: 'increase' | 'decrease'; contractor?: string; sourceCommercialItem?: string; notes?: string; proposedEffectiveRevision?: number; immutable: true }
export interface CloseoutEvidencePackage { id: string; projectId: string; status: 'preliminary' | 'final'; sourceRevision: number; accountId: string | null; accountRevision: number; acceptedAdjustmentIds: string[]; closureId: string | null; custodyIds: string[]; waiverIds: string[]; openDocumentCount: number; assembledBy: string; assembledOn: string; immutable: true }
export interface CloseoutPortfolioState {
  revision: number
  projects: ProjectCloseoutRecord[]
  interventions: CloseoutIntervention[]
  closures: ProjectClosure[]
  finalAccounts: FinalAccountRecord[]
  documentCustody: CloseoutDocumentCustodyRecord[]
  waivers: CloseoutWaiverRecord[]
  adjustments: FinalAccountAdjustment[]
  evidencePackages: CloseoutEvidencePackage[]
}
export interface ScheduleCloseoutIntervention {
  id: string
  expectedRevision: number
  authority: PortfolioAuthority
  projectId: string
  assignedManager: string
  reviewOn: string
  asOf: string
  reason: string
}

export const initialCloseoutPortfolioState: CloseoutPortfolioState = {
  revision: 0,
  projects: structuredClone(seededCloseoutPortfolio),
  interventions: [],
  closures: [],
  finalAccounts: [],
  documentCustody: [],
  waivers: [],
  adjustments: [],
  evidencePackages: [],
}

interface AssembleCloseoutEvidence { id: string; expectedRevision: number; authority: PortfolioAuthority; projectId: string; status: 'preliminary' | 'final'; assembledBy: string; assembledOn: string }
export function assembleCloseoutEvidencePackage(state: CloseoutPortfolioState, command: AssembleCloseoutEvidence) {
  if (state.evidencePackages.some((item) => item.id === command.id)) return state
  if (state.revision !== command.expectedRevision) throw new CloseoutControlError('STALE_REVISION', command.projectId, 'Closeout changed. Refresh before assembling the evidence package.')
  if (!closeoutPermissions(command.authority).canAuthorizeClosure) throw new CloseoutControlError('UNAUTHORIZED', command.projectId, 'Only the commercial director can assemble a governed closeout package.')
  const project = state.projects.find((item) => item.projectId === command.projectId)
  if (!project) throw new Error('Closeout project was not found.')
  const closure = state.closures.find((item) => item.projectId === command.projectId) ?? null
  if (command.status === 'final' && (!closure || project.openDocuments !== 0 || state.adjustments.some((item) => item.projectId === command.projectId && item.status === 'proposed'))) throw new CloseoutControlError('UNRESOLVED_OBLIGATION', command.projectId, 'A final package requires completed closure, documents, and commercial decisions.')
  if (command.status === 'preliminary' && closure) throw new CloseoutControlError('IMMUTABLE_CLOSURE', command.projectId, 'A closed project requires a final evidence package.')
  const account = getFinalAccountHistory(state, command.projectId).at(-1) ?? null
  const next = structuredClone(state)
  next.evidencePackages.push({ id: command.id, projectId: command.projectId, status: command.status, sourceRevision: state.revision, accountId: account?.id ?? null, accountRevision: account?.revision ?? 0, acceptedAdjustmentIds: state.adjustments.filter((item) => item.projectId === command.projectId && item.status === 'accepted').map((item) => item.id), closureId: closure?.id ?? null, custodyIds: state.documentCustody.filter((item) => item.projectId === command.projectId).map((item) => item.id), waiverIds: state.waivers.filter((item) => item.projectId === command.projectId).map((item) => item.id), openDocumentCount: project.openDocuments, assembledBy: command.assembledBy, assembledOn: command.assembledOn, immutable: true })
  next.revision += 1
  return next
}

interface ProposeFinalAccountAdjustment { id: string; expectedRevision: number; authority: PortfolioAuthority; projectId: string; reason: string; category: FinalAccountAdjustment['category']; valueCents: number; evidenceIds: string[]; proposedBy: string; proposedOn: string }
export function proposeFinalAccountAdjustment(state: CloseoutPortfolioState, command: ProposeFinalAccountAdjustment) {
  if (state.adjustments.some((item) => item.id === command.id)) return state
  if (state.revision !== command.expectedRevision) throw new CloseoutControlError('STALE_REVISION', command.projectId, 'Closeout portfolio changed. Refresh before proposing the final-account adjustment.')
  if (!closeoutPermissions(command.authority).canIntervene) throw new CloseoutControlError('UNAUTHORIZED', command.projectId, 'Only the commercial director can propose a final-account adjustment.')
  const project = state.projects.find((item) => item.projectId === command.projectId)
  if (!project) throw new Error('Closeout project was not found.')
  if (state.closures.some((item) => item.projectId === command.projectId)) throw new CloseoutControlError('IMMUTABLE_CLOSURE', command.projectId, 'A closed project cannot receive a final-account adjustment.')
  if (command.reason.trim().length < 20 || command.valueCents === 0 || command.evidenceIds.length === 0) throw new CloseoutControlError('MISSING_EVIDENCE', command.projectId, 'Adjustment reason, value, and supporting evidence are required.')
  const next = structuredClone(state)
  next.adjustments.filter((item) => item.projectId === command.projectId && item.status === 'proposed').forEach((item) => { item.status = 'superseded' })
  next.adjustments.push({ ...command, reason: command.reason.trim(), evidenceIds: [...command.evidenceIds], submittedRevision: state.revision, status: 'proposed', reviewedBy: null, reviewedOn: null, resultingAccountRevision: null, immutable: true })
  next.revision += 1
  return next
}

export interface CategorizedAdjustmentProposal { id: string; expectedRevision: number; authority: PortfolioAuthority; projectId: string; category: FinalAccountAdjustment['category']; commercialReason: string; amountCents: number; direction: 'increase' | 'decrease'; contractor: string; sourceCommercialItem: string; evidenceReference: string; notes: string; proposedEffectiveRevision: number; proposedBy: string; proposedOn: string }
export function proposeCategorizedFinalAccountAdjustment(state: CloseoutPortfolioState, command: CategorizedAdjustmentProposal) {
  if (state.adjustments.some((item) => item.id === command.id)) return state
  if (state.revision !== command.expectedRevision) throw new CloseoutControlError('STALE_REVISION', command.projectId, 'Closeout portfolio changed. Refresh before proposing the final-account adjustment.')
  if (!closeoutPermissions(command.authority).canIntervene) throw new CloseoutControlError('UNAUTHORIZED', command.projectId, 'Only the commercial director can propose a final-account adjustment.')
  const project = state.projects.find((item) => item.projectId === command.projectId)
  if (!project) throw new Error('Closeout project was not found.')
  if (state.closures.some((item) => item.projectId === command.projectId)) throw new CloseoutControlError('IMMUTABLE_CLOSURE', command.projectId, 'A closed project cannot receive a final-account adjustment.')
  if (!command.contractor.trim() || command.contractor !== project.contractor || !command.sourceCommercialItem.trim() || command.notes.trim().length < 10) throw new CloseoutControlError('MISSING_EVIDENCE', command.projectId, 'Contractor, source commercial item, and adjustment rationale are required.')
  if (!Number.isSafeInteger(command.amountCents) || command.amountCents <= 0) throw new CloseoutControlError('UNRESOLVED_OBLIGATION', command.projectId, 'Adjustment amount must be a positive whole number of cents.')
  if (command.direction === 'decrease' && command.amountCents > project.commercialExposureCents) throw new CloseoutControlError('UNRESOLVED_OBLIGATION', command.projectId, 'Adjustment cannot reduce the current account below zero.')
  const evidencePrefix = { variation: 'VO-', retention: 'RET-', claim: 'CLM-' }[command.category]
  if (!evidencePrefix || !command.evidenceReference.startsWith(evidencePrefix)) throw new CloseoutControlError('MISSING_EVIDENCE', command.projectId, 'Evidence must use an approved commercial reference for its category.')
  const currentRevision = getFinalAccountHistory(state, command.projectId).at(-1)?.revision ?? 0
  if (command.proposedEffectiveRevision !== currentRevision + 1) throw new CloseoutControlError('STALE_REVISION', command.projectId, 'Proposed effective revision must follow the current final account.')
  if (state.adjustments.some((item) => item.projectId === command.projectId && item.sourceCommercialItem === command.sourceCommercialItem && item.status !== 'rejected')) throw new CloseoutControlError('UNRESOLVED_OBLIGATION', command.projectId, 'This source commercial item already has an active adjustment.')
  const next = proposeFinalAccountAdjustment(state, { id: command.id, expectedRevision: command.expectedRevision, authority: command.authority, projectId: command.projectId, reason: command.commercialReason, category: command.category, valueCents: command.direction === 'increase' ? command.amountCents : -command.amountCents, evidenceIds: [command.evidenceReference], proposedBy: command.proposedBy, proposedOn: command.proposedOn })
  const adjustment = next.adjustments.find((item) => item.id === command.id)
  if (adjustment) Object.assign(adjustment, { direction: command.direction, contractor: command.contractor.trim(), sourceCommercialItem: command.sourceCommercialItem.trim(), notes: command.notes.trim(), proposedEffectiveRevision: command.proposedEffectiveRevision })
  return next
}

export function compareFinalAccountAdjustment(state: CloseoutPortfolioState, projectId: string, amountCents: number, direction: 'increase' | 'decrease') {
  const currentValueCents = getFinalAccountHistory(state, projectId).at(-1)?.commercialExposureCents ?? state.projects.find((item) => item.projectId === projectId)?.commercialExposureCents ?? 0
  const adjustmentValueCents = direction === 'increase' ? amountCents : -amountCents
  return { currentValueCents, adjustmentValueCents, resultingValueCents: Math.max(0, currentValueCents + adjustmentValueCents) }
}

interface ReviewFinalAccountAdjustment { id: string; expectedRevision: number; authority: PortfolioAuthority; adjustmentId: string; decision: 'accepted' | 'rejected'; reviewedBy: string; reviewedOn: string }
export function reviewFinalAccountAdjustment(state: CloseoutPortfolioState, command: ReviewFinalAccountAdjustment) {
  if (state.revision !== command.expectedRevision) throw new CloseoutControlError('STALE_REVISION', command.adjustmentId, 'Closeout portfolio changed. Refresh before reviewing the final-account adjustment.')
  if (!closeoutPermissions(command.authority).canAuthorizeClosure) throw new CloseoutControlError('UNAUTHORIZED', command.adjustmentId, 'Only the commercial director can review a final-account adjustment.')
  const adjustment = state.adjustments.find((item) => item.id === command.adjustmentId)
  if (adjustment?.status !== 'proposed') throw new Error('A current proposed final-account adjustment is required.')
  if (state.closures.some((item) => item.projectId === adjustment.projectId)) throw new CloseoutControlError('IMMUTABLE_CLOSURE', adjustment.projectId, 'A closed project cannot receive a final-account adjustment.')
  const project = state.projects.find((item) => item.projectId === adjustment.projectId)
  if (!project) throw new Error('Closeout project was not found.')
  const next = structuredClone(state)
  const nextAdjustment = next.adjustments.find((item) => item.id === adjustment.id)
  const target = next.projects.find((item) => item.projectId === adjustment.projectId)
  if (!nextAdjustment || !target) throw new Error('Final-account records disappeared during review.')
  nextAdjustment.status = command.decision
  nextAdjustment.reviewedBy = command.reviewedBy
  nextAdjustment.reviewedOn = command.reviewedOn
  if (command.decision === 'accepted') {
    const revision = next.finalAccounts.filter((item) => item.projectId === adjustment.projectId).length + 1
    const exposure = Math.max(0, project.commercialExposureCents + adjustment.valueCents)
    next.finalAccounts.push({ id: `${command.id}:account`, projectId: project.projectId, contractor: project.contractor, revision, sourceReference: project.sourceReference, finalReference: `ADJ-${adjustment.id}-R${String(revision)}`, commercialExposureCents: exposure, approvedBy: command.reviewedBy, approvedOn: command.reviewedOn, immutable: true })
    nextAdjustment.resultingAccountRevision = revision
    target.commercialExposureCents = exposure
  }
  next.revision += 1
  return next
}

export function getFinalAccountAdjustmentReadiness(state: CloseoutPortfolioState, projectId: string) {
  const history = state.adjustments.filter((item) => item.projectId === projectId)
  const latestAccount = getFinalAccountHistory(state, projectId).at(-1) ?? null
  return { history, latestAccount, pendingAdjustment: history.find((item) => item.status === 'proposed') ?? null, closureReady: history.every((item) => item.status !== 'proposed') }
}

export function scheduleCloseoutIntervention(state: CloseoutPortfolioState, command: ScheduleCloseoutIntervention) {
  if (state.interventions.some((item) => item.id === command.id)) return state
  if (state.revision !== command.expectedRevision) throw new CloseoutControlError('STALE_REVISION', command.projectId, 'Closeout portfolio changed. Refresh before scheduling intervention.')
  if (!closeoutPermissions(command.authority).canIntervene) throw new CloseoutControlError('UNAUTHORIZED', command.projectId, 'Only the commercial director can schedule a portfolio intervention.')
  const project = state.projects.find((item) => item.projectId === command.projectId)
  if (!project) throw new Error('Closeout project was not found.')
  const assessed = assessCloseoutPortfolio([project], command.asOf)[0]
  if (assessed?.urgency !== 'breached' || project.openDocuments === 0) throw new Error('Only breached closeout obligations can be escalated.')
  if (command.reviewOn <= command.asOf) throw new Error('Commercial review must be scheduled after the intervention date.')
  if (command.reason.trim().length < 20) throw new Error('Intervention reason must contain at least 20 characters.')
  const next = structuredClone(state)
  const target = next.projects.find((item) => item.projectId === command.projectId)
  if (!target) throw new Error('Closeout project disappeared during the portfolio update.')
  next.interventions.push({
    id: command.id,
    projectId: project.projectId,
    obligationReference: project.sourceReference,
    previousManager: project.commercialManager,
    assignedManager: command.assignedManager,
    reviewOn: command.reviewOn,
    reason: command.reason.trim(),
    immutable: true,
  })
  target.commercialManager = command.assignedManager
  next.revision += 1
  return next
}

interface AuthorizeProjectClosure { id: string; expectedRevision: number; authority: PortfolioAuthority; projectId: string; evidenceIds: string[]; satisfiedDocuments: number; waivedDocuments: number; waiverAuthority: string | null; waiverRationale: string | null; waivedExposureCents: number; finalAccountReference: string; custodyReference: string; authorizedBy: string; closedOn: string }
export function authorizeProjectClosure(state: CloseoutPortfolioState, command: AuthorizeProjectClosure) {
  if (state.closures.some((item) => item.id === command.id)) return state
  if (state.revision !== command.expectedRevision) throw new CloseoutControlError('STALE_REVISION', command.projectId, 'Closeout portfolio changed. Refresh before closure.')
  if (!closeoutPermissions(command.authority).canAuthorizeClosure) throw new CloseoutControlError('UNAUTHORIZED', command.projectId, 'Only the commercial director can authorize project closure.')
  if (state.closures.some((item) => item.projectId === command.projectId)) throw new CloseoutControlError('IMMUTABLE_CLOSURE', command.projectId, 'A closed project cannot be completed again.')
  const project = state.projects.find((item) => item.projectId === command.projectId)
  const intervention = [...state.interventions].reverse().find((item) => item.projectId === command.projectId)
  if (!project || !intervention) throw new Error('A governed closeout intervention is required before closure.')
  if (state.adjustments.some((item) => item.projectId === command.projectId && item.status === 'proposed')) throw new CloseoutControlError('UNRESOLVED_OBLIGATION', command.projectId, 'Pending final-account adjustments must be decided before closure.')
  const acceptedAdjustment = [...state.adjustments].reverse().find((item) => item.projectId === command.projectId && item.status === 'accepted')
  const currentAccount = getFinalAccountHistory(state, command.projectId).at(-1)
  if (acceptedAdjustment && command.finalAccountReference !== currentAccount?.finalReference) throw new CloseoutControlError('UNRESOLVED_OBLIGATION', command.projectId, 'Closure must reference the current accepted final-account revision.')
  if (command.satisfiedDocuments + command.waivedDocuments !== project.openDocuments) throw new CloseoutControlError('UNRESOLVED_OBLIGATION', command.projectId, 'Every open document must be satisfied or explicitly waived.')
  if (command.evidenceIds.length < command.satisfiedDocuments || !command.finalAccountReference || !command.custodyReference) throw new CloseoutControlError('MISSING_EVIDENCE', command.projectId, 'Completion, final-account, and custody evidence are required.')
  if (command.waivedDocuments > 0 && (!command.waiverAuthority || (command.waiverRationale?.trim().length ?? 0) < 20 || command.waivedExposureCents <= 0)) throw new CloseoutControlError('INVALID_WAIVER', command.projectId, 'A waiver requires authority, rationale, and commercial consequence.')
  const next = structuredClone(state)
  const target = next.projects.find((item) => item.projectId === project.projectId)
  if (!target) throw new Error('Project disappeared during closure.')
  next.closures.push({ ...command, interventionId: intervention.id, evidenceIds: [...command.evidenceIds], waiverRationale: command.waiverRationale?.trim() ?? null, immutable: true })
  next.finalAccounts.push({ id: `${command.id}:account`, projectId: project.projectId, contractor: project.contractor, revision: next.finalAccounts.filter((item) => item.projectId === project.projectId).length + 1, sourceReference: project.sourceReference, finalReference: command.finalAccountReference, commercialExposureCents: command.waivedExposureCents, approvedBy: command.authorizedBy, approvedOn: command.closedOn, immutable: true })
  next.documentCustody.push(...command.evidenceIds.map((documentReference, index) => ({ id: `${command.id}:document:${String(index + 1)}`, projectId: project.projectId, documentReference, custodyReference: command.custodyReference, status: 'verified' as const, responsibleManager: command.authorizedBy, recordedOn: command.closedOn, closureId: command.id, immutable: true as const })))
  if (command.waivedDocuments > 0 && command.waiverAuthority && command.waiverRationale) next.waivers.push({ id: `${command.id}:waiver`, projectId: project.projectId, closureId: command.id, waivedDocuments: command.waivedDocuments, authority: command.waiverAuthority, rationale: command.waiverRationale.trim(), retainedExposureCents: command.waivedExposureCents, recordedOn: command.closedOn, immutable: true })
  target.openDocuments = 0
  target.commercialExposureCents = command.waivedExposureCents
  next.revision += 1
  return next
}

export function getFinalAccountHistory(state: CloseoutPortfolioState, projectId: string) { return state.finalAccounts.filter((item) => item.projectId === projectId).sort((a, b) => a.revision - b.revision) }
export function getCloseoutDocumentHistory(state: CloseoutPortfolioState, projectId: string) { return state.documentCustody.filter((item) => item.projectId === projectId).map((item) => ({ ...item, waiver: state.waivers.find((waiver) => waiver.closureId === item.closureId) ?? null })) }

export function queryProjectCloseoutHistory(state: CloseoutPortfolioState, projectId: string) {
  return [
    ...state.interventions.filter((item) => item.projectId === projectId).map((item) => ({ kind: 'intervention' as const, occurredOn: item.reviewOn, actor: item.assignedManager, evidence: [item.obligationReference], record: item })),
    ...state.closures.filter((item) => item.projectId === projectId).map((item) => ({ kind: 'closure' as const, occurredOn: item.closedOn, actor: item.authorizedBy, evidence: [...item.evidenceIds, item.finalAccountReference, item.custodyReference], record: item })),
  ].sort((a, b) => a.occurredOn.localeCompare(b.occurredOn))
}

export interface CloseoutPersistence { load(): CloseoutPortfolioState | null; save(next: CloseoutPortfolioState): void }
export class BrowserCloseoutPersistence implements CloseoutPersistence {
  static key = 'buildledger:closeout-portfolio:v2'
  private readonly storage: Pick<Storage, 'getItem' | 'setItem'>
  constructor(storage: Pick<Storage, 'getItem' | 'setItem'>) { this.storage = storage }
  load() { const raw = this.storage.getItem(BrowserCloseoutPersistence.key); if (!raw) return null; const saved = JSON.parse(raw) as Partial<CloseoutPortfolioState>; return { ...(saved as CloseoutPortfolioState), finalAccounts: saved.finalAccounts ?? [], documentCustody: saved.documentCustody ?? [], waivers: saved.waivers ?? [], adjustments: saved.adjustments ?? [], evidencePackages: saved.evidencePackages ?? [] } }
  save(next: CloseoutPortfolioState) { this.storage.setItem(BrowserCloseoutPersistence.key, JSON.stringify(next)) }
}
export class CloseoutPortfolioRepository {
  private readonly persistence: CloseoutPersistence
  constructor(persistence: CloseoutPersistence) { this.persistence = persistence }
  read(): CloseoutPortfolioState { return this.persistence.load() ?? structuredClone(initialCloseoutPortfolioState) }
  dispatch(command: ScheduleCloseoutIntervention | AuthorizeProjectClosure | ProposeFinalAccountAdjustment | ReviewFinalAccountAdjustment | CategorizedAdjustmentProposal | AssembleCloseoutEvidence) {
    const current = this.read()
    const next = 'status' in command ? assembleCloseoutEvidencePackage(current, command) : 'commercialReason' in command ? proposeCategorizedFinalAccountAdjustment(current, command) : 'decision' in command ? reviewFinalAccountAdjustment(current, command) : 'category' in command ? proposeFinalAccountAdjustment(current, command) : 'satisfiedDocuments' in command ? authorizeProjectClosure(current, command) : scheduleCloseoutIntervention(current, command)
    if (next !== current) this.persistence.save(next)
    return next
  }
}
