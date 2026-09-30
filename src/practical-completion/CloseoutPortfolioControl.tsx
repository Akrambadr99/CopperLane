import { closeoutDocumentRelease } from '../document-control/closeout-documents';
import { useRef, useState } from "react";
import { assessCloseoutPortfolio } from "./closeout-portfolio";
import {
  BrowserCloseoutPersistence,
  CloseoutPortfolioRepository,
  compareFinalAccountAdjustment,
  closeoutContentScopes,
  currentRecipientContentScope,
  currentRequiredRecipients,
  getCloseoutHandoffStatus,
  getCloseoutDocumentManifestStatus,
  getProjectHandoverAcceptance,
  captureProjectCloseoutArchive,
  parseProjectCloseoutArchive,
  previewProjectCloseoutRestore,
  requiredCloseoutRecipients,
  type ProjectCloseoutArchive,
  type CloseoutRecipient,
  type CloseoutContentScope,
  type PortfolioAuthority,
} from "./closeout-control-domain";

export function CloseoutPortfolioControl() {
  const [repository] = useState(
    () =>
      new CloseoutPortfolioRepository(
        new BrowserCloseoutPersistence(localStorage),
      ),
  );
  const [state, setState] = useState(() => repository.read());
  const [authority, setAuthority] =
    useState<PortfolioAuthority>("Portfolio Viewer");
  const [message, setMessage] = useState("");
  const [archive, setArchive] = useState<ProjectCloseoutArchive | null>(() => { try { const saved = localStorage.getItem('buildledger:project-closeout-archive:v1'); return saved ? parseProjectCloseoutArchive(saved) : null; } catch { return null; } });
  const [selectedProjectId, setSelectedProjectId] = useState(() => { const saved = localStorage.getItem('buildledger:closeout-project:v1'); return typeof saved === 'string' && state.projects.some((item) => item.projectId === saved) ? saved : 'PROJECT-SOUTH'; });
  const selectedProject = state.projects.find((item) => item.projectId === selectedProjectId);
  if (!selectedProject) throw new Error('The selected authoritative closeout project is missing.');
  const projectPackages = state.evidencePackages.filter((item) => item.projectId === selectedProjectId);
  const projectClosures = state.closures.filter((item) => item.projectId === selectedProjectId);
  const projectInterventions = state.interventions.filter((item) => item.projectId === selectedProjectId);
  const projectAdjustments = state.adjustments.filter((item) => item.projectId === selectedProjectId);
  const projectAccounts = state.finalAccounts.filter((item) => item.projectId === selectedProjectId);
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
  const [recipient, setRecipient] = useState<CloseoutRecipient>('Client representative');
  const [policyRecipient, setPolicyRecipient] = useState<CloseoutRecipient>('Independent certifier');
  const [scopeRecipient, setScopeRecipient] = useState<CloseoutRecipient>('Client representative');
  const [draftScope, setDraftScope] = useState<CloseoutContentScope[]>([...closeoutContentScopes]);
  const [adjustmentDrafts, setAdjustmentDrafts] = useState<Record<string, { category: "variation" | "retention" | "claim"; reason: string; amount: string; direction: "increase" | "decrease"; contractor: string; source: string; evidence: string; notes: string }>>({ "PROJECT-SOUTH": { category: "variation", reason: "Approved variation must be reflected before final account closure.", amount: "25000", direction: "increase", contractor: "MEP contractor", source: "VO-19", evidence: "VO-19", notes: "Approved commercial instruction supported by quantity surveyor evidence." } });
  const adjustmentDraft: (typeof adjustmentDrafts)[string] = adjustmentDrafts[selectedProjectId] ?? { category: 'variation', reason: '', amount: '', direction: 'increase', contractor: selectedProject.contractor, source: '', evidence: '', notes: '' };
  const setAdjustmentDraft = (draft: typeof adjustmentDraft) => { setAdjustmentDrafts((current) => ({ ...current, [selectedProjectId]: draft })); };
  const [closureDrafts, setClosureDrafts] = useState<Record<string, { evidence: string; satisfied: string; waived: string; waiverReason: string; exposure: string; account: string; custody: string }>>({ 'PROJECT-SOUTH': { evidence: 'DOC-O&M-9, DOC-WARRANTY-3', satisfied: '2', waived: '1', waiverReason: 'Minor training record accepted with retained commercial exposure.', exposure: '40000', account: 'FA-2026-009-FINAL', custody: 'CUSTODY-882' } });
  const closureDraft = closureDrafts[selectedProjectId] ?? { evidence: '', satisfied: '0', waived: '0', waiverReason: '', exposure: '0', account: '', custody: '' };
  const setClosureDraft = (draft: typeof closureDraft) => { setClosureDrafts((current) => ({ ...current, [selectedProjectId]: draft })); };
  interface RecipientDraft { policyReason: string; receiptReference: string; correctionRationale: string; replacementRecipient: string; reassignmentReason: string; substitutionReason: 'responsibility changed' | 'representative replaced' | 'contact superseded'; substitutionApproval: string; supersessionRationale: string; acceptanceReference: string }
  const [recipientDrafts, setRecipientDrafts] = useState<Record<string, RecipientDraft>>({ 'PROJECT-SOUTH': { policyReason: 'Independent certification is required after partial closeout handoff.', receiptReference: 'RECEIPT-PROJECT-SOUTH-01', correctionRationale: 'Recipient requests a corrected custody document reference.', replacementRecipient: 'Client delegate', reassignmentReason: 'Original recipient is unavailable for closeout acknowledgement.', substitutionReason: 'representative replaced', substitutionApproval: 'DIRECTOR-APPROVAL-01', supersessionRationale: 'The newly assembled package leaves this recipient scope unchanged.', acceptanceReference: 'HANDOVER-PROJECT-SOUTH-01' } });
  const recipientDraft: RecipientDraft = recipientDrafts[selectedProjectId] ?? { policyReason: '', receiptReference: '', correctionRationale: '', replacementRecipient: '', reassignmentReason: '', substitutionReason: 'representative replaced', substitutionApproval: '', supersessionRationale: '', acceptanceReference: '' };
  const { policyReason, receiptReference, correctionRationale, replacementRecipient, reassignmentReason, substitutionReason, substitutionApproval, supersessionRationale, acceptanceReference } = recipientDraft;
  const updateRecipientDraft = <K extends keyof RecipientDraft,>(key: K, value: RecipientDraft[K]) => { setRecipientDrafts((current) => ({ ...current, [selectedProjectId]: { ...recipientDraft, [key]: value } })); };
  const setPolicyReason = (value: RecipientDraft['policyReason']) => { updateRecipientDraft('policyReason', value); };
  const setReceiptReference = (value: RecipientDraft['receiptReference']) => { updateRecipientDraft('receiptReference', value); };
  const setCorrectionRationale = (value: RecipientDraft['correctionRationale']) => { updateRecipientDraft('correctionRationale', value); };
  const setReplacementRecipient = (value: RecipientDraft['replacementRecipient']) => { updateRecipientDraft('replacementRecipient', value); };
  const setReassignmentReason = (value: RecipientDraft['reassignmentReason']) => { updateRecipientDraft('reassignmentReason', value); };
  const setSubstitutionReason = (value: RecipientDraft['substitutionReason']) => { updateRecipientDraft('substitutionReason', value); };
  const setSubstitutionApproval = (value: RecipientDraft['substitutionApproval']) => { updateRecipientDraft('substitutionApproval', value); };
  const setSupersessionRationale = (value: RecipientDraft['supersessionRationale']) => { updateRecipientDraft('supersessionRationale', value); };
  const setAcceptanceReference = (value: RecipientDraft['acceptanceReference']) => { updateRecipientDraft('acceptanceReference', value); };
  const [documentSelections, setDocumentSelections] = useState<Record<string, string>>({});
  const [documentDrafts, setDocumentDrafts] = useState<Record<string, { label: string; evidence: string; date: string }>>({});
  const [assemblyDates, setAssemblyDates] = useState<Record<string, string>>({});
  const assemblyDate = assemblyDates[selectedProjectId] ?? '2026-10-25';
  const projectDocuments = state.documentCustody.filter((item) => item.projectId === selectedProjectId && item.status === 'verified');
  const selectedDocument = projectDocuments.find((item) => item.id === documentSelections[selectedProjectId]) ?? projectDocuments[0];
  const [releaseDrafts, setReleaseDrafts] = useState<Record<string, { evidence: string; rationale: string; date: string }>>({});
  const selectedRevision = state.documentRevisions?.filter(item => item.custodyId === selectedDocument?.id).toSorted((a,b) => a.revision-b.revision).at(-1);
  const releaseDraft = selectedRevision ? releaseDrafts[selectedRevision.id] ?? { evidence: '', rationale: '', date: '2026-10-25' } : { evidence: '', rationale: '', date: '2026-10-25' };
  const updateReleaseDraft = (patch: Partial<typeof releaseDraft>) => { if(selectedRevision) setReleaseDrafts(current => ({ ...current, [selectedRevision.id]: { ...releaseDraft, ...patch } })); };
  const technicalReview = (decision: 'released' | 'returned') => { if (!selectedRevision) return; try { setState(repository.dispatch({ id: crypto.randomUUID(), expectedRevision: state.revision, authority, projectId: selectedProjectId, documentRevisionId: selectedRevision.id, decision, evidenceReference: releaseDraft.evidence, rationale: releaseDraft.rationale, reviewedBy: 'document-controller', reviewedOn: releaseDraft.date })); setMessage(decision === 'released' ? 'Document independently released for package assembly.' : 'Document returned; register a corrected revision, preserving this review.'); } catch(error) { setMessage(error instanceof Error ? error.message : 'Technical release review failed.'); } queueMicrotask(() => feedback.current?.focus()); };
  const documentDraft = selectedDocument ? documentDrafts[selectedDocument.id] ?? { label: '', evidence: '', date: '2026-10-25' } : { label: '', evidence: '', date: '2026-10-25' };
  const updateDocumentDraft = (update: Partial<typeof documentDraft>) => { if (selectedDocument) setDocumentDrafts((current) => ({ ...current, [selectedDocument.id]: { ...documentDraft, ...update } })); };
  const registerDocument = () => {
    if (!selectedDocument) return;
    try {
      const previous = state.documentRevisions?.filter((item) => item.custodyId === selectedDocument.id).toSorted((a, b) => a.revision - b.revision).at(-1);
      setState(repository.dispatch({ id: crypto.randomUUID(), expectedRevision: state.revision, authority, projectId: selectedProjectId, documentCustodyId: selectedDocument.id, expectedPreviousRevisionId: previous?.id ?? null, revisionLabel: documentDraft.label, evidenceReference: documentDraft.evidence, registeredBy: 'commercial-director', registeredOn: documentDraft.date }));
      setMessage('Document revision registered against its authoritative custody record; issued package evidence preserved.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Document registration failed.'); }
    queueMicrotask(() => feedback.current?.focus());
  };
  const feedback = useRef<HTMLParagraphElement>(null);
  const portfolio = assessCloseoutPortfolio(state.projects, "2026-10-20");
  const intervene = () => {
    try {
      setState(
        repository.dispatch({
          id: crypto.randomUUID(),
          expectedRevision: state.revision,
          authority,
          projectId: selectedProjectId,
          assignedManager: "director-closeout",
          reviewOn: "2026-10-22",
          asOf: "2026-10-20",
          reason:
            "Commercial exposure and overdue documents require director intervention.",
        }),
      );
      setMessage(
        "Commercial intervention scheduled and responsibility transferred.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Closeout intervention failed.",
      );
    }
    queueMicrotask(() => feedback.current?.focus());
  };
  const handoverAcceptance = getProjectHandoverAcceptance(state, selectedProjectId);
  const acceptHandover = () => { const pkg = getCloseoutHandoffStatus(state, selectedProjectId).package; if (!pkg) return; try { setState(repository.dispatch({ id: crypto.randomUUID(), expectedRevision: state.revision, authority, projectId: selectedProjectId, packageId: pkg.id, acceptanceReference, acceptedBy: 'commercial-director', acceptedOn: '2026-10-30' })); setMessage('Project handover accepted against the exact package and completed recipient obligations.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Handover acceptance failed.'); } queueMicrotask(() => feedback.current?.focus()); };
  const comparison = compareFinalAccountAdjustment(state, selectedProjectId, Number(adjustmentDraft.amount) || 0, adjustmentDraft.direction);
  const selectedPackage = projectPackages.find((item) => item.id === selectedPackageId) ?? projectPackages.at(-1);
  const finalPackage = state.evidencePackages.filter((item) => item.projectId === selectedProjectId && item.status === 'final').at(-1);
  const archivePreview = archive ? previewProjectCloseoutRestore(state, archive, selectedProjectId) : null;
  const captureArchive = () => { try { const next = captureProjectCloseoutArchive(state, { id: crypto.randomUUID(), projectId: selectedProjectId, authority, createdOn: '2026-10-29' }); localStorage.setItem('buildledger:project-closeout-archive:v1', JSON.stringify(next)); setArchive(next); setMessage('Versioned final closeout archive captured with source revisions and recipient evidence.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Closeout archive failed.'); } queueMicrotask(() => feedback.current?.focus()); };
  const importArchive = async (file: File | undefined) => { if (!file) return; try { setArchive(parseProjectCloseoutArchive(await file.text())); setMessage('Closeout archive loaded for verification; project records are unchanged.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Archive import failed.'); } queueMicrotask(() => feedback.current?.focus()); };
  const restoreArchive = () => { if (!archive) return; try { setState(repository.restore(archive, { id: crypto.randomUUID(), expectedRevision: state.revision, authority, projectId: selectedProjectId, restoredBy: 'commercial-director', restoredOn: '2026-10-29' })); setMessage('Verified project archive restored with immutable recovery history.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Archive restore failed.'); } queueMicrotask(() => feedback.current?.focus()); };
  const handoffStatus = getCloseoutHandoffStatus(state, selectedProjectId);
  const overdueHandoffStatus = getCloseoutHandoffStatus(state, selectedProjectId, '2026-10-28');
  const recipientHandoff = handoffStatus.recipients.find((item) => item.recipient === recipient);
  const activeRecipients = currentRequiredRecipients(state, selectedProjectId);
  const reviseRecipientPolicy = () => { if (!handoffStatus.package) return; try { const required = activeRecipients.includes(policyRecipient) ? activeRecipients.filter((item) => item !== policyRecipient) : [...activeRecipients, policyRecipient]; const next = repository.dispatch({ id: crypto.randomUUID(), expectedRevision: state.revision, authority, projectId: selectedProjectId, packageId: handoffStatus.package.id, requiredRecipients: required, reason: policyReason, approvedBy: 'commercial-director', effectiveOn: '2026-10-29' }); setState(next); if (!required.includes(recipient)) setRecipient(required[0] ?? 'Client representative'); setMessage('Recipient policy revised; current completion reflects the new required set.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Recipient policy change failed.'); } queueMicrotask(() => feedback.current?.focus()); };
  const reviseContentScope = () => { if (!handoffStatus.package) return; try { setState(repository.dispatch({ id: crypto.randomUUID(), expectedRevision: state.revision, authority, projectId: selectedProjectId, packageId: handoffStatus.package.id, requiredRecipients: activeRecipients, scopeByRecipient: { [scopeRecipient]: draftScope }, reason: policyReason, approvedBy: 'commercial-director', effectiveOn: '2026-10-29' })); setMessage(`${scopeRecipient} content scope revised; existing package responses remain historical.`); } catch (error) { setMessage(error instanceof Error ? error.message : 'Content scope revision failed.'); } queueMicrotask(() => feedback.current?.focus()); };
  const prepareHandoff = () => { if (!selectedPackage) return; try { setState(repository.dispatch({ id: crypto.randomUUID(), expectedRevision: state.revision, authority, packageId: selectedPackage.id, recipient, dueOn: '2026-10-27', preparedBy: 'commercial-director', preparedOn: '2026-10-26' })); setMessage('Manual closeout handoff prepared; recipient receipt remains unconfirmed.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Closeout handoff failed.'); } queueMicrotask(() => feedback.current?.focus()); };
  const recordResponse = (decision: 'acknowledged' | 'correction-requested') => { if (!recipientHandoff?.handoff || !selectedPackage) return; try { setState(repository.dispatch({ id: crypto.randomUUID(), expectedRevision: state.revision, authority, handoffId: recipientHandoff.handoff.id, packageId: selectedPackage.id, recipient, decision, receiptReference, rationale: decision === 'correction-requested' ? correctionRationale : '', recordedBy: 'commercial-director', recordedOn: recipientHandoff.handoff.preparedOn > '2026-10-27' ? '2026-10-29' : '2026-10-27' })); setMessage(decision === 'acknowledged' ? 'Manual recipient acknowledgement recorded against this package.' : 'Correction requested; issued package preserved for a new revision.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Recipient response failed.'); } queueMicrotask(() => feedback.current?.focus()); };
  const reassignRecipient = () => { if (!recipientHandoff?.handoff) return; try { setState(repository.dispatch({ id: crypto.randomUUID(), expectedRevision: state.revision, authority, handoffId: recipientHandoff.handoff.id, recipientIdentity: replacementRecipient, dueOn: '2026-11-05', reason: reassignmentReason, reassignedBy: 'commercial-director', reassignedOn: '2026-10-28' })); setMessage('Recipient handoff reassigned; previous assignment retained in history.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Recipient reassignment failed.'); } queueMicrotask(() => feedback.current?.focus()); };
  const substituteRecipient = () => { if (!recipientHandoff?.handoff) return; try { setState(repository.dispatch({ id: crypto.randomUUID(), expectedRevision: state.revision, authority, handoffId: recipientHandoff.handoff.id, substituteRecipient: replacementRecipient, reason: substitutionReason, approvalReference: substitutionApproval, approvedBy: 'commercial-director', approvedOn: '2026-10-28', dueOn: '2026-11-05' })); setMessage('Recipient substitution approved; the substitute must acknowledge the current package.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Recipient substitution failed.'); } queueMicrotask(() => feedback.current?.focus()); };
  const reviewSupersession = (decision: 'retain acknowledgement' | 'renew acknowledgement') => { try { setState(repository.dispatch({ id: crypto.randomUUID(), expectedRevision: state.revision, authority, projectId: selectedProjectId, recipient, decision, rationale: supersessionRationale, authorizedBy: 'commercial-director', authorizedOn: '2026-10-28' })); setMessage(decision === 'retain acknowledgement' ? 'Unchanged recipient obligation retained by explicit policy decision.' : 'Recipient obligation renewed for the current package.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Recipient supersession review failed.'); } queueMicrotask(() => feedback.current?.focus()); };
  const assemblePackage = () => { try { const id = crypto.randomUUID(); const next = repository.dispatch({ id, expectedRevision: state.revision, authority, projectId: selectedProjectId, status: projectClosures.length > 0 ? "final" : "preliminary", assembledBy: "commercial-director", assembledOn: assemblyDate }); setState(next); setSelectedPackageId(id); setMessage("Governed closeout evidence package assembled from pinned source records."); } catch (error) { setMessage(error instanceof Error ? error.message : "Package assembly failed."); } queueMicrotask(() => feedback.current?.focus()); };
  const proposeAdjustment = () => { try { setState(repository.dispatch({ id: crypto.randomUUID(), expectedRevision: state.revision, authority, projectId: selectedProjectId, category: adjustmentDraft.category, commercialReason: adjustmentDraft.reason, amountCents: Number(adjustmentDraft.amount), direction: adjustmentDraft.direction, contractor: adjustmentDraft.contractor, sourceCommercialItem: adjustmentDraft.source, evidenceReference: adjustmentDraft.evidence, notes: adjustmentDraft.notes, proposedEffectiveRevision: (projectAccounts.at(-1)?.revision ?? 0) + 1, proposedBy: "commercial-manager", proposedOn: "2026-10-21" })); setMessage("Final-account adjustment proposed with commercial evidence."); } catch (error) { setMessage(error instanceof Error ? error.message : "Adjustment proposal failed."); } queueMicrotask(() => feedback.current?.focus()); };
  const reviewAdjustment = (decision: "accepted" | "rejected") => { const adjustment = projectAdjustments.find((item) => item.status === "proposed"); if (!adjustment) return; try { setState(repository.dispatch({ id: crypto.randomUUID(), expectedRevision: state.revision, authority, adjustmentId: adjustment.id, decision, reviewedBy: "commercial-director", reviewedOn: "2026-10-22" })); setMessage(`Final-account adjustment ${decision}.`); } catch (error) { setMessage(error instanceof Error ? error.message : "Adjustment review failed."); } queueMicrotask(() => feedback.current?.focus()); };
  const close = () => {
    try {
      setState(
        repository.dispatch({
          id: crypto.randomUUID(),
          expectedRevision: state.revision,
          authority,
          projectId: selectedProjectId,
          evidenceIds: closureDraft.evidence.split(",").map((item) => item.trim()).filter(Boolean),
          satisfiedDocuments: Number(closureDraft.satisfied),
          waivedDocuments: Number(closureDraft.waived),
          waiverAuthority: Number(closureDraft.waived) > 0 ? "Commercial Director" : null,
          waiverRationale: closureDraft.waiverReason || null,
          waivedExposureCents: Number(closureDraft.exposure),
          finalAccountReference: state.finalAccounts.filter((item) => item.projectId === selectedProjectId).at(-1)?.finalReference ?? closureDraft.account,
          custodyReference: closureDraft.custody,
          authorizedBy: "director-closeout",
          closedOn: "2026-10-24",
        }),
      );
      setMessage(
        "Project closeout authorized with immutable evidence and waiver consequence.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Project closure failed.",
      );
    }
    queueMicrotask(() => feedback.current?.focus());
  };
  return (
    <section className="card" aria-label="Closeout portfolio">
      <h2>Project closeout portfolio</h2>
      <label>
        Portfolio authority
        <select
          value={authority}
          onChange={(event) => {
            setAuthority(event.target.value as PortfolioAuthority);
          }}
        >
          <option>Portfolio Viewer</option>
          <option>Commercial Director</option>
          <option>Document Controller</option>
        </select>
      </label>
      <label>Operational closeout project<select value={selectedProjectId} onChange={(event) => { const id = event.target.value; setSelectedProjectId(id); localStorage.setItem('buildledger:closeout-project:v1', id); setSelectedPackageId(null); const nextRecipient = currentRequiredRecipients(state, id)[0] ?? 'Client representative'; setRecipient(nextRecipient); setScopeRecipient(nextRecipient); setDraftScope([...currentRecipientContentScope(state, id, nextRecipient)]); setMessage('Selected project sources loaded; other project records and drafts are preserved.'); }}>{state.projects.map((item) => <option key={item.projectId} value={item.projectId}>{item.projectId}</option>)}</select></label>
      <p aria-label="Selected closeout source">{selectedProject.projectId} · {selectedProject.contractor} · source {selectedProject.sourceReference} · open documents {selectedProject.openDocuments}</p>
      <button onClick={() => { setState(repository.read()); setMessage('Closeout sources refreshed; project drafts are preserved.'); }}>Refresh closeout sources</button>
      {portfolio.map((item) => (
        <p key={item.projectId}>
          {item.projectId} · {item.urgency} · coverage {item.coveragePercent}% ·
          exposure {item.commercialExposureCents} · manager{" "}
          {item.commercialManager} · source {item.sourceReference}
        </p>
      ))}
      <section aria-label="Project closeout archive"><h3>Final closeout recovery</h3><button disabled={authority !== 'Commercial Director' || !finalPackage} onClick={captureArchive}>Capture final closeout archive</button><label>Import closeout archive<input type="file" accept="application/json,.json" onChange={(event) => { void importArchive(event.target.files?.[0]); }} /></label>{archive && <><p aria-label="Closeout archive preview">Archive {archive.id} · project {archive.projectId} · package {archive.currentPackageId} · account revision {String(archive.accountRevision)} · source revision {String(archive.sourceRevision)} · {archivePreview?.ready ? 'verified for restore' : 'restore blocked'}</p>{archivePreview?.reasons.map((reason) => <p role="alert" key={reason}>{reason}</p>)}<a download={`closeout-${archive.projectId}-${archive.id}.json`} href={`data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(archive, null, 2))}`}>Download closeout archive</a><button disabled={authority !== 'Commercial Director' || !archivePreview?.ready} onClick={restoreArchive}>Restore verified project closeout</button></>}<ol aria-label="Closeout archive restoration history">{state.archiveRestores.filter((item) => item.projectId === selectedProjectId).map((item) => <li key={item.id}>{item.archiveId} · {item.projectId} · revision {String(item.sourceRevision)} · {item.restoredBy}</li>)}</ol></section>
      <button
        disabled={
          authority !== "Commercial Director" || projectInterventions.length > 0
        }
        onClick={intervene}
      >
        Schedule overdue closeout intervention
      </button>
      <fieldset><legend>Categorized final-account adjustment</legend><label>Category<select value={adjustmentDraft.category} onChange={(event) => { setAdjustmentDraft({ ...adjustmentDraft, category: event.target.value as typeof adjustmentDraft.category }); }}><option value="variation">Variation</option><option value="retention">Retention</option><option value="claim">Claim</option></select></label><label>Commercial reason<textarea value={adjustmentDraft.reason} onChange={(event) => { setAdjustmentDraft({ ...adjustmentDraft, reason: event.target.value }); }} /></label><label>Amount<input inputMode="numeric" value={adjustmentDraft.amount} onChange={(event) => { setAdjustmentDraft({ ...adjustmentDraft, amount: event.target.value }); }} /></label><label>Impact direction<select value={adjustmentDraft.direction} onChange={(event) => { setAdjustmentDraft({ ...adjustmentDraft, direction: event.target.value as typeof adjustmentDraft.direction }); }}><option value="increase">Increase</option><option value="decrease">Decrease</option></select></label><label>Contractor<input value={adjustmentDraft.contractor} onChange={(event) => { setAdjustmentDraft({ ...adjustmentDraft, contractor: event.target.value }); }} /></label><label>Source commercial item<input value={adjustmentDraft.source} onChange={(event) => { setAdjustmentDraft({ ...adjustmentDraft, source: event.target.value }); }} /></label><label>Evidence reference<input value={adjustmentDraft.evidence} onChange={(event) => { setAdjustmentDraft({ ...adjustmentDraft, evidence: event.target.value }); }} /></label><label>Rationale<textarea value={adjustmentDraft.notes} onChange={(event) => { setAdjustmentDraft({ ...adjustmentDraft, notes: event.target.value }); }} /></label><p aria-label="Final account comparison">Current {comparison.currentValueCents} · adjustment {comparison.adjustmentValueCents} · resulting {comparison.resultingValueCents}</p></fieldset>
      <button disabled={authority !== "Commercial Director" || projectAdjustments.some((item) => item.status === "proposed") || projectClosures.length > 0} onClick={proposeAdjustment}>Propose final-account adjustment</button>
      <button disabled={authority !== "Commercial Director" || !projectAdjustments.some((item) => item.status === "proposed")} onClick={() => { reviewAdjustment("accepted"); }}>Accept current adjustment</button>
      <button disabled={authority !== "Commercial Director" || !projectAdjustments.some((item) => item.status === "proposed")} onClick={() => { reviewAdjustment("rejected"); }}>Reject current adjustment</button>
      <fieldset><legend>Selected project closure evidence</legend><label>Verified document references<input value={closureDraft.evidence} onChange={(event) => { setClosureDraft({ ...closureDraft, evidence: event.target.value }); }} /></label><label>Satisfied documents<input type="number" min="0" step="1" value={closureDraft.satisfied} onChange={(event) => { setClosureDraft({ ...closureDraft, satisfied: event.target.value }); }} /></label><label>Waived documents<input type="number" min="0" step="1" value={closureDraft.waived} onChange={(event) => { setClosureDraft({ ...closureDraft, waived: event.target.value }); }} /></label><label>Document waiver rationale<textarea value={closureDraft.waiverReason} onChange={(event) => { setClosureDraft({ ...closureDraft, waiverReason: event.target.value }); }} /></label><label>Retained waiver exposure<input type="number" min="0" step="1" value={closureDraft.exposure} onChange={(event) => { setClosureDraft({ ...closureDraft, exposure: event.target.value }); }} /></label><label>Final account closure reference<input value={projectAccounts.at(-1)?.finalReference ?? closureDraft.account} disabled={Boolean(projectAccounts.length)} onChange={(event) => { setClosureDraft({ ...closureDraft, account: event.target.value }); }} /></label><label>Document custody reference<input value={closureDraft.custody} onChange={(event) => { setClosureDraft({ ...closureDraft, custody: event.target.value }); }} /></label></fieldset>
      <button
        disabled={
          authority !== "Commercial Director" ||
          projectInterventions.length === 0 ||
          projectAdjustments.some((item) => item.status === "proposed") ||
          projectClosures.length > 0
        }
        onClick={close}
      >
        Authorize evidence-based project closure
      </button>
      <label>Package assembly date<input type="date" value={assemblyDate} onChange={(event) => { setAssemblyDates((current) => ({ ...current, [selectedProjectId]: event.target.value })); }} /></label>
      <button disabled={authority !== "Commercial Director"} onClick={assemblePackage}>Assemble closeout evidence package</button>
      {selectedPackage && <section aria-label="Closeout package preview"><h3>{selectedPackage.status} closeout package</h3><p aria-label="Closeout document manifest status">{getCloseoutDocumentManifestStatus(state, selectedPackage).status}</p>{selectedPackage.documentManifest && <ol aria-label="Pinned closeout document manifest">{selectedPackage.documentManifest.map((pin) => { const revision = state.documentRevisions?.find((item) => item.id === pin.revisionId); return <li key={pin.custodyId}>{revision?.documentReference ?? pin.custodyId} · revision {revision?.revisionLabel ?? 'missing evidence'} · {revision?.evidenceReference ?? pin.revisionId}</li>; })}</ol>}<p>Assembled {selectedPackage.assembledOn} by {selectedPackage.assembledBy} · source revision {selectedPackage.sourceRevision} · final account revision {selectedPackage.accountRevision}</p><p>Accepted adjustments {selectedPackage.acceptedAdjustmentIds.length} · open documents at assembly {selectedPackage.openDocumentCount} · custody records {selectedPackage.custodyIds.length} · waivers {selectedPackage.waiverIds.length} · closure {selectedPackage.closureId ?? "pending"}</p><a download={`closeout-${selectedPackage.id}.json`} href={`data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(selectedPackage, null, 2))}`}>Export pinned package manifest</a></section>}
      {projectDocuments.length > 0 && <section aria-label="Authoritative closeout documents"><h3>Document revision register</h3><p>Each revision belongs to an existing verified custody record. Issued packages retain the exact revisions they reviewed.</p><ol aria-label="Current closeout document revisions">{projectDocuments.map((document) => { const revision = state.documentRevisions?.filter((item) => item.custodyId === document.id).toSorted((a, b) => a.revision - b.revision).at(-1); return <li key={document.id}>{document.documentReference} · {revision ? `revision ${revision.revisionLabel} · ${revision.evidenceReference}` : 'revision not registered'}</li>; })}</ol><details><summary>Register a document revision</summary><label>Closeout custody document<select value={selectedDocument?.id ?? ''} onChange={(event) => { setDocumentSelections((current) => ({ ...current, [selectedProjectId]: event.target.value })); }}>{projectDocuments.map((item) => <option key={item.id} value={item.id}>{item.documentReference}</option>)}</select></label><label>Document revision label<input value={documentDraft.label} onChange={(event) => { updateDocumentDraft({ label: event.target.value }); }} /></label><label>Document revision evidence<input value={documentDraft.evidence} onChange={(event) => { updateDocumentDraft({ evidence: event.target.value }); }} /></label><label>Document revision date<input type="date" value={documentDraft.date} onChange={(event) => { updateDocumentDraft({ date: event.target.value }); }} /></label><button disabled={authority !== 'Commercial Director' || !selectedDocument} onClick={registerDocument}>Register closeout document revision</button></details>
      {selectedRevision?.requiresReleaseReview && <section aria-label="Closeout document technical release"><h4>Independent technical release</h4><p>{selectedRevision.documentReference} · revision {selectedRevision.revisionLabel} · {closeoutDocumentRelease(state, selectedRevision).status}</p><p>Returned revisions retain their review and require a new corrected revision. Commercial registration alone does not release a document.</p>{!(state.documentReleaseReviews ?? []).some(item => item.revisionId === selectedRevision.id) && <><label>Technical release evidence<input value={releaseDraft.evidence} onChange={event => { updateReleaseDraft({ evidence: event.target.value }); }} /></label><label>Technical review rationale<textarea value={releaseDraft.rationale} onChange={event => { updateReleaseDraft({ rationale: event.target.value }); }} /></label><label>Technical review date<input type="date" value={releaseDraft.date} onChange={event => { updateReleaseDraft({ date: event.target.value }); }} /></label><button disabled={authority !== 'Document Controller'} onClick={() => { technicalReview('released'); }}>Release reviewed closeout document</button><button disabled={authority !== 'Document Controller'} onClick={() => { technicalReview('returned'); }}>Return closeout document for correction</button></>}</section>}
      <details><summary>Document technical release history</summary><ol aria-label="Technical release decisions">{state.documentReleaseReviews?.filter(item => item.projectId === selectedProjectId).map(item => <li key={item.id}>{state.documentRevisions?.find(revision => revision.id === item.revisionId)?.documentReference} · {item.decision} · {item.rationale} · {item.evidenceReference} · {item.reviewedBy} · {item.reviewedOn}</li>)}</ol></details>
<details><summary>Document revision history</summary><ol aria-label="Closeout document revision history">{state.documentRevisions?.filter((item) => item.projectId === selectedProjectId).map((item) => <li key={item.id}>{item.documentReference} · revision {item.revisionLabel} · {item.previousRevisionId ? 'superseding prior revision' : 'first registered revision'} · {item.evidenceReference} · {item.registeredOn} · {item.registeredBy}</li>)}</ol></details></section>}
      <section aria-label="Project handover acceptance"><h3>Recipient-complete handover</h3><p aria-label="Handover acceptance status">{handoverAcceptance.status}</p>{handoverAcceptance.outstanding.length > 0 && <ul aria-label="Handover blockers">{handoverAcceptance.outstanding.map((item) => <li key={item}>{item}</li>)}</ul>}<label>Handover acceptance reference<input value={acceptanceReference} onChange={(event) => { setAcceptanceReference(event.target.value); }} /></label><button disabled={authority !== 'Commercial Director' || !handoverAcceptance.ready} onClick={acceptHandover}>Accept recipient-complete handover</button><details><summary>Handover acceptance history ({state.handoverAcceptances.filter((item) => item.projectId === selectedProjectId).length})</summary><ol aria-label="Handover acceptance history">{state.handoverAcceptances.filter((item) => item.projectId === selectedProjectId).map((item) => <li key={item.id}>{item.acceptanceReference} · package {item.packageId} · policy revision {item.recipientPolicyRevision} · {item.obligations.length} recipient receipts · {item.acceptedBy} · {item.acceptedOn}{item.id === handoverAcceptance.latest?.id ? handoverAcceptance.current ? ' · current' : ' · superseded' : ' · historical'}</li>)}</ol></details></section>
      <section aria-label="Recipient content policy"><h3>Recipient content policy</h3><p>Each required recipient acknowledges the listed closeout content. Material changes to that content require a fresh package response.</p><ol>{handoffStatus.recipients.map((item) => <li key={item.recipient}>{item.recipient}: {item.contentScopes.join(', ')} · {item.status}</li>)}</ol><label>Scope recipient<select value={scopeRecipient} onChange={(event) => { const next = event.target.value as CloseoutRecipient; setScopeRecipient(next); setDraftScope([...currentRecipientContentScope(state, selectedProjectId, next)]); }}>{activeRecipients.map((item) => <option key={item}>{item}</option>)}</select></label><fieldset><legend>Required content for selected recipient</legend>{closeoutContentScopes.map((scope) => <label key={scope}><input type="checkbox" checked={draftScope.includes(scope)} onChange={(event) => { setDraftScope((current) => event.target.checked ? [...current, scope] : current.filter((item) => item !== scope)); }} />{scope}</label>)}</fieldset><button disabled={authority !== 'Commercial Director' || !handoffStatus.package} onClick={reviseContentScope}>Approve content scope revision</button></section>
      <section aria-label="Closeout recipient handoff"><h3>Final package handoff</h3><p>Current final package {handoffStatus.package?.assembledOn ?? 'not assembled'} · {handoffStatus.complete ? 'all required recipients acknowledged' : 'required acknowledgements outstanding'}</p><p aria-label="Closeout handoff exceptions">{overdueHandoffStatus.recipients.filter((item) => item.status === 'overdue').map((item) => `${item.recipient}: acknowledgement overdue for ${item.handoff?.recipientIdentity ?? item.recipient}`).join('; ') || 'No overdue recipient acknowledgements'}</p><label>Handoff recipient<select value={recipient} onChange={(event) => { setRecipient(event.target.value as CloseoutRecipient); }}>{activeRecipients.map((item) => <option key={item}>{item}</option>)}</select></label>{recipientHandoff?.status === 'policy review required' && <div aria-label="Recipient supersession review"><p>{recipient} · {recipientHandoff.changedScope.length ? `changed ${recipientHandoff.changedScope.join(', ')}` : 'recipient scope unchanged'} · previous acknowledgement remains historical</p><label>Supersession policy rationale<input value={supersessionRationale} onChange={(event) => { setSupersessionRationale(event.target.value); }} /></label><button disabled={authority !== 'Commercial Director'} onClick={() => { reviewSupersession('retain acknowledgement'); }}>Retain unchanged acknowledgement</button><button disabled={authority !== 'Commercial Director'} onClick={() => { reviewSupersession('renew acknowledgement'); }}>Require new acknowledgement</button></div>}<button disabled={authority !== 'Commercial Director' || selectedPackage?.status !== 'final' || selectedPackage.id !== handoffStatus.package?.id || Boolean(recipientHandoff?.handoff) || recipientHandoff?.status === 'policy review required' || recipientHandoff?.policy?.decision === 'retain acknowledgement' || handoffStatus.manifestStale} onClick={prepareHandoff}>Prepare manual recipient handoff</button><label>Manual receipt reference<input value={receiptReference} onChange={(event) => { setReceiptReference(event.target.value); }} /></label><label>Correction rationale<input value={correctionRationale} onChange={(event) => { setCorrectionRationale(event.target.value); }} /></label><button disabled={authority !== 'Commercial Director' || !recipientHandoff?.handoff || Boolean(recipientHandoff.response) || handoffStatus.manifestStale} onClick={() => { recordResponse('acknowledged'); }}>Record recipient acknowledgement</button><button disabled={authority !== 'Commercial Director' || !recipientHandoff?.handoff || Boolean(recipientHandoff.response) || handoffStatus.manifestStale} onClick={() => { recordResponse('correction-requested'); }}>Record correction request</button><label>Replacement recipient identity<input value={replacementRecipient} onChange={(event) => { setReplacementRecipient(event.target.value); }} /></label><label>Reassignment reason<input value={reassignmentReason} onChange={(event) => { setReassignmentReason(event.target.value); }} /></label><button disabled={authority !== 'Commercial Director' || !recipientHandoff?.handoff || Boolean(recipientHandoff.response) || handoffStatus.manifestStale} onClick={reassignRecipient}>Reassign unanswered recipient</button><label>Substitution policy reason<select value={substitutionReason} onChange={(event) => { setSubstitutionReason(event.target.value as typeof substitutionReason); }}><option>representative replaced</option><option>responsibility changed</option><option>contact superseded</option></select></label><label>Substitution approval reference<input value={substitutionApproval} onChange={(event) => { setSubstitutionApproval(event.target.value); }} /></label><button disabled={authority !== 'Commercial Director' || !recipientHandoff?.handoff} onClick={substituteRecipient}>Approve recipient substitution</button><ol aria-label="Required closeout recipients">{handoffStatus.recipients.map((item) => <li key={item.recipient}>{item.recipient} · {item.status} · {item.handoff?.recipientIdentity ?? item.recipient} · {item.response?.receiptReference ?? (item.policy?.decision === 'retain acknowledgement' ? 'retained by approved policy' : 'no receipt evidence')} · {item.changedScope.length ? `changed ${item.changedScope.join(', ')}` : 'scope unchanged'}</li>)}</ol><div aria-label="Recipient policy revision"><label>Policy recipient<select value={policyRecipient} onChange={(event) => { setPolicyRecipient(event.target.value as CloseoutRecipient); }}>{[...requiredCloseoutRecipients, 'Independent certifier'].map((item) => <option key={item}>{item}</option>)}</select></label><label>Policy change reason<input value={policyReason} onChange={(event) => { setPolicyReason(event.target.value); }} /></label><button disabled={authority !== 'Commercial Director' || !handoffStatus.package} onClick={reviseRecipientPolicy}>{activeRecipients.includes(policyRecipient) ? 'Retire recipient obligation' : 'Require recipient acknowledgement'}</button></div><ol aria-label="Recipient policy revision history">{state.recipientPolicyRevisions.filter((item) => item.projectId === selectedProjectId).map((item) => <li key={item.id}>Revision {item.revision} · package {item.packageId} · introduced {item.introduced.join(', ') || 'none'} · retired {item.retired.join(', ') || 'none'} · {item.reason} · {item.approvedBy}</li>)}</ol><ol aria-label="Recipient assignment history">{state.handoffs.filter((item) => item.projectId === selectedProjectId).map((item) => <li key={item.id}>{item.recipient} · {item.recipientIdentity ?? item.recipient} · {item.previousHandoffId ? `reassigned from ${item.previousHandoffId}` : 'initial handoff'} · package {item.packageId}</li>)}</ol><ol aria-label="Recipient substitution policy history">{state.recipientSubstitutions.filter((item) => projectPackages.some((pkg) => pkg.id === item.packageId)).map((item) => <li key={item.id}>{item.originalRecipient} to {item.substituteRecipient} · {item.reason} · approval {item.approvalReference} · package revision {item.packageSourceRevision}</li>)}</ol><ol aria-label="Recipient supersession policy history">{state.recipientPolicies.filter((item) => item.projectId === selectedProjectId).map((item) => <li key={item.id}>{item.recipient} · {item.decision} · {item.changedScope.join(', ') || 'scope unchanged'} · {item.previousPackageId} to {item.currentPackageId}</li>)}</ol></section>
      <ol aria-label="Closeout evidence packages">{projectPackages.map((item) => <li key={item.id}><button onClick={() => { setSelectedPackageId(item.id); }}>{item.status} · {item.assembledOn} · source revision {item.sourceRevision}</button></li>)}</ol>
      {message && (
        <p ref={feedback} tabIndex={-1} role="status">
          {message}
        </p>
      )}
      <ol aria-label="Final account history">
        {projectAccounts.map((item) => (
          <li key={item.id}>
            {item.projectId} · revision {item.revision} · {item.sourceReference}{" "}
            to {item.finalReference} · exposure {item.commercialExposureCents}
          </li>
        ))}
      </ol>
      <ol aria-label="Final account adjustment history">{projectAdjustments.map((item) => <li key={item.id}>{item.category} · {item.valueCents} · {item.status} · evidence {item.evidenceIds.join(", ")} · account revision {item.resultingAccountRevision ?? "none"}</li>)}</ol>
      <ol aria-label="Document custody history">
        {state.documentCustody.filter((item) => item.projectId === selectedProjectId).map((item) => (
          <li key={item.id}>
            {item.documentReference} · {item.status} · custody{" "}
            {item.custodyReference}
          </li>
        ))}
      </ol>
      <ol aria-label="Closeout intervention history">
        {projectInterventions.map((item) => (
          <li key={item.id}>
            {item.projectId} · {item.previousManager} to {item.assignedManager}{" "}
            · review {item.reviewOn} · source {item.obligationReference}
          </li>
        ))}
      </ol>
      <ol aria-label="Project closure history">
        {projectClosures.map((item) => (
          <li key={item.id}>
            {item.projectId} · closed {item.closedOn} · evidence{" "}
            {item.evidenceIds.join(", ")} · waived {item.waivedDocuments} ·
            retained exposure {item.waivedExposureCents}
          </li>
        ))}
      </ol>
    </section>
  );
}
