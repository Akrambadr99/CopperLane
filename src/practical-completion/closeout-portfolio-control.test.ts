import { describe, expect, it } from 'vitest'
import { initialCloseoutPortfolioState, scheduleCloseoutIntervention } from './CloseoutPortfolioControl'

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
