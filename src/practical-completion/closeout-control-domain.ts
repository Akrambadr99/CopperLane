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
export type CloseoutRecipient = 'Client representative' | 'Commercial manager' | 'Main contractor' | 'Independent certifier'
export const requiredCloseoutRecipients: CloseoutRecipient[] = ['Client representative', 'Commercial manager', 'Main contractor']
export type CloseoutContentScope = 'final account' | 'commercial adjustments' | 'closeout documents' | 'waivers' | 'custody evidence' | 'final closure evidence'
export const closeoutContentScopes: readonly CloseoutContentScope[] = ['final account', 'commercial adjustments', 'closeout documents', 'waivers', 'custody evidence', 'final closure evidence']
export const defaultRecipientContentScope: Record<CloseoutRecipient, readonly CloseoutContentScope[]> = {
  'Client representative': closeoutContentScopes,
  'Commercial manager': ['final account', 'commercial adjustments', 'waivers'],
  'Main contractor': ['final account', 'commercial adjustments', 'closeout documents', 'custody evidence', 'final closure evidence'],
  'Independent certifier': closeoutContentScopes,
}
export interface CloseoutHandoff { id: string; projectId: string; packageId: string; packageSourceRevision: number; recipient: CloseoutRecipient; recipientIdentity?: string; dueOn?: string; previousHandoffId?: string; reassignmentReason?: string; preparedBy: string; preparedOn: string; immutable: true }
export interface CloseoutRecipientResponse { id: string; handoffId: string; packageId: string; recipient: CloseoutRecipient; decision: 'acknowledged' | 'correction-requested'; receiptReference: string; rationale: string; recordedBy: string; recordedOn: string; immutable: true }
export interface RecipientSubstitution { id: string; handoffId: string; replacementHandoffId: string; packageId: string; packageSourceRevision: number; originalRecipient: string; substituteRecipient: string; reason: 'responsibility changed' | 'representative replaced' | 'contact superseded'; approvalReference: string; approvedBy: string; approvedOn: string; immutable: true }
export interface RecipientPolicyRevision { id: string; projectId: string; packageId: string; revision: number; requiredRecipients: CloseoutRecipient[]; scopeByRecipient?: Partial<Record<CloseoutRecipient, CloseoutContentScope[]>>; introduced: CloseoutRecipient[]; retired: CloseoutRecipient[]; reason: string; approvedBy: string; effectiveOn: string; immutable: true }
export interface RecipientSupersessionPolicy { id: string; projectId: string; recipient: CloseoutRecipient; previousPackageId: string; currentPackageId: string; previousResponseId: string; changedScope: string[]; contentScopes?: CloseoutContentScope[]; recipientPolicyRevision?: number; decision: 'retain acknowledgement' | 'renew acknowledgement'; rationale: string; authorizedBy: string; authorizedOn: string; immutable: true }
export interface HandoverAcceptance { id: string; projectId: string; packageId: string; packageSourceRevision: number; recipientPolicyRevision: number; obligations: { recipient: CloseoutRecipient; handoffId: string | null; responseId: string; retainedPolicyId: string | null }[]; acceptanceReference: string; acceptedBy: string; acceptedOn: string; immutable: true }
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
  handoffs: CloseoutHandoff[]
  recipientResponses: CloseoutRecipientResponse[]
  recipientSubstitutions: RecipientSubstitution[]
  recipientPolicies: RecipientSupersessionPolicy[]
  recipientPolicyRevisions: RecipientPolicyRevision[]
  handoverAcceptances: HandoverAcceptance[]
  archiveRestores: { id: string; archiveId: string; projectId: string; sourceRevision: number; restoredBy: string; restoredOn: string; immutable: true }[]
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
  handoffs: [],
  recipientResponses: [],
  recipientSubstitutions: [],
  recipientPolicies: [],
  recipientPolicyRevisions: [],
  handoverAcceptances: [],
  archiveRestores: [],
}

export function currentRequiredRecipients(state: CloseoutPortfolioState, projectId: string): CloseoutRecipient[] {
  return state.recipientPolicyRevisions.filter((item) => item.projectId === projectId).at(-1)?.requiredRecipients ?? requiredCloseoutRecipients
}

export function currentRecipientContentScope(state: CloseoutPortfolioState, projectId: string, recipient: CloseoutRecipient): readonly CloseoutContentScope[] {
  return state.recipientPolicyRevisions.filter((item) => item.projectId === projectId).at(-1)?.scopeByRecipient?.[recipient] ?? defaultRecipientContentScope[recipient]
}

