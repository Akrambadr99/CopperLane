import { expect, it } from 'vitest'
import { assembleCloseoutEvidencePackage, authorizeProjectClosure, BrowserCloseoutPersistence, captureProjectCloseoutArchive, initialCloseoutPortfolioState, parseProjectCloseoutArchive, previewProjectCloseoutRestore, restoreProjectCloseoutArchive, scheduleCloseoutIntervention } from './closeout-control-domain'

function finalCloseout() {
  const active = scheduleCloseoutIntervention(initialCloseoutPortfolioState, { id: 'intervention-1', expectedRevision: 0, authority: 'Commercial Director', projectId: 'PROJECT-SOUTH', assignedManager: 'director-closeout', reviewOn: '2026-10-22', asOf: '2026-10-20', reason: 'Overdue commercial handover needs director ownership.' })
  const closed = authorizeProjectClosure(active, { id: 'closure-1', expectedRevision: active.revision, authority: 'Commercial Director', projectId: 'PROJECT-SOUTH', evidenceIds: ['DOC-1', 'DOC-2'], satisfiedDocuments: 2, waivedDocuments: 1, waiverAuthority: 'Commercial Director', waiverRationale: 'Minor training record accepted with retained exposure.', waivedExposureCents: 40_000, finalAccountReference: 'FA-FINAL', custodyReference: 'CUSTODY-1', authorizedBy: 'director-closeout', closedOn: '2026-10-24' })
  return assembleCloseoutEvidencePackage(closed, { id: 'final-1', expectedRevision: closed.revision, authority: 'Commercial Director', projectId: 'PROJECT-SOUTH', status: 'final', assembledBy: 'director', assembledOn: '2026-10-25' })
}

it('archives final project evidence and rejects stale or broken restoration without mutation', () => {
  const state = finalCloseout()
  const archive = captureProjectCloseoutArchive(state, { id: 'archive-1', projectId: 'PROJECT-SOUTH', authority: 'Commercial Director', createdOn: '2026-10-29' })
  expect(archive).toMatchObject({ schemaVersion: 1, currentPackageId: 'final-1', sourceRevision: state.revision })
  expect(parseProjectCloseoutArchive(JSON.stringify(archive))).toEqual(archive)
  expect(() => parseProjectCloseoutArchive(JSON.stringify({ ...archive, schemaVersion: 2 }))).toThrow('Unsupported')
  expect(() => captureProjectCloseoutArchive(state, { id: 'forbidden', projectId: 'PROJECT-SOUTH', authority: 'Portfolio Viewer', createdOn: '2026-10-29' })).toThrow('director')
  expect(previewProjectCloseoutRestore(state, archive, 'PROJECT-SOUTH').ready).toBe(true)
  const broken = structuredClone(archive)
  broken.evidencePackages[0]!.custodyIds.push('missing-custody')
  expect(previewProjectCloseoutRestore(state, broken, 'PROJECT-SOUTH').reasons).toContain('Package custody, waiver, or adjustment references are incomplete.')
  const conflicting = structuredClone(archive)
  conflicting.closures[0]!.authorizedBy = 'different-director'
  expect(previewProjectCloseoutRestore(state, conflicting, 'PROJECT-SOUTH').reasons).toContain('Historical closeout record closure-1 conflicts with its archive.')
  const before = structuredClone(state)
  const command = { id: 'restore-1', expectedRevision: state.revision, authority: 'Commercial Director' as const, projectId: 'PROJECT-SOUTH', restoredBy: 'director', restoredOn: '2026-10-29' }
  expect(() => restoreProjectCloseoutArchive(state, broken, command)).toThrow('custody')
  expect(state).toEqual(before)
  const restored = restoreProjectCloseoutArchive(state, archive, command)
  expect(restored.archiveRestores).toMatchObject([{ archiveId: 'archive-1', sourceRevision: state.revision, immutable: true }])
  expect(restoreProjectCloseoutArchive(restored, archive, command)).toBe(restored)
  expect(() => restoreProjectCloseoutArchive(restored, { ...archive, id: 'archive-2' }, { ...command, id: 'restore-2', expectedRevision: restored.revision })).toThrow('newer work')
})

it('loads older closeout state without archive history', () => {
  const old = structuredClone(initialCloseoutPortfolioState) as unknown as Record<string, unknown>
  delete old['archiveRestores']
  const persisted = new BrowserCloseoutPersistence({ getItem: () => JSON.stringify(old), setItem: () => undefined }).load()
  expect(persisted?.archiveRestores).toEqual([])
})

it('rejects duplicate recovered custody evidence before it can inflate the closeout ledger', () => {
  const state = finalCloseout()
  const archive = captureProjectCloseoutArchive(state, { id: 'archive-duplicate', projectId: 'PROJECT-SOUTH', authority: 'Commercial Director', createdOn: '2026-10-29' })
  archive.documentCustody.push(structuredClone(archive.documentCustody[0]!))
  const damaged = structuredClone(state)
  damaged.documentCustody = []
  const before = structuredClone(damaged)
  expect(previewProjectCloseoutRestore(damaged, archive, 'PROJECT-SOUTH').ready).toBe(false)
  expect(() => restoreProjectCloseoutArchive(damaged, archive, { id: 'restore-duplicate', expectedRevision: damaged.revision, authority: 'Commercial Director', projectId: 'PROJECT-SOUTH', restoredBy: 'director', restoredOn: '2026-10-29' })).toThrow('repeats an evidence identity')
  expect(damaged).toEqual(before)
  archive.documentCustody.pop()
  expect(restoreProjectCloseoutArchive(damaged, archive, { id: 'restore-valid', expectedRevision: damaged.revision, authority: 'Commercial Director', projectId: 'PROJECT-SOUTH', restoredBy: 'director', restoredOn: '2026-10-29' }).documentCustody).toEqual(state.documentCustody)
})

it('does not recover a receipt for a different recipient on the same package', () => {
  const state = finalCloseout()
  const archive = captureProjectCloseoutArchive(state, { id: 'archive-recipient', projectId: 'PROJECT-SOUTH', authority: 'Commercial Director', createdOn: '2026-10-29' })
  archive.handoffs.push({ id: 'handoff-client', projectId: 'PROJECT-SOUTH', packageId: 'final-1', packageSourceRevision: archive.evidencePackages[0]!.sourceRevision, recipient: 'Client representative', preparedBy: 'director', preparedOn: '2026-10-26', immutable: true })
  archive.recipientResponses.push({ id: 'receipt-wrong', handoffId: 'handoff-client', packageId: 'final-1', recipient: 'Commercial manager', decision: 'acknowledged', receiptReference: 'RECEIPT-1', rationale: '', recordedBy: 'director', recordedOn: '2026-10-27', immutable: true })
  const command = { id: 'restore-recipient', expectedRevision: state.revision, authority: 'Commercial Director' as const, projectId: 'PROJECT-SOUTH', restoredBy: 'director', restoredOn: '2026-10-29' }
  const before = structuredClone(state)
  expect(() => restoreProjectCloseoutArchive(state, archive, command)).toThrow('assigned handoff recipient')
  expect(state).toEqual(before)
  archive.recipientResponses[0]!.recipient = 'Client representative'
  expect(restoreProjectCloseoutArchive(state, archive, command).recipientResponses).toEqual(archive.recipientResponses)
})
