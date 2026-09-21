import { describe, expect, it } from 'vitest'
import { authorizeProjectClosure, CloseoutControlError, CloseoutPortfolioRepository, closeoutPermissions, initialCloseoutPortfolioState, queryProjectCloseoutHistory, scheduleCloseoutIntervention, type CloseoutPersistence, type CloseoutPortfolioState } from './closeout-control-domain'

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

describe('evidence-based project closure', () => {
  const closure = { id: 'closure-1', expectedRevision: 1, authority: 'Commercial Director' as const, projectId: 'PROJECT-SOUTH', evidenceIds: ['DOC-1', 'DOC-2'], satisfiedDocuments: 2, waivedDocuments: 1, waiverAuthority: 'Commercial Director', waiverRationale: 'Minor training record accepted with retained commercial exposure.', waivedExposureCents: 40_000, finalAccountReference: 'FA-FINAL', custodyReference: 'CUSTODY-1', authorizedBy: 'director-closeout', closedOn: '2026-10-24' }
  it('reconciles every obligation and preserves waiver evidence', () => {
    const active = scheduleCloseoutIntervention(initialCloseoutPortfolioState, command)
    const closed = authorizeProjectClosure(active, closure)
    expect(closed.projects.find((item) => item.projectId === 'PROJECT-SOUTH')).toMatchObject({ openDocuments: 0, commercialExposureCents: 40_000 })
    expect(closed.closures[0]).toMatchObject({ interventionId: 'intervention-1', waivedDocuments: 1, immutable: true })
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
