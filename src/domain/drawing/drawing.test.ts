import { describe, expect, it } from 'vitest';
import { product } from '../../product/definition';
import { fresh } from '../../workspace/engine';
import { analyzeDrawing } from './analytics';
import { canEditDrawing, drawingStates } from './policy';
import { countDrawingByState, searchDrawing, selectDrawing } from './selectors';
describe('drawing domain module', () => { const records = fresh(product).entities; it('selects only drawing records', () => expect(selectDrawing(records).every(record => record.kind === 'drawing')).toBe(true)); it('searches deterministic fields', () => { const first = selectDrawing(records)[0]; expect(first ? searchDrawing(records, first.title).map(row => row.id) : []).toEqual(first ? [first.id] : []); }); it('summarizes states', () => expect([...countDrawingByState(records).values()].reduce((sum, value) => sum + value, 0)).toBe(selectDrawing(records).length)); it('exposes configured states', () => expect(drawingStates(product).length).toBeGreaterThan(0)); it('reports analytics', () => expect(analyzeDrawing(records).total).toBe(selectDrawing(records).length)); it('applies edit policy', () => expect(canEditDrawing(product, product.actors[0]!.role)).toBe(product.kinds.find(kind => kind.key === 'drawing')!.editors.includes(product.actors[0]!.role))); });
