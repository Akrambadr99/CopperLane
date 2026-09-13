import { useRef, useState } from 'react';
import { applyReadinessRefresh, approveInspectionRelease, assignJointInspector, changePackageFilter, InspectionReleaseRepository, recordJointInspection, releaseInspectedPackages, requestJointInspection, togglePackageSelection, visiblePackages, type InspectionReleaseState, type InspectionRole, type PackageFilter } from './inspection-release';
const actors: Record<InspectionRole, string> = { 'Site Engineer': 'engineer-a', 'Document Controller': 'documents-a', 'Quality Manager': 'quality-a', 'Site Inspector': 'inspector-a', 'Design Reviewer': 'design-a', 'Construction Manager': 'construction-a' };
export function InspectionReleasePage() {
  const [repository] = useState(() => new InspectionReleaseRepository(localStorage));
  const [state, setState] = useState<InspectionReleaseState>(() => repository.read());
  const [role, setRole] = useState<InspectionRole>('Site Engineer');
  const [message, setMessage] = useState('');
  const feedback = useRef<HTMLParagraphElement>(null);
  const meta = () => ({ id: crypto.randomUUID(), expectedRevision: state.revision, actor: { id: actors[role], role } });
  const run = (operation: (value: InspectionReleaseState) => InspectionReleaseState, success: string) => {
    try { setState(repository.commit(state.revision, operation)); setMessage(success); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Inspection release failed.'); }
    queueMicrotask(() => feedback.current?.focus());
  };
  return <main className="page">
    <header className="page-title"><p>Field quality</p><h1>Joint inspection release</h1><p>Coordinate ready work packages under one drawing revision and atomically unblock successor activities.</p></header>
    <section className="workspace-toolbar">
      <label>Inspection release role<select value={role} onChange={(event) => { setRole(event.target.value as InspectionRole); }}>{Object.keys(actors).map((item) => <option key={item}>{item}</option>)}</select></label>
      <label>Work package filter<select value={state.filter} onChange={(event) => { const filter = event.target.value as PackageFilter; run((value) => changePackageFilter(value, { ...meta(), filter }), `Package filter changed to ${filter}.`); }}><option value="all">All packages</option><option value="ready">Ready packages</option><option value="blocked">Blocked packages</option></select></label>
      <button disabled={role !== 'Document Controller'} onClick={() => { const capturedQueueVersion = state.queueVersion; run((value) => applyReadinessRefresh(value, { ...meta(), capturedQueueVersion, responseVersion: 9, packageVersions: { 'PKG-SLAB-41': 5, 'PKG-SLAB-42': 7, 'PKG-WALL-43': 3 } }), 'Readiness evidence refreshed with selection preserved.'); }}>Refresh inspection readiness</button>
    </section>
    {message && <p ref={feedback} tabIndex={-1} role="status">{message}</p>}
    <section className="suite-table-wrap" aria-label="Work package results"><table><caption>{visiblePackages(state).length} visible packages · {state.selectedIds.length} selected</caption><thead><tr><th>Select</th><th>Package</th><th>Zone</th><th>Drawing</th><th>Tests</th><th>Status</th></tr></thead><tbody>{visiblePackages(state).map((item) => <tr key={item.id}><td><input type="checkbox" aria-label={`Select ${item.id}`} checked={state.selectedIds.includes(item.id)} onChange={() => { run((value) => togglePackageSelection(value, { ...meta(), packageId: item.id }), `${item.id} selection updated.`); }} /></td><td>{item.id}</td><td>{item.zone}</td><td>{item.drawingId} rev {item.drawingRevision}</td><td>{item.concreteTestsPassed ? 'passed' : 'blocked'}</td><td>{item.status}</td></tr>)}</tbody></table></section>
    <section className="card" aria-label="Joint inspection"><h2>{state.batch?.id ?? 'Joint inspection'} · {state.batch?.status ?? 'not requested'}</h2><p>Readiness feed {state.readinessFeedVersion} · packages {state.batch?.packageIds.length ?? 0}</p><p>Inspector {state.batch?.inspector ?? 'unassigned'} · reviewer {state.batch?.reviewer ?? 'unassigned'}</p><p>Ready successors {state.successorActivities.filter((item) => item.status === 'ready').length} · immutable evidence {state.evidence.length}</p>
      <button disabled={role !== 'Site Engineer' || state.selectedIds.length !== 2 || Boolean(state.batch)} onClick={() => { const expectedVersions = Object.fromEntries(state.packages.filter((item) => state.selectedIds.includes(item.id)).map((item) => [item.id, item.version])); run((value) => requestJointInspection(value, { ...meta(), expectedVersions }), 'Joint inspection requested.'); }}>Request joint inspection</button>
      <button disabled={role !== 'Quality Manager' || state.batch?.status !== 'requested'} onClick={() => { run((value) => assignJointInspector(value, { ...meta(), inspectorId: 'inspector-a' }), 'Independent inspector assigned.'); }}>Assign joint inspector</button>
      <button disabled={role !== 'Site Inspector' || state.batch?.status !== 'assigned'} onClick={() => { run((value) => recordJointInspection(value, meta()), 'Joint inspection passed.'); }}>Record joint inspection</button>
      <button disabled={role !== 'Design Reviewer' || state.batch?.status !== 'inspected'} onClick={() => { run((value) => approveInspectionRelease(value, meta()), 'Inspection release independently approved.'); }}>Approve inspection release</button>
      <button disabled={role !== 'Construction Manager' || state.batch?.status !== 'approved'} onClick={() => { run((value) => releaseInspectedPackages(value, meta()), 'Inspected packages released with successors ready.'); }}>Release inspected packages</button>
    </section>
    <section className="card" aria-label="Inspection release history"><h2>Immutable inspection activity</h2>{state.events.map((event) => <p key={event.id}>{event.action}</p>)}</section>
  </main>;
}
