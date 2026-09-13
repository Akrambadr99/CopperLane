import { describe, expect, it } from 'vitest';
import { approveMaterialSubmittal, draftMaterialSubmittal, initialMaterialTraceState, inspectMaterialDelivery, recordMaterialInstallation, releaseMaterialPurchase, verifyMaterialTraceability, type MaterialTraceRole, type MaterialTraceState } from './material-traceability';
const meta = (id: string, revision: number, actor: string, role: MaterialTraceRole) => ({ id, expectedRevision: revision, actor: { id: actor, role } });
function ordered() {
  let state = draftMaterialSubmittal(initialMaterialTraceState, { ...meta('draft', 0, 'engineer-a', 'Package Engineer'), product: 'Axis Rebar 500', grade: 'B500B', certificate: 'MTC-STEEL-778' });
  state = approveMaterialSubmittal(state, meta('approve', 1, 'reviewer-a', 'Design Reviewer'));
  return releaseMaterialPurchase(state, meta('order', 2, 'procurement-a', 'Procurement Manager'));
}
describe('construction material traceability', () => {
  it('links approved material from certificate through installed location', () => {
    let state = inspectMaterialDelivery(ordered(), { ...meta('deliver', 3, 'inspector-a', 'Site Inspector'), batch: 'HEAT-BATCH-778', quantity: 24, certificate: 'MTC-STEEL-778' });
    state = recordMaterialInstallation(state, { ...meta('install', 4, 'site-a', 'Site Engineer'), location: 'SLAB-L04-ZB', batch: 'HEAT-BATCH-778' });
    state = verifyMaterialTraceability(state, meta('verify', 5, 'quality-a', 'Quality Manager'));
    expect(state.package).toMatchObject({ status: 'verified', installedLocation: 'SLAB-L04-ZB' });
    expect(state.delivery).toMatchObject({ status: 'installed', batch: 'HEAT-BATCH-778', acceptedQuantity: 24 });
    expect(state.evidence).toHaveLength(5);
    expect(state.submittal?.status).toBe('verified');
  });
  it('rejects a delivery certificate that differs from the approved submittal', () => {
    expect(() => inspectMaterialDelivery(ordered(), { ...meta('deliver', 3, 'inspector-a', 'Site Inspector'), batch: 'HEAT-BATCH-778', quantity: 24, certificate: 'MTC-OTHER' })).toThrow('does not match');
  });
  it('blocks installation after the delivery version becomes stale', () => {
    const delivered = inspectMaterialDelivery(ordered(), { ...meta('deliver', 3, 'inspector-a', 'Site Inspector'), batch: 'HEAT-BATCH-778', quantity: 24, certificate: 'MTC-STEEL-778' });
    const staleState: MaterialTraceState = structuredClone(delivered);
    staleState.delivery.version += 1;
    expect(() => recordMaterialInstallation(staleState, { ...meta('install', 4, 'site-a', 'Site Engineer'), location: 'SLAB-L04-ZB', batch: 'HEAT-BATCH-778' })).toThrow('Delivery record changed');
  });
});
