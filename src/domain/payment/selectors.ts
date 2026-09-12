import type { Entity } from '../../workspace/types';
import { matchesSearch } from '../../core/search';
import { isPayment } from './model';
export function selectPayment(records: readonly Entity[]): Entity[] { return records.filter(isPayment).toSorted((a, b) => a.title.localeCompare(b.title)); }
export function findPayment(records: readonly Entity[], id: string): Entity | undefined { return records.find(record => isPayment(record) && record.id === id); }
export function searchPayment(records: readonly Entity[], query: string): Entity[] { return selectPayment(records).filter(record => matchesSearch([record.id, record.title, record.status, ...Object.values(record.fields)], query)); }
export function countPaymentByState(records: readonly Entity[]): ReadonlyMap<string, number> {
    const result = new Map<string, number>();
    for (const record of selectPayment(records))
        result.set(record.status, (result.get(record.status) ?? 0) + 1);
    return result;
}