export function changeCloseoutRecipientPolicy(state: CloseoutPortfolioState, command: { id: string; expectedRevision: number; authority: PortfolioAuthority; projectId: string; packageId: string; requiredRecipients: readonly CloseoutRecipient[]; scopeByRecipient?: Partial<Record<CloseoutRecipient, CloseoutContentScope[]>>; reason: string; approvedBy: string; effectiveOn: string }) {
  if (state.recipientPolicyRevisions.some((item) => item.id === command.id)) return state
  if (state.revision !== command.expectedRevision) throw new CloseoutControlError('STALE_REVISION', command.projectId, 'Closeout changed. Refresh before revising recipient policy.')
  if (!closeoutPermissions(command.authority).canAuthorizeClosure) throw new CloseoutControlError('UNAUTHORIZED', command.projectId, 'Only the commercial director can revise recipient policy.')
  const pkg = state.evidencePackages.filter((item) => item.projectId === command.projectId && item.status === 'final').at(-1)
  if (pkg?.id !== command.packageId) throw new Error('Policy must apply to the current final package revision.')
  const prior = currentRequiredRecipients(state, command.projectId)
  const required = command.requiredRecipients
  if (!required.length || new Set(required).size !== required.length || required.some((item) => ![...requiredCloseoutRecipients, 'Independent certifier'].includes(item))) throw new Error('Recipient policy needs a nonempty set of known recipients.')
  const priorScopes = Object.fromEntries((Object.keys(defaultRecipientContentScope) as CloseoutRecipient[]).map((recipient) => [recipient, [...currentRecipientContentScope(state, command.projectId, recipient)]])) as Record<CloseoutRecipient, CloseoutContentScope[]>
  const scopes = { ...priorScopes, ...command.scopeByRecipient }
  if (required.some((recipient) => !scopes[recipient].length || new Set(scopes[recipient]).size !== scopes[recipient].length || scopes[recipient].some((scope) => !closeoutContentScopes.includes(scope)))) throw new Error('Each required recipient needs a nonempty set of known closeout content scopes.')
  if (required.length === prior.length && required.every((item) => prior.includes(item)) && required.every((recipient) => JSON.stringify([...scopes[recipient]].sort()) === JSON.stringify([...priorScopes[recipient]].sort()))) throw new Error('Recipient policy needs a distinct recipient or content scope change.')
  for (const recipient of required) {
    const acknowledgement = state.recipientResponses.some((response) => response.packageId === pkg.id && response.recipient === recipient && response.decision === 'acknowledged') || state.recipientPolicies.some((policy) => policy.currentPackageId === pkg.id && policy.recipient === recipient && policy.decision === 'retain acknowledgement')
    if (acknowledgement && scopes[recipient].some((scope) => !priorScopes[recipient].includes(scope) && packageContentPresent(pkg, scope))) throw new Error(`Existing ${recipient} acknowledgement cannot silently cover newly required content; issue a new package revision.`)
  }
  if (command.reason.trim().length < 20 || !command.approvedBy.trim() || command.effectiveOn < pkg.assembledOn) throw new Error('Policy reason, approving authority, and effective date after package assembly are required.')
  const next = structuredClone(state)
  next.recipientPolicyRevisions.push({ id: command.id, projectId: command.projectId, packageId: pkg.id, revision: (state.recipientPolicyRevisions.filter((item) => item.projectId === command.projectId).at(-1)?.revision ?? 0) + 1, requiredRecipients: [...required], scopeByRecipient: Object.fromEntries(required.map((recipient) => [recipient, [...scopes[recipient]]])), introduced: required.filter((item) => !prior.includes(item)), retired: prior.filter((item) => !required.includes(item)), reason: command.reason.trim(), approvedBy: command.approvedBy.trim(), effectiveOn: command.effectiveOn, immutable: true })
  next.revision += 1
  return next
}

function packageContentPresent(pkg: CloseoutEvidencePackage, scope: CloseoutContentScope) {
  return scope === 'final account' ? Boolean(pkg.accountId) : scope === 'commercial adjustments' ? pkg.acceptedAdjustmentIds.length > 0 : scope === 'closeout documents' ? pkg.openDocumentCount > 0 || pkg.custodyIds.length > 0 : scope === 'waivers' ? pkg.waiverIds.length > 0 : scope === 'custody evidence' ? pkg.custodyIds.length > 0 : Boolean(pkg.closureId)
}

export function changedCloseoutContent(previous: CloseoutEvidencePackage, current: CloseoutEvidencePackage): CloseoutContentScope[] {
  const changed: CloseoutContentScope[] = []
  if (previous.accountId !== current.accountId || previous.accountRevision !== current.accountRevision) changed.push('final account')
  if (JSON.stringify(previous.acceptedAdjustmentIds) !== JSON.stringify(current.acceptedAdjustmentIds)) changed.push('commercial adjustments')
  if (previous.openDocumentCount !== current.openDocumentCount) changed.push('closeout documents')
  if (JSON.stringify(previous.custodyIds) !== JSON.stringify(current.custodyIds)) changed.push('custody evidence')
  if (JSON.stringify(previous.waiverIds) !== JSON.stringify(current.waiverIds)) changed.push('waivers')
  if (previous.closureId !== current.closureId) changed.push('final closure evidence')
  return changed
}

export function recipientPackageChanges(previous: CloseoutEvidencePackage, current: CloseoutEvidencePackage, recipient: CloseoutRecipient, scopes: readonly CloseoutContentScope[] = defaultRecipientContentScope[recipient]) {
  const material = changedCloseoutContent(previous, current).filter((scope) => scopes.includes(scope))
  const changed: string[] = []
  if (material.includes('final account') || material.includes('commercial adjustments')) changed.push('commercial scope')
  if (material.includes('closeout documents') || material.includes('custody evidence') || material.includes('final closure evidence')) changed.push('document custody')
  if (material.includes('waivers')) changed.push('waiver policy')
  return changed
}

function priorAcknowledgement(state: CloseoutPortfolioState, packageId: string, recipient: CloseoutRecipient) {
  const handoff = state.handoffs.filter((item) => item.packageId === packageId && item.recipient === recipient).at(-1)
  const policy = state.recipientPolicies.find((item) => item.currentPackageId === packageId && item.recipient === recipient && item.decision === 'retain acknowledgement')
  return state.recipientResponses.find((item) => item.handoffId === handoff?.id && item.decision === 'acknowledged' || item.id === policy?.previousResponseId) ?? null
}

