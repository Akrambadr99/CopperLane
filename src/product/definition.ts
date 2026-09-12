import { submittalKind, submittalOperations } from '../document-control/submittal-workflow';
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import type { Product, Kind, Field, Operation, Entity } from '../workspace/types';
import { entity, find, rows, total, text, number, requireThat, money } from '../workspace/values';
const txt = (key: string, label: string): Field => ({ key, label, type: 'text', required: true });
const num = (key: string, label: string, initial = 0, min = 0, max = Number.MAX_SAFE_INTEGER): Field => ({ key, label, type: 'number', required: true, integer: true, initial, min, max });
const date = (key: string, label: string): Field => ({ key, label, type: 'date', required: true, initial: '2026-09-12' });
const ref = (key: string, label: string, reference: string): Field => ({ key, label, type: 'reference', reference, required: true });
const choice = (key: string, label: string, options: string[]): Field => ({ key, label, type: 'select', options, required: true, initial: options[0] ?? '' });
const kind = (key: string, label: string, states: string[], editors: string[], fields: Field[]): Kind => ({ key, label, states, editors, fields, initial: states[0] ?? 'draft' });
const linked = (entities: Entity[], kind: string, key: string, id: string) => rows(entities, kind).filter(item => item.fields[key] === id);
void txt;
void num;
void date;
void ref;
void choice;
void kind;
void linked;
void entity;
void find;
void rows;
void total;
void text;
void number;
void requireThat;
void money;
const roles = ['Project Executive', 'Architect', 'Site Inspector', 'Cost Controller'];
const kinds = [kind('contract', 'Contracts', ['active', 'closed'], [roles[0]!, roles[3]!], [num('value', 'Original value (cents)', 100000000, 1), num('contingency', 'Contingency (cents)', 10000000), date('completion', 'Planned completion')]), kind('drawing', 'Drawing revisions', ['draft', 'issued', 'superseded'], [roles[1]!], [ref('contract', 'Contract', 'contract'), txt('document', 'Document number'), txt('revision', 'Revision'), txt('checksum', 'Content checksum')]), kind('change', 'Change orders', ['draft', 'priced', 'approved', 'executed'], [roles[0]!, roles[3]!], [ref('contract', 'Contract', 'contract'), num('cost', 'Cost impact (cents)'), num('days', 'Schedule impact days', 0, 0, 365), txt('scope', 'Scope description')]), kind('inspection', 'Field inspections', ['open', 'passed', 'failed'], [roles[2]!], [ref('drawing', 'Drawing revision', 'drawing'), txt('observation', 'Field observation')]), kind('payment', 'Payment applications', ['submitted', 'reviewed', 'certified', 'paid'], [roles[3]!], [ref('contract', 'Contract', 'contract'), num('gross', 'Gross amount (cents)', 100000, 1), num('retainage', 'Retainage percent', 10, 0, 100)])];
const operations: Operation[] = [{ key: 'issue', label: 'Issue construction drawing', kind: 'drawing', from: ['draft'], roles: [roles[1]!], run: ({ state, entity }) => {
            for (const old of rows(state.entities, 'drawing').filter(row => row.id !== entity.id && row.fields['document'] === entity.fields['document'] && row.status === 'issued'))
                old.status = 'superseded';
            entity.status = 'issued';
            return 'Issued immutable drawing revision and superseded its predecessor.';
        } }, { key: 'inspect', label: 'Complete field inspection', kind: 'inspection', from: ['open'], roles: [roles[2]!], fields: [choice('result', 'Inspection result', ['passed', 'failed'])], run: ({ state, entity, input }) => { requireThat(find(state.entities, text(entity.fields, 'drawing'), 'drawing').status === 'issued', 'Inspection must reference an issued drawing.'); entity.status = text(input, 'result'); return 'Inspection completed against its historical drawing revision.'; } }, { key: 'price', label: 'Complete contractor pricing', kind: 'change', from: ['draft'], roles: [roles[3]!], run: ({ entity }) => { entity.status = 'priced'; return 'Commercial pricing completed.'; } }, { key: 'approve', label: 'Approve funded change', kind: 'change', from: ['priced'], roles: [roles[0]!], run: ({ state, entity }) => { const contract = find(state.entities, text(entity.fields, 'contract')); const approved = total(rows(state.entities, 'change').filter(row => ['approved', 'executed'].includes(row.status) && row.fields['contract'] === contract.id), 'cost'); requireThat(approved + number(entity.fields, 'cost') <= number(contract.fields, 'contingency'), 'Change exceeds remaining contract contingency.'); entity.status = 'approved'; return 'Owner approved change against remaining contingency.'; } }, { key: 'execute', label: 'Execute approved change', kind: 'change', from: ['approved'], roles: [roles[3]!], run: ({ entity }) => { entity.status = 'executed'; return 'Approved change incorporated into forecast.'; } }, { key: 'review', label: 'Review measured quantities', kind: 'payment', from: ['submitted'], roles: [roles[3]!], run: ({ entity }) => { entity.status = 'reviewed'; return 'Measured quantities reviewed.'; } }, { key: 'certify', label: 'Certify payment', kind: 'payment', from: ['reviewed'], roles: [roles[1]!, roles[3]!], run: ({ state, entity }) => { const contract = find(state.entities, text(entity.fields, 'contract')); const certified = total(rows(state.entities, 'payment').filter(row => ['certified', 'paid'].includes(row.status) && row.fields['contract'] === contract.id), 'gross'); requireThat(certified + number(entity.fields, 'gross') <= number(contract.fields, 'value'), 'Certification exceeds contract value.'); entity.status = 'certified'; return 'Payment certified after value control.'; } }];
