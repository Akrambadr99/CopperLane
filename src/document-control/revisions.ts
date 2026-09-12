export type ReviewState = 'draft' | 'submitted' | 'approved' | 'rejected' | 'superseded';
export type ConstructionRole = 'Project Executive' | 'Architect' | 'Site Inspector' | 'Cost Controller';
export interface Revision {
    documentId: string;
    revision: string;
    issuedAt: string;
    state: ReviewState;
    checksum: string;
    supersedes?: string;
}
export interface HistoricalReference {
    id: string;
    kind: 'inspection' | 'rfi' | 'submittal';
    documentId: string;
    revision: string;
    recordedAt: string;
}
export interface ChangeOrder {
    id: string;
    description: string;
    costImpact: number;
    scheduleDays: number;
    state: 'draft' | 'contractor-priced' | 'owner-review' | 'executed';
    approvals: string[];
}
export interface PaymentApplication {
    id: string;
    gross: number;
    retainageRate: number;
    certified: number;
    state: 'submitted' | 'reviewed' | 'certified' | 'paid';
}
export function nextRevision(revisions: Revision[], documentId: string, revision: string, checksum: string): Revision[] {
    const related = revisions.filter(r => r.documentId === documentId);
    if (related.some(r => r.revision === revision))
        throw new Error('Revision identifier already exists for this drawing.');
    const current = related.find(r => r.state === 'approved');
    return [...revisions.map(r => r === current ? { ...r, state: 'superseded' as const } : r), { documentId, revision, issuedAt: new Date().toISOString(), state: 'draft', checksum, ...(current ? { supersedes: current.revision } : {}) }];
}
export function resolveReference(revisions: Revision[], reference: HistoricalReference): Revision {
    const revision = revisions.find(r => r.documentId === reference.documentId && r.revision === reference.revision);
    if (!revision)
        throw new Error('The referenced drawing revision is missing; historical record was not rewritten.');
    return revision;
}
export function submitChangeOrder(order: ChangeOrder, role: ConstructionRole): ChangeOrder {
    if (role !== 'Cost Controller' && role !== 'Project Executive')
        throw new Error('Commercial authority is required to advance a change order.');
    if (order.state !== 'contractor-priced')
        throw new Error('Contractor pricing must be complete before owner review.');
    return { ...order, state: 'owner-review', approvals: [...order.approvals, role] };
}
export function certifyPayment(payment: PaymentApplication, role: ConstructionRole): PaymentApplication {
    if (role !== 'Architect' && role !== 'Cost Controller')
        throw new Error('Only the architect or cost controller can certify payment.');
    if (payment.state !== 'reviewed')
        throw new Error('Payment application must complete quantity review.');
    const max = payment.gross * (1 - payment.retainageRate);
    if (payment.certified > max)
        throw new Error('Certified amount exceeds net value after retainage.');
    return { ...payment, state: 'certified' };
}
export function netPayment(payment: PaymentApplication) { return Math.round(payment.gross * (1 - payment.retainageRate) * 100) / 100; }
