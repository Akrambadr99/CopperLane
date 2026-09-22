import { describe, expect, it } from 'vitest'
import { assembleCloseoutEvidencePackage, authorizeProjectClosure, BrowserCloseoutPersistence, CloseoutControlError, CloseoutPortfolioRepository, closeoutPermissions, compareFinalAccountAdjustment, getCloseoutDocumentHistory, getCloseoutHandoffStatus, getFinalAccountAdjustmentReadiness, getFinalAccountHistory, initialCloseoutPortfolioState, prepareCloseoutHandoff, proposeCategorizedFinalAccountAdjustment, proposeFinalAccountAdjustment, queryProjectCloseoutHistory, reassignCloseoutHandoff, recordCloseoutRecipientResponse, requiredCloseoutRecipients, reviewFinalAccountAdjustment, scheduleCloseoutIntervention, substituteCloseoutRecipient, type CloseoutPersistence, type CloseoutPortfolioState } from './closeout-control-domain'

it('pins preliminary closeout evidence and requires actual closure before a final package', () => { const command = { id: 'package-1', expectedRevision: 0, authority: 'Commercial Director' as const, projectId: 'PROJECT-SOUTH', status: 'preliminary' as const, assembledBy: 'director', assembledOn: '2026-10-25' }; expect(() => assembleCloseoutEvidencePackage(initialCloseoutPortfolioState, { ...command, status: 'final' })).toThrow('completed closure'); expect(() => assembleCloseoutEvidencePackage(initialCloseoutPortfolioState, { ...command, authority: 'Portfolio Viewer' })).toThrow('commercial director'); const first = assembleCloseoutEvidencePackage(initialCloseoutPortfolioState, command); expect(first.evidencePackages[0]).toMatchObject({ sourceRevision: 0, accountRevision: 0, openDocumentCount: 3, immutable: true }); const later = scheduleCloseoutIntervention(first, { id: 'intervention-2', expectedRevision: 1, authority: 'Commercial Director', projectId: 'PROJECT-SOUTH', assignedManager: 'director-closeout', reviewOn: '2026-10-22', asOf: '2026-10-20', reason: 'Commercial exposure and overdue documents require director intervention.' }); expect(later.evidencePackages[0]).toEqual(first.evidencePackages[0]); expect(() => assembleCloseoutEvidencePackage(later, { ...command, id: 'package-stale' })).toThrow('Refresh') })

const command = { id: 'intervention-1', expectedRevision: 0, authority: 'Commercial Director' as const, projectId: 'PROJECT-SOUTH', assignedManager: 'director-closeout', reviewOn: '2026-10-22', asOf: '2026-10-20', reason: 'Commercial exposure and overdue documents require director intervention.' }

