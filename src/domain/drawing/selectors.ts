import type { Entity } from '../../workspace/types';
import { matchesSearch } from '../../core/search';
import { isDrawing } from './model';
export function selectDrawing(records: readonly Entity[]): Entity[] { return records.filter(isDrawing).toSorted((a, b) => a.title.localeCompare(b.title)); }
export function findDrawing(records: readonly Entity[], id: string): Entity | undefined { return records.find(record => isDrawing(record) && record.id === id); }
export function searchDrawing(records: readonly Entity[], query: string): Entity[] { return selectDrawing(records).filter(record => matchesSearch([record.id, record.title, record.status, ...Object.values(record.fields)], query)); }
export function countDrawingByState(records: readonly Entity[]): ReadonlyMap<string, number> {
    const result = new Map<string, number>();
    for (const record of selectDrawing(records))
        result.set(record.status, (result.get(record.status) ?? 0) + 1);
    return result;
}
