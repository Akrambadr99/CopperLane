import { describe, expect, it } from 'vitest';
import { product } from '../../product/definition';
import { fresh } from '../../workspace/engine';
import { analyzePayment } from './analytics';
import { canEditPayment, paymentStates } from './policy';
import { countPaymentByState, searchPayment, selectPayment } from './selectors';
describe('payment domain module', () => { const records = fresh(product).entities; it('selects only payment records', () => expect(selectPayment(records).every(record => record.kind === 'payment')).toBe(true)); it('searches deterministic fields', () => { const first = selectPayment(records)[0]; expect(first ? searchPayment(records, first.title).map(row => row.id) : []).toEqual(first ? [first.id] : []); }); it('summarizes states', () => expect([...countPaymentByState(records).values()].reduce((sum, value) => sum + value, 0)).toBe(selectPayment(records).length)); it('exposes configured states', () => expect(paymentStates(product).length).toBeGreaterThan(0)); it('reports analytics', () => expect(analyzePayment(records).total).toBe(selectPayment(records).length)); it('applies edit policy', () => expect(canEditPayment(product, product.actors[0]!.role)).toBe(product.kinds.find(kind => kind.key === 'payment')!.editors.includes(product.actors[0]!.role))); });
