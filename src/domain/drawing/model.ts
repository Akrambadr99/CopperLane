import type { Entity } from '../../workspace/types';
export type DrawingRecord = Entity & {
    kind: 'drawing';
};
export function isDrawing(record: Entity): record is DrawingRecord { return record.kind === 'drawing'; }
