import { describe, expect, it } from 'vitest';
import { product } from '../../product/definition';
import { fresh } from '../../workspace/engine';
import { analyzeContract } from './analytics';
import { canEditContract, contractStates } from './policy';
import { countContractByState, searchContract, selectContract } from './selectors';
describe('contract domain module', () => { const records = fresh(product).entities; it('selects only contract records', () => expect(selectContract(records).every(record => record.kind === 'contract')).toBe(true)); it('searches deterministic fields', () => { const first = selectContract(records)[0]; expect(first ? searchContract(records, first.title).map(row => row.id) : []).toEqual(first ? [first.id] : []); }); it('summarizes states', () => expect([...countContractByState(records).values()].reduce((sum, value) => sum + value, 0)).toBe(selectContract(records).length)); it('exposes configured states', () => expect(contractStates(product).length).toBeGreaterThan(0)); it('reports analytics', () => expect(analyzeContract(records).total).toBe(selectContract(records).length)); it('applies edit policy', () => expect(canEditContract(product, product.actors[0]!.role)).toBe(product.kinds.find(kind => kind.key === 'contract')!.editors.includes(product.actors[0]!.role))); });
