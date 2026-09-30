import { reviewCloseoutDocument } from '../document-control/closeout-documents'
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

import { changedCloseoutContent, getCloseoutDocumentManifestStatus, getCloseoutHandoffStatus, getProjectHandoverAcceptance, prepareCloseoutHandoff, registerCloseoutDocumentRevision, type CloseoutPortfolioState } from './closeout-control-domain'
function revisionCommand(state: CloseoutPortfolioState, index = 0) {
  const custody = state.documentCustody[index]; if (!custody) throw new Error('Expected authoritative custody document.')
  const prior = state.documentRevisions?.filter((item) => item.custodyId === custody.id).at(-1)
  return { id: `document-${String(index)}-${String((prior?.revision ?? 0) + 1)}`, expectedRevision: state.revision, authority: 'Commercial Director' as const, projectId: custody.projectId, documentCustodyId: custody.id, expectedPreviousRevisionId: prior?.id ?? null, revisionLabel: prior ? 'B' : 'A', evidenceReference: `CONTROLLED-DOC-${String(index)}-${prior ? 'B' : 'A'}`, registeredBy: 'document-controller', registeredOn: '2026-10-25' }
}
function releaseLatestDocument(state: CloseoutPortfolioState) {
  const revision = state.documentRevisions?.at(-1); if (!revision) throw new Error('Expected registered revision.')
  return reviewCloseoutDocument(state, { id: 'release-' + revision.id, expectedRevision: state.revision, authority: 'Document Controller', projectId: revision.projectId, documentRevisionId: revision.id, decision: 'released', evidenceReference: 'RELEASE-EVIDENCE-' + revision.id, rationale: 'Independent technical review verifies current document contents and custody.', reviewedBy: 'technical-reviewer', reviewedOn: revision.registeredOn })
}
function manifestedCloseout() {
  let state = finalCloseout(); for (let index = 0; index < state.documentCustody.length; index++) { state = registerCloseoutDocumentRevision(state, revisionCommand(state, index)); state = releaseLatestDocument(state) }
  return assembleCloseoutEvidencePackage(state, { id: 'manifested-1', expectedRevision: state.revision, authority: 'Commercial Director', projectId: 'PROJECT-SOUTH', status: 'final', assembledBy: 'director', assembledOn: '2026-10-25' })
}
it('pins authoritative document revisions and invalidates downstream handover after a replacement without rewriting issued evidence', () => {
  const original = manifestedCloseout(), pkg = original.evidencePackages.at(-1); if (!pkg) throw new Error('Expected package.')
  expect(pkg.documentManifest).toHaveLength(2); expect(getCloseoutDocumentManifestStatus(original, pkg).current).toBe(true)
  const revised = registerCloseoutDocumentRevision(original, revisionCommand(original)), snapshot = structuredClone(revised)
  expect(revised.evidencePackages).toEqual(original.evidencePackages); expect(revised.documentCustody).toEqual(original.documentCustody); expect(revised.documentRevisions?.slice(0, 2)).toEqual(original.documentRevisions); expect(getCloseoutDocumentManifestStatus(revised, pkg).current).toBe(false); expect(getCloseoutHandoffStatus(revised, 'PROJECT-SOUTH').complete).toBe(false); expect(getProjectHandoverAcceptance(revised, 'PROJECT-SOUTH').outstanding).toContain('Closeout document revisions require a new package manifest')
  expect(() => prepareCloseoutHandoff(revised, { id: 'stale-handoff', expectedRevision: revised.revision, authority: 'Commercial Director', packageId: pkg.id, recipient: 'Client representative', preparedBy: 'director', preparedOn: '2026-10-26' })).toThrow('Document revisions changed'); expect(revised).toEqual(snapshot)
  const approved = releaseLatestDocument(revised), replacement = assembleCloseoutEvidencePackage(approved, { id: 'manifested-2', expectedRevision: approved.revision, authority: 'Commercial Director', projectId: 'PROJECT-SOUTH', status: 'final', assembledBy: 'director', assembledOn: '2026-10-26' }), newer = replacement.evidencePackages.at(-1); if (!newer) throw new Error('Expected replacement package.')
  expect(getCloseoutDocumentManifestStatus(replacement, newer).current).toBe(true); expect(changedCloseoutContent(pkg, newer)).toEqual(['closeout documents']); expect(newer.documentManifest?.[0]?.revisionId).toBe(revised.documentRevisions?.at(-1)?.id)
})
it('requires complete verified-document coverage and chronological revision dates before issuing a manifest', () => {
  const state = registerCloseoutDocumentRevision(finalCloseout(), revisionCommand(finalCloseout())), snapshot = structuredClone(state)
  expect(() => assembleCloseoutEvidencePackage(state, { id: 'incomplete', expectedRevision: state.revision, authority: 'Commercial Director', projectId: 'PROJECT-SOUTH', status: 'final', assembledBy: 'director', assembledOn: '2026-10-25' })).toThrow('no registered revision'); expect(state).toEqual(snapshot)
  const complete = manifestedCloseout(), command = revisionCommand(complete)
  for (const invalid of [{ ...command, registeredOn: '2026-02-30' }, { ...command, registeredOn: '2026-10-23' }, { ...command, expectedPreviousRevisionId: null }, { ...command, documentCustodyId: 'invented-document' }, { ...command, authority: 'Portfolio Viewer' as const }, { ...command, revisionLabel: 'A' }]) expect(() => registerCloseoutDocumentRevision(complete, invalid)).toThrow()
  const later = registerCloseoutDocumentRevision(complete, { ...command, registeredOn: '2026-10-28' }); expect(() => assembleCloseoutEvidencePackage(later, { id: 'early', expectedRevision: later.revision, authority: 'Commercial Director', projectId: 'PROJECT-SOUTH', status: 'final', assembledBy: 'director', assembledOn: '2026-10-27' })).toThrow('assembly date')
})
it('round-trips document revisions and rejects missing, forked or corrupted archive lineage atomically', () => {
  const state = manifestedCloseout(), archive = captureProjectCloseoutArchive(state, { id: 'revision-archive', projectId: 'PROJECT-SOUTH', authority: 'Commercial Director', createdOn: '2026-10-29' }); expect(parseProjectCloseoutArchive(JSON.stringify(archive))).toEqual(archive)
  const recovered = structuredClone(state); recovered.documentRevisions = []; expect(previewProjectCloseoutRestore(recovered, archive, 'PROJECT-SOUTH').ready).toBe(true); const restored = restoreProjectCloseoutArchive(recovered, archive, { id: 'restore-revisions', expectedRevision: recovered.revision, authority: 'Commercial Director', projectId: 'PROJECT-SOUTH', restoredBy: 'director', restoredOn: '2026-10-29' }); expect(restored.documentRevisions).toEqual(state.documentRevisions)
  const broken = structuredClone(archive); broken.documentRevisions?.pop(); expect(previewProjectCloseoutRestore(recovered, broken, 'PROJECT-SOUTH').reasons).toContain('Package document manifest references are incomplete.')
  const fork = structuredClone(archive), first = fork.documentRevisions?.[0]; if (!first) throw new Error('Expected revision.'); fork.documentRevisions?.push({ ...first, id: 'forked-revision' }); expect(previewProjectCloseoutRestore(recovered, fork, 'PROJECT-SOUTH').reasons).toContain('Closeout document revision lineage is incomplete.')
  const malformed = structuredClone(archive); malformed.documentRevisions![0]!.registeredOn = '2026-02-30'; expect(() => parseProjectCloseoutArchive(JSON.stringify(malformed))).toThrow('revision history')
})
it('loads old closeout evidence without inventing document revisions or changing issued legacy packages', () => {
  const legacy = finalCloseout(), loaded = new BrowserCloseoutPersistence({ getItem: () => JSON.stringify(legacy), setItem: () => undefined }).load(); expect(loaded?.documentRevisions).toEqual([]); const pkg = legacy.evidencePackages[0]; if (!pkg) throw new Error('Expected package.'); expect(pkg.documentManifest).toBeUndefined(); expect(getCloseoutDocumentManifestStatus(legacy, pkg)).toEqual({ current: true, status: 'legacy revision evidence unavailable' });
  const archive = captureProjectCloseoutArchive(legacy, { id: 'legacy', projectId: 'PROJECT-SOUTH', authority: 'Commercial Director', createdOn: '2026-10-29' }); delete archive.documentRevisions; expect(previewProjectCloseoutRestore(legacy, parseProjectCloseoutArchive(JSON.stringify(archive)), 'PROJECT-SOUTH').ready).toBe(true)
})

