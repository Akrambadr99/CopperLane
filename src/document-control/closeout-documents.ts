export interface CloseoutDocumentCustodyRecord { id: string; projectId: string; documentReference: string; custodyReference: string; status: 'verified' | 'waived'; responsibleManager: string; recordedOn: string; closureId: string; immutable: true }
export interface CloseoutDocumentRevision { id: string; projectId: string; custodyId: string; documentReference: string; revision: number; revisionLabel: string; previousRevisionId: string | null; evidenceReference: string; registeredBy: string; registeredOn: string; requiresReleaseReview?: true; immutable: true }
export interface DocumentReleaseReview { id: string; projectId: string; revisionId: string; decision: 'released' | 'returned'; evidenceReference: string; rationale: string; reviewedBy: string; reviewedOn: string; immutable: true }
export interface CloseoutDocumentRegistry {
  revision: number;
  documentCustody: CloseoutDocumentCustodyRecord[];
  documentRevisions?: CloseoutDocumentRevision[];
  documentReleaseReviews?: DocumentReleaseReview[];
}
export function validDocumentReleaseReview(value: unknown): value is DocumentReleaseReview {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return ['id', 'projectId', 'revisionId', 'reviewedBy', 'reviewedOn'].every(key => typeof item[key] === 'string' && Boolean(item[key].trim())) &&
    ['released', 'returned'].includes(String(item['decision'])) && typeof item['evidenceReference'] === 'string' && item['evidenceReference'].trim().length >= 6 &&
    typeof item['rationale'] === 'string' && item['rationale'].trim().length >= 20 && item['immutable'] === true &&
    /^20\d{2}-\d{2}-\d{2}$/.test(String(item['reviewedOn'])) && !Number.isNaN(Date.parse(String(item['reviewedOn']))) && new Date(String(item['reviewedOn'])).toISOString().slice(0, 10) === item['reviewedOn'];
}
export function closeoutDocumentRelease(registry: Pick<CloseoutDocumentRegistry, 'documentReleaseReviews'>, revision: CloseoutDocumentRevision) {
  const reviews = registry.documentReleaseReviews?.filter(item => item.revisionId === revision.id) ?? [];
  if (!revision.requiresReleaseReview) return { ready: true, status: 'legacy technical review not recorded', review: null };
  const review = reviews.length === 1 ? reviews[0] : null;
  const valid = review && validDocumentReleaseReview(review) && review.projectId === revision.projectId && review.reviewedBy !== revision.registeredBy && review.reviewedOn >= revision.registeredOn;
  return { ready: Boolean(valid && review.decision === 'released'), status: valid ? review.decision === 'released' ? 'independently released' : 'returned; register corrected revision' : 'technical release review required', review: valid ? review : null };
}
export interface ReviewCloseoutDocument {
  id: string; expectedRevision: number; authority: string; projectId: string; documentRevisionId: string;
  decision: 'released' | 'returned'; evidenceReference: string; rationale: string; reviewedBy: string; reviewedOn: string;
}
export function reviewCloseoutDocument<T extends CloseoutDocumentRegistry>(state: T, command: ReviewCloseoutDocument): T {
  if (state.revision !== command.expectedRevision) throw new Error('Closeout changed. Refresh before technical review.');
  if (command.authority !== 'Document Controller') throw new Error('Only an independent document controller can review technical release.');
  const revisions = state.documentRevisions?.filter(item => item.id === command.documentRevisionId && item.projectId === command.projectId) ?? [], revision = revisions[0];
  if (revisions.length !== 1 || !revision?.requiresReleaseReview) throw new Error('An authoritative revision requiring technical review is needed.');
  const latest = state.documentRevisions?.filter(item => item.custodyId === revision.custodyId).toSorted((a, b) => a.revision - b.revision).at(-1);
  if (latest?.id !== revision.id || !state.documentCustody.some(item => item.id === revision.custodyId && item.projectId === command.projectId && item.status === 'verified' && item.documentReference === revision.documentReference)) throw new Error('The current verified custody document revision is required.');
  const review: DocumentReleaseReview = { id: command.id, projectId: command.projectId, revisionId: revision.id, decision: command.decision, evidenceReference: command.evidenceReference.trim(), rationale: command.rationale.trim(), reviewedBy: command.reviewedBy.trim(), reviewedOn: command.reviewedOn, immutable: true };
  if (!validDocumentReleaseReview(review) || review.reviewedBy === revision.registeredBy || review.reviewedOn < revision.registeredOn) throw new Error('Independent reviewer, substantive evidence and a chronological review date are required.');
  if (state.documentReleaseReviews?.some(item => item.id === review.id || item.revisionId === revision.id)) throw new Error('Technical review is immutable; register a corrected revision after return.');
  const next = structuredClone(state);
  next.documentReleaseReviews ??= []; next.documentReleaseReviews.push(review); next.revision++;
  return next;
}