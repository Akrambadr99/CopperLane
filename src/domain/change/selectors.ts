import type { Entity } from '../../workspace/types';
import { matchesSearch } from '../../core/search';
import { isChange } from './model';
export function selectChange(records: readonly Entity[]): Entity[] { return records.filter(isChange).toSorted((a, b) => a.title.localeCompare(b.title)); }
export function findChange(records: readonly Entity[], id: string): Entity | undefined { return records.find(record => isChange(record) && record.id === id); }
export function searchChange(records: readonly Entity[], query: string): Entity[] { return selectChange(records).filter(record => matchesSearch([record.id, record.title, record.status, ...Object.values(record.fields)], query)); }
export function countChangeByState(records: readonly Entity[]): ReadonlyMap<string, number> {
    const result = new Map<string, number>();
    for (const record of selectChange(records))
        result.set(record.status, (result.get(record.status) ?? 0) + 1);
    return result;
}
