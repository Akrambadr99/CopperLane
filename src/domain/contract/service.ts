import type { Command, Product, Snapshot, Value } from '../../workspace/types';
import { execute } from '../../workspace/engine';
import { findContract } from './selectors';
export function createContractCommand(input: {
    id: string;
    actorId: string;
    revision: number;
    title: string;
    fields: Record<string, Value>;
}): Command { return { id: input.id, actorId: input.actorId, expectedRevision: input.revision, type: 'create', kind: 'contract', title: input.title, input: input.fields }; }
export function applyContractCommand(state: Snapshot, command: Command, product: Product, at: string): Snapshot { return execute(state, command, product, at); }
export function requireContract(state: Snapshot, id: string) {
    const record = findContract(state.entities, id);
    if (!record)
        throw new Error('Contract record was not found.');
    return record;
}