it('requires approved substitute acknowledgement even after original recipient already acknowledged', () => {
  const active = scheduleCloseoutIntervention(initialCloseoutPortfolioState, command)
  const closed = authorizeProjectClosure(active, { id: 'closure-substitute', expectedRevision: active.revision, authority: 'Commercial Director', projectId: command.projectId, evidenceIds: ['DOC-1', 'DOC-2'], satisfiedDocuments: 2, waivedDocuments: 1, waiverAuthority: 'Commercial Director', waiverRationale: 'Minor training record accepted with retained commercial exposure.', waivedExposureCents: 40_000, finalAccountReference: 'FA-FINAL', custodyReference: 'CUSTODY-1', authorizedBy: 'director-closeout', closedOn: '2026-10-24' })
  const packaged = assembleCloseoutEvidencePackage(closed, { id: 'final-substitute', expectedRevision: closed.revision, authority: 'Commercial Director', projectId: command.projectId, status: 'final', assembledBy: 'director', assembledOn: '2026-10-25' })
  const handed = prepareCloseoutHandoff(packaged, { id: 'original', expectedRevision: packaged.revision, authority: 'Commercial Director', packageId: 'final-substitute', recipient: 'Client representative', recipientIdentity: 'Original client lead', dueOn: '2026-10-27', preparedBy: 'director', preparedOn: '2026-10-26' })
  const acknowledged = recordCloseoutRecipientResponse(handed, { id: 'old-receipt', expectedRevision: handed.revision, authority: 'Commercial Director', handoffId: 'original', packageId: 'final-substitute', recipient: 'Client representative', decision: 'acknowledged', receiptReference: 'REC-OLD', rationale: '', recordedBy: 'director', recordedOn: '2026-10-27' })
  const substitution = { id: 'policy-1', expectedRevision: acknowledged.revision, authority: 'Commercial Director' as const, handoffId: 'original', substituteRecipient: 'Client delegate', reason: 'representative replaced' as const, approvalReference: 'APPROVAL-01', approvedBy: 'director', approvedOn: '2026-10-28', dueOn: '2026-11-05' }
  expect(() => substituteCloseoutRecipient(acknowledged, { ...substitution, authority: 'Portfolio Viewer' })).toThrow('commercial director')
  expect(() => substituteCloseoutRecipient(acknowledged, { ...substitution, expectedRevision: 0 })).toThrow('Refresh')
  expect(() => substituteCloseoutRecipient(acknowledged, { ...substitution, approvalReference: '' })).toThrow('approval evidence')
  const substituted = substituteCloseoutRecipient(acknowledged, substitution)
  expect(substituted.recipientResponses).toEqual(acknowledged.recipientResponses)
  expect(substituted.recipientSubstitutions[0]).toMatchObject({ originalRecipient: 'Original client lead', substituteRecipient: 'Client delegate', packageSourceRevision: packaged.evidencePackages[0]?.sourceRevision })
  expect(getCloseoutHandoffStatus(substituted, command.projectId).recipients[0]).toMatchObject({ status: 'awaiting manual receipt', handoff: { id: 'policy-1:handoff' } })
  expect(() => recordCloseoutRecipientResponse(substituted, { id: 'stale', expectedRevision: substituted.revision, authority: 'Commercial Director', handoffId: 'original', packageId: 'final-substitute', recipient: 'Client representative', decision: 'acknowledged', receiptReference: 'REC-LATE', rationale: '', recordedBy: 'director', recordedOn: '2026-10-29' })).toThrow('reassigned')
  const completed = recordCloseoutRecipientResponse(substituted, { id: 'new-receipt', expectedRevision: substituted.revision, authority: 'Commercial Director', handoffId: 'policy-1:handoff', packageId: 'final-substitute', recipient: 'Client representative', decision: 'acknowledged', receiptReference: 'REC-NEW', rationale: '', recordedBy: 'director', recordedOn: '2026-10-29' })
  expect(getCloseoutHandoffStatus(completed, command.projectId).recipients[0]?.status).toBe('acknowledged')
  const storage = { getItem: () => JSON.stringify({ ...completed, recipientSubstitutions: undefined }), setItem: () => undefined }
  expect(new BrowserCloseoutPersistence(storage).load()?.recipientSubstitutions).toEqual([])
})

