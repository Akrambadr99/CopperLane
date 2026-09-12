import type { Context, Entity, Field, Kind, Operation } from '../workspace/types';
import { find, requireThat, rows, text } from '../workspace/values';

const executive = 'Project Executive';
const architect = 'Architect';
const inspector = 'Site Inspector';
const controller = 'Cost Controller';
const field = (key: string, label: string, type: Field['type'] = 'text'): Field => ({ key, label, type, required: true });
const reference = (key: string, label: string, kind: string): Field => ({ ...field(key, label, 'reference'), reference: kind });

export const packageKinds: Kind[] = [
    {
        key: 'submittal-package', label: 'Submittal packages', initial: 'draft', editors: [],
        states: ['draft', 'submitted', 'approved', 'released', 'completed', 'cancelled'],
        fields: [reference('contract', 'Contract', 'contract'), field('scope', 'Package scope'),
            reference('dependencies', 'Required submittal IDs', 'submittal'), field('owner', 'Package owner'),
            field('evidence', 'Dependency evidence'), field('approval', 'Approval record')],
    },
    {
        key: 'package-inspection', label: 'Package inspections', initial: 'scheduled', editors: [],
        states: ['scheduled', 'ready', 'passed', 'failed', 'cancelled'],
        fields: [reference('package', 'Submittal package', 'submittal-package'), field('scheduledOn', 'Scheduled date', 'date'),
            field('owner', 'Inspection owner'), field('readiness', 'Readiness evidence'), field('result', 'Inspection result')],
    },
];

function detailed(value: string, message: string) {
    const clean = value.trim();
    requireThat(clean.length >= 20, message);
    return clean;
}

function dependencyIds(entity: Entity) {
    const ids = text(entity.fields, 'dependencies').split(',').map(value => value.trim()).filter(Boolean);
    requireThat(ids.length > 0 && new Set(ids).size === ids.length, 'Choose at least one unique submittal dependency.');
    return ids;
}

function packageDependencies(entities: Entity[], entity: Entity) {
    return dependencyIds(entity).map(id => {
        const submittal = find(entities, id, 'submittal');
        const drawing = find(entities, text(submittal.fields, 'drawing'), 'drawing');
        requireThat(drawing.fields['contract'] === entity.fields['contract'], 'Every package submittal must belong to its contract.');
        return { submittal, drawing };
    });
}

function dependencyFingerprint(entities: Entity[], entity: Entity) {
    return JSON.stringify(packageDependencies(entities, entity).map(({ submittal, drawing }) =>
        [submittal.id, submittal.revision, submittal.status, drawing.id, drawing.revision, drawing.status]));
}

function requireCurrentReleasedDependencies(context: Context) {
    const dependencies = packageDependencies(context.state.entities, context.entity);
    requireThat(dependencies.every(({ submittal, drawing }) => submittal.status === 'released' && drawing.status === 'issued'
        && submittal.fields['drawingVersion'] === drawing.revision), 'Release every dependency against its current issued drawing.');
    return dependencies;
}

