import type { Entity } from '../../workspace/types';
export type PaymentRecord = Entity & {
    kind: 'payment';
};
export function isPayment(record: Entity): record is PaymentRecord { return record.kind === 'payment'; }
