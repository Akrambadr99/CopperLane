/* eslint-disable react-refresh/only-export-components */
import { useRef, useState } from 'react'
import { assessCloseoutPortfolio, seededCloseoutPortfolio, type ProjectCloseoutRecord } from './closeout-portfolio'

export type PortfolioAuthority = 'Portfolio Viewer' | 'Commercial Director'
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
  if (command.authority !== 'Commercial Director') throw new Error('Only the commercial director can schedule a portfolio intervention.')
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
  if (command.authority !== 'Commercial Director') throw new Error('Only the commercial director can authorize project closure.')
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

export function CloseoutPortfolioControl() {
  const [repository] = useState(() => new CloseoutPortfolioRepository(localStorage))
  const [state, setState] = useState(() => repository.read())
  const [authority, setAuthority] = useState<PortfolioAuthority>('Portfolio Viewer')
  const [message, setMessage] = useState('')
  const feedback = useRef<HTMLParagraphElement>(null)
  const portfolio = assessCloseoutPortfolio(state.projects, '2026-10-20')
  const intervene = () => {
    try {
      setState(repository.dispatch({ id: crypto.randomUUID(), expectedRevision: state.revision, authority, projectId: 'PROJECT-SOUTH', assignedManager: 'director-closeout', reviewOn: '2026-10-22', asOf: '2026-10-20', reason: 'Commercial exposure and overdue documents require director intervention.' }))
      setMessage('Commercial intervention scheduled and responsibility transferred.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Closeout intervention failed.')
    }
    queueMicrotask(() => feedback.current?.focus())
  }
  const close = () => { try { setState(repository.dispatch({ id: crypto.randomUUID(), expectedRevision: state.revision, authority, projectId: 'PROJECT-SOUTH', evidenceIds: ['DOC-O&M-9', 'DOC-WARRANTY-3'], satisfiedDocuments: 2, waivedDocuments: 1, waiverAuthority: 'Commercial Director', waiverRationale: 'Minor training record accepted with retained commercial exposure.', waivedExposureCents: 40_000, finalAccountReference: 'FA-2026-009-FINAL', custodyReference: 'CUSTODY-882', authorizedBy: 'director-closeout', closedOn: '2026-10-24' })); setMessage('Project closeout authorized with immutable evidence and waiver consequence.') } catch (error) { setMessage(error instanceof Error ? error.message : 'Project closure failed.') } queueMicrotask(() => feedback.current?.focus()) }
  return <section className="card" aria-label="Closeout portfolio"><h2>Project closeout portfolio</h2><label>Portfolio authority<select value={authority} onChange={(event) => { setAuthority(event.target.value as PortfolioAuthority) }}><option>Portfolio Viewer</option><option>Commercial Director</option></select></label>{portfolio.map((item) => <p key={item.projectId}>{item.projectId} · {item.urgency} · coverage {item.coveragePercent}% · exposure {item.commercialExposureCents} · manager {item.commercialManager} · source {item.sourceReference}</p>)}<button disabled={authority !== 'Commercial Director' || state.interventions.length > 0} onClick={intervene}>Schedule overdue closeout intervention</button><button disabled={authority !== 'Commercial Director' || state.interventions.length === 0 || state.closures.length > 0} onClick={close}>Authorize evidence-based project closure</button>{message && <p ref={feedback} tabIndex={-1} role="status">{message}</p>}<ol aria-label="Closeout intervention history">{state.interventions.map((item) => <li key={item.id}>{item.projectId} · {item.previousManager} to {item.assignedManager} · review {item.reviewOn} · source {item.obligationReference}</li>)}</ol><ol aria-label="Project closure history">{state.closures.map((item) => <li key={item.id}>{item.projectId} · closed {item.closedOn} · evidence {item.evidenceIds.join(', ')} · waived {item.waivedDocuments} · retained exposure {item.waivedExposureCents}</li>)}</ol></section>
}
