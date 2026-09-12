import type { Entity } from '../../workspace/types';
import { matchesSearch } from '../../core/search';
import { isContract } from './model';
export function selectContract(records: readonly Entity[]): Entity[] { return records.filter(isContract).toSorted((a, b) => a.title.localeCompare(b.title)); }
export function findContract(records: readonly Entity[], id: string): Entity | undefined { return records.find(record => isContract(record) && record.id === id); }
export function searchContract(records: readonly Entity[], query: string): Entity[] { return selectContract(records).filter(record => matchesSearch([record.id, record.title, record.status, ...Object.values(record.fields)], query)); }
export function countContractByState(records: readonly Entity[]): ReadonlyMap<string, number> {
    const result = new Map<string, number>();
    for (const record of selectContract(records))
        result.set(record.status, (result.get(record.status) ?? 0) + 1);
    return result;
}
