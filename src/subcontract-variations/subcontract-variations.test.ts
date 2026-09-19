import { describe, expect, it } from 'vitest';
import {
  approveSubcontractVariation,
  assessVariationQuotation,
  commitSubcontractVariation,
  initialVariationState,
  issueSiteInstruction,
  releaseVariationWork,
  returnVariationAssessment,
  submitVariationQuotation,
  type VariationRole,
  type VariationState,
} from './subcontract-variations';

const m = (id: string, r: number, a: string, role: VariationRole) => ({ id, expectedRevision: r, actor: { id: a, role } });
function assessed() {
  let state = issueSiteInstruction(initialVariationState, { ...m('issue', 0, 'site-a', 'Site Manager'), drawing: 'DRG-MEP-442-R3' });
  state = submitVariationQuotation(state, { ...m('quote', 1, 'subcontractor-a', 'Subcontractor'), amount: 32_000, delayDays: 3 });
  return assessVariationQuotation(state, { ...m('assess', 2, 'qs-a', 'Quantity Surveyor'), amount: 30_000, delayDays: 2 });
}

describe('subcontract variations', () => {
  it('updates commitment contingency forecast and programme before work release', () => {
    let state = approveSubcontractVariation(assessed(), m('approve', 3, 'commercial-a', 'Commercial Manager'));
    state = commitSubcontractVariation(state, m('commit', 4, 'director-a', 'Project Director'));
    state = releaseVariationWork(state, m('release', 5, 'admin-a', 'Contract Administrator'));
    expect(state.subcontract).toMatchObject({ status: 'amended', commitment: 530_000 });
    expect(state.budget).toMatchObject({ contingency: 20_000, forecast: 530_000 });
    expect(state.programme).toMatchObject({ completionDate: '2026-12-22', approvedDelayDays: 2 });
    expect(state.variation?.status).toBe('released');
    expect(state.evidence).toHaveLength(6);
  });
  it('rejects an unsupported assessment', () => {
    let state = issueSiteInstruction(initialVariationState, { ...m('issue', 0, 'site-a', 'Site Manager'), drawing: 'DRG-MEP-442-R3' });
    state = submitVariationQuotation(state, { ...m('quote', 1, 'subcontractor-a', 'Subcontractor'), amount: 32_000, delayDays: 3 });
    expect(() => assessVariationQuotation(state, { ...m('assess', 2, 'qs-a', 'Quantity Surveyor'), amount: 31_000, delayDays: 2 })).toThrow('verified cost');
  });
  it('blocks approval after budget changes', () => {
    const stale: VariationState = structuredClone(assessed());
    stale.budget.version += 1;
    expect(() => approveSubcontractVariation(stale, m('approve', 3, 'commercial-a', 'Commercial Manager'))).toThrow('Project budget changed');
  });
  it('returns an assessment for correction without losing earlier evidence', () => {
    const returned = returnVariationAssessment(assessed(), { ...m('return', 3, 'commercial-a', 'Commercial Manager'), reason: 'Labour build-up needs subcontract rate evidence.' });
    expect(returned.variation).toMatchObject({ status: 'quoted', assessor: null, assessedAmount: 0 });
    expect(returned.evidence.map((item) => item.kind)).toEqual(['instruction', 'quotation', 'assessment', 'assessment-return']);
    const reassessed = assessVariationQuotation(returned, { ...m('reassess', 4, 'qs-b', 'Quantity Surveyor'), amount: 30_000, delayDays: 2 });
    expect(reassessed.variation).toMatchObject({ status: 'assessed', assessor: 'qs-b' });
    expect(reassessed.evidence).toHaveLength(5);
  });
  it('requires a useful immutable reason when returning an assessment', () => {
    expect(() => returnVariationAssessment(assessed(), { ...m('return', 3, 'commercial-a', 'Commercial Manager'), reason: 'Needs changes' })).toThrow('24 characters');
  });
});