export function reviewRecipientPackageSupersession(state: CloseoutPortfolioState, command: { id: string; expectedRevision: number; authority: PortfolioAuthority; projectId: string; recipient: CloseoutRecipient; decision: RecipientSupersessionPolicy['decision']; rationale: string; authorizedBy: string; authorizedOn: string }) {
  if (state.recipientPolicies.some((item) => item.id === command.id)) return state
  if (state.revision !== command.expectedRevision) throw new CloseoutControlError('STALE_REVISION', command.projectId, 'Closeout changed. Refresh before reviewing recipient obligations.')
  if (!closeoutPermissions(command.authority).canAuthorizeClosure) throw new CloseoutControlError('UNAUTHORIZED', command.projectId, 'Only the commercial director can decide supersession policy.')
  const packages = state.evidencePackages.filter((item) => item.projectId === command.projectId && item.status === 'final')
  const current = packages.at(-1), previous = packages.at(-2)
  if (!current || !previous) throw new Error('Two final package revisions are required for supersession policy.')
  if (state.recipientPolicies.some((item) => item.currentPackageId === current.id && item.recipient === command.recipient)) throw new Error('Recipient policy was already decided for this package.')
  const priorResponse = priorAcknowledgement(state, previous.id, command.recipient)
  if (!priorResponse) throw new Error('An acknowledged prior recipient obligation is required for supersession review.')
  const contentScopes = currentRecipientContentScope(state, command.projectId, command.recipient)
  const changedScope = recipientPackageChanges(previous, current, command.recipient, contentScopes)
  if (command.decision === 'retain acknowledgement' && changedScope.length > 0) throw new Error(`Changed ${changedScope.join(' and ')} requires a new recipient acknowledgement.`)
  if (command.rationale.trim().length < 15 || !command.authorizedBy.trim()) throw new Error('A specific policy rationale and authorizing operator are required.')
  const next = structuredClone(state)
  next.recipientPolicies.push({ id: command.id, projectId: command.projectId, recipient: command.recipient, previousPackageId: previous.id, currentPackageId: current.id, previousResponseId: priorResponse.id, changedScope, contentScopes: [...contentScopes], recipientPolicyRevision: state.recipientPolicyRevisions.filter((item) => item.projectId === command.projectId).at(-1)?.revision ?? 0, decision: command.decision, rationale: command.rationale.trim(), authorizedBy: command.authorizedBy.trim(), authorizedOn: command.authorizedOn, immutable: true })
  next.revision += 1
  return next
}

export function substituteCloseoutRecipient(state: CloseoutPortfolioState, command: { id: string; expectedRevision: number; authority: PortfolioAuthority; handoffId: string; substituteRecipient: string; reason: RecipientSubstitution['reason']; approvalReference: string; approvedBy: string; approvedOn: string; dueOn: string }) {
  if (state.recipientSubstitutions.some((item) => item.id === command.id)) return state
  const handoff = state.handoffs.find((item) => item.id === command.handoffId)
  if (!handoff) throw new Error('A current closeout handoff is required for substitution.')
  if (state.revision !== command.expectedRevision) throw new CloseoutControlError('STALE_REVISION', handoff.projectId, 'Closeout changed. Refresh before recipient substitution.')
  if (!closeoutPermissions(command.authority).canAuthorizeClosure) throw new CloseoutControlError('UNAUTHORIZED', handoff.projectId, 'Only the commercial director can authorize recipient substitution.')
  if (state.evidencePackages.filter((item) => item.projectId === handoff.projectId && item.status === 'final').at(-1)?.id !== handoff.packageId || state.handoffs.filter((item) => item.packageId === handoff.packageId && item.recipient === handoff.recipient).at(-1)?.id !== handoff.id) throw new Error('Substitution requires the current recipient and final package.')
  if (!command.substituteRecipient.trim() || command.substituteRecipient.trim() === (handoff.recipientIdentity ?? handoff.recipient) || !['responsibility changed', 'representative replaced', 'contact superseded'].includes(command.reason) || !command.approvalReference.trim() || !command.approvedBy.trim() || command.dueOn <= command.approvedOn) throw new Error('A distinct substitute, policy reason, approval evidence, and future due date are required.')
  const next = structuredClone(state)
  const replacementHandoffId = `${command.id}:handoff`
  next.handoffs.push({ id: replacementHandoffId, projectId: handoff.projectId, packageId: handoff.packageId, packageSourceRevision: handoff.packageSourceRevision, recipient: handoff.recipient, recipientIdentity: command.substituteRecipient.trim(), dueOn: command.dueOn, previousHandoffId: handoff.id, preparedBy: command.approvedBy.trim(), preparedOn: command.approvedOn, immutable: true })
  next.recipientSubstitutions.push({ id: command.id, handoffId: handoff.id, replacementHandoffId, packageId: handoff.packageId, packageSourceRevision: handoff.packageSourceRevision, originalRecipient: handoff.recipientIdentity ?? handoff.recipient, substituteRecipient: command.substituteRecipient.trim(), reason: command.reason, approvalReference: command.approvalReference.trim(), approvedBy: command.approvedBy.trim(), approvedOn: command.approvedOn, immutable: true })
  next.revision += 1
  return next
}

export function prepareCloseoutHandoff(state: CloseoutPortfolioState, command: { id: string; expectedRevision: number; authority: PortfolioAuthority; packageId: string; recipient: CloseoutRecipient; recipientIdentity?: string; dueOn?: string; preparedBy: string; preparedOn: string }) {
  if (state.handoffs.some((item) => item.id === command.id)) return state
  const pkg = state.evidencePackages.find((item) => item.id === command.packageId)
  if (!pkg) throw new Error('A final closeout package is required for recipient handoff.')
  if (pkg.status !== 'final') throw new Error('A final closeout package is required for recipient handoff.')
  if (state.revision !== command.expectedRevision) throw new CloseoutControlError('STALE_REVISION', pkg.projectId, 'Closeout changed. Refresh before preparing recipient handoff.')
  if (!closeoutPermissions(command.authority).canAuthorizeClosure) throw new CloseoutControlError('UNAUTHORIZED', pkg.projectId, 'Only the commercial director can prepare closeout handoff.')
  if (state.evidencePackages.filter((item) => item.projectId === pkg.projectId && item.status === 'final').at(-1)?.id !== pkg.id) throw new Error('A newer final package superseded this handoff source.')
  if (state.recipientPolicies.some((item) => item.currentPackageId === pkg.id && item.recipient === command.recipient && item.decision === 'retain acknowledgement')) throw new Error('Recipient obligation remains satisfied under the approved unchanged-scope policy.')
  const priorPackage = state.evidencePackages.filter((item) => item.projectId === pkg.projectId && item.status === 'final').at(-2)
  if (priorPackage && priorAcknowledgement(state, priorPackage.id, command.recipient) && !state.recipientPolicies.some((item) => item.currentPackageId === pkg.id && item.recipient === command.recipient)) throw new Error('Review supersession policy before preparing a renewed recipient handoff.')
  if (!currentRequiredRecipients(state, pkg.projectId).includes(command.recipient) || !command.preparedBy.trim()) throw new Error('A required recipient and preparing operator are needed.')
  if (state.handoffs.some((item) => item.packageId === pkg.id && item.recipient === command.recipient)) throw new Error('This recipient already has a handoff for the selected package.')
  const next = structuredClone(state)
  next.handoffs.push({ id: command.id, projectId: pkg.projectId, packageId: pkg.id, packageSourceRevision: pkg.sourceRevision, recipient: command.recipient, recipientIdentity: command.recipientIdentity?.trim() ? command.recipientIdentity.trim() : command.recipient, ...(command.dueOn ? { dueOn: command.dueOn } : {}), preparedBy: command.preparedBy.trim(), preparedOn: command.preparedOn, immutable: true })
  next.revision += 1
  return next
}

