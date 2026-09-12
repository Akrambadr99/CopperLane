import type { Command, Product, Snapshot, Value } from '../../workspace/types';
import { execute } from '../../workspace/engine';
import { findChange } from './selectors';
export function createChangeCommand(input: {
    id: string;
    actorId: string;
    revision: number;
    title: string;
    fields: Record<string, Value>;
}): Command { return { id: input.id, actorId: input.actorId, expectedRevision: input.revision, type: 'create', kind: 'change', title: input.title, input: input.fields }; }
export function applyChangeCommand(state: Snapshot, command: Command, product: Product, at: string): Snapshot { return execute(state, command, product, at); }
export function requireChange(state: Snapshot, id: string) {
    const record = findChange(state.entities, id);
    if (!record)
        throw new Error('Change record was not found.');
    return record;
}
