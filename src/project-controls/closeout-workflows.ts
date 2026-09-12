import type { Entity, Field, Kind, Operation } from '../workspace/types';
import { find, requireThat, rows, text } from '../workspace/values';

const roles = {
    executive: 'Project Executive',
    architect: 'Architect',
    inspector: 'Site Inspector',
    cost: 'Cost Controller',
} as const;

const field = (key: string, label: string, type: Field['type'] = 'text'): Field => ({ key, label, type, required: true });
const optional = (key: string, label: string): Field => ({ key, label, type: 'text', required: false });
const reference = (key: string, label: string, target: string): Field => ({ ...field(key, label, 'reference'), reference: target });

export const closeoutKinds: Kind[] = [
    {
        key: 'punch', label: 'Punch list items', initial: 'open',
        states: ['open', 'resolved', 'verified', 'reopened', 'void'], editors: [],
        fields: [reference('drawing', 'Drawing', 'drawing'), field('description', 'Defect description'),
            field('owner', 'Owner'), field('due', 'Correction due', 'date'), field('evidence', 'Resolution evidence'),
            field('verification', 'Verification'), optional('resolvedBy', 'Resolved by'), optional('resolvedAt', 'Resolved at'),
            optional('verifiedBy', 'Verified by'), optional('verifiedAt', 'Verified at'), optional('reopenedBy', 'Reopened by'), optional('reopenedAt', 'Reopened at')],
    },
    {
        key: 'commitment', label: 'Contractor commitments', initial: 'draft',
        states: ['draft', 'submitted', 'approved', 'completed', 'cancelled'], editors: [],
        fields: [reference('contract', 'Contract', 'contract'), field('description', 'Commitment description'),
            field('owner', 'Owner'), field('due', 'Commitment due', 'date'), field('requester', 'Requester'),
            field('approval', 'Approval'), field('completion', 'Completion evidence'), optional('completedBy', 'Completed by'), optional('completedAt', 'Completed at')],
    },
    {
        key: 'warranty', label: 'Warranties', initial: 'active',
        states: ['active', 'claim-open', 'remediated', 'expired'], editors: [],
        fields: [reference('contract', 'Contract', 'contract'), field('asset', 'Covered asset'), field('expires', 'Expiry', 'date'),
            field('provider', 'Warranty provider'), field('claim', 'Claim description'), field('resolution', 'Remediation evidence'),
            optional('claimedBy', 'Claimed by'), optional('claimedAt', 'Claimed at'), optional('resolvedBy', 'Resolved by'), optional('resolvedAt', 'Resolved at')],
    },
];

const specific = (value: string, message: string) => {
    const normalized = value.trim();
    requireThat(normalized.length >= 20, message);
    return normalized;
};

