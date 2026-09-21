import { useRef, useState } from "react";
import { assessCloseoutPortfolio } from "./closeout-portfolio";
import {
  BrowserCloseoutPersistence,
  CloseoutPortfolioRepository,
  compareFinalAccountAdjustment,
  getCloseoutHandoffStatus,
  requiredCloseoutRecipients,
  type CloseoutRecipient,
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
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
  const [recipient, setRecipient] = useState<CloseoutRecipient>('Client representative');
  const [receiptReference, setReceiptReference] = useState('RECEIPT-PROJECT-SOUTH-01');
  const [correctionRationale, setCorrectionRationale] = useState('Recipient requests a corrected custody document reference.');
  const [replacementRecipient, setReplacementRecipient] = useState('Client delegate');
  const [reassignmentReason, setReassignmentReason] = useState('Original recipient is unavailable for closeout acknowledgement.');
  const [adjustmentDraft, setAdjustmentDraft] = useState({ category: "variation" as "variation" | "retention" | "claim", reason: "Approved variation must be reflected before final account closure.", amount: "25000", direction: "increase" as "increase" | "decrease", contractor: "MEP contractor", source: "VO-19", evidence: "VO-19", notes: "Approved commercial instruction supported by quantity surveyor evidence." });
  const feedback = useRef<HTMLParagraphElement>(null);
  const portfolio = assessCloseoutPortfolio(state.projects, "2026-10-20");
  const intervene = () => {
    try {
      setState(
        repository.dispatch({
          id: crypto.randomUUID(),
          expectedRevision: state.revision,
          authority,
          projectId: "PROJECT-SOUTH",
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
  const comparison = compareFinalAccountAdjustment(state, "PROJECT-SOUTH", Number(adjustmentDraft.amount) || 0, adjustmentDraft.direction);
  const selectedPackage = state.evidencePackages.find((item) => item.id === selectedPackageId) ?? state.evidencePackages.at(-1);
  const handoffStatus = getCloseoutHandoffStatus(state, 'PROJECT-SOUTH');
  const overdueHandoffStatus = getCloseoutHandoffStatus(state, 'PROJECT-SOUTH', '2026-10-28');
  const recipientHandoff = handoffStatus.recipients.find((item) => item.recipient === recipient);
  const prepareHandoff = () => { if (!selectedPackage) return; try { setState(repository.dispatch({ id: crypto.randomUUID(), expectedRevision: state.revision, authority, packageId: selectedPackage.id, recipient, dueOn: '2026-10-27', preparedBy: 'commercial-director', preparedOn: '2026-10-26' })); setMessage('Manual closeout handoff prepared; recipient receipt remains unconfirmed.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Closeout handoff failed.'); } queueMicrotask(() => feedback.current?.focus()); };
  const recordResponse = (decision: 'acknowledged' | 'correction-requested') => { if (!recipientHandoff?.handoff || !selectedPackage) return; try { setState(repository.dispatch({ id: crypto.randomUUID(), expectedRevision: state.revision, authority, handoffId: recipientHandoff.handoff.id, packageId: selectedPackage.id, recipient, decision, receiptReference, rationale: decision === 'correction-requested' ? correctionRationale : '', recordedBy: 'commercial-director', recordedOn: recipientHandoff.handoff.preparedOn > '2026-10-27' ? '2026-10-29' : '2026-10-27' })); setMessage(decision === 'acknowledged' ? 'Manual recipient acknowledgement recorded against this package.' : 'Correction requested; issued package preserved for a new revision.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Recipient response failed.'); } queueMicrotask(() => feedback.current?.focus()); };
  const reassignRecipient = () => { if (!recipientHandoff?.handoff) return; try { setState(repository.dispatch({ id: crypto.randomUUID(), expectedRevision: state.revision, authority, handoffId: recipientHandoff.handoff.id, recipientIdentity: replacementRecipient, dueOn: '2026-11-05', reason: reassignmentReason, reassignedBy: 'commercial-director', reassignedOn: '2026-10-28' })); setMessage('Recipient handoff reassigned; previous assignment retained in history.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Recipient reassignment failed.'); } queueMicrotask(() => feedback.current?.focus()); };
  const assemblePackage = () => { try { const id = crypto.randomUUID(); const next = repository.dispatch({ id, expectedRevision: state.revision, authority, projectId: "PROJECT-SOUTH", status: state.closures.length > 0 ? "final" : "preliminary", assembledBy: "commercial-director", assembledOn: "2026-10-25" }); setState(next); setSelectedPackageId(id); setMessage("Governed closeout evidence package assembled from pinned source records."); } catch (error) { setMessage(error instanceof Error ? error.message : "Package assembly failed."); } queueMicrotask(() => feedback.current?.focus()); };
  const proposeAdjustment = () => { try { setState(repository.dispatch({ id: crypto.randomUUID(), expectedRevision: state.revision, authority, projectId: "PROJECT-SOUTH", category: adjustmentDraft.category, commercialReason: adjustmentDraft.reason, amountCents: Number(adjustmentDraft.amount), direction: adjustmentDraft.direction, contractor: adjustmentDraft.contractor, sourceCommercialItem: adjustmentDraft.source, evidenceReference: adjustmentDraft.evidence, notes: adjustmentDraft.notes, proposedEffectiveRevision: (state.finalAccounts.at(-1)?.revision ?? 0) + 1, proposedBy: "commercial-manager", proposedOn: "2026-10-21" })); setMessage("Final-account adjustment proposed with commercial evidence."); } catch (error) { setMessage(error instanceof Error ? error.message : "Adjustment proposal failed."); } queueMicrotask(() => feedback.current?.focus()); };
  const reviewAdjustment = (decision: "accepted" | "rejected") => { const adjustment = state.adjustments.find((item) => item.status === "proposed"); if (!adjustment) return; try { setState(repository.dispatch({ id: crypto.randomUUID(), expectedRevision: state.revision, authority, adjustmentId: adjustment.id, decision, reviewedBy: "commercial-director", reviewedOn: "2026-10-22" })); setMessage(`Final-account adjustment ${decision}.`); } catch (error) { setMessage(error instanceof Error ? error.message : "Adjustment review failed."); } queueMicrotask(() => feedback.current?.focus()); };
  const close = () => {
    try {
      setState(
        repository.dispatch({
          id: crypto.randomUUID(),
          expectedRevision: state.revision,
          authority,
          projectId: "PROJECT-SOUTH",
          evidenceIds: ["DOC-O&M-9", "DOC-WARRANTY-3"],
          satisfiedDocuments: 2,
          waivedDocuments: 1,
          waiverAuthority: "Commercial Director",
          waiverRationale:
            "Minor training record accepted with retained commercial exposure.",
          waivedExposureCents: 40_000,
          finalAccountReference: state.finalAccounts.filter((item) => item.projectId === "PROJECT-SOUTH").at(-1)?.finalReference ?? "FA-2026-009-FINAL",
          custodyReference: "CUSTODY-882",
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
        </select>
      </label>
      {portfolio.map((item) => (
        <p key={item.projectId}>
          {item.projectId} · {item.urgency} · coverage {item.coveragePercent}% ·
          exposure {item.commercialExposureCents} · manager{" "}
          {item.commercialManager} · source {item.sourceReference}
        </p>
      ))}
      <button
        disabled={
          authority !== "Commercial Director" || state.interventions.length > 0
        }
        onClick={intervene}
      >
        Schedule overdue closeout intervention
      </button>
      <fieldset><legend>Categorized final-account adjustment</legend><label>Category<select value={adjustmentDraft.category} onChange={(event) => { setAdjustmentDraft({ ...adjustmentDraft, category: event.target.value as typeof adjustmentDraft.category }); }}><option value="variation">Variation</option><option value="retention">Retention</option><option value="claim">Claim</option></select></label><label>Commercial reason<textarea value={adjustmentDraft.reason} onChange={(event) => { setAdjustmentDraft({ ...adjustmentDraft, reason: event.target.value }); }} /></label><label>Amount<input inputMode="numeric" value={adjustmentDraft.amount} onChange={(event) => { setAdjustmentDraft({ ...adjustmentDraft, amount: event.target.value }); }} /></label><label>Impact direction<select value={adjustmentDraft.direction} onChange={(event) => { setAdjustmentDraft({ ...adjustmentDraft, direction: event.target.value as typeof adjustmentDraft.direction }); }}><option value="increase">Increase</option><option value="decrease">Decrease</option></select></label><label>Contractor<input value={adjustmentDraft.contractor} onChange={(event) => { setAdjustmentDraft({ ...adjustmentDraft, contractor: event.target.value }); }} /></label><label>Source commercial item<input value={adjustmentDraft.source} onChange={(event) => { setAdjustmentDraft({ ...adjustmentDraft, source: event.target.value }); }} /></label><label>Evidence reference<input value={adjustmentDraft.evidence} onChange={(event) => { setAdjustmentDraft({ ...adjustmentDraft, evidence: event.target.value }); }} /></label><label>Rationale<textarea value={adjustmentDraft.notes} onChange={(event) => { setAdjustmentDraft({ ...adjustmentDraft, notes: event.target.value }); }} /></label><p aria-label="Final account comparison">Current {comparison.currentValueCents} · adjustment {comparison.adjustmentValueCents} · resulting {comparison.resultingValueCents}</p></fieldset>
      <button disabled={authority !== "Commercial Director" || state.adjustments.some((item) => item.status === "proposed") || state.closures.length > 0} onClick={proposeAdjustment}>Propose final-account adjustment</button>
      <button disabled={authority !== "Commercial Director" || !state.adjustments.some((item) => item.status === "proposed")} onClick={() => { reviewAdjustment("accepted"); }}>Accept current adjustment</button>
      <button disabled={authority !== "Commercial Director" || !state.adjustments.some((item) => item.status === "proposed")} onClick={() => { reviewAdjustment("rejected"); }}>Reject current adjustment</button>
      <button
        disabled={
          authority !== "Commercial Director" ||
          state.interventions.length === 0 ||
          state.adjustments.some((item) => item.status === "proposed") ||
          state.closures.length > 0
        }
        onClick={close}
      >
        Authorize evidence-based project closure
      </button>
      <button disabled={authority !== "Commercial Director"} onClick={assemblePackage}>Assemble closeout evidence package</button>
      {selectedPackage && <section aria-label="Closeout package preview"><h3>{selectedPackage.status} closeout package</h3><p>Assembled {selectedPackage.assembledOn} by {selectedPackage.assembledBy} · source revision {selectedPackage.sourceRevision} · final account revision {selectedPackage.accountRevision}</p><p>Accepted adjustments {selectedPackage.acceptedAdjustmentIds.length} · open documents at assembly {selectedPackage.openDocumentCount} · custody records {selectedPackage.custodyIds.length} · waivers {selectedPackage.waiverIds.length} · closure {selectedPackage.closureId ?? "pending"}</p><a download={`closeout-${selectedPackage.id}.json`} href={`data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(selectedPackage, null, 2))}`}>Export pinned package manifest</a></section>}
      <section aria-label="Closeout recipient handoff"><h3>Final package handoff</h3><p>Current final package {handoffStatus.package?.assembledOn ?? 'not assembled'} · {handoffStatus.complete ? 'all required recipients acknowledged' : 'required acknowledgements outstanding'}</p><p aria-label="Closeout handoff exceptions">{overdueHandoffStatus.recipients.filter((item) => item.status === 'overdue').map((item) => `${item.recipient}: acknowledgement overdue for ${item.handoff?.recipientIdentity ?? item.recipient}`).join('; ') || 'No overdue recipient acknowledgements'}</p><label>Handoff recipient<select value={recipient} onChange={(event) => { setRecipient(event.target.value as CloseoutRecipient); }}>{requiredCloseoutRecipients.map((item) => <option key={item}>{item}</option>)}</select></label><button disabled={authority !== 'Commercial Director' || selectedPackage?.status !== 'final' || selectedPackage.id !== handoffStatus.package?.id || Boolean(recipientHandoff?.handoff)} onClick={prepareHandoff}>Prepare manual recipient handoff</button><label>Manual receipt reference<input value={receiptReference} onChange={(event) => { setReceiptReference(event.target.value); }} /></label><label>Correction rationale<input value={correctionRationale} onChange={(event) => { setCorrectionRationale(event.target.value); }} /></label><button disabled={authority !== 'Commercial Director' || !recipientHandoff?.handoff || Boolean(recipientHandoff.response)} onClick={() => { recordResponse('acknowledged'); }}>Record recipient acknowledgement</button><button disabled={authority !== 'Commercial Director' || !recipientHandoff?.handoff || Boolean(recipientHandoff.response)} onClick={() => { recordResponse('correction-requested'); }}>Record correction request</button><label>Replacement recipient identity<input value={replacementRecipient} onChange={(event) => { setReplacementRecipient(event.target.value); }} /></label><label>Reassignment reason<input value={reassignmentReason} onChange={(event) => { setReassignmentReason(event.target.value); }} /></label><button disabled={authority !== 'Commercial Director' || !recipientHandoff?.handoff || Boolean(recipientHandoff.response)} onClick={reassignRecipient}>Reassign unanswered recipient</button><ol aria-label="Required closeout recipients">{handoffStatus.recipients.map((item) => <li key={item.recipient}>{item.recipient} · {item.status} · {item.handoff?.recipientIdentity ?? item.recipient} · {item.response?.receiptReference ?? 'no receipt evidence'}</li>)}</ol><ol aria-label="Recipient assignment history">{state.handoffs.filter((item) => item.projectId === 'PROJECT-SOUTH').map((item) => <li key={item.id}>{item.recipient} · {item.recipientIdentity ?? item.recipient} · {item.previousHandoffId ? `reassigned from ${item.previousHandoffId}` : 'initial handoff'} · package {item.packageId}</li>)}</ol></section>
      <ol aria-label="Closeout evidence packages">{state.evidencePackages.map((item) => <li key={item.id}><button onClick={() => { setSelectedPackageId(item.id); }}>{item.status} · {item.assembledOn} · source revision {item.sourceRevision}</button></li>)}</ol>
      {message && (
        <p ref={feedback} tabIndex={-1} role="status">
          {message}
        </p>
      )}
      <ol aria-label="Final account history">
        {state.finalAccounts.map((item) => (
          <li key={item.id}>
            {item.projectId} · revision {item.revision} · {item.sourceReference}{" "}
            to {item.finalReference} · exposure {item.commercialExposureCents}
          </li>
        ))}
      </ol>
      <ol aria-label="Final account adjustment history">{state.adjustments.map((item) => <li key={item.id}>{item.category} · {item.valueCents} · {item.status} · evidence {item.evidenceIds.join(", ")} · account revision {item.resultingAccountRevision ?? "none"}</li>)}</ol>
      <ol aria-label="Document custody history">
        {state.documentCustody.map((item) => (
          <li key={item.id}>
            {item.documentReference} · {item.status} · custody{" "}
            {item.custodyReference}
          </li>
        ))}
      </ol>
      <ol aria-label="Closeout intervention history">
        {state.interventions.map((item) => (
          <li key={item.id}>
            {item.projectId} · {item.previousManager} to {item.assignedManager}{" "}
            · review {item.reviewOn} · source {item.obligationReference}
          </li>
        ))}
      </ol>
      <ol aria-label="Project closure history">
        {state.closures.map((item) => (
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
