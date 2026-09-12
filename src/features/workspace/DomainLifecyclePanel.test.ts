import { describe, expect, it } from 'vitest';
import type { Entity } from '../../workspace/types';
import { rfiAnswerGate } from './DomainLifecyclePanel';
const entity = (id: string, kind: string, status: string, fields: Entity['fields'] = {}): Entity => ({ id, kind, status, fields, title: id, revision: 1 });
describe('rfiAnswerGate', () => {
    it('requires issued drawing evidence and a specific response', () => expect(rfiAnswerGate(entity('d', 'drawing', 'draft'), [], 'short', true).blockers).toHaveLength(3));
    it('accepts an issued response with passed field evidence', () => expect(rfiAnswerGate(entity('d', 'drawing', 'issued'), [entity('i', 'inspection', 'passed', { drawing: 'd' })], 'Proceed to issued detail B.', true).ready).toBe(true));
});
