import type { HistoricalReference, Revision } from './revisions';
export function RevisionLineage({ revisions, references }: {
    revisions: Revision[];
    references: HistoricalReference[];
}) {
    return <div className="revision-lineage">{revisions.filter((revision) => revision.documentId === 'A-401').map((revision, index) => <article key={revision.revision}><div className="revision-node"><span>REV</span><strong>{revision.revision}</strong></div><div><span>{revision.state}</span><h2>A-401 · Exterior wall section</h2><p>Issued {revision.issuedAt} · checksum <code>{revision.checksum}</code></p></div><div className="reference-count"><strong>{references.filter((reference) => reference.documentId === revision.documentId && reference.revision === revision.revision).length}</strong><small>historical references</small></div>{index < revisions.filter((item) => item.documentId === 'A-401').length - 1 && <i>→</i>}</article>)}</div>;
}
