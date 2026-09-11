import type { ChangeOrder } from './revisions'

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
export function ImpactSheet({ order, onAdvance }: { order: ChangeOrder; onAdvance: () => void }) {
  return <section className="impact-sheet"><header><div><span>CHANGE ORDER</span><h2>{order.id}</h2><p>{order.description}</p></div><b>{order.state}</b></header><div className="impact-columns"><div><span>DIRECT COST</span><strong>{usd.format(order.costImpact)}</strong><small>Contractor priced</small></div><div><span>TIME IMPACT</span><strong>+{order.scheduleDays} days</strong><small>Critical path forecast</small></div><div><span>APPROVALS</span><strong>{order.approvals.length}</strong><small>of 2 required</small></div></div><footer><p>Advancing preserves the contractor price and creates an owner-review decision record.</p><button onClick={onAdvance}>Send to owner review</button></footer></section>
}
