import { describe, expect, it } from 'vitest'
import { authorizeProjectClosure, CloseoutControlError, CloseoutPortfolioRepository, closeoutPermissions, getCloseoutDocumentHistory, getFinalAccountAdjustmentReadiness, getFinalAccountHistory, initialCloseoutPortfolioState, proposeFinalAccountAdjustment, queryProjectCloseoutHistory, reviewFinalAccountAdjustment, scheduleCloseoutIntervention, type CloseoutPersistence, type CloseoutPortfolioState } from './closeout-control-domain'

const command = { id: 'intervention-1', expectedRevision: 0, authority: 'Commercial Director' as const, projectId: 'PROJECT-SOUTH', assignedManager: 'director-closeout', reviewOn: '2026-10-22', asOf: '2026-10-20', reason: 'Commercial exposure and overdue documents require director intervention.' }

describe('closeout portfolio intervention', () => {
  it('transfers responsibility and preserves immutable obligation lineage', () => {
    const next = scheduleCloseoutIntervention(initialCloseoutPortfolioState, command)
    expect(next.projects.find((item) => item.projectId === 'PROJECT-SOUTH')?.commercialManager).toBe('director-closeout')
    expect(next.interventions[0]).toMatchObject({ previousManager: 'commercial-south', obligationReference: 'FA-2026-009', immutable: true })
  })
  it('rejects unauthorized and stale interventions without mutation', () => {
    expect(() => scheduleCloseoutIntervention(initialCloseoutPortfolioState, { ...command, authority: 'Portfolio Viewer' })).toThrow('commercial director')
    expect(() => scheduleCloseoutIntervention(initialCloseoutPortfolioState, { ...command, expectedRevision: 2 })).toThrow('changed')
    expect(initialCloseoutPortfolioState.interventions).toEqual([])
  })
  it('treats a repeated intervention command as idempotent', () => {
    const next = scheduleCloseoutIntervention(initialCloseoutPortfolioState, command)
    expect(scheduleCloseoutIntervention(next, command)).toBe(next)
  })
})

describe('pre-closure final-account adjustments', () => {
  const proposal = { id: 'adjust-1', expectedRevision: 0, authority: 'Commercial Director' as const, projectId: 'PROJECT-SOUTH', reason: 'Approved variation must be reflected before final account closure.', category: 'variation' as const, valueCents: 25_000, evidenceIds: ['VO-19'], proposedBy: 'commercial-manager', proposedOn: '2026-10-21' }
  it('accepts a governed adjustment as a new account revision and changes exposure', () => { const proposed = proposeFinalAccountAdjustment(initialCloseoutPortfolioState, proposal); const accepted = reviewFinalAccountAdjustment(proposed, { id: 'review-1', expectedRevision: 1, authority: 'Commercial Director', adjustmentId: proposal.id, decision: 'accepted', reviewedBy: 'commercial-director', reviewedOn: '2026-10-22' }); expect(accepted.projects.find((item) => item.projectId === proposal.projectId)?.commercialExposureCents).toBe(305_000); expect(getFinalAccountAdjustmentReadiness(accepted, proposal.projectId)).toMatchObject({ pendingAdjustment: null, closureReady: true, latestAccount: { revision: 1, commercialExposureCents: 305_000 } }) })
  it('retains rejected and superseded proposals without changing commercial exposure', () => { const first = proposeFinalAccountAdjustment(initialCloseoutPortfolioState, proposal); const replacement = proposeFinalAccountAdjustment(first, { ...proposal, id: 'adjust-2', expectedRevision: 1, valueCents: 15_000 }); const rejected = reviewFinalAccountAdjustment(replacement, { id: 'review-2', expectedRevision: 2, authority: 'Commercial Director', adjustmentId: 'adjust-2', decision: 'rejected', reviewedBy: 'commercial-director', reviewedOn: '2026-10-22' }); expect(rejected.adjustments.map((item) => item.status)).toEqual(['superseded', 'rejected']); expect(rejected.projects.find((item) => item.projectId === proposal.projectId)?.commercialExposureCents).toBe(280_000) })
  it('blocks closure while an adjustment is pending and refuses post-closure changes', () => { const active = scheduleCloseoutIntervention(initialCloseoutPortfolioState, command); const proposed = proposeFinalAccountAdjustment(active, { ...proposal, expectedRevision: 1 }); expect(() => authorizeProjectClosure(proposed, { id: 'closure-pending', expectedRevision: 2, authority: 'Commercial Director', projectId: 'PROJECT-SOUTH', evidenceIds: ['DOC-1', 'DOC-2'], satisfiedDocuments: 2, waivedDocuments: 1, waiverAuthority: 'Commercial Director', waiverRationale: 'Minor training record accepted with retained commercial exposure.', waivedExposureCents: 40_000, finalAccountReference: 'FA-FINAL', custodyReference: 'CUSTODY-1', authorizedBy: 'director-closeout', closedOn: '2026-10-24' })).toThrow('Pending final-account'); const closed = authorizeProjectClosure(active, { id: 'closure-final', expectedRevision: 1, authority: 'Commercial Director', projectId: 'PROJECT-SOUTH', evidenceIds: ['DOC-1', 'DOC-2'], satisfiedDocuments: 2, waivedDocuments: 1, waiverAuthority: 'Commercial Director', waiverRationale: 'Minor training record accepted with retained commercial exposure.', waivedExposureCents: 40_000, finalAccountReference: 'FA-FINAL', custodyReference: 'CUSTODY-1', authorizedBy: 'director-closeout', closedOn: '2026-10-24' }); expect(() => proposeFinalAccountAdjustment(closed, { ...proposal, expectedRevision: 2 })).toThrow('closed project') })
})