export const closeoutOperations: Operation[] = [
    {
        key: 'punch-open', label: 'Open punch list item', kind: 'drawing', from: ['issued'], roles: [roles.inspector],
        fields: [field('description', 'Defect description'), field('due', 'Correction due', 'date')],
        run: ({ entity, actor, input, add, now }) => {
            requireThat(text(input, 'due') >= now.slice(0, 10), 'Correction is past due.');
            const description = specific(text(input, 'description'), 'Describe the defect in 20 characters.');
            add('punch', 'Punch · ' + entity.title, { drawing: entity.id, description, owner: actor.id,
                due: text(input, 'due'), evidence: 'Awaiting correction', verification: 'Not verified' });
            return 'Punch item opened against the drawing revision.';
        },
    },
    {
        key: 'punch-resolve', label: 'Submit punch correction', kind: 'punch', from: ['open', 'reopened'], roles: [roles.inspector, roles.cost],
        fields: [field('evidence', 'Resolution evidence')], run: ({ entity, actor, input, now }) => {
            requireThat(entity.fields['owner'] === actor.id || actor.role === roles.cost, 'Only the owner or controller can submit correction.');
            entity.fields['evidence'] = specific(text(input, 'evidence'), 'Provide 20 characters of correction evidence.');
            entity.fields['verification'] = 'Awaiting independent inspection';
            entity.fields['resolvedBy'] = actor.id; entity.fields['resolvedAt'] = now; entity.status = 'resolved';
            return 'Punch correction submitted for verification.';
        },
    },
    {
        key: 'punch-verify', label: 'Verify punch correction', kind: 'punch', from: ['resolved'], roles: [roles.inspector],
        fields: [field('verification', 'Verification note')], run: ({ entity, actor, input, now }) => {
            requireThat(entity.fields['resolvedBy'] !== actor.id, 'Correction submitter cannot verify it.');
            entity.fields['verification'] = specific(text(input, 'verification'), 'Provide a 20-character verification note.');
            entity.fields['verifiedBy'] = actor.id; entity.fields['verifiedAt'] = now; entity.status = 'verified';
            return 'Punch correction verified.';
        },
    },
    {
        key: 'punch-reopen', label: 'Reopen punch item', kind: 'punch', from: ['resolved', 'verified'], roles: [roles.inspector],
        fields: [field('reason', 'Reopening reason')], run: ({ entity, actor, input, now }) => {
            entity.fields['verification'] = 'Reopened: ' + specific(text(input, 'reason'), 'Provide a 20-character reopening reason.');
            entity.fields['reopenedBy'] = actor.id; entity.fields['reopenedAt'] = now; entity.status = 'reopened';
            return 'Punch item reopened; prior evidence is retained.';
        },
    },
    {
        key: 'commitment-create', label: 'Create contractor commitment', kind: 'contract', from: ['active'], roles: [roles.cost, roles.executive],
        fields: [field('description', 'Commitment description'), field('due', 'Commitment due', 'date'), field('owner', 'Owner')],
        run: ({ entity, actor, input, add, now }) => {
            requireThat(text(input, 'due') >= now.slice(0, 10), 'Commitment is past due.');
            add('commitment', 'Commitment · ' + entity.title, { contract: entity.id,
                description: specific(text(input, 'description'), 'Describe the commitment in 20 characters.'),
                owner: text(input, 'owner').trim(), due: text(input, 'due'), requester: actor.id,
                approval: 'Awaiting approval', completion: 'Not completed' });
            return 'Contractor commitment drafted.';
        },
    },
    {
        key: 'commitment-submit', label: 'Submit contractor commitment', kind: 'commitment', from: ['draft'], roles: [roles.cost, roles.executive],
        run: ({ entity, actor }) => {
            requireThat(entity.fields['requester'] === actor.id, 'Only its requester can submit.');
            entity.status = 'submitted'; return 'Commitment submitted for approval.';
        },
    },
    {
        key: 'commitment-approve', label: 'Approve contractor commitment', kind: 'commitment', from: ['submitted'], roles: [roles.executive],
        run: ({ entity, actor, now }) => {
            requireThat(entity.fields['requester'] !== actor.id, 'Requester cannot approve it.');
            entity.fields['approval'] = actor.name + ' · ' + now; entity.status = 'approved';
            return 'Commitment approved.';
        },
    },
    {
        key: 'commitment-complete', label: 'Complete contractor commitment', kind: 'commitment', from: ['approved'], roles: [roles.cost],
        fields: [field('completion', 'Completion evidence')], run: ({ entity, actor, input, now }) => {
            entity.fields['completion'] = specific(text(input, 'completion'), 'Provide 20 characters of completion evidence.');
            entity.fields['completedBy'] = actor.id; entity.fields['completedAt'] = now; entity.status = 'completed';
            return 'Commitment completed with evidence.';
        },
    },
    {
        key: 'warranty-register', label: 'Register closeout warranty', kind: 'contract', from: ['closed'], roles: [roles.executive, roles.cost],
        fields: [field('asset', 'Covered asset'), field('expires', 'Expiry', 'date'), field('provider', 'Warranty provider')],
        run: ({ state, entity, input, add, now }) => {
            requireThat(text(input, 'expires') > now.slice(0, 10), 'Warranty must expire in the future.');
            requireThat(!rows(state.entities, 'warranty').some(item => item.fields['contract'] === entity.id && item.fields['asset'] === text(input, 'asset').trim() && item.status !== 'expired'), 'Active warranty already covers this asset.');
            add('warranty', 'Warranty · ' + text(input, 'asset').trim(), { contract: entity.id,
                asset: specific(text(input, 'asset'), 'Describe the asset in 20 characters.'), expires: text(input, 'expires'),
                provider: specific(text(input, 'provider'), 'Identify the provider in 20 characters.'),
                claim: 'No open claim', resolution: 'No remediation recorded' });
            return 'Warranty registered.';
        },
    },
    {
        key: 'warranty-claim', label: 'Open warranty claim', kind: 'warranty', from: ['active', 'remediated'], roles: [roles.inspector],
        fields: [field('claim', 'Warranty claim')], run: ({ state, entity, actor, input, now }) => {
            const contract = find(state.entities, text(entity.fields, 'contract'), 'contract');
            requireThat(contract.status === 'closed', 'Contract must remain closed.');
            requireThat(text(entity.fields, 'expires') >= now.slice(0, 10), 'Warranty expired.');
            entity.fields['claim'] = specific(text(input, 'claim'), 'Describe the claim in 20 characters.');
            entity.fields['claimedBy'] = actor.id; entity.fields['claimedAt'] = now; entity.status = 'claim-open';
            return 'Warranty claim opened.';
        },
    },
    {
        key: 'warranty-remediate', label: 'Resolve warranty claim', kind: 'warranty', from: ['claim-open'], roles: [roles.cost],
        fields: [field('resolution', 'Remediation evidence')], run: ({ entity, actor, input, now }) => {
            entity.fields['resolution'] = specific(text(input, 'resolution'), 'Provide 20 characters of remediation evidence.');
            entity.fields['resolvedBy'] = actor.id; entity.fields['resolvedAt'] = now; entity.status = 'remediated';
            return 'Warranty claim resolved; history retained.';
        },
    },
];

