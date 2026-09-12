import type { Entity, Field, Kind, Operation } from '../workspace/types';
import { find, requireThat, rows, text } from '../workspace/values';

const executive = 'Project Executive';
const architect = 'Architect';
const inspector = 'Site Inspector';
const controller = 'Cost Controller';
const field = (key: string, label: string, type: Field['type'] = 'text'): Field => ({ key, label, type, required: true });
const reference = (key: string, label: string, kind: string): Field => ({ ...field(key, label, 'reference'), reference: kind });

export const coordinationKinds: Kind[] = [
    {
        key: 'coordination-issue', label: 'Field coordination issues', initial: 'open', editors: [],
        states: ['open', 'proposed', 'approved', 'closed', 'void'],
        fields: [reference('drawing', 'Drawing revision', 'drawing'), field('zone', 'Coordination zone'),
            field('issue', 'Coordination issue'), field('owner', 'Issue owner'), field('resolution', 'Resolution proposal'),
            field('decision', 'Review decision'), field('drawingRevision', 'Pinned drawing revision', 'number')],
    },
    {
        key: 'work-permit', label: 'Controlled work permits', initial: 'requested', editors: [],
        states: ['requested', 'released', 'suspended', 'closed', 'cancelled'],
        fields: [reference('drawing', 'Drawing revision', 'drawing'), reference('package', 'Completed package', 'submittal-package'),
            field('scope', 'Released work scope'), field('owner', 'Permit owner'), field('evidence', 'Release evidence'),
            field('decision', 'Release decision'), field('closure', 'Closure evidence')],
    },
];

function detailed(value: string, message: string) {
    const clean = value.trim();
    requireThat(clean.length >= 20, message);
    return clean;
}

function packageDependencyIds(item: Entity) {
    return text(item.fields, 'dependencies').split(',').map(value => value.trim()).filter(Boolean);
}

function completedPackageForDrawing(entities: Entity[], drawingId: string) {
    const submittalIds = new Set(rows(entities, 'submittal').filter(item => item.fields['drawing'] === drawingId && item.status === 'released').map(item => item.id));
    return rows(entities, 'submittal-package').find(item => item.status === 'completed' && packageDependencyIds(item).some(id => submittalIds.has(id)));
}

function openIssues(entities: Entity[], drawingId: string) {
    return rows(entities, 'coordination-issue').filter(item => item.fields['drawing'] === drawingId && !['closed', 'void'].includes(item.status));
}

function permitEvidence(drawing: Entity, completedPackage: Entity) {
    return JSON.stringify({ drawing: [drawing.id, drawing.revision, drawing.status], package: [completedPackage.id, completedPackage.revision, completedPackage.status] });
}