describe('evidence-based project closure', () => {
  const closure = { id: 'closure-1', expectedRevision: 1, authority: 'Commercial Director' as const, projectId: 'PROJECT-SOUTH', evidenceIds: ['DOC-1', 'DOC-2'], satisfiedDocuments: 2, waivedDocuments: 1, waiverAuthority: 'Commercial Director', waiverRationale: 'Minor training record accepted with retained commercial exposure.', waivedExposureCents: 40_000, finalAccountReference: 'FA-FINAL', custodyReference: 'CUSTODY-1', authorizedBy: 'director-closeout', closedOn: '2026-10-24' }
  it('reconciles every obligation and preserves waiver evidence', () => {
    const active = scheduleCloseoutIntervention(initialCloseoutPortfolioState, command)
    const closed = authorizeProjectClosure(active, closure)
    expect(closed.projects.find((item) => item.projectId === 'PROJECT-SOUTH')).toMatchObject({ openDocuments: 0, commercialExposureCents: 40_000 })
    expect(closed.closures[0]).toMatchObject({ interventionId: 'intervention-1', waivedDocuments: 1, immutable: true })
    expect(getFinalAccountHistory(closed, 'PROJECT-SOUTH')[0]).toMatchObject({ sourceReference: 'FA-2026-009', finalReference: 'FA-FINAL', revision: 1, immutable: true })
    expect(getCloseoutDocumentHistory(closed, 'PROJECT-SOUTH')).toHaveLength(2)
    expect(closed.waivers[0]).toMatchObject({ waivedDocuments: 1, retainedExposureCents: 40_000, immutable: true })
  })
  it('blocks incomplete reconciliation and stale approval atomically', () => {
    const active = scheduleCloseoutIntervention(initialCloseoutPortfolioState, command)
    expect(() => authorizeProjectClosure(active, { ...closure, satisfiedDocuments: 1 })).toThrow('Every open document')
    expect(() => authorizeProjectClosure(active, { ...closure, expectedRevision: 0 })).toThrow('changed')
    expect(active.projects.find((item) => item.projectId === 'PROJECT-SOUTH')?.openDocuments).toBe(3)
  })
  it('requires director approval and makes duplicate closure idempotent', () => {
    const active = scheduleCloseoutIntervention(initialCloseoutPortfolioState, command)
    expect(() => authorizeProjectClosure(active, { ...closure, authority: 'Portfolio Viewer' })).toThrow('commercial director')
    const closed = authorizeProjectClosure(active, closure)
    expect(authorizeProjectClosure(closed, closure)).toBe(closed)
  })
  it('centralizes closeout capability and returns chronological evidence lineage', () => {
    expect(closeoutPermissions('Portfolio Viewer')).toEqual({ canIntervene: false, canAuthorizeClosure: false })
    const active = scheduleCloseoutIntervention(initialCloseoutPortfolioState, command)
    const closed = authorizeProjectClosure(active, closure)
    expect(queryProjectCloseoutHistory(closed, 'PROJECT-SOUTH').map((item) => [item.kind, item.actor])).toEqual([['intervention', 'director-closeout'], ['closure', 'director-closeout']])
    expect(queryProjectCloseoutHistory(closed, 'PROJECT-SOUTH')[1]?.evidence).toContain('FA-FINAL')
  })
  it('persists one atomic snapshot and exposes stable failure context', () => { let durable: CloseoutPortfolioState | null = null; let writes = 0; const persistence: CloseoutPersistence = { load: () => durable, save: (next) => { durable = structuredClone(next); writes += 1 } }; const repository = new CloseoutPortfolioRepository(persistence); repository.dispatch(command); expect(writes).toBe(1); expect(repository.read().revision).toBe(1); try { repository.dispatch({ ...command, id: 'stale', expectedRevision: 0 }) } catch (error) { expect(error).toBeInstanceOf(CloseoutControlError); expect(error).toMatchObject({ code: 'STALE_REVISION', projectId: 'PROJECT-SOUTH' }) } expect(writes).toBe(1) })
})