export const packageOperations: Operation[] = [
    {
        key: 'package-open', label: 'Open submittal package', kind: 'contract', from: ['active'], roles: [controller],
        fields: [field('scope', 'Package scope'), reference('dependencies', 'Required submittal IDs', 'submittal')],
        run: ({ state, entity, actor, input, add }) => {
            requireThat(!rows(state.entities, 'submittal-package').some(item => item.fields['contract'] === entity.id
                && !['completed', 'cancelled'].includes(item.status)), 'Contract already has an active submittal package.');
            const created = add('submittal-package', 'Package · ' + entity.title, { contract: entity.id,
                scope: detailed(text(input, 'scope'), 'Describe package scope in at least 20 characters.'),
                dependencies: text(input, 'dependencies'), owner: actor.id, evidence: 'Not pinned', approval: 'Awaiting review' });
            packageDependencies(state.entities, created);
            return 'Submittal package opened with explicit dependencies.';
        },
    },
    {
        key: 'package-submit', label: 'Submit submittal package', kind: 'submittal-package', from: ['draft'], roles: [controller],
        run: context => {
            requireThat(context.entity.fields['owner'] === context.actor.id, 'Only the package owner can submit it.');
            requireCurrentReleasedDependencies(context);
            context.entity.fields['evidence'] = dependencyFingerprint(context.state.entities, context.entity);
            context.entity.status = 'submitted';
            return 'Package submitted with pinned submittal and drawing evidence.';
        },
    },
    {
        key: 'package-approve', label: 'Approve submittal package', kind: 'submittal-package', from: ['submitted'], roles: [architect],
        fields: [field('review', 'Architect review')],
        run: context => {
            requireThat(context.entity.fields['owner'] !== context.actor.id, 'Package approval must be independent.');
            requireCurrentReleasedDependencies(context);
            requireThat(context.entity.fields['evidence'] === dependencyFingerprint(context.state.entities, context.entity),
                'Package dependencies changed. Return it for current evidence.');
            context.entity.fields['approval'] = context.actor.name + ' · ' + context.now + ' · '
                + detailed(text(context.input, 'review'), 'Provide 20 characters of architectural review evidence.');
            context.entity.status = 'approved';
            return 'Submittal package approved against pinned dependencies.';
        },
    },
    {
        key: 'package-release', label: 'Release submittal package', kind: 'submittal-package', from: ['approved'], roles: [executive],
        run: context => {
            requireCurrentReleasedDependencies(context);
            requireThat(context.entity.fields['evidence'] === dependencyFingerprint(context.state.entities, context.entity),
                'Package dependencies changed before release.');
            context.entity.status = 'released';
            return 'Approved package released for coordinated field work.';
        },
    },
    {
        key: 'package-inspection-schedule', label: 'Schedule package inspection', kind: 'submittal-package', from: ['released'], roles: [inspector],
        fields: [field('scheduledOn', 'Scheduled date', 'date')],
        run: ({ state, entity, actor, input, now, add }) => {
            requireThat(text(input, 'scheduledOn') >= now.slice(0, 10), 'Inspection cannot be scheduled in the past.');
            requireThat(!rows(state.entities, 'package-inspection').some(item => item.fields['package'] === entity.id
                && !['passed', 'cancelled'].includes(item.status)), 'Package already has an active inspection.');
            add('package-inspection', 'Inspection · ' + entity.title, { package: entity.id,
                scheduledOn: text(input, 'scheduledOn'), owner: actor.id, readiness: 'Awaiting field readiness', result: 'Not inspected' });
            return 'Field inspection scheduled for the released package.';
        },
    },
    {
        key: 'package-inspection-ready', label: 'Submit package inspection readiness', kind: 'package-inspection', from: ['scheduled', 'failed'], roles: [inspector],
        fields: [field('readiness', 'Readiness evidence')],
        run: ({ entity, actor, input }) => {
            requireThat(entity.fields['owner'] === actor.id, 'Only the inspection owner can submit readiness.');
            entity.fields['readiness'] = detailed(text(input, 'readiness'), 'Provide 20 characters of field readiness evidence.');
            entity.status = 'ready';
            return 'Package inspection submitted as ready.';
        },
    },
    {
        key: 'package-inspection-complete', label: 'Complete package inspection', kind: 'package-inspection', from: ['ready'], roles: [architect],
        fields: [{ ...field('result', 'Inspection result', 'select'), options: ['passed', 'failed'] }, field('note', 'Inspection note')],
        run: ({ state, entity, input }) => {
            const parent = find(state.entities, text(entity.fields, 'package'), 'submittal-package');
            requireThat(parent.status === 'released', 'Package must remain released during inspection.');
            entity.status = text(input, 'result');
            entity.fields['result'] = detailed(text(input, 'note'), 'Provide 20 characters of inspection evidence.');
            return entity.status === 'passed' ? 'Package inspection passed.' : 'Package inspection failed and requires new readiness evidence.';
        },
    },
    {
        key: 'package-complete', label: 'Complete released package', kind: 'submittal-package', from: ['released'], roles: [executive],
        run: ({ state, entity }) => {
            const inspections = rows(state.entities, 'package-inspection').filter(item => item.fields['package'] === entity.id);
            requireThat(inspections.length > 0 && inspections.every(item => item.status === 'passed'), 'Every package inspection must pass before completion.');
            entity.status = 'completed';
            return 'Submittal package completed with inspection evidence.';
        },
    },
];

export function requirePackagesReadyForHandoff(entities: Entity[], contractId: string) {
    requireThat(!rows(entities, 'submittal-package').some(item => item.fields['contract'] === contractId
        && !['completed', 'cancelled'].includes(item.status)), 'Complete or cancel every submittal package before handoff.');
}

export function validatePackages(entities: Entity[]) {
    for (const item of rows(entities, 'submittal-package')) {
        find(entities, text(item.fields, 'contract'), 'contract');
        packageDependencies(entities, item);
        if (['submitted', 'approved', 'released', 'completed'].includes(item.status))
            requireThat(text(item.fields, 'evidence') !== 'Not pinned', 'Submitted packages require dependency evidence.');
    }
    for (const inspection of rows(entities, 'package-inspection')) {
        const parent = find(entities, text(inspection.fields, 'package'), 'submittal-package');
        if (inspection.status === 'passed') requireThat(['released', 'completed'].includes(parent.status), 'Passed inspection requires a released package.');
    }
}
