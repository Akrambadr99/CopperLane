import type { Entity } from '../../workspace/types';
export type ChangeRecord = Entity & {
    kind: 'change';
};
export function isChange(record: Entity): record is ChangeRecord { return record.kind === 'change'; }
