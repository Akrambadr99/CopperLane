import { useState, type ReactNode } from 'react'
import { FieldReferenceList } from './document-control/FieldReferenceList'
import { changeOrder, payment, references, revisions as initialRevisions } from './document-control/fixtures'
import { ImpactSheet } from './document-control/ImpactSheet'
import { certifyPayment, nextRevision, submitChangeOrder, type ConstructionRole, type Revision } from './document-control/revisions'
import { RevisionLineage } from './document-control/RevisionLineage'

type Register = 'drawings' | 'field records' | 'submittals' | 'changes' | 'payments'
const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

function App() {
  const [register, setRegister] = useState<Register>('drawings')
  const [revisions, setRevisions] = useState<Revision[]>(initialRevisions)
  const [role, setRole] = useState<ConstructionRole>('Architect')
  const [message, setMessage] = useState('')

  function issueRevision() {
    try { setRevisions((current) => nextRevision(current, 'A-401', 'C', 'ee91')); setMessage('Revision C created. Field records remain pinned to the revisions used when recorded.') }
    catch (error) { setMessage(error instanceof Error ? error.message : 'The drawing revision could not be created.') }
  }
  function advanceChange() { try { submitChangeOrder(changeOrder, role); setMessage('Commercial review opened with cost and schedule impact preserved.') } catch (error) { setMessage(error instanceof Error ? error.message : 'The change order could not advance.') } }

  return <div className="construction-app"><header className="project-header"><div className="build-brand"><span>BL</span><div><strong>BuildLedger</strong><small>CAPITAL PROJECT CONTROLS</small></div></div><div className="project-name"><span>ACTIVE PROJECT</span><strong>Riverside Medical Center</strong><small>RMC-2027 · Construction</small></div><label>Signing role<select aria-label="Project role" value={role} onChange={(event) => { setRole(event.target.value as ConstructionRole) }}><option>Project Executive</option><option>Architect</option><option>Site Inspector</option><option>Cost Controller</option></select></label></header>
    <div className="project-ribbon"><span>Contract <strong>$12.35M</strong></span><span>Certified <strong>$7.84M</strong></span><span>Schedule <strong>62%</strong></span><span>Open changes <strong>3</strong></span></div>
    <nav className="register-tabs" aria-label="Project registers">{(['drawings', 'field records', 'submittals', 'changes', 'payments'] as Register[]).map((item) => <button key={item} aria-current={register === item ? 'page' : undefined} onClick={() => { setRegister(item) }}>{item}</button>)}</nav>
    <main>{message && <p className="project-message" role="status">{message}</p>}
      {register === 'drawings' && <><RegisterHeading code="DOC CONTROL" title="Drawing revision register" detail="Each revision has its own approval state, checksum, and historical references." action={<button onClick={issueRevision}>Issue A-401 Rev C</button>} /><RevisionLineage revisions={revisions} references={references} /><div className="document-register"><div><span>DOCUMENT</span><span>REVISION</span><span>STATE</span><span>SUPERSEDES</span><span>CHECKSUM</span></div>{revisions.map((revision) => <div key={`${revision.documentId}-${revision.revision}`}><strong>{revision.documentId}</strong><span>{revision.revision}</span><b>{revision.state}</b><span>{revision.supersedes ?? '—'}</span><code>{revision.checksum}</code></div>)}</div></>}
      {register === 'field records' && <><RegisterHeading code="FIELD INTEGRITY" title="Inspection & RFI references" detail="Records resolve the exact drawing revision used on site, including superseded issues." /><FieldReferenceList references={references} revisions={revisions} /></>}
      {register === 'submittals' && <><RegisterHeading code="REVIEW CHAIN" title="Submittal workflow" detail="Discipline reviews advance sequentially and preserve each response." /><div className="submittal-flow"><article className="done"><span>01</span><div><strong>Architectural review</strong><small>Mina Youssef · approved 12 Mar</small></div></article><i>→</i><article className="active"><span>02</span><div><strong>Structural review</strong><small>Rana Adel · due today</small></div></article><i>→</i><article><span>03</span><div><strong>MEP coordination</strong><small>Waiting</small></div></article></div></>}
      {register === 'changes' && <><RegisterHeading code="CONTRACT CONTROL" title="Change order impact" detail="Cost, contingency, and critical-path time move together through owner review." /><ImpactSheet order={changeOrder} onAdvance={advanceChange} /></>}
      {register === 'payments' && <><RegisterHeading code="PAYMENT CERTIFICATION" title="Application for payment" detail="Retainage and measured work cap the amount that can be certified." /><section className="payment-sheet"><header><div><span>PAYMENT APPLICATION</span><h2>{payment.id}</h2></div><b>{payment.state}</b></header><div><p>Gross work this period</p><strong>{usd.format(payment.gross)}</strong><p>Retainage withheld</p><strong>{usd.format(payment.gross * payment.retainageRate)}</strong><p>Proposed certification</p><strong>{usd.format(payment.certified)}</strong></div><button onClick={() => { try { certifyPayment(payment, role); setMessage('Payment certified with the retainage ceiling applied.') } catch (error) { setMessage(error instanceof Error ? error.message : 'Certification failed.') } }}>Certify application</button></section></>}
    </main></div>
}

function RegisterHeading({ code, title, detail, action }: { code: string; title: string; detail: string; action?: ReactNode }) { return <div className="register-heading"><div><span>{code}</span><h1>{title}</h1><p>{detail}</p></div>{action}</div> }
export default App
