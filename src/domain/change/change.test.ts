import { describe, expect, it } from 'vitest';
import { product } from '../../product/definition';
import { fresh } from '../../workspace/engine';
import { analyzeChange } from './analytics';
import { canEditChange, changeStates } from './policy';
import { countChangeByState, searchChange, selectChange } from './selectors';
describe('change domain module', () => { const records = fresh(product).entities; it('selects only change records', () => expect(selectChange(records).every(record => record.kind === 'change')).toBe(true)); it('searches deterministic fields', () => { const first = selectChange(records)[0]; expect(first ? searchChange(records, first.title).map(row => row.id) : []).toEqual(first ? [first.id] : []); }); it('summarizes states', () => expect([...countChangeByState(records).values()].reduce((sum, value) => sum + value, 0)).toBe(selectChange(records).length)); it('exposes configured states', () => expect(changeStates(product).length).toBeGreaterThan(0)); it('reports analytics', () => expect(analyzeChange(records).total).toBe(selectChange(records).length)); it('applies edit policy', () => expect(canEditChange(product, product.actors[0]!.role)).toBe(product.kinds.find(kind => kind.key === 'change')!.editors.includes(product.actors[0]!.role))); });
