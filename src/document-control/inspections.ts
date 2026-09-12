import type { HistoricalReference, Revision } from './revisions';
export interface Inspection {
    id: string;
    drawing: HistoricalReference;
    result: 'open' | 'passed' | 'failed';
    inspectedAt: string;
    inspector: string;
    observations: string[];
}
export function completeInspection(inspection: Inspection, revisions: Revision[]): Inspection {
    const revision = revisions.find((item) => item.documentId === inspection.drawing.documentId && item.revision === inspection.drawing.revision);
    if (!revision)
        throw new Error('The inspection drawing revision cannot be resolved.');
    if (revision.state === 'draft' || revision.state === 'rejected')
        throw new Error('Field inspection requires an issued drawing revision.');
    if (inspection.observations.length === 0)
        throw new Error('Field observations are required before completing inspection.');
    return { ...inspection, result: inspection.observations.some((item) => item.startsWith('DEFECT:')) ? 'failed' : 'passed' };
}
export function affectedInspections(inspections: Inspection[], documentId: string, supersededRevision: string): Inspection[] {
    return inspections.filter((inspection) => inspection.drawing.documentId === documentId && inspection.drawing.revision === supersededRevision);
}
