import { useRef, useState } from 'react';
import { approveMaterialSubmittal, draftMaterialSubmittal, inspectMaterialDelivery, MaterialTraceRepository, recordMaterialInstallation, releaseMaterialPurchase, verifyMaterialTraceability, type MaterialTraceRole, type MaterialTraceState } from './material-traceability';
const actors: Record<MaterialTraceRole, string> = { 'Package Engineer': 'engineer-a', 'Design Reviewer': 'reviewer-a', 'Procurement Manager': 'procurement-a', 'Site Inspector': 'inspector-a', 'Site Engineer': 'site-a', 'Quality Manager': 'quality-a' };

export function MaterialTraceabilityPage() {
  const [repository] = useState(() => new MaterialTraceRepository(localStorage));
  const [state, setState] = useState<MaterialTraceState>(() => repository.read());
  const [role, setRole] = useState<MaterialTraceRole>('Package Engineer');
  const [message, setMessage] = useState('');
  const feedback = useRef<HTMLParagraphElement>(null);
  const meta = () => ({ id: crypto.randomUUID(), expectedRevision: state.revision, actor: { id: actors[role], role } });
  const run = (operation: (value: MaterialTraceState) => MaterialTraceState, success: string) => {
    try { setState(repository.commit(state.revision, operation)); setMessage(success); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Material traceability action failed.'); }
    queueMicrotask(() => feedback.current?.focus());
  };
  return <main className="page">
    <header className="page-title"><p>Construction quality</p><h1>Material approval and traceability</h1><p>Approve specified products and preserve their chain from purchase through installed location.</p></header>
    <section className="workspace-toolbar"><label>Material trace role<select value={role} onChange={(event) => { setRole(event.target.value as MaterialTraceRole); }}>{Object.keys(actors).map((item) => <option key={item}>{item}</option>)}</select></label></section>
    {message && <p ref={feedback} tabIndex={-1} role="status">{message}</p>}
    <section className="card">
      <h2>{state.package.id} · {state.package.status}</h2>
      <p>Submittal {state.submittal?.status ?? 'not drafted'} · approved product {state.specification.approvedProduct ?? 'none'}</p>
      <p>Order {state.order.status} · {state.order.orderedQuantity} tonnes</p>
      <p>Delivery {state.delivery.status} · batch {state.delivery.batch ?? 'none'} · accepted {state.delivery.acceptedQuantity} tonnes</p>
      <p>Installed location {state.package.installedLocation ?? 'none'} · immutable evidence {state.evidence.length}</p>
      <button disabled={role !== 'Package Engineer' || Boolean(state.submittal)} onClick={() => { run((value) => draftMaterialSubmittal(value, { ...meta(), product: 'Axis Rebar 500', grade: 'B500B', certificate: 'MTC-STEEL-778' }), 'Material submittal drafted with certificate.'); }}>Draft material submittal</button>
      <button disabled={role !== 'Design Reviewer' || state.submittal?.status !== 'drafted'} onClick={() => { run((value) => approveMaterialSubmittal(value, meta()), 'Material submittal independently approved.'); }}>Approve material submittal</button>
      <button disabled={role !== 'Procurement Manager' || state.submittal?.status !== 'approved'} onClick={() => { run((value) => releaseMaterialPurchase(value, meta()), 'Approved material purchase released.'); }}>Release material purchase</button>
      <button disabled={role !== 'Site Inspector' || state.submittal?.status !== 'ordered'} onClick={() => { run((value) => inspectMaterialDelivery(value, { ...meta(), batch: 'HEAT-BATCH-778', quantity: 24, certificate: 'MTC-STEEL-778' }), 'Certified material delivery accepted.'); }}>Inspect material delivery</button>
      <button disabled={role !== 'Site Engineer' || state.submittal?.status !== 'delivered'} onClick={() => { run((value) => recordMaterialInstallation(value, { ...meta(), location: 'SLAB-L04-ZB', batch: 'HEAT-BATCH-778' }), 'Approved material installation recorded.'); }}>Record material installation</button>
      <button disabled={role !== 'Quality Manager' || state.submittal?.status !== 'installed'} onClick={() => { run((value) => verifyMaterialTraceability(value, meta()), 'Installed material traceability verified.'); }}>Verify material traceability</button>
    </section>
    <section className="card" aria-label="Material evidence"><h2>Immutable material evidence</h2>{state.evidence.map((item) => <p key={item.id}>{item.kind} · {item.reference}</p>)}</section>
    <section className="card" aria-label="Material traceability history"><h2>Material history</h2>{state.events.map((event) => <p key={event.id}>{event.action}</p>)}</section>
  </main>;
}
