import type { Context, Field, Kind, Operation } from '../workspace/types';
import { find, requireThat, text } from '../workspace/values';

const note: Field = { key: 'note', label: 'Submittal narrative', type: 'text', required: true };
const drawing: Field = { key: 'drawing', label: 'Submittal drawing', type: 'reference', reference: 'drawing', required: true };
export const submittalKind: Kind = {
    key: 'submittal', label: 'Submittals', initial: 'draft', editors: [],
    states: ['draft', 'submitted', 'reviewed', 'rejected', 'released', 'withdrawn'],
    fields: [drawing, note,
        { key: 'owner', label: 'Submitting actor', type: 'text', required: true },
        { key: 'drawingVersion', label: 'Drawing version', type: 'number', integer: true, min: 1, required: true },
        { key: 'review', label: 'Review evidence', type: 'text', required: false },
    ],
};

function narrative(context: Context) {
    const value = text(context.input, 'note').trim();
    requireThat(value.length >= 20, 'Describe the submittal evidence in at least 20 characters.');
    return value;
}

function owned(context: Context) {
    requireThat(context.entity.fields['owner'] === context.actor.id, 'Only the submitting actor can change this submittal.');
}

function currentDrawing(context: Context) {
    const record = find(context.state.entities, text(context.entity.fields, 'drawing'), 'drawing');
    requireThat(record.status === 'issued' && record.revision === context.entity.fields['drawingVersion'],
        'Drawing changed. Reject or withdraw the submittal and revise its drawing reference.');
    return record;
}

function activeContract(context: Context, drawingId: string) {
    const record = find(context.state.entities, drawingId, 'drawing');
    const contract = find(context.state.entities, text(record.fields, 'contract'), 'contract');
    requireThat(contract.status === 'active', 'Reopen the contract before changing submittals.');
    return record;
}

export const submittalOperations: Operation[] = [
    {
        key: 'submittal-open', label: 'Open submittal', kind: 'drawing', from: ['issued'],
        roles: ['Site Inspector', 'Cost Controller'], fields: [note],
        run: context => {
            activeContract(context, context.entity.id);
            context.add('submittal', 'Submittal · ' + context.entity.title, {
                drawing: context.entity.id, drawingVersion: context.entity.revision,
                owner: context.actor.id, note: narrative(context), review: '',
            });
            return 'Submittal draft created with pinned drawing evidence.';
        },
    },
    {
        key: 'submittal-revise', label: 'Revise submittal', kind: 'submittal', from: ['draft', 'rejected'],
        roles: ['Site Inspector', 'Cost Controller'], fields: [drawing, note],
        run: context => {
            owned(context);
            const previous = activeContract(context, text(context.entity.fields, 'drawing'));
            const next = activeContract(context, text(context.input, 'drawing'));
            requireThat(next.status === 'issued', 'Choose a currently issued drawing.');
            requireThat(next.fields['contract'] === previous.fields['contract'], 'The drawing must belong to the same contract.');
            context.entity.fields = { ...context.entity.fields, drawing: next.id,
                drawingVersion: next.revision, note: narrative(context), review: '' };
            context.entity.status = 'draft';
            return 'Submittal revised; prior review remains in audit history.';
        },
    },
    {
        key: 'submittal-submit', label: 'Submit submittal', kind: 'submittal', from: ['draft'],
        roles: ['Site Inspector', 'Cost Controller'],
        run: context => {
            owned(context);
            activeContract(context, currentDrawing(context).id);
            context.entity.status = 'submitted';
            return 'Submittal submitted for architectural review.';
        },
    },
    {
        key: 'submittal-review', label: 'Approve submittal review', kind: 'submittal', from: ['submitted'],
        roles: ['Architect'], fields: [note],
        run: context => {
            currentDrawing(context);
            requireThat(context.entity.fields['owner'] !== context.actor.id, 'Review requires an independent actor.');
            const evidence = narrative(context);
            context.entity.fields['review'] = context.actor.name + ' · ' + context.now + ' · ' + evidence;
            context.entity.status = 'reviewed';
            return 'Submittal review approved: ' + evidence;
        },
    },
    {
        key: 'submittal-reject', label: 'Reject submittal', kind: 'submittal', from: ['submitted', 'reviewed'],
        roles: ['Architect', 'Project Executive'], fields: [note],
        run: context => {
            const reason = narrative(context);
            context.entity.fields['review'] = context.actor.name + ' · ' + context.now + ' · ' + reason;
            context.entity.status = 'rejected';
            return 'Submittal rejected for revision: ' + reason;
        },
    },
    {
        key: 'submittal-release', label: 'Release reviewed submittal', kind: 'submittal', from: ['reviewed'],
        roles: ['Project Executive'],
        run: context => {
            activeContract(context, currentDrawing(context).id);
            requireThat(Boolean(context.entity.fields['review']), 'Architectural review evidence is required.');
            context.entity.status = 'released';
            return 'Reviewed submittal released for field execution.';
        },
    },
    {
        key: 'submittal-withdraw', label: 'Withdraw submittal', kind: 'submittal', from: ['draft', 'submitted', 'rejected'],
        roles: ['Site Inspector', 'Cost Controller'], fields: [note],
        run: context => {
            owned(context);
            const reason = narrative(context);
            context.entity.status = 'withdrawn';
            return 'Submittal withdrawn with evidence preserved: ' + reason;
        },
    },
];
