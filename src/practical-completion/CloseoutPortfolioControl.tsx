import { useRef, useState } from 'react'
import { assessCloseoutPortfolio } from './closeout-portfolio'
import { BrowserCloseoutPersistence, CloseoutPortfolioRepository, type PortfolioAuthority } from './closeout-control-domain'

export function CloseoutPortfolioControl() {
  const [repository] = useState(() => new CloseoutPortfolioRepository(new BrowserCloseoutPersistence(localStorage)))
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
  return <section className="card" aria-label="Closeout portfolio"><h2>Project closeout portfolio</h2><label>Portfolio authority<select value={authority} onChange={(event) => { setAuthority(event.target.value as PortfolioAuthority) }}><option>Portfolio Viewer</option><option>Commercial Director</option></select></label>{portfolio.map((item) => <p key={item.projectId}>{item.projectId} · {item.urgency} · coverage {item.coveragePercent}% · exposure {item.commercialExposureCents} · manager {item.commercialManager} · source {item.sourceReference}</p>)}<button disabled={authority !== 'Commercial Director' || state.interventions.length > 0} onClick={intervene}>Schedule overdue closeout intervention</button><button disabled={authority !== 'Commercial Director' || state.interventions.length === 0 || state.closures.length > 0} onClick={close}>Authorize evidence-based project closure</button>{message && <p ref={feedback} tabIndex={-1} role="status">{message}</p>}<ol aria-label="Final account history">{state.finalAccounts.map((item) => <li key={item.id}>{item.projectId} · revision {item.revision} · {item.sourceReference} to {item.finalReference} · exposure {item.commercialExposureCents}</li>)}</ol><ol aria-label="Document custody history">{state.documentCustody.map((item) => <li key={item.id}>{item.documentReference} · {item.status} · custody {item.custodyReference}</li>)}</ol><ol aria-label="Closeout intervention history">{state.interventions.map((item) => <li key={item.id}>{item.projectId} · {item.previousManager} to {item.assignedManager} · review {item.reviewOn} · source {item.obligationReference}</li>)}</ol><ol aria-label="Project closure history">{state.closures.map((item) => <li key={item.id}>{item.projectId} · closed {item.closedOn} · evidence {item.evidenceIds.join(', ')} · waived {item.waivedDocuments} · retained exposure {item.waivedExposureCents}</li>)}</ol></section>
}
