import { describe, expect, it } from 'vitest';
import { approveCostForecast, draftCostForecast, initialCostForecastState, publishCostForecast, validateCommitments, type ForecastRole } from './cost-forecast';
const meta = (id: string, revision: number, actor: string, role: ForecastRole) => ({ id, expectedRevision: revision, actor: { id: actor, role } });
function validated() { const state = draftCostForecast(initialCostForecastState, { ...meta('draft', 0, 'engineer', 'Cost Engineer'), estimateToComplete: 540000 }); return validateCommitments(state, meta('validate', 1, 'manager', 'Package Manager')); }
describe('cost-to-complete forecast', () => {
  it('publishes package variance into the project forecast snapshot', () => { let state = approveCostForecast(validated(), meta('approve', 2, 'director', 'Project Director')); state = publishCostForecast(state, meta('publish', 3, 'finance', 'Finance Controller')); expect(state.forecast?.status).toBe('published'); expect(state.project.forecastAtCompletion).toBe(7675000); expect(state.snapshots[0]).toMatchObject({ forecastAtCompletion: 1160000, variance: 125000 }); });
  it('rejects a forecast below remaining commitments', () => { const state = draftCostForecast(initialCostForecastState, { ...meta('draft', 0, 'engineer', 'Cost Engineer'), estimateToComplete: 470000 }); expect(() => validateCommitments(state, meta('validate', 1, 'manager', 'Package Manager'))).toThrow('below committed'); });
  it('protects approval from stale project data', () => { const state = validated(); state.project.version += 1; expect(() => approveCostForecast(state, meta('approve', 2, 'director', 'Project Director'))).toThrow('Project forecast changed'); });
});