export function reassignCloseoutHandoff(state: CloseoutPortfolioState, command: { id: string; expectedRevision: number; authority: PortfolioAuthority; handoffId: string; recipientIdentity: string; dueOn: string; reason: string; reassignedBy: string; reassignedOn: string }) {
  if (state.handoffs.some((item) => item.id === command.id)) return state
  const handoff = state.handoffs.find((item) => item.id === command.handoffId)
  if (!handoff) throw new Error('A current recipient handoff is required for reassignment.')
  if (state.revision !== command.expectedRevision) throw new CloseoutControlError('STALE_REVISION', handoff.projectId, 'Closeout changed. Refresh before reassigning the recipient.')
  if (!closeoutPermissions(command.authority).canAuthorizeClosure) throw new CloseoutControlError('UNAUTHORIZED', handoff.projectId, 'Only the commercial director can reassign a recipient handoff.')
  if (state.evidencePackages.filter((item) => item.projectId === handoff.projectId && item.status === 'final').at(-1)?.id !== handoff.packageId) throw new Error('A newer final package requires its own recipient obligation.')
  if (state.handoffs.filter((item) => item.packageId === handoff.packageId && item.recipient === handoff.recipient).at(-1)?.id !== handoff.id || state.recipientResponses.some((item) => item.handoffId === handoff.id)) throw new Error('Only an unanswered current handoff can be reassigned.')
  if (!command.recipientIdentity.trim() || command.recipientIdentity.trim() === (handoff.recipientIdentity ?? handoff.recipient) || command.reason.trim().length < 15 || !command.reassignedBy.trim() || command.dueOn <= command.reassignedOn) throw new Error('A different recipient, future due date, operator, and reassignment reason are required.')
  const next = structuredClone(state)
  next.handoffs.push({ id: command.id, projectId: handoff.projectId, packageId: handoff.packageId, packageSourceRevision: handoff.packageSourceRevision, recipient: handoff.recipient, recipientIdentity: command.recipientIdentity.trim(), dueOn: command.dueOn, previousHandoffId: handoff.id, reassignmentReason: command.reason.trim(), preparedBy: command.reassignedBy.trim(), preparedOn: command.reassignedOn, immutable: true })
  next.revision += 1
  return next
}

export function recordCloseoutRecipientResponse(state: CloseoutPortfolioState, command: { id: string; expectedRevision: number; authority: PortfolioAuthority; handoffId: string; packageId: string; recipient: CloseoutRecipient; decision: CloseoutRecipientResponse['decision']; receiptReference: string; rationale: string; recordedBy: string; recordedOn: string }) {
  if (state.recipientResponses.some((item) => item.id === command.id)) return state
  const handoff = state.handoffs.find((item) => item.id === command.handoffId)
  if (!handoff) throw new Error('A prepared closeout handoff is required before recording recipient response.')
  if (state.revision !== command.expectedRevision) throw new CloseoutControlError('STALE_REVISION', handoff.projectId, 'Closeout changed. Refresh before recording recipient response.')
  if (!closeoutPermissions(command.authority).canAuthorizeClosure) throw new CloseoutControlError('UNAUTHORIZED', handoff.projectId, 'Only the commercial director can record verified recipient response evidence.')
  if (handoff.packageId !== command.packageId || handoff.recipient !== command.recipient) throw new Error('Recipient response must reference the exact handoff, package, and recipient.')
  if (state.handoffs.filter((item) => item.packageId === handoff.packageId && item.recipient === handoff.recipient).at(-1)?.id !== handoff.id) throw new Error('Recipient handoff was reassigned; record evidence against its current recipient.')
  if (state.evidencePackages.filter((item) => item.projectId === handoff.projectId && item.status === 'final').at(-1)?.id !== handoff.packageId) throw new Error('A newer final package requires a new recipient handoff.')
  if (state.recipientResponses.some((item) => item.handoffId === handoff.id)) throw new Error('This handoff already has a recorded recipient response.')
  if (!command.receiptReference.trim() || !command.recordedBy.trim() || (command.decision === 'correction-requested' && command.rationale.trim().length < 15)) throw new Error('Receipt evidence, operator, and correction rationale are required.')
  const next = structuredClone(state)
  next.recipientResponses.push({ id: command.id, handoffId: handoff.id, packageId: handoff.packageId, recipient: handoff.recipient, decision: command.decision, receiptReference: command.receiptReference.trim(), rationale: command.rationale.trim(), recordedBy: command.recordedBy.trim(), recordedOn: command.recordedOn, immutable: true })
  next.revision += 1
  return next
}