import { createElement } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CloseoutPortfolioControl } from './CloseoutPortfolioControl'
it('preserves document-specific drafts and recovers a sibling revision conflict with focused status feedback', async () => {
  localStorage.clear(); localStorage.setItem(BrowserCloseoutPersistence.key, JSON.stringify(finalCloseout())); const user = userEvent.setup(); render(createElement(CloseoutPortfolioControl)); await user.selectOptions(screen.getByLabelText('Portfolio authority'), 'Commercial Director'); await user.click(screen.getByText('Register a document revision', { exact: true })); await user.type(screen.getByLabelText('Document revision label'), 'B'); await user.type(screen.getByLabelText('Document revision evidence'), 'OPERATOR-REPLACEMENT-B');
  const current = new BrowserCloseoutPersistence(localStorage).load(); if (!current) throw new Error('Expected saved state.'); const sibling = registerCloseoutDocumentRevision(current, revisionCommand(current)); new BrowserCloseoutPersistence(localStorage).save(sibling); await user.click(screen.getByRole('button', { name: 'Register closeout document revision' })); expect(screen.getByRole('status')).toHaveTextContent('Refresh before registering'); expect(screen.getByRole('status')).toHaveFocus(); await user.click(screen.getByRole('button', { name: 'Refresh closeout sources' })); expect(screen.getByLabelText('Document revision label')).toHaveValue('B'); expect(screen.getByLabelText('Document revision evidence')).toHaveValue('OPERATOR-REPLACEMENT-B');
  await user.selectOptions(screen.getByLabelText('Closeout custody document'), sibling.documentCustody[1]!.id); expect(screen.getByLabelText('Document revision evidence')).toHaveValue(''); await user.selectOptions(screen.getByLabelText('Closeout custody document'), sibling.documentCustody[0]!.id); expect(screen.getByLabelText('Document revision evidence')).toHaveValue('OPERATOR-REPLACEMENT-B'); await user.click(screen.getByRole('button', { name: 'Register closeout document revision' })); expect(new BrowserCloseoutPersistence(localStorage).load()?.documentRevisions.at(-1)).toMatchObject({ revisionLabel: 'B', previousRevisionId: sibling.documentRevisions?.[0]?.id }); localStorage.clear();
})

