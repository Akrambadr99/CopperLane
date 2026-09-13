import { describe, expect, it } from 'vitest';
import {
  assessChange,
  createChangeDraft,
  decideChange,
  incorporateChange,
  initialChangeImpactState,
  reviseChangeDraft,
  submitChange,
} from './change-impact';

const meta = (id: string, revision: number, actor: string, role: 'Contractor' | 'Cost Engineer' | 'Project Manager' | 'Executive') => ({
  id,
  expectedRevision: revision,
  actor: { id: actor, role },
});

describe('change impact control', () => {
  it('incorporates independently assessed cost and schedule impact', () => {
    let state = createChangeDraft(initialChangeImpactState, {
      ...meta('draft', 0, 'contractor', 'Contractor'),
      title: 'Reroute mechanical services around revised structural opening',
      evidence: 'Answered RFI and drawing revision require a coordinated service reroute.',
    });
    state = submitChange(state, meta('submit', 1, 'contractor', 'Contractor'));
    state = assessChange(state, {
      ...meta('assess', 2, 'cost', 'Cost Engineer'),
      directCost: 120_000,
      contingency: 20_000,
      delayDays: 4,
      rationale: 'Measured quantities and the current programme support the assessed impact.',
    });
    state = decideChange(state, {
      ...meta('approve', 3, 'manager', 'Project Manager'),
      approve: true,
      rationale: 'The coordinated design basis and assessment justify incorporation.',
    });
    state = incorporateChange(state, meta('incorporate', 4, 'executive', 'Executive'));
    expect(state.contract).toMatchObject({ forecastValue: 4_140_000, version: 6 });
    expect(state.schedule).toMatchObject({ completion: '2026-12-25', version: 6 });
    expect(state.request?.status).toBe('incorporated');
  });

  it('requires revision after the linked drawing changes', () => {
    let state = createChangeDraft(initialChangeImpactState, {
      ...meta('draft', 0, 'contractor', 'Contractor'),
      title: 'Reroute mechanical services around revised structural opening',
      evidence: 'Answered RFI and drawing revision require a coordinated service reroute.',
    });
    state.design.drawingRevision += 1;
    expect(() => submitChange(state, meta('submit', 1, 'contractor', 'Contractor'))).toThrow('Linked drawing changed');
    state = reviseChangeDraft(state, {
      ...meta('revise', 1, 'contractor', 'Contractor'),
      evidence: 'Updated evidence incorporates the newest coordinated drawing revision.',
    });
    expect(state.request?.basis.drawingRevision).toBe(8);
  });

  it('rejects assessment contingency above the control limit', () => {
    let state = createChangeDraft(initialChangeImpactState, {
      ...meta('draft', 0, 'contractor', 'Contractor'),
      title: 'Reroute mechanical services around revised structural opening',
      evidence: 'Answered RFI and drawing revision require a coordinated service reroute.',
    });
    state = submitChange(state, meta('submit', 1, 'contractor', 'Contractor'));
    expect(() => assessChange(state, {
      ...meta('assess', 2, 'cost', 'Cost Engineer'),
      directCost: 100_000,
      contingency: 30_000,
      delayDays: 4,
      rationale: 'Measured quantities and the current programme support the assessed impact.',
    })).toThrow('25 percent');
  });
});
