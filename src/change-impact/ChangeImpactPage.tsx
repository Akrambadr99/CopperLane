import { useRef, useState } from 'react';
import {
  assessChange,
  ChangeImpactRepository,
  createChangeDraft,
  decideChange,
  incorporateChange,
  submitChange,
  type ChangeImpactState,
  type ChangeRole,
} from './change-impact';

const actorIds: Record<ChangeRole, string> = {
  Contractor: 'contractor',
  'Cost Engineer': 'cost-engineer',
  'Project Manager': 'project-manager',
  Executive: 'executive',
};

export function ChangeImpactPage() {
  const [repository] = useState(() => new ChangeImpactRepository(localStorage));
  const [state, setState] = useState<ChangeImpactState>(() => repository.read());
  const [role, setRole] = useState<ChangeRole>('Contractor');
  const [message, setMessage] = useState('');
  const feedback = useRef<HTMLParagraphElement>(null);
  const request = state.request;

  const command = () => ({
    id: crypto.randomUUID(),
    expectedRevision: state.revision,
    actor: { id: actorIds[role], role },
  });

  const run = (change: (current: ChangeImpactState) => ChangeImpactState, success: string) => {
    try {
      setState(repository.commit(state.revision, change));
      setMessage(success);
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : 'Change impact action failed.');
    }
    queueMicrotask(() => feedback.current?.focus());
  };

  return <main className="page">
    <header className="page-title">
      <p>Commercial change control</p>
      <h1>Design change impact</h1>
      <p>Connect answered RFIs and current drawings to independently assessed contract and schedule consequences.</p>
    </header>

    <section className="workspace-toolbar">
      <label>
        Change role
        <select value={role} onChange={(event) => { setRole(event.target.value as ChangeRole); }}>
          {Object.keys(actorIds).map((item) => <option key={item}>{item}</option>)}
        </select>
      </label>
      <button onClick={() => { setState(repository.read()); }}>Refresh change impact</button>
    </section>

    {message && <p ref={feedback} tabIndex={-1} role="status">{message}</p>}

    <div className="cards">
      <section className="card">
        <h2>Design basis</h2>
        <p>Drawing {state.design.drawingId} revision {state.design.drawingRevision}</p>
        <p>Answered {state.design.rfiId} revision {state.design.rfiRevision}</p>
        <p>Request {request?.status ?? 'not created'}</p>
        <button
          disabled={role !== 'Contractor' || Boolean(request && !['rejected', 'incorporated', 'cancelled'].includes(request.status))}
          onClick={() => { run((current) => createChangeDraft(current, {
            ...command(),
            title: 'Reroute mechanical services around revised structural opening',
            evidence: 'Answered RFI and drawing revision require a coordinated service reroute.',
          }), 'Change draft created.'); }}
        >Create linked change draft</button>
        <button
          disabled={role !== 'Contractor' || request?.status !== 'draft'}
          onClick={() => { run((current) => submitChange(current, command()), 'Change request submitted.'); }}
        >Submit change request</button>
      </section>

      <section className="card">
        <h2>Cost and programme</h2>
        <p>Forecast {state.contract.forecastValue} · contract version {state.contract.version}</p>
        <p>Completion {state.schedule.completion} · schedule version {state.schedule.version}</p>
        <button
          disabled={role !== 'Cost Engineer' || request?.status !== 'submitted'}
          onClick={() => { run((current) => assessChange(current, {
            ...command(),
            directCost: 120_000,
            contingency: 20_000,
            delayDays: 4,
            rationale: 'Measured quantities and the current programme support the assessed impact.',
          }), 'Change impact assessed.'); }}
        >Assess cost and delay</button>
        <button
          disabled={role !== 'Project Manager' || request?.status !== 'assessed'}
          onClick={() => { run((current) => decideChange(current, {
            ...command(),
            approve: true,
            rationale: 'The coordinated design basis and assessment justify incorporation.',
          }), 'Change impact approved.'); }}
        >Approve change impact</button>
        <button
          disabled={role !== 'Executive' || request?.status !== 'approved'}
          onClick={() => { run((current) => incorporateChange(current, command()), 'Contract and schedule updated.'); }}
        >Incorporate approved change</button>
      </section>
    </div>

    <section aria-label="Change impact history">
      <h2>Change impact history</h2>
      <ol>{state.events.toReversed().map((event) => <li key={event.id}>{event.action} · {event.actor} · {event.detail}</li>)}</ol>
    </section>
  </main>;
}
