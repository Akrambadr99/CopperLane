/* eslint-disable react-refresh/only-export-components */
import { product } from '../../product/definition';
import { useState } from 'react';
import type { Entity, Snapshot } from '../../workspace/types';

export function constructionHandoff(contractId: string, entities: Entity[]) {
    const drawings = entities.filter((item) => item.kind === 'drawing' && item.fields['contract'] === contractId);
    const drawingIds = new Set(drawings.map((item) => item.id));
    const inspections = entities.filter((item) => item.kind === 'inspection' && drawingIds.has(String(item.fields['drawing'] ?? '')));
    const changes = entities.filter((item) => item.kind === 'change' && item.fields['contract'] === contractId);
    const rfis = entities.filter(item => item.kind === 'rfi' && drawingIds.has(String(item.fields['drawing'])));
    const blockers = [...(drawings.some(drawing => drawing.status === 'issued' && !inspections.some(item => item.fields['drawing'] === drawing.id && item.status === 'passed')) ? ['Every issued drawing requires a passed field inspection.'] : []), ...(rfis.some(item => item.status !== 'issued') ? ['RFI responses remain unissued.'] : []), ...(drawings.some((item) => item.status === 'issued') ? [] : ['No issued drawing revision.']), ...(inspections.some((item) => item.status !== 'passed') ? ['Field inspections remain unresolved.'] : []), ...(changes.some((item) => item.status === 'approved') ? ['Approved changes remain unexecuted.'] : [])];
    return { ready: blockers.length === 0, blockers, evidence: drawings.length + inspections.length + changes.length };
}

export function DomainDepthPanel({ snapshot, actorId, onExecute }: { snapshot: Snapshot; actorId?: string; onExecute?: (operation: string, entityId: string) => void }) {
    const contracts = snapshot.entities.filter((item) => item.kind === 'contract');
    const [contractId, setContractId] = useState(contracts[0]?.id ?? '');
    const result = constructionHandoff(contractId, snapshot.entities);
    const role = product.actors.find(actor => actor.id === actorId)?.role;
    const targets = snapshot.entities.filter(item => item.id === contractId || (item.kind === 'handoff' && item.fields['contract'] === contractId));
    return <section className="sub" aria-label="Construction handoff gate"><h3>Construction handoff gate <span>{result.ready ? 'ready' : 'blocked'}</span></h3><div className="filters"><select aria-label="Handoff contract" value={contractId} onChange={(event) => { setContractId(event.target.value); }}>{contracts.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></div><p><b>{result.evidence} linked control records</b><small>{result.ready ? 'Drawing, inspection, and change gates are satisfied.' : result.blockers.join(' ')}</small></p>{targets.map(target => <div key={target.id}>{target.kind === 'handoff' && <p>{target.title} · {target.status}</p>}{product.operations.filter(operation => operation.key.startsWith('handoff-') && operation.kind === target.kind && operation.from.includes(target.status) && operation.roles.includes(role ?? '')).map(operation => <button key={operation.key} onClick={() => onExecute?.(operation.key, target.id)}>{operation.label}</button>)}</div>)}</section>;
}
