import { describe, expect, it } from 'vitest';
import type { Entity } from '../../workspace/types';
import { compareDrawings } from './DomainWorkflowPanel';
const drawing = (id: string, fields: Entity['fields']): Entity => ({ id, kind: 'drawing', title: id, status: 'issued', revision: 1, fields });
describe('compareDrawings', () => {
    it('reports only changed fields in stable key order', () => expect(compareDrawings(drawing('a', { code: 'A', revision: 1 }), drawing('b', { code: 'B', revision: 1, sheet: 'S1' }))).toEqual([{ field: 'code', before: 'A', after: 'B' }, { field: 'sheet', before: undefined, after: 'S1' }]));
    it('rejects comparing a drawing with itself', () => { const item = drawing('a', {}); expect(compareDrawings(item, item)).toEqual([]); });
});
