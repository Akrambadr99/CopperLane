import type { Command, Product, Snapshot, Value } from '../../workspace/types';
import { execute } from '../../workspace/engine';
import { findPayment } from './selectors';
export function createPaymentCommand(input: {
    id: string;
    actorId: string;
    revision: number;
    title: string;
    fields: Record<string, Value>;
}): Command { return { id: input.id, actorId: input.actorId, expectedRevision: input.revision, type: 'create', kind: 'payment', title: input.title, input: input.fields }; }
export function applyPaymentCommand(state: Snapshot, command: Command, product: Product, at: string): Snapshot { return execute(state, command, product, at); }
export function requirePayment(state: Snapshot, id: string) {
    const record = findPayment(state.entities, id);
    if (!record)
        throw new Error('Payment record was not found.');
    return record;
}
