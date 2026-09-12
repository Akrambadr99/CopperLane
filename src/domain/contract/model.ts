import type { Entity } from '../../workspace/types';
export type ContractRecord = Entity & {
    kind: 'contract';
};
export function isContract(record: Entity): record is ContractRecord { return record.kind === 'contract'; }