const seed = [entity('contract-1', 'contract', 'Central station renewal', 'active', { value: 100000000, contingency: 10000000, completion: '2027-06-30' }), entity('drawing-1', 'drawing', 'Structural slab plan · A', 'draft', { contract: 'contract-1', document: 'STR-201', revision: 'A', checksum: 'sha256:59ac' }), entity('change-1', 'change', 'Relocate service riser', 'draft', { contract: 'contract-1', cost: 1500000, days: 8, scope: 'Coordinate revised MEP riser route' })];
kinds.push(kind('rfi', 'Requests for information', ['draft', 'submitted', 'rejected', 'approved', 'issued', 'superseded'], [], [
    ref('drawing', 'Referenced drawing', 'drawing'), num('drawingVersion', 'Pinned drawing version', 1, 1),
    txt('question', 'Question'), txt('response', 'Response'), txt('owner', 'Submitting actor'),
    txt('decision', 'Review decision'), { ...ref('predecessor', 'Previous RFI response', 'rfi'), required: false },
]));
operations.push(
    { key: 'rfi-open', label: 'Open RFI', kind: 'drawing', from: ['issued'], roles: [roles[2]!, roles[3]!],
        fields: [txt('question', 'RFI question')], run: ({ entity, actor, input, add }) => {
            requireThat(text(input, 'question').trim().length >= 12, 'Describe the RFI question in at least 12 characters.');
            add('rfi', 'RFI · ' + entity.title, { drawing: entity.id, drawingVersion: entity.revision,
                question: text(input, 'question').trim(), response: 'Awaiting response', owner: actor.id, decision: 'Awaiting review' });
            return 'RFI draft opened with a pinned drawing reference.';
        } },
    { key: 'rfi-revise', label: 'Revise RFI', kind: 'rfi', from: ['draft', 'rejected'], roles: [roles[2]!, roles[3]!],
        fields: [ref('drawing', 'Referenced drawing', 'drawing'), txt('question', 'Revised question')], run: ({ state, entity, actor, input }) => {
            requireThat(entity.fields['owner'] === actor.id, 'Only the submitting actor can revise this RFI.');
            const drawing = find(state.entities, text(input, 'drawing'), 'drawing');
            requireThat(drawing.status === 'issued', 'Choose a currently issued drawing.');
            requireThat(text(input, 'question').trim().length >= 12, 'Describe the RFI question in at least 12 characters.');
            entity.fields['drawing'] = drawing.id;
            entity.fields['drawingVersion'] = drawing.revision;
            entity.fields['question'] = text(input, 'question').trim();
            entity.fields['response'] = 'Awaiting response';
            entity.fields['decision'] = 'Awaiting review';
            entity.status = 'draft';
            return 'RFI revised against the current drawing; prior decisions remain in audit history.';
        } },
    { key: 'rfi-submit', label: 'Submit RFI', kind: 'rfi', from: ['draft'], roles: [roles[2]!, roles[3]!],
        run: ({ state, entity, actor }) => {
            requireThat(entity.fields['owner'] === actor.id, 'Only the submitting actor can submit this RFI.');
            const drawing = find(state.entities, text(entity.fields, 'drawing'), 'drawing');
            requireThat(drawing.status === 'issued' && drawing.revision === entity.fields['drawingVersion'], 'Drawing changed. Revise the RFI against its current issued revision.');
            entity.status = 'submitted';
            return 'RFI submitted for architectural review.';
        } },
    { key: 'rfi-reject', label: 'Reject RFI', kind: 'rfi', from: ['submitted', 'approved'], roles: [roles[1]!],
        fields: [txt('reason', 'Rejection reason')], run: ({ entity, input }) => {
            requireThat(text(input, 'reason').trim().length >= 12, 'Provide a specific rejection reason.');
            entity.fields['decision'] = text(input, 'reason').trim();
            entity.status = 'rejected';
            return 'RFI rejected: ' + text(input, 'reason').trim();
        } },
    { key: 'rfi-approve', label: 'Approve RFI', kind: 'rfi', from: ['submitted'], roles: [roles[1]!],
        fields: [txt('response', 'Architect response')], run: ({ state, entity, input }) => {
            const drawing = find(state.entities, text(entity.fields, 'drawing'), 'drawing');
            requireThat(drawing.status === 'issued' && drawing.revision === entity.fields['drawingVersion'], 'Drawing changed. Reject for revision before approving.');
            requireThat(text(input, 'response').trim().length >= 12, 'Provide a specific architectural response.');
            entity.fields['response'] = text(input, 'response').trim();
            entity.fields['decision'] = 'Approved';
            entity.status = 'approved';
            return 'RFI approved: ' + text(input, 'response').trim();
        } },
    { key: 'rfi-issue', label: 'Issue RFI response', kind: 'rfi', from: ['approved'], roles: [roles[1]!],
        run: ({ state, entity }) => {
            const drawing = find(state.entities, text(entity.fields, 'drawing'), 'drawing');
            requireThat(drawing.status === 'issued' && drawing.revision === entity.fields['drawingVersion'], 'Drawing changed. Reject for revision before issuing.');
            entity.status = 'issued';
            return 'RFI response issued against pinned drawing ' + drawing.title + ': ' + text(entity.fields, 'response');
        } },
    { key: 'rfi-supersede', label: 'Supersede issued RFI response', kind: 'rfi', from: ['issued'], roles: [roles[1]!],
        fields: [ref('drawing', 'Current drawing revision', 'drawing'), txt('reason', 'Supersession reason')], run: ({ state, entity, input, add }) => {
            const previousDrawing = find(state.entities, text(entity.fields, 'drawing'), 'drawing');
            const currentDrawing = find(state.entities, text(input, 'drawing'), 'drawing');
            requireThat(currentDrawing.status === 'issued' && currentDrawing.id !== previousDrawing.id && currentDrawing.fields['document'] === previousDrawing.fields['document'], 'Choose a newer issued revision of the same drawing document.');
            requireThat(text(input, 'reason').trim().length >= 12, 'Provide a specific supersession reason.');
            requireThat(!rows(state.entities, 'rfi').some(item => item.fields['predecessor'] === entity.id && item.status !== 'superseded'), 'An active successor already exists for this RFI response.');
            entity.status = 'superseded';
            add('rfi', 'RFI revision · ' + currentDrawing.title, { drawing: currentDrawing.id, drawingVersion: currentDrawing.revision,
                question: text(entity.fields, 'question'), response: 'Awaiting response', owner: text(entity.fields, 'owner'),
                decision: 'Superseded because: ' + text(input, 'reason').trim(), predecessor: entity.id });
            return 'Issued response superseded; a successor draft was created against the current drawing while the prior response remains in history.';
        } },
);
function handoffEvidence(entities: Entity[], contractId: string) {
    const drawings = linked(entities, 'drawing', 'contract', contractId);
    const ids = new Set(drawings.map(item => item.id));
    return entities.filter(item => item.id === contractId || (['drawing', 'change'].includes(item.kind) && item.fields['contract'] === contractId) || (['inspection', 'rfi', 'submittal'].includes(item.kind) && ids.has(String(item.fields['drawing']))));
}
function handoffFingerprint(entities: Entity[], contractId: string) {
    return JSON.stringify(handoffEvidence(entities, contractId).map(item => [item.id, item.revision, item.status]).sort((a, b) => String(a[0]).localeCompare(String(b[0]))));
}
function requireHandoffReady(entities: Entity[], contractId: string) {
    const evidence = handoffEvidence(entities, contractId);
    requireThat(!evidence.some(item => item.kind === 'submittal' && !['released', 'withdrawn'].includes(item.status)), 'Release or withdraw outstanding submittals before handoff.');
    const issued = evidence.filter(item => item.kind === 'drawing' && item.status === 'issued');
    requireThat(issued.length > 0, 'Issue construction drawings before requesting handoff.');
    requireThat(issued.every(drawing => evidence.some(item => item.kind === 'inspection' && item.fields['drawing'] === drawing.id && item.status === 'passed')), 'Every issued drawing requires a passed field inspection.');
    requireThat(!evidence.some(item => item.kind === 'inspection' && item.status !== 'passed'), 'Resolve outstanding field inspections before handoff.');
    requireThat(!evidence.some(item => item.kind === 'change' && item.status === 'approved'), 'Execute approved changes before handoff.');
    requireThat(!evidence.some(item => item.kind === 'rfi' && item.status !== 'issued'), 'Issue all RFI responses before handoff.');
}
kinds.push(kind('handoff', 'Contract handoffs', ['requested', 'approved', 'cancelled', 'revoked'], [], [
    ref('contract', 'Contract', 'contract'), {...txt('evidence', 'Evidence fingerprint'), max: 1000000}, txt('requester', 'Requesting actor'), txt('note', 'Handoff note'),
    {...txt('approval', 'Approval record'), required: false}, {...txt('revocation', 'Revocation record'), required: false},
]));
operations.push(
    {key: 'handoff-request', label: 'Request contract handoff', kind: 'contract', from: ['active'], roles: [roles[1]!, roles[2]!], fields: [txt('note', 'Handoff note')], run: ({state, entity, actor, input, add}) => {
        requireThat(text(input, 'note').trim().length >= 20, 'Provide a handoff note of at least 20 characters.');
        requireThat(!linked(state.entities, 'handoff', 'contract', entity.id).some(item => ['requested', 'approved'].includes(item.status)), 'A handoff is already pending or approved.');
        requireHandoffReady(state.entities, entity.id);
        add('handoff', 'Handoff · ' + entity.title, {contract: entity.id, evidence: handoffFingerprint(state.entities, entity.id), requester: actor.id, note: text(input, 'note').trim()});
        return 'Contract handoff requested with pinned drawing, inspection and RFI evidence.';
    }},
    {key: 'handoff-approve', label: 'Approve contract handoff', kind: 'handoff', from: ['requested'], roles: [roles[0]!], run: ({state, entity, actor, now}) => {
        const contract = find(state.entities, text(entity.fields, 'contract'), 'contract');
        requireThat(contract.status === 'active', 'Contract is no longer active.');
        requireThat(entity.fields['requester'] !== actor.id, 'An independent executive must approve handoff.');
        requireThat(entity.fields['evidence'] === handoffFingerprint(state.entities, contract.id), 'Handoff evidence changed. Cancel this request and request a new handoff.');
        requireHandoffReady(state.entities, contract.id);
        entity.status = 'approved'; entity.fields['approval'] = actor.name + ' · ' + now;
        contract.status = 'closed';
        return 'Contract handoff approved and contract closed with preserved evidence.';
    }},
    {key: 'handoff-cancel', label: 'Cancel handoff request', kind: 'handoff', from: ['requested'], roles: [roles[0]!, roles[1]!, roles[2]!], run: ({entity, actor}) => {
        requireThat(entity.fields['requester'] === actor.id || actor.role === roles[0], 'Only the requester or executive can cancel handoff.');
        entity.status = 'cancelled'; return 'Handoff request cancelled; evidence retained for audit.';
    }},
    {key: 'handoff-revoke', label: 'Revoke contract handoff', kind: 'handoff', from: ['approved'], roles: [roles[0]!], fields: [txt('reason', 'Revocation reason')], run: ({state, entity, actor, input, now}) => {
        requireThat(text(input, 'reason').trim().length >= 20, 'Provide a revocation reason of at least 20 characters.');
        const contract = find(state.entities, text(entity.fields, 'contract'), 'contract');
        requireThat(contract.status === 'closed', 'Contract is no longer closed.');
        entity.status = 'revoked'; entity.fields['revocation'] = actor.name + ' · ' + now + ' · ' + text(input, 'reason').trim(); contract.status = 'active';
        return 'Handoff revoked and contract reopened; original approval and evidence retained.';
    }},
);
kinds.push(submittalKind);
operations.push(...submittalOperations);
const validate: Product['validate'] = entities => {
    for (const handoff of rows(entities, 'handoff').filter(item => item.status === 'approved')) {
        const contract = find(entities, text(handoff.fields, 'contract'), 'contract');
        requireThat(contract.status === 'closed', 'Approved handoff requires a closed contract.');
        const original = JSON.parse(text(handoff.fields, 'evidence')) as [string, number, string][];
        const current = handoffEvidence(entities, contract.id).filter(item => item.id !== contract.id).map(item => [item.id, item.revision, item.status]);
        requireThat(JSON.stringify(current.sort((a, b) => String(a[0]).localeCompare(String(b[0])))) === JSON.stringify(original.filter(item => item[0] !== contract.id)), 'Revoke handoff before changing closed contract evidence.');
    }
    for (const contract of rows(entities, 'contract'))
        requireThat(total(rows(entities, 'change').filter(row => ['approved', 'executed'].includes(row.status) && row.fields['contract'] === contract.id), 'cost') <= number(contract.fields, 'contingency'), 'Approved changes exceed contingency.');
};
const metrics: Product['metrics'] = entities => [{ label: 'Executed change value', value: money(total(rows(entities, 'change').filter(row => row.status === 'executed'), 'cost')) }, { label: 'Issued drawings', value: String(rows(entities, 'drawing').filter(row => row.status === 'issued').length) }, { label: 'Open inspections', value: String(rows(entities, 'inspection').filter(row => row.status === 'open').length) }];
export const product: Product = { name: 'BuildLedger', description: 'Construction revisions, field quality and commercial control', accent: '#b45309', actors: roles.map((role, index) => ({ id: 'actor-' + String(index), name: ['Maya Hassan', 'Omar Saleh', 'Lina Farouk', 'Nadia Ali'][index] ?? role, role })), kinds, operations, seed, validate, metrics };
