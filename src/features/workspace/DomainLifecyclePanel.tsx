/* eslint-disable react-refresh/only-export-components, @typescript-eslint/no-confusing-void-expression */
import { useState } from 'react';
import type { Entity, Snapshot } from '../../workspace/types';

export function rfiAnswerGate(drawing: Entity | undefined, inspections: Entity[], answer: string, affectsWork: boolean) {
    const blockers: string[] = [];
    if (!drawing)
        blockers.push('Select a drawing revision.');
    else if (drawing.status !== 'issued')
        blockers.push('The referenced drawing must be issued.');
    if (answer.trim().length < 12)
        blockers.push('Provide a specific response of at least 12 characters.');
    const linked = drawing ? inspections.filter((item) => item.fields['drawing'] === drawing.id) : [];
    if (affectsWork && !linked.some((item) => item.status === 'passed'))
        blockers.push('Field-impacting responses require a passed inspection.');
    return { ready: blockers.length === 0, blockers, evidence: linked.length };
}

export function DomainLifecyclePanel({ snapshot }: { snapshot: Snapshot }) {
    const drawings = snapshot.entities.filter((item) => item.kind === 'drawing');
    const [drawingId, setDrawingId] = useState(drawings[0]?.id ?? '');
    const [answer, setAnswer] = useState('');
    const [affectsWork, setAffectsWork] = useState(false);
    const result = rfiAnswerGate(drawings.find((item) => item.id === drawingId), snapshot.entities.filter((item) => item.kind === 'inspection'), answer, affectsWork);
    return <section className="sub" aria-label="RFI response gate"><h3>RFI response gate <span>{result.ready ? 'ready' : 'blocked'}</span></h3><div className="filters"><select aria-label="RFI drawing" value={drawingId} onChange={(event) => setDrawingId(event.target.value)}>{drawings.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select><input aria-label="RFI response" value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder="Document the response"/><label><input type="checkbox" checked={affectsWork} onChange={(event) => setAffectsWork(event.target.checked)}/>Affects installed work</label></div><p><b>{result.evidence} linked inspections</b><small>{result.ready ? 'Response evidence is ready for issue.' : result.blockers.join(' ')}</small></p></section>;
}