export const coordinationOperations: Operation[] = [
    {
        key: 'coordination-open', label: 'Open field coordination issue', kind: 'drawing', from: ['issued'], roles: [inspector, controller],
        fields: [field('zone', 'Coordination zone'), field('issue', 'Coordination issue')],
        run: ({ state, entity, actor, input, add }) => {
            const zone = detailed(text(input, 'zone'), 'Describe the coordination zone in 20 characters.');
            requireThat(!openIssues(state.entities, entity.id).some(item => item.fields['zone'] === zone), 'This drawing already has an open issue for the coordination zone.');
            add('coordination-issue', 'Coordination · ' + entity.title, { drawing: entity.id, zone,
                issue: detailed(text(input, 'issue'), 'Describe the coordination issue in 20 characters.'), owner: actor.id,
                resolution: 'Awaiting coordinated proposal', decision: 'Awaiting review', drawingRevision: entity.revision });
            return 'Field coordination issue opened against the issued drawing.';
        },
    },
    {
        key: 'coordination-propose', label: 'Submit coordination resolution', kind: 'coordination-issue', from: ['open'], roles: [inspector, controller],
        fields: [field('resolution', 'Resolution proposal')],
        run: ({ state, entity, actor, input }) => {
            requireThat(entity.fields['owner'] === actor.id, 'Only the issue owner can submit its resolution.');
            const drawing = find(state.entities, text(entity.fields, 'drawing'), 'drawing');
            requireThat(drawing.status === 'issued' && drawing.revision === entity.fields['drawingRevision'], 'Drawing changed. Void and reopen coordination against the current revision.');
            entity.fields['resolution'] = detailed(text(input, 'resolution'), 'Provide 20 characters of coordinated resolution evidence.');
            entity.status = 'proposed';
            return 'Coordination resolution submitted for architectural review.';
        },
    },
    {
        key: 'coordination-review', label: 'Review coordination resolution', kind: 'coordination-issue', from: ['proposed'], roles: [architect],
        fields: [{ ...field('result', 'Coordination decision', 'select'), options: ['approved', 'rejected'] }, field('decision', 'Decision evidence')],
        run: ({ state, entity, actor, input, now }) => {
            requireThat(entity.fields['owner'] !== actor.id, 'Coordination review must be independent.');
            const drawing = find(state.entities, text(entity.fields, 'drawing'), 'drawing');
            requireThat(drawing.status === 'issued' && drawing.revision === entity.fields['drawingRevision'], 'Drawing changed before coordination review.');
            const approved = text(input, 'result') === 'approved';
            entity.fields['decision'] = actor.name + ' · ' + now + ' · ' + detailed(text(input, 'decision'), 'Provide 20 characters of decision evidence.');
            entity.status = approved ? 'approved' : 'open';
            return approved ? 'Coordination resolution approved.' : 'Coordination resolution returned for revision.';
        },
    },
    {
        key: 'coordination-close', label: 'Close coordination issue', kind: 'coordination-issue', from: ['approved'], roles: [executive],
        run: ({ state, entity }) => {
            const drawing = find(state.entities, text(entity.fields, 'drawing'), 'drawing');
            requireThat(drawing.status === 'issued' && drawing.revision === entity.fields['drawingRevision'], 'Drawing changed before issue closure.');
            entity.status = 'closed';
            return 'Approved coordination issue closed with its history preserved.';
        },
    },
    {
        key: 'permit-request', label: 'Request controlled work permit', kind: 'drawing', from: ['issued'], roles: [inspector],
        fields: [field('scope', 'Released work scope')],
        run: ({ state, entity, actor, input, add }) => {
            requireThat(openIssues(state.entities, entity.id).length === 0, 'Close field coordination issues before requesting work release.');
            const completedPackage = completedPackageForDrawing(state.entities, entity.id);
            requireThat(completedPackage, 'Complete an inspected submittal package before requesting work release.');
            requireThat(!rows(state.entities, 'work-permit').some(item => item.fields['drawing'] === entity.id && !['closed', 'cancelled'].includes(item.status)), 'Drawing already has an active work permit.');
            add('work-permit', 'Permit · ' + entity.title, { drawing: entity.id, package: completedPackage.id,
                scope: detailed(text(input, 'scope'), 'Describe the released work scope in 20 characters.'), owner: actor.id,
                evidence: permitEvidence(entity, completedPackage), decision: 'Awaiting architectural release', closure: 'Not closed' });
            return 'Controlled work permit requested with package evidence pinned.';
        },
    },
    {
        key: 'permit-release', label: 'Release controlled work permit', kind: 'work-permit', from: ['requested', 'suspended'], roles: [architect],
        fields: [field('decision', 'Release evidence')],
        run: ({ state, entity, actor, input, now }) => {
            const drawing = find(state.entities, text(entity.fields, 'drawing'), 'drawing');
            const completedPackage = find(state.entities, text(entity.fields, 'package'), 'submittal-package');
            requireThat(openIssues(state.entities, drawing.id).length === 0, 'Resolve current field coordination before release.');
            requireThat(entity.fields['evidence'] === permitEvidence(drawing, completedPackage), 'Drawing or package evidence changed. Request a current permit.');
            entity.fields['decision'] = actor.name + ' · ' + now + ' · ' + detailed(text(input, 'decision'), 'Provide 20 characters of release evidence.');
            entity.status = 'released';
            return 'Controlled work permit released against current evidence.';
        },
    },
    {
        key: 'permit-suspend', label: 'Suspend controlled work permit', kind: 'work-permit', from: ['released'], roles: [inspector, architect],
        fields: [field('reason', 'Suspension reason')],
        run: ({ entity, actor, input, now }) => {
            entity.fields['decision'] = actor.name + ' · ' + now + ' · suspended · ' + detailed(text(input, 'reason'), 'Provide 20 characters explaining suspension.');
            entity.status = 'suspended';
            return 'Work permit suspended; prior release evidence retained.';
        },
    },
    {
        key: 'permit-close', label: 'Close controlled work permit', kind: 'work-permit', from: ['released'], roles: [inspector],
        fields: [field('closure', 'Closure evidence')],
        run: ({ entity, actor, input, now }) => {
            requireThat(entity.fields['owner'] === actor.id, 'Only the permit owner can close released work.');
            entity.fields['closure'] = actor.name + ' · ' + now + ' · ' + detailed(text(input, 'closure'), 'Provide 20 characters of work closure evidence.');
            entity.status = 'closed';
            return 'Controlled work permit closed with execution evidence.';
        },
    },
];

export function validateFieldCoordination(entities: Entity[]) {
    for (const issue of rows(entities, 'coordination-issue')) {
        const drawing = find(entities, text(issue.fields, 'drawing'), 'drawing');
        requireThat(Number(issue.fields['drawingRevision']) >= 1, 'Coordination issue requires a pinned drawing revision.');
        if (issue.status === 'closed') requireThat(text(issue.fields, 'decision') !== 'Awaiting review', 'Closed coordination requires a decision record.');
        requireThat(drawing.fields['contract'] !== undefined, 'Coordinated drawing must belong to a contract.');
    }
    for (const permit of rows(entities, 'work-permit')) {
        find(entities, text(permit.fields, 'drawing'), 'drawing');
        find(entities, text(permit.fields, 'package'), 'submittal-package');
        if (permit.status === 'closed') requireThat(text(permit.fields, 'closure') !== 'Not closed', 'Closed permit requires execution evidence.');
    }
}