it('reassigns an overdue recipient without transferring old receipt authority or losing history', () => {
  const active = scheduleCloseoutIntervention(initialCloseoutPortfolioState, command)
  const closed = authorizeProjectClosure(active, { id: 'closure-reassign', expectedRevision: active.revision, authority: 'Commercial Director', projectId: command.projectId, evidenceIds: ['DOC-1', 'DOC-2'], satisfiedDocuments: 2, waivedDocuments: 1, waiverAuthority: 'Commercial Director', waiverRationale: 'Minor training record accepted with retained commercial exposure.', waivedExposureCents: 40_000, finalAccountReference: 'FA-FINAL', custodyReference: 'CUSTODY-1', authorizedBy: 'director-closeout', closedOn: '2026-10-24' })
  const packaged = assembleCloseoutEvidencePackage(closed, { id: 'final-reassign', expectedRevision: closed.revision, authority: 'Commercial Director', projectId: command.projectId, status: 'final', assembledBy: 'director', assembledOn: '2026-10-25' })
  const handed = prepareCloseoutHandoff(packaged, { id: 'handoff-old', expectedRevision: packaged.revision, authority: 'Commercial Director', packageId: 'final-reassign', recipient: 'Client representative', recipientIdentity: 'Original client lead', dueOn: '2026-10-27', preparedBy: 'director', preparedOn: '2026-10-26' })
  expect(getCloseoutHandoffStatus(handed, command.projectId, '2026-10-28').recipients[0]?.status).toBe('overdue')
  const reassignment = { id: 'handoff-new', expectedRevision: handed.revision, authority: 'Commercial Director' as const, handoffId: 'handoff-old', recipientIdentity: 'Client delegate', dueOn: '2026-11-05', reason: 'Original client lead is unavailable for closeout.', reassignedBy: 'director', reassignedOn: '2026-10-28' }
  expect(() => reassignCloseoutHandoff(handed, { ...reassignment, authority: 'Portfolio Viewer' })).toThrow('commercial director')
  const reassigned = reassignCloseoutHandoff(handed, reassignment)
  expect(reassigned.handoffs).toHaveLength(2)
  expect(reassigned.handoffs[0]).toEqual(handed.handoffs[0])
  expect(getCloseoutHandoffStatus(reassigned, command.projectId, '2026-10-28').recipients[0]).toMatchObject({ status: 'awaiting manual receipt', handoff: { recipientIdentity: 'Client delegate', previousHandoffId: 'handoff-old' } })
  const response = { id: 'receipt-new', expectedRevision: reassigned.revision, authority: 'Commercial Director' as const, handoffId: 'handoff-old', packageId: 'final-reassign', recipient: 'Client representative' as const, decision: 'acknowledged' as const, receiptReference: 'REC-1', rationale: '', recordedBy: 'director', recordedOn: '2026-10-29' }
  expect(() => recordCloseoutRecipientResponse(reassigned, response)).toThrow('reassigned')
  const acknowledged = recordCloseoutRecipientResponse(reassigned, { ...response, handoffId: 'handoff-new' })
  expect(getCloseoutHandoffStatus(acknowledged, command.projectId).recipients[0]?.status).toBe('acknowledged')
  expect(acknowledged.handoffs[0]).toEqual(handed.handoffs[0])
})

