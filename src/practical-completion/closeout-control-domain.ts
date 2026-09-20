import { assessCloseoutPortfolio, seededCloseoutPortfolio, type ProjectCloseoutRecord } from './closeout-portfolio'

export type PortfolioAuthority = 'Portfolio Viewer' | 'Commercial Director'
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
export interface CloseoutPortfolioState {
  revision: number
  projects: ProjectCloseoutRecord[]
  interventions: CloseoutIntervention[]
  closures: ProjectClosure[]
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
}

export function scheduleCloseoutIntervention(state: CloseoutPortfolioState, command: ScheduleCloseoutIntervention) {
  if (state.interventions.some((item) => item.id === command.id)) return state
  if (state.revision !== command.expectedRevision) throw new Error('Closeout portfolio changed. Refresh before scheduling intervention.')
  if (!closeoutPermissions(command.authority).canIntervene) throw new Error('Only the commercial director can schedule a portfolio intervention.')
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
  if (state.revision !== command.expectedRevision) throw new Error('Closeout portfolio changed. Refresh before closure.')
  if (!closeoutPermissions(command.authority).canAuthorizeClosure) throw new Error('Only the commercial director can authorize project closure.')
  const project = state.projects.find((item) => item.projectId === command.projectId)
  const intervention = [...state.interventions].reverse().find((item) => item.projectId === command.projectId)
  if (!project || !intervention) throw new Error('A governed closeout intervention is required before closure.')
  if (command.satisfiedDocuments + command.waivedDocuments !== project.openDocuments) throw new Error('Every open document must be satisfied or explicitly waived.')
  if (command.evidenceIds.length < command.satisfiedDocuments || !command.finalAccountReference || !command.custodyReference) throw new Error('Completion, final-account, and custody evidence are required.')
  if (command.waivedDocuments > 0 && (!command.waiverAuthority || (command.waiverRationale?.trim().length ?? 0) < 20 || command.waivedExposureCents <= 0)) throw new Error('A waiver requires authority, rationale, and commercial consequence.')
  const next = structuredClone(state)
  const target = next.projects.find((item) => item.projectId === project.projectId)
  if (!target) throw new Error('Project disappeared during closure.')
  next.closures.push({ ...command, interventionId: intervention.id, evidenceIds: [...command.evidenceIds], waiverRationale: command.waiverRationale?.trim() ?? null, immutable: true })
  target.openDocuments = 0
  target.commercialExposureCents = command.waivedExposureCents
  next.revision += 1
  return next
}

export function queryProjectCloseoutHistory(state: CloseoutPortfolioState, projectId: string) {
  return [
    ...state.interventions.filter((item) => item.projectId === projectId).map((item) => ({ kind: 'intervention' as const, occurredOn: item.reviewOn, actor: item.assignedManager, evidence: [item.obligationReference], record: item })),
    ...state.closures.filter((item) => item.projectId === projectId).map((item) => ({ kind: 'closure' as const, occurredOn: item.closedOn, actor: item.authorizedBy, evidence: [...item.evidenceIds, item.finalAccountReference, item.custodyReference], record: item })),
  ].sort((a, b) => a.occurredOn.localeCompare(b.occurredOn))
}

export class CloseoutPortfolioRepository {
  static key = 'buildledger:closeout-portfolio:v2'
  private readonly storage: Pick<Storage, 'getItem' | 'setItem'>
  constructor(storage: Pick<Storage, 'getItem' | 'setItem'>) { this.storage = storage }
  read(): CloseoutPortfolioState {
    const raw = this.storage.getItem(CloseoutPortfolioRepository.key)
    return raw ? JSON.parse(raw) as CloseoutPortfolioState : structuredClone(initialCloseoutPortfolioState)
  }
  dispatch(command: ScheduleCloseoutIntervention | AuthorizeProjectClosure) {
    const current = this.read()
    const next = 'evidenceIds' in command ? authorizeProjectClosure(current, command) : scheduleCloseoutIntervention(current, command)
    if (next !== current) this.storage.setItem(CloseoutPortfolioRepository.key, JSON.stringify(next))
    return next
  }
}