export function requireConstructionCloseoutReady(entities: Entity[], contractId: string) {
    const drawingIds = new Set(rows(entities, 'drawing').filter(item => item.fields['contract'] === contractId).map(item => item.id));
    requireThat(!rows(entities, 'punch').some(item => drawingIds.has(String(item.fields['drawing'])) && !['verified', 'void'].includes(item.status)), 'Verify or void every punch item before handoff.');
    requireThat(!rows(entities, 'commitment').some(item => item.fields['contract'] === contractId && !['completed', 'cancelled'].includes(item.status)), 'Complete or cancel every contractor commitment before handoff.');
}

export function validateConstructionCloseout(entities: Entity[]) {
    for (const punch of rows(entities, 'punch')) {
        const drawing = find(entities, text(punch.fields, 'drawing'), 'drawing');
        requireThat(drawing.status !== 'draft', 'Punch items must reference an issued or superseded drawing.');
        if (punch.status === 'verified') requireThat(Boolean(punch.fields['verifiedBy']) && Boolean(punch.fields['verifiedAt']), 'Verified punch items require verifier identity and time.');
    }
    for (const commitment of rows(entities, 'commitment')) {
        find(entities, text(commitment.fields, 'contract'), 'contract');
        if (commitment.status === 'approved') requireThat(text(commitment.fields, 'approval').length > 0, 'Approved commitments require an approval record.');
    }
    for (const warranty of rows(entities, 'warranty')) {
        const contract = find(entities, text(warranty.fields, 'contract'), 'contract');
        requireThat(contract.status === 'closed', 'Warranties remain attached to closed contracts.');
    }
}