it('pins manual recipient responses to the final package and resets handover after correction', () => {
  const active = scheduleCloseoutIntervention(initialCloseoutPortfolioState, command)
  const closed = authorizeProjectClosure(active, { id: 'closure-handoff', expectedRevision: active.revision, authority: 'Commercial Director', projectId: command.projectId, evidenceIds: ['DOC-1', 'DOC-2'], satisfiedDocuments: 2, waivedDocuments: 1, waiverAuthority: 'Commercial Director', waiverRationale: 'Minor training record accepted with retained commercial exposure.', waivedExposureCents: 40_000, finalAccountReference: 'FA-FINAL', custodyReference: 'CUSTODY-1', authorizedBy: 'director-closeout', closedOn: '2026-10-24' })
  let state = assembleCloseoutEvidencePackage(closed, { id: 'final-1', expectedRevision: closed.revision, authority: 'Commercial Director', projectId: command.projectId, status: 'final', assembledBy: 'director', assembledOn: '2026-10-25' })
  for (const [index, recipient] of requiredCloseoutRecipients.entries()) {
    const handoff = { id: `handoff-${String(index)}`, expectedRevision: state.revision, authority: 'Commercial Director' as const, packageId: 'final-1', recipient, preparedBy: 'director', preparedOn: '2026-10-26' }
    expect(() => prepareCloseoutHandoff(state, { ...handoff, authority: 'Portfolio Viewer' })).toThrow('commercial director')
    state = prepareCloseoutHandoff(state, handoff)
    const response = { id: `response-${String(index)}`, expectedRevision: state.revision, authority: 'Commercial Director' as const, handoffId: handoff.id, packageId: handoff.packageId, recipient, decision: index === 2 ? 'correction-requested' as const : 'acknowledged' as const, receiptReference: `RECEIPT-${String(index)}`, rationale: 'Recipient requests a corrected custody record.', recordedBy: 'director', recordedOn: '2026-10-27' }
    expect(() => recordCloseoutRecipientResponse(state, { ...response, packageId: 'WRONG' })).toThrow('exact handoff')
    state = recordCloseoutRecipientResponse(state, response)
    expect(recordCloseoutRecipientResponse(state, response)).toBe(state)
  }
  expect(getCloseoutHandoffStatus(state, command.projectId)).toMatchObject({ complete: false, recipients: [{ status: 'acknowledged' }, { status: 'acknowledged' }, { status: 'correction-requested' }] })
  const corrected = assembleCloseoutEvidencePackage(state, { id: 'final-2', expectedRevision: state.revision, authority: 'Commercial Director', projectId: command.projectId, status: 'final', assembledBy: 'director', assembledOn: '2026-10-28' })
  expect(() => recordCloseoutRecipientResponse(corrected, { id: 'stale-response', expectedRevision: corrected.revision, authority: 'Commercial Director', handoffId: 'handoff-0', packageId: 'final-1', recipient: 'Client representative', decision: 'acknowledged', receiptReference: 'LATE', rationale: '', recordedBy: 'director', recordedOn: '2026-10-29' })).toThrow('newer final package')
  expect(getCloseoutHandoffStatus(corrected, command.projectId)).toMatchObject({ complete: false, recipients: [{ status: 'not prepared' }, { status: 'not prepared' }, { status: 'not prepared' }] })
  expect(corrected.recipientResponses).toEqual(state.recipientResponses)
  const old = { ...state } as Record<string, unknown>; delete old['handoffs']; delete old['recipientResponses']
  const storage = { getItem: () => JSON.stringify(old), setItem: () => undefined }
  expect(new BrowserCloseoutPersistence(storage).load()).toMatchObject({ handoffs: [], recipientResponses: [] })
})

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
  const categorized = { id: 'structured-1', expectedRevision: 0, authority: 'Commercial Director' as const, projectId: 'PROJECT-SOUTH', category: 'variation' as const, commercialReason: 'Approved MEP variation adjusts the final account.', amountCents: 25000, direction: 'increase' as const, contractor: 'MEP contractor', sourceCommercialItem: 'VO-19', evidenceReference: 'VO-19', notes: 'Supported by current quantity surveyor evidence.', proposedEffectiveRevision: 1, proposedBy: 'commercial-manager', proposedOn: '2026-10-21' }
  it('validates structured proposal and preserves comparison and source lineage', () => { const proposed = proposeCategorizedFinalAccountAdjustment(initialCloseoutPortfolioState, categorized); expect(proposed.adjustments[0]).toMatchObject({ sourceCommercialItem: 'VO-19', contractor: 'MEP contractor', proposedEffectiveRevision: 1, valueCents: 25000 }); expect(compareFinalAccountAdjustment(proposed, categorized.projectId, 25000, 'increase')).toEqual({ currentValueCents: 280000, adjustmentValueCents: 25000, resultingValueCents: 305000 }); expect(() => proposeCategorizedFinalAccountAdjustment(proposed, { ...categorized, id: 'duplicate', expectedRevision: 1 })).toThrow('already has an active adjustment'); expect(proposed.adjustments).toHaveLength(1) })
  it('rejects stale, unauthorized, invalid evidence, and excessive decreases atomically', () => { expect(() => proposeCategorizedFinalAccountAdjustment(initialCloseoutPortfolioState, { ...categorized, expectedRevision: 1 })).toThrow('changed'); expect(() => proposeCategorizedFinalAccountAdjustment(initialCloseoutPortfolioState, { ...categorized, authority: 'Portfolio Viewer' })).toThrow('commercial director'); expect(() => proposeCategorizedFinalAccountAdjustment(initialCloseoutPortfolioState, { ...categorized, evidenceReference: 'unsupported' })).toThrow('approved commercial reference'); expect(() => proposeCategorizedFinalAccountAdjustment(initialCloseoutPortfolioState, { ...categorized, amountCents: Number.NaN })).toThrow('positive whole number'); expect(() => proposeCategorizedFinalAccountAdjustment(initialCloseoutPortfolioState, { ...categorized, amountCents: 300000, direction: 'decrease' })).toThrow('below zero'); expect(initialCloseoutPortfolioState.adjustments).toHaveLength(0) })
  const proposal = { id: 'adjust-1', expectedRevision: 0, authority: 'Commercial Director' as const, projectId: 'PROJECT-SOUTH', reason: 'Approved variation must be reflected before final account closure.', category: 'variation' as const, valueCents: 25_000, evidenceIds: ['VO-19'], proposedBy: 'commercial-manager', proposedOn: '2026-10-21' }
  it('accepts a governed adjustment as a new account revision and changes exposure', () => { const proposed = proposeFinalAccountAdjustment(initialCloseoutPortfolioState, proposal); const accepted = reviewFinalAccountAdjustment(proposed, { id: 'review-1', expectedRevision: 1, authority: 'Commercial Director', adjustmentId: proposal.id, decision: 'accepted', reviewedBy: 'commercial-director', reviewedOn: '2026-10-22' }); expect(accepted.projects.find((item) => item.projectId === proposal.projectId)?.commercialExposureCents).toBe(305_000); expect(getFinalAccountAdjustmentReadiness(accepted, proposal.projectId)).toMatchObject({ pendingAdjustment: null, closureReady: true, latestAccount: { revision: 1, commercialExposureCents: 305_000 } }) })
  it('retains rejected and superseded proposals without changing commercial exposure', () => { const first = proposeFinalAccountAdjustment(initialCloseoutPortfolioState, proposal); const replacement = proposeFinalAccountAdjustment(first, { ...proposal, id: 'adjust-2', expectedRevision: 1, valueCents: 15_000 }); const rejected = reviewFinalAccountAdjustment(replacement, { id: 'review-2', expectedRevision: 2, authority: 'Commercial Director', adjustmentId: 'adjust-2', decision: 'rejected', reviewedBy: 'commercial-director', reviewedOn: '2026-10-22' }); expect(rejected.adjustments.map((item) => item.status)).toEqual(['superseded', 'rejected']); expect(rejected.projects.find((item) => item.projectId === proposal.projectId)?.commercialExposureCents).toBe(280_000) })
  it('blocks closure while an adjustment is pending and refuses post-closure changes', () => { const active = scheduleCloseoutIntervention(initialCloseoutPortfolioState, command); const proposed = proposeFinalAccountAdjustment(active, { ...proposal, expectedRevision: 1 }); expect(() => authorizeProjectClosure(proposed, { id: 'closure-pending', expectedRevision: 2, authority: 'Commercial Director', projectId: 'PROJECT-SOUTH', evidenceIds: ['DOC-1', 'DOC-2'], satisfiedDocuments: 2, waivedDocuments: 1, waiverAuthority: 'Commercial Director', waiverRationale: 'Minor training record accepted with retained commercial exposure.', waivedExposureCents: 40_000, finalAccountReference: 'FA-FINAL', custodyReference: 'CUSTODY-1', authorizedBy: 'director-closeout', closedOn: '2026-10-24' })).toThrow('Pending final-account'); const closed = authorizeProjectClosure(active, { id: 'closure-final', expectedRevision: 1, authority: 'Commercial Director', projectId: 'PROJECT-SOUTH', evidenceIds: ['DOC-1', 'DOC-2'], satisfiedDocuments: 2, waivedDocuments: 1, waiverAuthority: 'Commercial Director', waiverRationale: 'Minor training record accepted with retained commercial exposure.', waivedExposureCents: 40_000, finalAccountReference: 'FA-FINAL', custodyReference: 'CUSTODY-1', authorizedBy: 'director-closeout', closedOn: '2026-10-24' }); expect(() => proposeFinalAccountAdjustment(closed, { ...proposal, expectedRevision: 2 })).toThrow('closed project') })
  it('requires closure to reference the current accepted final-account revision', () => { const intervened = scheduleCloseoutIntervention(initialCloseoutPortfolioState, command); const proposed = proposeFinalAccountAdjustment(intervened, { ...proposal, expectedRevision: 1 }); const accepted = reviewFinalAccountAdjustment(proposed, { id: 'review-current', expectedRevision: 2, authority: 'Commercial Director', adjustmentId: proposal.id, decision: 'accepted', reviewedBy: 'commercial-director', reviewedOn: '2026-10-22' }); const closure = { id: 'closure-current', expectedRevision: 3, authority: 'Commercial Director' as const, projectId: 'PROJECT-SOUTH', evidenceIds: ['DOC-1', 'DOC-2'], satisfiedDocuments: 2, waivedDocuments: 1, waiverAuthority: 'Commercial Director', waiverRationale: 'Minor training record accepted with retained commercial exposure.', waivedExposureCents: 40_000, finalAccountReference: 'OUTDATED', custodyReference: 'CUSTODY-1', authorizedBy: 'director-closeout', closedOn: '2026-10-24' }; expect(() => authorizeProjectClosure(accepted, closure)).toThrow('current accepted'); expect(authorizeProjectClosure(accepted, { ...closure, finalAccountReference: 'ADJ-adjust-1-R1' }).closures).toHaveLength(1) })
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
