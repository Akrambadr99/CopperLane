import { describe, expect, it } from 'vitest'
import { certifyPayment, netPayment, nextRevision, resolveReference, submitChangeOrder } from './revisions'
import { changeOrder, payment, references, revisions } from './fixtures'

describe('construction record integrity', () => {
  it('supersedes an approved drawing without rewriting history', () => {
    const next = nextRevision(revisions, 'A-401', 'C', 'ffff')
    expect(next.find((item) => item.revision === 'B')?.state).toBe('superseded')
    expect(resolveReference(next, references[0]!).revision).toBe('A')
    expect(nextRevision(revisions, 'NEW-1', 'A', 'aaaa').at(-1)?.supersedes).toBeUndefined()
  })
  it('rejects duplicate and missing revision identities', () => {
    expect(() => nextRevision(revisions, 'A-401', 'B', 'ffff')).toThrow(/exists/)
    expect(() => resolveReference(revisions, { ...references[0]!, revision: 'Z' })).toThrow(/missing/)
  })
  it('enforces change-order state and commercial authority', () => {
    expect(submitChangeOrder(changeOrder, 'Cost Controller').state).toBe('owner-review')
    expect(submitChangeOrder(changeOrder, 'Project Executive').approvals).toContain('Project Executive')
    expect(() => submitChangeOrder(changeOrder, 'Site Inspector')).toThrow(/authority/)
    expect(() => submitChangeOrder({ ...changeOrder, state: 'draft' }, 'Cost Controller')).toThrow(/pricing/)
  })
  it('enforces certification state, role, and retainage', () => {
    expect(netPayment(payment)).toBe(1125000)
    expect(() => certifyPayment(payment, 'Site Inspector')).toThrow(/Only/)
    expect(() => certifyPayment({ ...payment, state: 'submitted' }, 'Architect')).toThrow(/quantity/)
    expect(() => certifyPayment({ ...payment, certified: 1200000 }, 'Architect')).toThrow(/retainage/)
    expect(certifyPayment(payment, 'Architect').state).toBe('certified')
  })
})
