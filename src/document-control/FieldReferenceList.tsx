import { resolveReference, type HistoricalReference, type Revision } from './revisions'

export function FieldReferenceList({ references, revisions }: { references: HistoricalReference[]; revisions: Revision[] }) {
  return <div className="field-references">{references.map((reference) => { const revision = resolveReference(revisions, reference); return <article key={reference.id}><span className="record-kind">{reference.kind}</span><div><h2>{reference.id}</h2><p>Recorded {reference.recordedAt}</p></div><div className="drawing-stamp"><span>{revision.documentId}</span><strong>REV {revision.revision}</strong><small>{revision.state}</small></div><p className="integrity-note">Pinned to checksum {revision.checksum}; later revisions do not rewrite this record.</p></article> })}</div>
}