export function getCloseoutHandoffStatus(state: CloseoutPortfolioState, projectId: string, asOf?: string) {
  const pkg = state.evidencePackages.filter((item) => item.projectId === projectId && item.status === 'final').at(-1) ?? null
  const previous = state.evidencePackages.filter((item) => item.projectId === projectId && item.status === 'final').at(-2) ?? null
  const recipients = currentRequiredRecipients(state, projectId).map((recipient) => { const handoff = state.handoffs.filter((item) => item.packageId === pkg?.id && item.recipient === recipient).at(-1) ?? null; const response = state.recipientResponses.find((item) => item.handoffId === handoff?.id) ?? null; const policy = state.recipientPolicies.find((item) => item.currentPackageId === pkg?.id && item.recipient === recipient) ?? null; const priorResponse = previous ? priorAcknowledgement(state, previous.id, recipient) : null; const contentScopes = currentRecipientContentScope(state, projectId, recipient); return { recipient, contentScopes, handoff, response, policy, changedScope: previous && pkg ? recipientPackageChanges(previous, pkg, recipient, contentScopes) : [], status: !handoff ? policy?.decision === 'retain acknowledgement' ? 'acknowledged' as const : previous && priorResponse && !policy ? 'policy review required' as const : 'not prepared' as const : !response ? asOf && handoff.dueOn && asOf > handoff.dueOn ? 'overdue' as const : 'awaiting manual receipt' as const : response.decision } })
  return { package: pkg, recipients, complete: Boolean(pkg) && recipients.every((item) => item.status === 'acknowledged') }
}

function currentHandoverObligations(state: CloseoutPortfolioState, projectId: string) {
  return getCloseoutHandoffStatus(state, projectId).recipients.map((item) => ({ recipient: item.recipient, handoffId: item.handoff?.id ?? null, responseId: item.response?.id ?? item.policy?.previousResponseId ?? '', retainedPolicyId: item.policy?.decision === 'retain acknowledgement' ? item.policy.id : null }))
}

export function getProjectHandoverAcceptance(state: CloseoutPortfolioState, projectId: string) {
  const status = getCloseoutHandoffStatus(state, projectId)
  const latest = state.handoverAcceptances.filter((item) => item.projectId === projectId).at(-1) ?? null
  const policyRevision = state.recipientPolicyRevisions.filter((item) => item.projectId === projectId).at(-1)?.revision ?? 0
  const current = Boolean(latest && status.complete && latest.packageId === status.package?.id && latest.recipientPolicyRevision === policyRevision && JSON.stringify(latest.obligations) === JSON.stringify(currentHandoverObligations(state, projectId)))
  return { latest, current, ready: status.complete && !current, outstanding: status.recipients.filter((item) => item.status !== 'acknowledged').map((item) => `${item.recipient}: ${item.status}`), status: current ? 'handover accepted' : latest ? 'acceptance superseded' : status.complete ? 'ready for acceptance' : 'recipient completion outstanding' }
}

