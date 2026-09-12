import { describe, expect, it } from 'vitest';
import { forecastContract, validateChangeImpact } from './contracts';
import { revisions } from './fixtures';
import { affectedInspections, completeInspection, type Inspection } from './inspections';
import { activeReviewStep, recordReview, type Submittal } from './submittals';
describe('field verification', () => {
    const inspection: Inspection = { id: 'INSP-122', drawing: { id: 'ref-1', kind: 'inspection', documentId: 'A-401', revision: 'A', recordedAt: '2027-01-22' }, result: 'open', inspectedAt: '2027-01-22', inspector: 'Salma', observations: ['Installed per detail 4'] };
    it('preserves the issued revision used in the field', () => {
        expect(completeInspection(inspection, revisions).result).toBe('passed');
        expect(completeInspection({ ...inspection, observations: ['DEFECT: anchor spacing'] }, revisions).result).toBe('failed');
        expect(affectedInspections([inspection], 'A-401', 'A')).toEqual([inspection]);
        expect(() => completeInspection({ ...inspection, observations: [] }, revisions)).toThrow(/observations/);
        expect(() => completeInspection({ ...inspection, drawing: { ...inspection.drawing, revision: 'missing' } }, revisions)).toThrow(/cannot be resolved/);
        expect(() => completeInspection(inspection, revisions.map((item) => item.revision === 'A' ? { ...item, state: 'rejected' } : item))).toThrow(/issued/);
    });
});
describe('contract and submittal controls', () => {
    it('forecasts approved and pending contractual exposure', () => {
        const contract = { id: 'GC-01', originalValue: 12000000, executedChanges: 350000, contingency: 800000 };
        const impact = { id: 'CO-19', directCost: 184000, contingencyUse: 100000, scheduleDays: 9 };
        expect(forecastContract(contract, [impact])).toEqual({ committed: 12350000, pendingChanges: 184000, forecast: 12534000, contingencyRemaining: 700000 });
        expect(validateChangeImpact(contract, impact)).toEqual([]);
        expect(validateChangeImpact(contract, { ...impact, directCost: -1, contingencyUse: 900000, scheduleDays: 400 })).toHaveLength(3);
    });
    it('advances a discipline review chain without skipping reviewers', () => {
        const submittal: Submittal = { id: 'SUB-45', specification: '08 41 13', revision: 2, steps: [{ discipline: 'Architectural', reviewer: 'Mina', state: 'active' }, { discipline: 'Structural', reviewer: 'Rana', state: 'waiting' }] };
        expect(activeReviewStep(submittal)?.reviewer).toBe('Mina');
        const advanced = recordReview(submittal, 'Mina', 'approved', '2027-03-15');
        expect(activeReviewStep(advanced)?.reviewer).toBe('Rana');
        expect(recordReview(submittal, 'Mina', 'rejected', '2027-03-15').steps[1]!.state).toBe('waiting');
        expect(() => recordReview(submittal, 'Other', 'approved', '2027-03-15')).toThrow(/active discipline/);
        expect(() => recordReview({ ...submittal, steps: submittal.steps.map((step) => ({ ...step, state: 'waiting' })) }, 'Mina', 'approved', '2027-03-15')).toThrow(/no active/);
    });
});