import { acceptProjectHandover, recordCloseoutRecipientResponse, requiredCloseoutRecipients } from './closeout-control-domain'
it('supersedes current acceptance on a document correction while preserving the accepted package and all original receipts', () => {
  let state = manifestedCloseout(); const pkg = state.evidencePackages.at(-1); if (!pkg) throw new Error('Expected package.')
  for (const recipient of requiredCloseoutRecipients) {
    state = prepareCloseoutHandoff(state, { id: 'handoff-' + recipient, expectedRevision: state.revision, authority: 'Commercial Director', packageId: pkg.id, recipient, preparedBy: 'director', preparedOn: '2026-10-26' })
    state = recordCloseoutRecipientResponse(state, { id: 'receipt-' + recipient, expectedRevision: state.revision, authority: 'Commercial Director', handoffId: 'handoff-' + recipient, packageId: pkg.id, recipient, decision: 'acknowledged', receiptReference: 'RECEIPT-' + recipient, rationale: '', recordedBy: 'director', recordedOn: '2026-10-27' })
  }
  state = acceptProjectHandover(state, { id: 'accepted-manifest', expectedRevision: state.revision, authority: 'Commercial Director', projectId: 'PROJECT-SOUTH', packageId: pkg.id, acceptanceReference: 'ACCEPTED-ORIGINAL-MANIFEST', acceptedBy: 'director', acceptedOn: '2026-10-28' })
  expect(getProjectHandoverAcceptance(state, 'PROJECT-SOUTH').current).toBe(true)
  const revised = registerCloseoutDocumentRevision(state, { ...revisionCommand(state), registeredOn: '2026-10-29' }); expect(getProjectHandoverAcceptance(revised, 'PROJECT-SOUTH').status).toBe('acceptance superseded'); expect(revised.handoverAcceptances).toEqual(state.handoverAcceptances); expect(revised.recipientResponses).toEqual(state.recipientResponses); expect(revised.evidencePackages).toEqual(state.evidencePackages)
})
it('rejects cross-project revisions and malformed manifest entries while recovering valid revision order independently of archive ordering', () => {
  const state = registerCloseoutDocumentRevision(manifestedCloseout(), revisionCommand(manifestedCloseout())), archive = captureProjectCloseoutArchive(state, { id: 'source-lineage', projectId: 'PROJECT-SOUTH', authority: 'Commercial Director', createdOn: '2026-10-29' })
  const crossProject = structuredClone(archive); crossProject.documentRevisions![0]!.projectId = 'PROJECT-NORTH'; expect(previewProjectCloseoutRestore(state, crossProject, 'PROJECT-SOUTH').reasons).toContain('Closeout document revision lineage is incomplete.')
  const malformed = JSON.parse(JSON.stringify(archive)) as Record<string, unknown>; (malformed['evidencePackages'] as Record<string, unknown>[]).at(-1)!['documentManifest'] = [null]; expect(() => parseProjectCloseoutArchive(JSON.stringify(malformed))).toThrow('manifest is invalid')
  const reordered = structuredClone(state); reordered.documentRevisions?.reverse(); const command = revisionCommand(state); expect(() => registerCloseoutDocumentRevision(reordered, { ...command, id: 'revision-c', revisionLabel: 'C', evidenceReference: 'THIRD-CONTROLLED-EVIDENCE' })).not.toThrow()
})
it('requires independent document release, preserves a returned revision and pins corrected release into its package', () => {
  const initial = finalCloseout(); let state = registerCloseoutDocumentRevision(initial, revisionCommand(initial));
  const revision = state.documentRevisions!.at(-1)!;
  const command = { id: 'returned-technical', expectedRevision: state.revision, authority: 'Document Controller', projectId: revision.projectId, documentRevisionId: revision.id, decision: 'returned' as const, evidenceReference: 'TECHNICAL-RETURN-001', rationale: 'Warranty coverage does not match the verified installed equipment.', reviewedBy: 'technical-reviewer', reviewedOn: '2026-10-26' };
  expect(() => reviewCloseoutDocument(state, { ...command, reviewedBy: revision.registeredBy })).toThrow('Independent reviewer');
  expect(() => reviewCloseoutDocument(state, { ...command, authority: 'Commercial Director' })).toThrow('document controller');
  const returned = reviewCloseoutDocument(state, command); expect(returned.documentCustody).toEqual(initial.documentCustody);
  expect(() => reviewCloseoutDocument(returned, { ...command, id: 'overwrite-review', expectedRevision: returned.revision, decision: 'released' })).toThrow('immutable');
  expect(() => registerCloseoutDocumentRevision(returned, revisionCommand(returned))).toThrow('cannot precede');
  state = registerCloseoutDocumentRevision(returned, { ...revisionCommand(returned), registeredOn: '2026-10-27' }); state = releaseLatestDocument(state);
  state = registerCloseoutDocumentRevision(state, { ...revisionCommand(state, 1), registeredOn: '2026-10-27' });
  expect(() => assembleCloseoutEvidencePackage(state, { id: 'unreviewed', expectedRevision: state.revision, authority: 'Commercial Director', projectId: 'PROJECT-SOUTH', status: 'final', assembledBy: 'director', assembledOn: '2026-10-27' })).toThrow('independent technical release');
  state = releaseLatestDocument(state); const packaged = assembleCloseoutEvidencePackage(state, { id: 'released-package', expectedRevision: state.revision, authority: 'Commercial Director', projectId: 'PROJECT-SOUTH', status: 'final', assembledBy: 'director', assembledOn: '2026-10-27' });
  expect(packaged.documentReleaseReviews?.[0]).toEqual(returned.documentReleaseReviews?.[0]); expect(packaged.evidencePackages.at(-1)?.documentManifest?.every(pin => Boolean(pin.releaseReviewId))).toBe(true); expect(packaged.documentRevisions?.slice(0, 1)).toEqual(returned.documentRevisions);
});
it('round-trips technical release evidence and rejects broken independent-review archive pins', () => {
  const state = manifestedCloseout(), archive = captureProjectCloseoutArchive(state, { id: 'technical-archive', projectId: 'PROJECT-SOUTH', authority: 'Commercial Director', createdOn: '2026-10-29' });
  expect(parseProjectCloseoutArchive(JSON.stringify(archive))).toEqual(archive);
  const missing = structuredClone(state); missing.documentReleaseReviews = []; const restored = restoreProjectCloseoutArchive(missing, archive, { id: 'restore-technical', expectedRevision: missing.revision, authority: 'Commercial Director', projectId: 'PROJECT-SOUTH', restoredBy: 'director', restoredOn: '2026-10-29' }); expect(restored.documentReleaseReviews).toEqual(state.documentReleaseReviews);
  const wrong = structuredClone(archive); wrong.documentReleaseReviews![0]!.reviewedBy = wrong.documentRevisions![0]!.registeredBy; expect(previewProjectCloseoutRestore(missing, wrong, 'PROJECT-SOUTH').reasons).toContain('Document technical release lineage is incomplete.');
  const broken = structuredClone(archive); broken.documentReleaseReviews = []; expect(previewProjectCloseoutRestore(missing, broken, 'PROJECT-SOUTH').reasons).toContain('Package technical release references are incomplete.');
  const corrupt = structuredClone(archive); corrupt.documentReleaseReviews![0]!.reviewedOn = '2026-02-30'; expect(() => parseProjectCloseoutArchive(JSON.stringify(corrupt))).toThrow('technical release history');
});
it('loads legacy registered documents without fabricating technical review decisions', () => {
  const state = manifestedCloseout(); for (const revision of state.documentRevisions ?? []) delete revision.requiresReleaseReview;
  delete state.documentReleaseReviews; for (const pkg of state.evidencePackages) for (const pin of pkg.documentManifest ?? []) delete pin.releaseReviewId;
  const loaded = new BrowserCloseoutPersistence({ getItem: () => JSON.stringify(state), setItem: () => undefined }).load()!;
  expect(loaded.documentReleaseReviews).toEqual([]); expect(getCloseoutDocumentManifestStatus(loaded, loaded.evidencePackages.at(-1)!).current).toBe(true);
});
it('preserves revision-specific technical review drafts through a failed operation and source refresh', async () => {
  localStorage.clear(); const state = registerCloseoutDocumentRevision(finalCloseout(), { ...revisionCommand(finalCloseout()), registeredBy: 'commercial-director' }); new BrowserCloseoutPersistence(localStorage).save(state); const user = userEvent.setup(); render(createElement(CloseoutPortfolioControl));
  await user.selectOptions(screen.getByLabelText('Portfolio authority'), 'Document Controller'); await user.type(screen.getByLabelText('Technical release evidence'), 'INDEPENDENT-REVIEW-001'); await user.type(screen.getByLabelText('Technical review rationale'), 'Independent review confirms current installed-equipment documentation.');
  const current = new BrowserCloseoutPersistence(localStorage).load()!; const sibling = registerCloseoutDocumentRevision(current, revisionCommand(current, 1)); new BrowserCloseoutPersistence(localStorage).save(sibling);
  await user.click(screen.getByRole('button', { name: 'Release reviewed closeout document' })); expect(screen.getByRole('status')).toHaveTextContent('Refresh before technical review'); expect(screen.getByRole('status')).toHaveFocus(); expect(screen.getByLabelText('Technical release evidence')).toHaveValue('INDEPENDENT-REVIEW-001');
  await user.click(screen.getByRole('button', { name: 'Refresh closeout sources' })); await user.click(screen.getByText('Register a document revision', { exact: true })); await user.selectOptions(screen.getByLabelText('Closeout custody document'), sibling.documentCustody[1]!.id); expect(screen.getByLabelText('Technical review rationale')).toHaveValue(''); await user.selectOptions(screen.getByLabelText('Closeout custody document'), sibling.documentCustody[0]!.id); expect(screen.getByLabelText('Technical release evidence')).toHaveValue('INDEPENDENT-REVIEW-001'); await user.click(screen.getByRole('button', { name: 'Release reviewed closeout document' })); expect(screen.getByRole('status')).toHaveTextContent('independently released'); expect(new BrowserCloseoutPersistence(localStorage).load()?.documentReleaseReviews).toHaveLength(1); localStorage.clear();
});