export function acceptProjectHandover(state: CloseoutPortfolioState, command: { id: string; expectedRevision: number; authority: PortfolioAuthority; projectId: string; packageId: string; acceptanceReference: string; acceptedBy: string; acceptedOn: string }) {
  if (state.handoverAcceptances.some((item) => item.id === command.id)) return state
  if (state.revision !== command.expectedRevision) throw new CloseoutControlError('STALE_REVISION', command.projectId, 'Closeout changed. Refresh before accepting project handover.')
  if (!closeoutPermissions(command.authority).canAuthorizeClosure) throw new CloseoutControlError('UNAUTHORIZED', command.projectId, 'Only the commercial director can accept project handover.')
  const handoff = getCloseoutHandoffStatus(state, command.projectId)
  const pkg = handoff.package
  if (pkg?.id !== command.packageId) throw new CloseoutControlError('STALE_REVISION', command.projectId, 'Acceptance must reference the current final package.')
  if (!handoff.complete) throw new CloseoutControlError('UNRESOLVED_OBLIGATION', command.projectId, `Recipient completion remains outstanding: ${getProjectHandoverAcceptance(state, command.projectId).outstanding.join('; ')}.`)
  if (getProjectHandoverAcceptance(state, command.projectId).current) throw new Error('This package and recipient policy already have current handover acceptance.')
  const latestEvidenceOn = [pkg.assembledOn, ...handoff.recipients.map((item) => item.response?.recordedOn ?? item.policy?.authorizedOn ?? pkg.assembledOn), ...state.recipientPolicyRevisions.filter((item) => item.projectId === command.projectId).map((item) => item.effectiveOn)].sort().at(-1) ?? ''
  const acceptedDate = new Date(command.acceptedOn + 'T00:00:00Z')
  if (!command.id.trim() || !command.acceptanceReference.trim() || !command.acceptedBy.trim() || !/^20\d{2}-\d{2}-\d{2}$/.test(command.acceptedOn) || !Number.isFinite(acceptedDate.getTime()) || acceptedDate.toISOString().slice(0, 10) !== command.acceptedOn || command.acceptedOn < latestEvidenceOn) throw new CloseoutControlError('MISSING_EVIDENCE', command.projectId, 'Acceptance reference, operator, and date after the reviewed recipient evidence are required.')
  const next = structuredClone(state)
  next.handoverAcceptances.push({ id: command.id, projectId: command.projectId, packageId: pkg.id, packageSourceRevision: pkg.sourceRevision, recipientPolicyRevision: state.recipientPolicyRevisions.filter((item) => item.projectId === command.projectId).at(-1)?.revision ?? 0, obligations: currentHandoverObligations(state, command.projectId), acceptanceReference: command.acceptanceReference.trim(), acceptedBy: command.acceptedBy.trim(), acceptedOn: command.acceptedOn, immutable: true })
  next.revision += 1
  return next
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
  if (![command.satisfiedDocuments, command.waivedDocuments, command.waivedExposureCents].every((value) => Number.isSafeInteger(value) && value >= 0) || (command.waivedDocuments === 0 && command.waivedExposureCents !== 0) || command.evidenceIds.some((item) => !item.trim()) || new Set(command.evidenceIds).size !== command.evidenceIds.length) throw new CloseoutControlError('MISSING_EVIDENCE', command.projectId, 'Whole nonnegative document counts, distinct evidence, and exposure only for explicit waivers are required.')
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

export interface ProjectCloseoutArchive {
  schemaVersion: 1
  id: string
  projectId: string
  sourceRevision: number
  createdOn: string
  currentPackageId: string
  accountRevision: number
  project: ProjectCloseoutRecord
  interventions: CloseoutIntervention[]
  closures: ProjectClosure[]
  finalAccounts: FinalAccountRecord[]
  documentCustody: CloseoutDocumentCustodyRecord[]
  waivers: CloseoutWaiverRecord[]
  adjustments: FinalAccountAdjustment[]
  evidencePackages: CloseoutEvidencePackage[]
  handoffs: CloseoutHandoff[]
  recipientResponses: CloseoutRecipientResponse[]
  recipientSubstitutions: RecipientSubstitution[]
  recipientPolicies: RecipientSupersessionPolicy[]
  recipientPolicyRevisions: RecipientPolicyRevision[]
  handoverAcceptances?: HandoverAcceptance[]
}

export function captureProjectCloseoutArchive(state: CloseoutPortfolioState, command: { id: string; projectId: string; authority: PortfolioAuthority; createdOn: string }): ProjectCloseoutArchive {
  if (command.authority !== 'Commercial Director') throw new CloseoutControlError('UNAUTHORIZED', command.projectId, 'Only the commercial director can archive final closeout.')
  const project = state.projects.find((item) => item.projectId === command.projectId)
  const pkg = state.evidencePackages.filter((item) => item.projectId === command.projectId && item.status === 'final').at(-1)
  if (!project || !pkg || !command.id.trim() || !/^20\d{2}-\d{2}-\d{2}$/.test(command.createdOn)) throw new Error('Final closeout package, archive identity, and business date are required.')
  const handoffs = state.handoffs.filter((item) => item.projectId === command.projectId)
  const handoffIds = new Set(handoffs.map((item) => item.id))
  return structuredClone({ schemaVersion: 1, id: command.id.trim(), projectId: command.projectId, sourceRevision: state.revision, createdOn: command.createdOn, currentPackageId: pkg.id, accountRevision: pkg.accountRevision, project, interventions: state.interventions.filter((item) => item.projectId === command.projectId), closures: state.closures.filter((item) => item.projectId === command.projectId), finalAccounts: state.finalAccounts.filter((item) => item.projectId === command.projectId), documentCustody: state.documentCustody.filter((item) => item.projectId === command.projectId), waivers: state.waivers.filter((item) => item.projectId === command.projectId), adjustments: state.adjustments.filter((item) => item.projectId === command.projectId), evidencePackages: state.evidencePackages.filter((item) => item.projectId === command.projectId), handoffs, recipientResponses: state.recipientResponses.filter((item) => handoffIds.has(item.handoffId)), recipientSubstitutions: state.recipientSubstitutions.filter((item) => handoffIds.has(item.handoffId)), recipientPolicies: state.recipientPolicies.filter((item) => item.projectId === command.projectId), recipientPolicyRevisions: state.recipientPolicyRevisions.filter((item) => item.projectId === command.projectId), handoverAcceptances: state.handoverAcceptances.filter((item) => item.projectId === command.projectId) })
}

function validHandoverAcceptanceShape(item: unknown): item is HandoverAcceptance {
  if (!item || typeof item !== 'object') return false
  const value = item as Record<string, unknown>
  if (['id', 'projectId', 'packageId', 'acceptanceReference', 'acceptedBy', 'acceptedOn'].some((key) => typeof value[key] !== 'string' || !value[key].trim()) || !Number.isSafeInteger(value['packageSourceRevision']) || !Number.isSafeInteger(value['recipientPolicyRevision']) || !Array.isArray(value['obligations']) || value['immutable'] !== true) return false
  return (value['obligations'] as unknown[]).every((obligation) => { if (!obligation || typeof obligation !== 'object') return false; const entry = obligation as Record<string, unknown>; return typeof entry['recipient'] === 'string' && [...requiredCloseoutRecipients, 'Independent certifier'].includes(entry['recipient']) && typeof entry['responseId'] === 'string' && Boolean(entry['responseId']) && (entry['handoffId'] === null || typeof entry['handoffId'] === 'string') && (entry['retainedPolicyId'] === null || typeof entry['retainedPolicyId'] === 'string') })
}
export function parseProjectCloseoutArchive(raw: string): ProjectCloseoutArchive {
  const parsed: unknown = JSON.parse(raw)
  if (!parsed || typeof parsed !== 'object') throw new Error('Closeout archive is invalid.')
  const value = parsed as Record<string, unknown>
  if (value['schemaVersion'] !== 1) throw new Error('Unsupported closeout archive schema.')
  if (typeof value['id'] !== 'string' || typeof value['projectId'] !== 'string' || !Number.isSafeInteger(value['sourceRevision']) || typeof value['currentPackageId'] !== 'string' || !value['project'] || typeof value['project'] !== 'object') throw new Error('Closeout archive identity is invalid.')
  if ((value['project'] as Record<string, unknown>)['projectId'] !== value['projectId']) throw new Error('Closeout archive project identity is invalid.')
  for (const key of ['interventions', 'closures', 'finalAccounts', 'documentCustody', 'waivers', 'adjustments', 'evidencePackages', 'handoffs', 'recipientResponses', 'recipientSubstitutions', 'recipientPolicies', 'recipientPolicyRevisions']) if (!Array.isArray(value[key]) || !(value[key] as unknown[]).every((item) => item && typeof item === 'object' && typeof (item as Record<string, unknown>)['id'] === 'string')) throw new Error(`Closeout archive ${key} is invalid.`)
  if (value['handoverAcceptances'] !== undefined && (!Array.isArray(value['handoverAcceptances']) || !(value['handoverAcceptances'] as unknown[]).every(validHandoverAcceptanceShape))) throw new Error('Closeout handover acceptance history is invalid.')
  return value as unknown as ProjectCloseoutArchive
}

export function previewProjectCloseoutRestore(state: CloseoutPortfolioState, archive: ProjectCloseoutArchive, projectId: string) {
  const reasons: string[] = []
  const project = state.projects.find((item) => item.projectId === projectId)
  if (archive.projectId !== projectId || project?.contractor !== archive.project.contractor) reasons.push('Archive project or contractor identity does not match.')
  if (archive.sourceRevision !== state.revision) reasons.push('Project changed after archive capture; newer work cannot be overwritten.')
  const pkg = archive.evidencePackages.find((item) => item.id === archive.currentPackageId && item.status === 'final')
  if (!pkg) reasons.push('Final package, account revision, or closure source is missing.')
  else if (pkg.accountRevision !== archive.accountRevision || !archive.finalAccounts.some((item) => item.id === pkg.accountId && item.revision === pkg.accountRevision) || !archive.closures.some((item) => item.id === pkg.closureId)) reasons.push('Final package, account revision, or closure source is missing.')
  if (pkg && (pkg.custodyIds.some((id) => !archive.documentCustody.some((item) => item.id === id)) || pkg.waiverIds.some((id) => !archive.waivers.some((item) => item.id === id)) || pkg.acceptedAdjustmentIds.some((id) => !archive.adjustments.some((item) => item.id === id && item.status === 'accepted')))) reasons.push('Package custody, waiver, or adjustment references are incomplete.')
  if (archive.recipientResponses.some((item) => !archive.handoffs.some((handoff) => handoff.id === item.handoffId && handoff.packageId === item.packageId)) || archive.handoffs.some((item) => !archive.evidencePackages.some((entry) => entry.id === item.packageId))) reasons.push('Recipient handoff or acknowledgement lineage is incomplete.')
  if ([...archive.interventions, ...archive.closures, ...archive.finalAccounts, ...archive.documentCustody, ...archive.waivers, ...archive.adjustments, ...archive.evidencePackages, ...archive.handoffs, ...archive.recipientPolicies, ...archive.recipientPolicyRevisions].some((item) => item.projectId !== projectId)) reasons.push('Archived evidence belongs to another project.')
  if ((archive.handoverAcceptances ?? []).some((item) => {
    if (!validHandoverAcceptanceShape(item) || item.projectId !== projectId || !archive.evidencePackages.some((pkg) => pkg.id === item.packageId && pkg.sourceRevision === item.packageSourceRevision)) return true
    const policy = item.recipientPolicyRevision === 0 ? null : archive.recipientPolicyRevisions.find((entry) => entry.projectId === projectId && entry.revision === item.recipientPolicyRevision)
    if (item.recipientPolicyRevision > 0 && !policy) return true
    const required = policy?.requiredRecipients ?? requiredCloseoutRecipients
    if (item.obligations.length !== required.length || new Set(item.obligations.map((entry) => entry.recipient)).size !== required.length || item.obligations.some((entry) => !required.includes(entry.recipient))) return true
    return item.obligations.some((obligation) => {
      const response = archive.recipientResponses.find((entry) => entry.id === obligation.responseId && entry.recipient === obligation.recipient && entry.decision === 'acknowledged')
      if (!response) return true
      if (obligation.retainedPolicyId) return !archive.recipientPolicies.some((entry) => entry.id === obligation.retainedPolicyId && entry.projectId === projectId && entry.recipient === obligation.recipient && entry.currentPackageId === item.packageId && entry.previousPackageId === response.packageId && entry.previousResponseId === response.id && entry.decision === 'retain acknowledgement')
      return response.packageId !== item.packageId || response.handoffId !== obligation.handoffId || !archive.handoffs.some((entry) => entry.id === obligation.handoffId && entry.packageId === item.packageId && entry.recipient === obligation.recipient)
    })
  })) reasons.push('Handover acceptance evidence lineage is incomplete.')
  const histories = [[archive.interventions, state.interventions], [archive.closures, state.closures], [archive.finalAccounts, state.finalAccounts], [archive.documentCustody, state.documentCustody], [archive.waivers, state.waivers], [archive.adjustments, state.adjustments], [archive.evidencePackages, state.evidencePackages], [archive.handoffs, state.handoffs], [archive.recipientResponses, state.recipientResponses], [archive.recipientSubstitutions, state.recipientSubstitutions], [archive.recipientPolicies, state.recipientPolicies], [archive.recipientPolicyRevisions, state.recipientPolicyRevisions], [archive.handoverAcceptances ?? [], state.handoverAcceptances]] as const
  if (histories.some(([archived]) => new Set(archived.map((item) => item.id)).size !== archived.length)) reasons.push('Closeout archive repeats an evidence identity. Each closure, custody record, and recipient response must appear once.')
  if (archive.recipientResponses.some((item) => !archive.handoffs.some((handoff) => handoff.id === item.handoffId && handoff.recipient === item.recipient))) reasons.push('Recipient response does not belong to the assigned handoff recipient.')
  for (const [archived, current] of histories) for (const item of archived) {
    const existing = current.find((entry) => entry.id === item.id)
    if (existing && JSON.stringify(existing) !== JSON.stringify(item)) reasons.push(`Historical closeout record ${item.id} conflicts with its archive.`)
  }
  return { ready: reasons.length === 0, reasons, archiveId: archive.id, sourceRevision: archive.sourceRevision, currentRevision: state.revision }
}

export function restoreProjectCloseoutArchive(state: CloseoutPortfolioState, archive: ProjectCloseoutArchive, command: { id: string; expectedRevision: number; authority: PortfolioAuthority; projectId: string; restoredBy: string; restoredOn: string }) {
  if (command.authority !== 'Commercial Director') throw new CloseoutControlError('UNAUTHORIZED', command.projectId, 'Only the commercial director can restore closeout evidence.')
  if (state.archiveRestores.some((item) => item.archiveId === archive.id)) return state
  if (state.revision !== command.expectedRevision) throw new CloseoutControlError('STALE_REVISION', command.projectId, 'Closeout changed before archive restore.')
  const preview = previewProjectCloseoutRestore(state, archive, command.projectId)
  if (!preview.ready || !command.id.trim() || !command.restoredBy.trim()) throw new Error(preview.reasons.join(' ') || 'Restore identity and actor are required.')
  const next = structuredClone(state)
  const projectIndex = next.projects.findIndex((item) => item.projectId === command.projectId)
  next.projects[projectIndex] = structuredClone(archive.project)
  const merge = <T extends { id: string }>(current: T[], saved: T[]) => [...current, ...structuredClone(saved).filter((item) => !current.some((existing) => existing.id === item.id))]
  next.interventions = merge(next.interventions, archive.interventions)
  next.closures = merge(next.closures, archive.closures)
  next.finalAccounts = merge(next.finalAccounts, archive.finalAccounts)
  next.documentCustody = merge(next.documentCustody, archive.documentCustody)
  next.waivers = merge(next.waivers, archive.waivers)
  next.adjustments = merge(next.adjustments, archive.adjustments)
  next.evidencePackages = merge(next.evidencePackages, archive.evidencePackages)
  next.handoffs = merge(next.handoffs, archive.handoffs)
  next.recipientResponses = merge(next.recipientResponses, archive.recipientResponses)
  next.recipientSubstitutions = merge(next.recipientSubstitutions, archive.recipientSubstitutions)
  next.recipientPolicies = merge(next.recipientPolicies, archive.recipientPolicies)
  next.recipientPolicyRevisions = merge(next.recipientPolicyRevisions, archive.recipientPolicyRevisions)
  next.handoverAcceptances = merge(next.handoverAcceptances, archive.handoverAcceptances ?? [])
  next.archiveRestores.push({ id: command.id, archiveId: archive.id, projectId: command.projectId, sourceRevision: archive.sourceRevision, restoredBy: command.restoredBy.trim(), restoredOn: command.restoredOn, immutable: true })
  next.revision += 1
  return next
}

export interface CloseoutPersistence { load(): CloseoutPortfolioState | null; save(next: CloseoutPortfolioState): void }
export class BrowserCloseoutPersistence implements CloseoutPersistence {
  static key = 'buildledger:closeout-portfolio:v2'
  private readonly storage: Pick<Storage, 'getItem' | 'setItem'>
  constructor(storage: Pick<Storage, 'getItem' | 'setItem'>) { this.storage = storage }
  load() { const raw = this.storage.getItem(BrowserCloseoutPersistence.key); if (!raw) return null; const saved = JSON.parse(raw) as Partial<CloseoutPortfolioState>; return { ...(saved as CloseoutPortfolioState), finalAccounts: saved.finalAccounts ?? [], documentCustody: saved.documentCustody ?? [], waivers: saved.waivers ?? [], adjustments: saved.adjustments ?? [], evidencePackages: saved.evidencePackages ?? [], handoffs: saved.handoffs ?? [], recipientResponses: saved.recipientResponses ?? [], recipientSubstitutions: saved.recipientSubstitutions ?? [], recipientPolicies: saved.recipientPolicies ?? [], recipientPolicyRevisions: saved.recipientPolicyRevisions ?? [], handoverAcceptances: saved.handoverAcceptances ?? [], archiveRestores: saved.archiveRestores ?? [] } }
  save(next: CloseoutPortfolioState) { this.storage.setItem(BrowserCloseoutPersistence.key, JSON.stringify(next)) }
}
export class CloseoutPortfolioRepository {
  private readonly persistence: CloseoutPersistence
  constructor(persistence: CloseoutPersistence) { this.persistence = persistence }
  read(): CloseoutPortfolioState { return this.persistence.load() ?? structuredClone(initialCloseoutPortfolioState) }
  dispatch(command: ScheduleCloseoutIntervention | AuthorizeProjectClosure | ProposeFinalAccountAdjustment | ReviewFinalAccountAdjustment | CategorizedAdjustmentProposal | AssembleCloseoutEvidence | Parameters<typeof prepareCloseoutHandoff>[1] | Parameters<typeof reassignCloseoutHandoff>[1] | Parameters<typeof recordCloseoutRecipientResponse>[1] | Parameters<typeof substituteCloseoutRecipient>[1] | Parameters<typeof reviewRecipientPackageSupersession>[1] | Parameters<typeof changeCloseoutRecipientPolicy>[1] | Parameters<typeof acceptProjectHandover>[1]) {
    const current = this.read()
    const next = 'acceptanceReference' in command ? acceptProjectHandover(current, command) : 'requiredRecipients' in command ? changeCloseoutRecipientPolicy(current, command) : 'receiptReference' in command ? recordCloseoutRecipientResponse(current, command) : 'substituteRecipient' in command ? substituteCloseoutRecipient(current, command) : 'handoffId' in command ? reassignCloseoutHandoff(current, command) : 'packageId' in command ? prepareCloseoutHandoff(current, command) : 'recipient' in command && 'decision' in command ? reviewRecipientPackageSupersession(current, command) : 'status' in command ? assembleCloseoutEvidencePackage(current, command) : 'commercialReason' in command ? proposeCategorizedFinalAccountAdjustment(current, command) : 'decision' in command ? reviewFinalAccountAdjustment(current, command) : 'category' in command ? proposeFinalAccountAdjustment(current, command) : 'satisfiedDocuments' in command ? authorizeProjectClosure(current, command) : scheduleCloseoutIntervention(current, command)
    if (next !== current) this.persistence.save(next)
    return next
  }
  restore(archive: ProjectCloseoutArchive, command: Parameters<typeof restoreProjectCloseoutArchive>[2]) { const current = this.read(); const next = restoreProjectCloseoutArchive(current, archive, command); if (next !== current) this.persistence.save(next); return next }
}
