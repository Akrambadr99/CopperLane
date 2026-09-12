/* eslint-disable react-refresh/only-export-components, @typescript-eslint/no-confusing-void-expression */
import { useMemo, useState } from 'react';
import type { Entity, Snapshot, Value } from '../../workspace/types';

export interface DrawingChange { field: string; before: Value | undefined; after: Value | undefined }

export function compareDrawings(before: Entity | undefined, after: Entity | undefined): DrawingChange[] {
    if (!before || !after || before.kind !== 'drawing' || after.kind !== 'drawing' || before.id === after.id)
        return [];
    return [...new Set([...Object.keys(before.fields), ...Object.keys(after.fields)])]
        .filter((field) => before.fields[field] !== after.fields[field])
        .map((field) => ({ field, before: before.fields[field], after: after.fields[field] }));
}

export function DomainWorkflowPanel({ snapshot }: { snapshot: Snapshot }) {
    const drawings = snapshot.entities.filter((entity) => entity.kind === 'drawing');
    const [baselineId, setBaselineId] = useState(drawings[0]?.id ?? '');
    const [targetId, setTargetId] = useState(drawings[1]?.id ?? '');
    const changes = useMemo(() => compareDrawings(drawings.find((item) => item.id === baselineId), drawings.find((item) => item.id === targetId)), [baselineId, drawings, targetId]);
    return <section className="sub" aria-label="Drawing revision comparison">
      <h3>Drawing revision comparison <span>{changes.length}</span></h3>
      <div className="filters"><select aria-label="Baseline drawing" value={baselineId} onChange={(event) => setBaselineId(event.target.value)}>{drawings.map((item) => <option key={item.id} value={item.id}>{item.title} · r{item.revision}</option>)}</select><select aria-label="Target drawing" value={targetId} onChange={(event) => setTargetId(event.target.value)}>{drawings.map((item) => <option key={item.id} value={item.id}>{item.title} · r{item.revision}</option>)}</select></div>
      {baselineId === targetId && <p className="empty">Choose two different drawings.</p>}
      {baselineId !== targetId && changes.length === 0 && <p className="empty">No field changes between these revisions.</p>}
      {changes.map((change) => <p key={change.field}><b>{change.field}</b><small>{String(change.before ?? '—')} → {String(change.after ?? '—')}</small></p>)}
    </section>;
}
