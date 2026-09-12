import type { Command, Product, Snapshot, Value } from '../../workspace/types';
import { execute } from '../../workspace/engine';
import { findDrawing } from './selectors';
export function createDrawingCommand(input: {
    id: string;
    actorId: string;
    revision: number;
    title: string;
    fields: Record<string, Value>;
}): Command { return { id: input.id, actorId: input.actorId, expectedRevision: input.revision, type: 'create', kind: 'drawing', title: input.title, input: input.fields }; }
export function applyDrawingCommand(state: Snapshot, command: Command, product: Product, at: string): Snapshot { return execute(state, command, product, at); }
export function requireDrawing(state: Snapshot, id: string) {
    const record = findDrawing(state.entities, id);
    if (!record)
        throw new Error('Drawing record was not found.');
    return record;
}
