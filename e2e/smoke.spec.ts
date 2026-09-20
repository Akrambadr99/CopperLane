import{expect,test}from'@playwright/test';test('BuildLedger exposes routed enterprise workflows',async({page})=>{await page.goto('/');await expect(page.getByRole('heading',{name:'BuildLedger command center'})).toBeVisible();await page.getByRole('link',{name:'Operations'}).click();await expect(page.getByRole('region',{name:'Drawing revision comparison'})).toBeVisible();await page.getByRole('link',{name:'Workflows'}).click();await expect(page.getByRole('heading',{name:'Workflow catalog'})).toBeVisible();await page.getByRole('link',{name:'Data model'}).click();await expect(page.getByRole('heading',{name:'Connected data model'})).toBeVisible();await page.getByRole('link',{name:'Data tools'}).click();await expect(page.getByRole('heading',{name:'Import and recovery tools'})).toBeVisible();await page.getByRole('textbox',{name:'Workspace JSON'}).fill('{}');await page.getByRole('button',{name:'Preview import'}).click();await expect(page.getByRole('alert')).toContainText('not a compatible');await page.getByRole('link',{name:'Activity',exact:true}).click();await expect(page.getByRole('heading',{name:'Operational activity'})).toBeVisible()})

test('construction shell provides keyboard bypass and responsive workflow navigation',async({page})=>{await page.setViewportSize({width:640,height:800});await page.goto('/');const skip=page.getByRole('link',{name:'Skip to main content'});await skip.focus();await expect(skip).toBeFocused();await skip.press('Enter');await expect(page.locator('#main-content')).toBeFocused();await page.getByRole('link',{name:'RFI coordination'}).click();await expect(page.getByRole('heading',{name:'Multi-RFI coordination queue'})).toBeVisible();await expect(page.getByRole('navigation',{name:'Product navigation'})).toBeVisible();});

test('RFI rejection, revision and issue persist across reload', async ({ page }) => {
  await page.goto('/operations');
  const actor = page.getByRole('combobox', { name: 'Current actor' });
  const save = async () => { await page.getByRole('button', { name: 'Save command', exact: true }).click(); await expect(page.getByRole('dialog')).toHaveCount(0); };
  await actor.selectOption('actor-1');
  await page.getByRole('button', { name: /^Drawing revisions/ }).click();
  await page.getByRole('button', { name: 'Issue construction drawing', exact: true }).click();
  await save();
  await actor.selectOption('actor-2');
  await page.getByRole('button', { name: 'Open RFI', exact: true }).click();
  await page.getByLabel('RFI question', { exact: true }).fill('Confirm the structural connection at grid four.');
  await save();
  await page.getByRole('button', { name: /^Requests for information/ }).click();
  await page.getByRole('button', { name: 'Submit RFI', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Submit RFI', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Submit RFI', exact: true }).click();
  await save();
  await actor.selectOption('actor-1');
  await page.getByRole('button', { name: 'Reject RFI', exact: true }).click();
  await page.getByLabel('Rejection reason', { exact: true }).fill('Please clarify the proposed connection detail.');
  await save();
  await actor.selectOption('actor-2');
  await page.getByRole('button', { name: 'Revise RFI', exact: true }).click();
  await page.getByRole('combobox', { name: 'Referenced drawing', exact: true }).selectOption('drawing-1');
  await page.getByLabel('Revised question', { exact: true }).fill('Confirm detail four on the structural slab plan.');
  await save();
  await page.getByRole('button', { name: 'Submit RFI', exact: true }).click();
  await save();
  await actor.selectOption('actor-1');
  await page.getByRole('button', { name: 'Approve RFI', exact: true }).click();
  await page.getByLabel('Architect response', { exact: true }).fill('short');
  await page.getByRole('button', { name: 'Save command', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('specific architectural response');
  await page.getByLabel('Architect response', { exact: true }).fill('Use detail four on the issued slab plan.');
  await save();
  await page.getByRole('button', { name: 'Issue RFI response', exact: true }).click();
  await save();
  await expect(page.getByRole('status')).toContainText('RFI response issued');
  await page.reload();
  await page.getByRole('button', { name: /^Requests for information/ }).click();
  await expect(page.locator('.detail-title')).toContainText('issued');
  await expect(page.locator('.detail')).toContainText('Use detail four on the issued slab plan.');
});

test('issued RFI response creates one successor against the current drawing revision', async ({ page }) => {
  await page.goto('/operations');
  const actor = page.getByRole('combobox', { name: 'Current actor' });
  const dialog = page.getByRole('dialog');
  const save = async () => { await dialog.getByRole('button', { name: 'Save command', exact: true }).click(); await expect(dialog).toHaveCount(0); };
  await actor.selectOption('actor-1');
  await page.getByRole('button', { name: /^Drawing revisions/ }).click();
  await page.getByRole('button', { name: 'Issue construction drawing', exact: true }).click(); await save();
  await actor.selectOption('actor-2');
  await page.getByRole('button', { name: 'Open RFI', exact: true }).click();
  await dialog.getByLabel('RFI question', { exact: true }).fill('Confirm the current structural connection detail.'); await save();
  await page.getByRole('button', { name: /^Requests for information/ }).click();
  await page.getByRole('button', { name: 'Submit RFI', exact: true }).click(); await save();
  await actor.selectOption('actor-1');
  await page.getByRole('button', { name: 'Approve RFI', exact: true }).click();
  await dialog.getByLabel('Architect response', { exact: true }).fill('Use detail four on drawing revision A.'); await save();
  await page.getByRole('button', { name: 'Issue RFI response', exact: true }).click(); await save();
  await page.getByRole('button', { name: /^Drawing revisions/ }).click();
  await page.getByRole('button', { name: 'Create drawing revisions', exact: true }).click();
  await dialog.getByLabel('Record title', { exact: true }).fill('Structural slab plan · B');
  await dialog.getByRole('combobox', { name: 'Contract', exact: true }).selectOption('contract-1');
  await dialog.getByLabel('Document number', { exact: true }).fill('STR-201');
  await dialog.getByLabel('Revision', { exact: true }).fill('B');
  await dialog.getByLabel('Content checksum', { exact: true }).fill('sha256:59ad'); await save();
  await page.getByRole('button', { name: /^Structural slab plan · B/ }).click();
  await page.getByRole('button', { name: 'Issue construction drawing', exact: true }).click(); await save();
  await page.getByRole('button', { name: /^Requests for information/ }).click();
  await page.getByRole('button', { name: /^RFI · Structural slab plan/ }).click();
  await page.getByRole('button', { name: 'Supersede issued RFI response', exact: true }).click();
  await dialog.getByRole('combobox', { name: 'Current drawing revision', exact: true }).selectOption({ label: 'Structural slab plan · B' });
  await dialog.getByLabel('Supersession reason', { exact: true }).fill('Drawing B changes the structural connection.'); await save();
  await expect(page.locator('.detail-title')).toContainText('superseded');
  await page.reload(); await page.getByRole('button', { name: /^Requests for information/ }).click();
  await expect(page.locator('.list .row')).toHaveCount(2);
  await page.getByRole('button', { name: /^RFI revision/ }).click();
  await expect(page.locator('.detail')).toContainText('Structural slab plan · B');
  await expect(page.locator('.detail')).toContainText('Previous RFI response');
});


test('handoff rejects stale evidence, renews, closes and revokes durably', async ({ page }) => {
  await page.goto('/operations');
  const actor = page.getByRole('combobox', {name: 'Current actor'});
  const gate = page.getByRole('region', {name: 'Construction handoff gate'});
  const dialog = page.getByRole('dialog');
  const save = async () => { await dialog.getByRole('button', {name: 'Save command', exact: true}).click(); await expect(dialog).toHaveCount(0); };
  await actor.selectOption('actor-1');
  await page.getByRole('button', {name: /^Drawing revisions/}).click();
  await page.getByRole('button', {name: 'Issue construction drawing', exact: true}).click(); await save();
  await actor.selectOption('actor-2');
  await gate.getByRole('button', {name: 'Request contract handoff', exact: true}).click();
  await dialog.getByLabel('Handoff note', {exact: true}).fill('All field evidence checked for practical completion.');
  await dialog.getByRole('button', {name: 'Save command', exact: true}).click();
  await expect(dialog.getByRole('alert')).toContainText('passed field inspection');
  await page.keyboard.press('Escape');
  await page.getByRole('button', {name: /^Field inspections/}).click();
  await page.getByRole('button', {name: 'Create field inspections', exact: true}).click();
  await dialog.getByLabel('Record title', {exact: true}).fill('Handoff slab inspection');
  await dialog.getByRole('combobox', {name: 'Drawing revision', exact: true}).selectOption('drawing-1');
  await dialog.getByLabel('Field observation', {exact: true}).fill('Verified slab matches issued drawing.'); await save();
  await page.getByRole('button', {name: 'Complete field inspection', exact: true}).click(); await save();
  await gate.getByRole('button', {name: 'Request contract handoff', exact: true}).click();
  await dialog.getByLabel('Handoff note', {exact: true}).fill('All field evidence checked for practical completion.'); await save();
  await actor.selectOption('actor-3');
  await page.getByRole('button', {name: /^Change orders/}).click();
  await page.getByRole('button', {name: 'Complete contractor pricing', exact: true}).click(); await save();
  await actor.selectOption('actor-0');
  await gate.getByRole('button', {name: 'Approve contract handoff', exact: true}).click();
  await dialog.getByRole('button', {name: 'Save command', exact: true}).click();
  await expect(dialog.getByRole('alert')).toContainText('evidence changed');
  await page.keyboard.press('Escape');
  await gate.getByRole('button', {name: 'Cancel handoff request', exact: true}).click(); await save();
  await actor.selectOption('actor-2');
  await gate.getByRole('button', {name: 'Request contract handoff', exact: true}).click();
  await dialog.getByLabel('Handoff note', {exact: true}).fill('Updated commercial evidence reviewed for handoff.'); await save();
  await actor.selectOption('actor-0');
  await gate.getByRole('button', {name: 'Approve contract handoff', exact: true}).click(); await save();
  await page.reload();
  await expect(gate).toContainText('approved');
  await gate.getByRole('button', {name: 'Revoke contract handoff', exact: true}).click();
  await dialog.getByLabel('Revocation reason', {exact: true}).fill('New field defect requires reopening this contract.'); await save();
  await page.reload();
  await expect(gate).toContainText('revoked');
  await expect(page.locator('.detail-title')).toContainText('active');
});

test('submittal rejection, revised evidence and executive release survive reload', async ({ page }) => {
  await page.goto('/operations');
  const actor = page.getByRole('combobox', { name: 'Current actor' });
  const dialog = page.getByRole('dialog');
  const save = async () => { await dialog.getByRole('button', { name: 'Save command', exact: true }).click(); await expect(dialog).toHaveCount(0); };
  await actor.selectOption('actor-1');
  await page.getByRole('button', { name: /^Drawing revisions/ }).click();
  await page.getByRole('button', { name: 'Issue construction drawing', exact: true }).click();
  await save();
  await actor.selectOption('actor-2');
  await page.getByRole('button', { name: 'Open submittal', exact: true }).click();
  await dialog.getByLabel('Submittal narrative', { exact: true }).fill('Slab material certification and installation evidence.');
  await save();
  await page.getByRole('button', { name: /^Submittals/ }).click();
  await page.getByRole('button', { name: 'Submit submittal', exact: true }).click();
  await save();
  await actor.selectOption('actor-1');
  await page.getByRole('button', { name: 'Reject submittal', exact: true }).click();
  await dialog.getByLabel('Submittal narrative', { exact: true }).fill('Add the missing certification for the slab material.');
  await save();
  await actor.selectOption('actor-2');
  await page.getByRole('button', { name: 'Revise submittal', exact: true }).click();
  await dialog.getByRole('combobox', { name: 'Submittal drawing', exact: true }).selectOption('drawing-1');
  await dialog.getByLabel('Submittal narrative', { exact: true }).fill('Updated package includes the requested material certification.');
  await save();
  await page.getByRole('button', { name: 'Submit submittal', exact: true }).click();
  await save();
  await actor.selectOption('actor-1');
  await page.getByRole('button', { name: 'Approve submittal review', exact: true }).click();
  await dialog.getByLabel('Submittal narrative', { exact: true }).fill('Certification matches the issued slab detail and specification.');
  await save();
  await actor.selectOption('actor-0');
  await page.getByRole('button', { name: 'Release reviewed submittal', exact: true }).click();
  await save();
  await page.reload();
  await page.getByRole('button', { name: /^Submittals/ }).click();
  await expect(page.locator('.detail-title')).toContainText('released');
  await expect(page.getByText('Submittal rejected for revision:', { exact: false }).last()).toBeVisible();
});

test('punch correction requires independent verification and survives reload', async ({ page }) => {
  await page.goto('/operations');
  const actor = page.getByRole('combobox', { name: 'Current actor' });
  const dialog = page.getByRole('dialog');
  const save = async () => { await dialog.getByRole('button', { name: 'Save command', exact: true }).click(); await expect(dialog).toHaveCount(0); };
  await actor.selectOption('actor-1');
  await page.getByRole('button', { name: /^Drawing revisions/ }).click();
  await page.getByRole('button', { name: 'Issue construction drawing', exact: true }).click(); await save();
  await actor.selectOption('actor-2');
  await page.getByRole('button', { name: 'Open punch list item', exact: true }).click();
  await dialog.getByLabel('Defect description', { exact: true }).fill('Anchor bolts do not match the issued slab detail.');
  await dialog.getByLabel('Correction due', { exact: true }).fill('2026-09-20'); await save();
  await page.getByRole('button', { name: /^Punch list items/ }).click();
  await actor.selectOption('actor-3');
  await page.getByRole('button', { name: 'Submit punch correction', exact: true }).click();
  await dialog.getByLabel('Resolution evidence', { exact: true }).fill('Contractor replaced the bolts and uploaded a signed torque report.'); await save();
  await actor.selectOption('actor-2');
  await page.getByRole('button', { name: 'Verify punch correction', exact: true }).click();
  await dialog.getByLabel('Verification note', { exact: true }).fill('Site inspection confirms the correction matches the issued detail.'); await save();
  await page.reload();
  await page.getByRole('button', { name: /^Punch list items/ }).click();
  await expect(page.locator('.detail-title')).toContainText('verified');
  await expect(page.locator('.detail')).toContainText('signed torque report');
});

test('released submittal package completes only after its field inspection passes',async({page})=>{
 await page.goto('/operations');const actor=page.getByRole('combobox',{name:'Current actor'}),dialog=page.getByRole('dialog');
 const save=async()=>{await dialog.getByRole('button',{name:'Save command',exact:true}).click();await expect(dialog).toHaveCount(0)};
 await actor.selectOption('actor-1');await page.getByRole('button',{name:/^Drawing revisions/}).click();await page.getByRole('button',{name:'Issue construction drawing'}).click();await save();
 await actor.selectOption('actor-2');await page.getByRole('button',{name:'Open submittal'}).click();await dialog.getByLabel('Submittal narrative').fill('Structural slab material and installation evidence package.');await save();
 await page.getByRole('button',{name:/^Submittals/}).click();await page.getByRole('button',{name:'Submit submittal'}).click();await save();
 await actor.selectOption('actor-1');await page.getByRole('button',{name:'Approve submittal review'}).click();await dialog.getByLabel('Submittal narrative').fill('Package evidence matches the current issued structural drawing.');await save();
 await actor.selectOption('actor-0');await page.getByRole('button',{name:'Release reviewed submittal'}).click();await save();
 await actor.selectOption('actor-3');await page.getByRole('button',{name:/^Contracts/}).click();await page.getByRole('button',{name:'Open submittal package'}).click();
 await dialog.getByLabel('Package scope').fill('Structural slab material and coordinated installation release.');await dialog.getByLabel('Required submittal IDs').selectOption({index:1});await save();
 await page.getByRole('button',{name:/^Submittal packages/}).click();await page.getByRole('button',{name:'Submit submittal package'}).click();await save();
 await actor.selectOption('actor-1');await page.getByRole('button',{name:'Approve submittal package'}).click();await dialog.getByLabel('Architect review').fill('Dependencies satisfy the coordinated architectural release requirements.');await save();
 await actor.selectOption('actor-0');await page.getByRole('button',{name:'Release submittal package'}).click();await save();
 await actor.selectOption('actor-2');await page.getByRole('button',{name:'Schedule package inspection'}).click();await dialog.getByLabel('Scheduled date').fill('2026-09-20');await save();
 await page.getByRole('button',{name:/^Package inspections/}).click();await page.getByRole('button',{name:'Submit package inspection readiness'}).click();await dialog.getByLabel('Readiness evidence').fill('Installed work and signed field checklist are available.');await save();
 await actor.selectOption('actor-1');await page.getByRole('button',{name:'Complete package inspection'}).click();await dialog.getByLabel('Inspection result').selectOption('passed');await dialog.getByLabel('Inspection note').fill('Field work matches the released coordinated package evidence.');await save();
 await actor.selectOption('actor-0');await page.getByRole('button',{name:/^Submittal packages/}).click();await page.getByRole('button',{name:'Complete released package'}).click();await save();await page.reload();
 await page.getByRole('button',{name:/^Submittal packages/}).click();await expect(page.locator('.detail-title')).toContainText('completed');await expect(page.locator('.detail')).toContainText('package-inspection · passed');
});

test('verified commercial evidence controls payment review certification and disbursement',async({page})=>{
 await page.goto('/operations');const actor=page.getByRole('combobox',{name:'Current actor'}),dialog=page.getByRole('dialog');const save=async()=>{await dialog.getByRole('button',{name:'Save command',exact:true}).click();await expect(dialog).toHaveCount(0)};
 await actor.selectOption('actor-3');await page.getByRole('button',{name:/^Payment applications/}).click();await page.getByRole('button',{name:'Create payment applications'}).click();
 await dialog.getByLabel('Record title').fill('August progress application');await dialog.getByLabel('Contract').selectOption('contract-1');await dialog.getByLabel('Gross amount (cents)').fill('2500000');await dialog.getByLabel('Retainage percent').fill('10');await save();
 await page.getByRole('button',{name:'Prepare payment evidence'}).click();await dialog.getByLabel('Lien waiver evidence').fill('Signed conditional lien waiver for August progress.');await dialog.getByLabel('Installed progress evidence').fill('Measured slab installation reached the approved quantity.');await save();
 await page.getByRole('button',{name:/^Payment evidence/}).click();await actor.selectOption('actor-1');await page.getByRole('button',{name:'Verify payment evidence'}).click();await dialog.getByLabel('Evidence review').fill('Measured quantities and waiver evidence reconcile to the application.');await save();
 await page.getByRole('button',{name:/^Payment applications/}).click();await actor.selectOption('actor-3');await page.getByRole('button',{name:'Review measured quantities'}).click();await save();
 await actor.selectOption('actor-1');await page.getByRole('button',{name:'Certify payment'}).click();await save();await actor.selectOption('actor-0');await page.getByRole('button',{name:'Disburse certified payment'}).click();await dialog.getByLabel('Disbursement reference').fill('Bank instruction BL-2026-08-001 was confirmed for release.');await save();await page.reload();
 await page.getByRole('button',{name:/^Payment applications/}).click();await expect(page.locator('.detail-title')).toContainText('paid');await expect(page.locator('.detail')).toContainText('Certified payment disbursed with verified evidence retained');
});

test('field coordination resolution requires owner proposal architectural review and executive closure',async({page})=>{
 await page.goto('/operations');const actor=page.getByRole('combobox',{name:'Current actor'}),dialog=page.getByRole('dialog');const save=async()=>{await dialog.getByRole('button',{name:'Save command',exact:true}).click();await expect(dialog).toHaveCount(0)};
 await actor.selectOption('actor-1');await page.getByRole('button',{name:/^Drawing revisions/}).click();await page.getByRole('button',{name:'Issue construction drawing'}).click();await save();
 await actor.selectOption('actor-2');await page.getByRole('button',{name:'Open field coordination issue'}).click();await dialog.getByLabel('Coordination zone').fill('North plant room service corridor');await dialog.getByLabel('Coordination issue').fill('Electrical tray conflicts with the released pipe elevation.');await save();
 await page.getByRole('button',{name:/^Field coordination issues/}).click();await page.getByRole('button',{name:'Submit coordination resolution'}).click();await dialog.getByLabel('Resolution proposal').fill('Raise the tray and preserve the required pipe maintenance clearance.');await save();
 await actor.selectOption('actor-1');await page.getByRole('button',{name:'Review coordination resolution'}).click();await dialog.getByLabel('Coordination decision').selectOption('approved');await dialog.getByLabel('Decision evidence').fill('Revised elevation preserves access and structural clearances.');await save();
 await actor.selectOption('actor-0');await page.getByRole('button',{name:'Close coordination issue'}).click();await save();await page.reload();await page.getByRole('button',{name:/^Field coordination issues/}).click();
 await expect(page.locator('.detail-title')).toContainText('closed');await expect(page.locator('.detail')).toContainText('Approved coordination issue closed with its history preserved.');
});
test('assessed delay entitlement updates the programme against its pinned version',async({page})=>{await page.goto('/schedule-claims');const role=page.getByRole('combobox',{name:'Claim role'});await page.getByRole('button',{name:'Notify project delay'}).click();await role.selectOption('Project Controls');await page.getByRole('button',{name:'Assess delay entitlement'}).click();await role.selectOption('Architect');await page.getByRole('button',{name:'Approve delay entitlement'}).click();await role.selectOption('Executive');await page.getByRole('button',{name:'Incorporate approved delay'}).click();await expect(page.getByRole('status')).toContainText('updated');await page.reload();await expect(page.getByRole('heading',{name:'Completion 2026-12-21'})).toBeVisible();await expect(page.getByRole('list',{name:'Schedule claim history'})).toContainText('delay-incorporated')});
test('linked design change updates contract forecast and programme together',async({page})=>{await page.goto('/change-impact');const role=page.getByRole('combobox',{name:'Change role'});await page.getByRole('button',{name:'Create linked change draft'}).click();await page.getByRole('button',{name:'Submit change request'}).click();await role.selectOption('Cost Engineer');await page.getByRole('button',{name:'Assess cost and delay'}).click();await role.selectOption('Project Manager');await page.getByRole('button',{name:'Approve change impact'}).click();await role.selectOption('Executive');await page.getByRole('button',{name:'Incorporate approved change'}).click();await expect(page.getByRole('status')).toContainText('updated');await page.reload();await expect(page.getByText(/Forecast 4140000/)).toBeVisible();await expect(page.getByText(/Completion 2026-12-25/)).toBeVisible();await expect(page.getByRole('region',{name:'Change impact history'})).toContainText('change-incorporated')});
test('certified payment retains funds and posts an immutable disbursement',async({page})=>{await page.goto('/payment-release');const role=page.getByRole('combobox',{name:'Payment role'});await page.getByRole('button',{name:'Create payment application'}).click();await page.getByRole('button',{name:'Submit application with waiver'}).click();await role.selectOption('Quantity Surveyor');await page.getByRole('button',{name:'Measure payment application'}).click();await role.selectOption('Site Inspector');await page.getByRole('button',{name:'Verify installed work'}).click();await role.selectOption('Project Manager');await page.getByRole('button',{name:'Approve payment certificate'}).click();await role.selectOption('Finance');await page.getByRole('button',{name:'Release certified payment'}).click();await page.reload();await expect(page.getByText(/Application released · paid 490000 · subcontract version 9/)).toBeVisible();await expect(page.getByText(/Ledger certified 500000 · paid 490000/)).toBeVisible();await expect(page.getByText('1 immutable disbursements')).toBeVisible();await expect(page.getByRole('list',{name:'Payment release history'})).toContainText('certified-payment-released')});

test('executes subcontract procurement through mobilization', async ({ page }) => { await page.goto('/subcontract-procurement'); await page.getByRole('button', { name: 'Open procurement' }).click(); await page.getByLabel('Procurement role').selectOption('Commercial Analyst'); await page.getByRole('button', { name: 'Level compliant bids' }).click(); await page.getByLabel('Procurement role').selectOption('Project Director'); await page.getByRole('button', { name: 'Approve award' }).click(); await page.getByLabel('Procurement role').selectOption('Contract Administrator'); await page.getByRole('button', { name: 'Issue subcontract' }).click(); await page.getByLabel('Procurement role').selectOption('Package Manager'); await page.getByRole('button', { name: 'Issue notice to proceed' }).click(); await expect(page.getByRole('status')).toContainText('Notice to proceed issued'); await expect(page.getByText(/Nova Electrical.*active/)).toBeVisible(); });

test('publishes an independently approved cost forecast',async({page})=>{await page.goto('/cost-forecast');await page.getByRole('button',{name:'Draft cost forecast'}).click();await page.getByLabel('Forecast role').selectOption('Package Manager');await page.getByRole('button',{name:'Validate package commitments'}).click();await page.getByLabel('Forecast role').selectOption('Project Director');await page.getByRole('button',{name:'Approve cost forecast'}).click();await page.getByLabel('Forecast role').selectOption('Finance Controller');await page.getByRole('button',{name:'Publish cost forecast'}).click();await expect(page.getByRole('status')).toContainText('Cost forecast published');await expect(page.getByText(/1 immutable forecast snapshots/)).toBeVisible();});

test('releases and accepts a tested concrete pour',async({page})=>{await page.goto('/permit-to-pour');const role=page.getByLabel('Pour role');await page.getByRole('button',{name:'Draft pour permit'}).click();await role.selectOption('Quality Inspector');await page.getByRole('button',{name:'Pass pre-pour inspection'}).click();await role.selectOption('Design Reviewer');await page.getByRole('button',{name:'Clear design revision'}).click();await role.selectOption('Construction Manager');await page.getByRole('button',{name:'Release concrete pour'}).click();await role.selectOption('Site Engineer');await page.getByRole('button',{name:'Record concrete placement'}).click();await role.selectOption('Laboratory Technician');await page.getByRole('button',{name:'Accept cube result'}).click();await expect(page.getByRole('status')).toContainText('Structural element accepted');await expect(page.getByText(/SLAB-L04-ZB · accepted/)).toBeVisible();});
test('certifies handover and releases governed practical-completion retention',async({page})=>{await page.goto('/practical-completion');const role=page.getByLabel('Completion role');await page.getByRole('button',{name:'Open completion inspection'}).click();await role.selectOption('Architect');await page.getByRole('button',{name:'Record completion snags'}).click();await role.selectOption('Package Manager');await page.getByRole('button',{name:'Rectify completion snags'}).click();await role.selectOption('Architect');await page.getByRole('button',{name:'Verify completion snags'}).click();await role.selectOption('Contract Administrator');await page.getByRole('button',{name:'Certify practical completion'}).click();await role.selectOption('Client Representative');await page.getByRole('button',{name:'Accept project handover'}).click();await role.selectOption('Finance');await page.getByRole('button',{name:'Release completion retention'}).click();await role.selectOption('Architect');await page.getByRole('button',{name:'Certify defects liability completion'}).click();await role.selectOption('Finance');await page.getByRole('button',{name:'Release final retention'}).click();await role.selectOption('Commercial Manager');await page.getByRole('button',{name:'Reconcile final account'}).click();await expect(page.getByRole('status')).toContainText('commercial closeout completed');await expect(page.getByText(/Project closed · package complete · snags 2/)).toBeVisible();await expect(page.getByText(/Retention released 120000\/120000 · evidence 8/)).toBeVisible();});
test('stops work and reissues its permit after verified incident recovery',async({page})=>{await page.goto('/safety-incident');const role=page.getByLabel('Safety role');await page.getByRole('button',{name:'Report safety incident'}).click();await expect(page.getByText(/Work stopped · permit suspended · evidence 1/)).toBeVisible();await role.selectOption('Safety Investigator');await page.getByRole('button',{name:'Investigate safety incident'}).click();await role.selectOption('Safety Manager');await page.getByRole('button',{name:'Approve corrective action'}).click();await role.selectOption('Site Supervisor');await page.getByRole('button',{name:'Implement corrective action'}).click();await role.selectOption('Safety Auditor');await page.getByRole('button',{name:'Verify safety recovery'}).click();await role.selectOption('Permit Issuer');await page.getByRole('button',{name:'Reissue work permit'}).click();await page.reload();await expect(page.getByText(/ZONE-L04 · closed/)).toBeVisible();await expect(page.getByText(/Work working · permit active · evidence 5/)).toBeVisible();});
test('traces approved construction material into its verified installed location',async({page})=>{await page.goto('/material-traceability');const role=page.getByLabel('Material trace role');await page.getByRole('button',{name:'Draft material submittal'}).click();await role.selectOption('Design Reviewer');await page.getByRole('button',{name:'Approve material submittal'}).click();await role.selectOption('Procurement Manager');await page.getByRole('button',{name:'Release material purchase'}).click();await role.selectOption('Site Inspector');await page.getByRole('button',{name:'Inspect material delivery'}).click();await role.selectOption('Site Engineer');await page.getByRole('button',{name:'Record material installation'}).click();await role.selectOption('Quality Manager');await page.getByRole('button',{name:'Verify material traceability'}).click();await expect(page.getByRole('status')).toContainText('traceability verified');await page.reload();await expect(page.getByText(/REBAR-L04 · verified/)).toBeVisible();await expect(page.getByText(/Delivery installed · batch HEAT-BATCH-778 · accepted 24 tonnes/)).toBeVisible();await expect(page.getByText(/Installed location SLAB-L04-ZB · immutable evidence 5/)).toBeVisible();});
test('commits an assessed subcontract variation before releasing instructed work',async({page})=>{await page.goto('/subcontract-variations');const role=page.getByLabel('Variation role');await page.getByRole('button',{name:'Issue site instruction'}).click();await role.selectOption('Subcontractor');await page.getByRole('button',{name:'Submit variation quotation'}).click();await role.selectOption('Quantity Surveyor');await page.getByRole('button',{name:'Assess variation quotation'}).click();await role.selectOption('Commercial Manager');await page.getByRole('button',{name:'Approve subcontract variation'}).click();await role.selectOption('Project Director');await page.getByRole('button',{name:'Commit subcontract variation'}).click();await role.selectOption('Contract Administrator');await page.getByRole('button',{name:'Release variation work'}).click();await expect(page.getByRole('status')).toContainText('work released');await page.reload();await expect(page.getByText(/SUBCON-44 · released/)).toBeVisible();await expect(page.getByText(/Commitment 530000 · forecast 530000 · contingency 20000/)).toBeVisible();await expect(page.getByText(/Completion 2026-12-22 · delay 2 days/)).toBeVisible();await expect(page.getByText(/Assessed 30000 · immutable evidence 6/)).toBeVisible();});
test('preserves drawing selection and issues one instruction for two coordinated RFIs',async({page})=>{await page.goto('/rfi-coordination');await page.getByLabel('RFI filter').selectOption('drawing-a401');await page.getByLabel('Select RFI-201').check();await page.getByLabel('Select RFI-202').check();await page.getByLabel('RFI coordination role').selectOption('Document Controller');await page.getByRole('button',{name:'Refresh coordinated drawing'}).click();await expect(page.getByLabel('Select RFI-201')).toBeChecked();await page.getByLabel('RFI coordination role').selectOption('Site Engineer');await page.getByRole('button',{name:'Create coordinated response'}).click();await page.getByLabel('RFI coordination role').selectOption('Design Lead');await page.getByRole('button',{name:'Approve coordinated response'}).click();await page.getByLabel('RFI coordination role').selectOption('Contract Administrator');await page.getByRole('button',{name:'Issue linked field instruction'}).click();await expect(page.getByRole('status')).toContainText('instruction issued');await page.reload();await expect(page.getByText(/RESPONSE-A401-7 · issued/)).toBeVisible();await expect(page.getByText(/Selected RFIs 0 · field instructions 1/)).toBeVisible();await expect(page.getByText('A-401 rev 7',{exact:true})).toBeVisible();});
test('releases two jointly inspected packages and unblocks their successors',async({page})=>{await page.goto('/inspection-release');await page.getByLabel('Work package filter').selectOption('ready');await page.getByLabel('Select PKG-SLAB-41').check();await page.getByLabel('Select PKG-SLAB-42').check();await page.getByLabel('Inspection release role').selectOption('Document Controller');await page.getByRole('button',{name:'Refresh inspection readiness'}).click();await expect(page.getByLabel('Select PKG-SLAB-41')).toBeChecked();await page.getByLabel('Inspection release role').selectOption('Site Engineer');await page.getByRole('button',{name:'Request joint inspection'}).click();await page.getByLabel('Inspection release role').selectOption('Quality Manager');await page.getByRole('button',{name:'Assign joint inspector'}).click();await page.getByLabel('Inspection release role').selectOption('Site Inspector');await page.getByRole('button',{name:'Record joint inspection'}).click();await page.getByLabel('Inspection release role').selectOption('Design Reviewer');await page.getByRole('button',{name:'Approve inspection release'}).click();await page.getByLabel('Inspection release role').selectOption('Construction Manager');await page.getByRole('button',{name:'Release inspected packages'}).click();await expect(page.getByRole('status')).toContainText('successors ready');await page.reload();await expect(page.getByText(/INSPECTION-L04-41 · released/)).toBeVisible();await expect(page.getByText(/Ready successors 2 · immutable evidence 4/)).toBeVisible();await expect(page.getByText(/Inspector inspector-a · reviewer design-a/)).toBeVisible();});
test('closes two remediated NCRs and releases their held work packages',async({page})=>{await page.goto('/nonconformance-control');await page.getByLabel('NCR filter').selectOption('open');await page.getByLabel('Select NCR-401').check();await page.getByLabel('Select NCR-402').check();await page.getByLabel('NCR role').selectOption('Document Controller');await page.getByRole('button',{name:'Refresh NCR specifications'}).click();await expect(page.getByLabel('Select NCR-401')).toBeChecked();await page.getByLabel('NCR role').selectOption('Site Engineer');await page.getByRole('button',{name:'Open remediation batch'}).click();await page.getByLabel('NCR role').selectOption('Subcontractor');await page.getByRole('button',{name:'Submit coordinated remedy'}).click();await page.getByLabel('NCR role').selectOption('Quality Manager');await page.getByRole('button',{name:'Approve coordinated remedy'}).click();await page.getByLabel('NCR role').selectOption('Site Inspector');await page.getByRole('button',{name:'Pass NCR reinspection'}).click();await page.getByLabel('NCR role').selectOption('Construction Manager');await page.getByRole('button',{name:'Close NCR batch'}).click();await expect(page.getByRole('status')).toContainText('held packages released');await page.reload();await expect(page.getByText(/NCR-REMEDY-WALL-11 · closed/)).toBeVisible();await expect(page.getByText(/Specification feed 11 · selected NCRs 0/)).toBeVisible();await expect(page.getByText(/Released packages 3 · ready successors 3/)).toBeVisible();await expect(page.getByText(/Immutable evidence 9/)).toBeVisible();});

test('BuildLedger second-pass workflows use contextual master detail disclosure',async({page})=>{await page.setViewportSize({width:820,height:900});for(const [path,queue,detail,stages,history] of [['/inspection-release','Work package results','Joint inspection','Joint inspection stages','Inspection release history'],['/nonconformance-control','Nonconformance register','NCR remediation batch','NCR remediation batch stages','NCR history']] as const){await page.goto(path);await expect(page.getByRole('region',{name:queue})).toBeVisible();await expect(page.getByRole('complementary',{name:detail})).toBeVisible();await expect(page.getByRole('list',{name:stages})).toBeVisible();const disclosure=page.getByRole('region',{name:history}).locator('details');await expect(disclosure).not.toHaveAttribute('open','');await disclosure.locator('summary').click();await expect(disclosure).toHaveAttribute('open','');}});

test('returns a subcontract assessment for correction and preserves its evidence trail',async({page})=>{await page.goto('/subcontract-variations');const role=page.getByLabel('Variation role');await page.getByRole('button',{name:'Issue site instruction'}).click();await role.selectOption('Subcontractor');await page.getByRole('button',{name:'Submit variation quotation'}).click();await role.selectOption('Quantity Surveyor');await page.getByRole('button',{name:'Assess variation quotation'}).click();await role.selectOption('Commercial Manager');await page.getByRole('button',{name:'Return assessment for correction'}).click();await expect(page.getByRole('status')).toContainText('returned for correction');await expect(page.getByText(/SUBCON-44 · quoted/)).toBeVisible();await expect(page.getByText(/Assessed 0 · immutable evidence 4/)).toBeVisible();await role.selectOption('Quantity Surveyor');await page.getByRole('button',{name:'Assess variation quotation'}).click();await expect(page.getByText(/Assessed 30000 · immutable evidence 5/)).toBeVisible();await page.reload();await expect(page.getByText('assessment-return · Labour build-up needs subcontract rate evidence.')).toBeVisible();});

test('withdraws and revises an approved payment certificate before release',async({page})=>{await page.goto('/payment-release');const role=page.getByLabel('Payment role');await page.getByRole('button',{name:'Create payment application'}).click();await page.getByRole('button',{name:'Submit application with waiver'}).click();await role.selectOption('Quantity Surveyor');await page.getByRole('button',{name:'Measure payment application'}).click();await role.selectOption('Site Inspector');await page.getByRole('button',{name:'Verify installed work'}).click();await role.selectOption('Project Manager');await page.getByRole('button',{name:'Approve payment certificate'}).click();await page.getByRole('button',{name:'Withdraw payment certificate'}).click();await expect(page.getByText(/Application withdrawn/)).toBeVisible();await expect(page.getByText(/Ledger certified 300000/)).toBeVisible();await role.selectOption('Subcontractor');await page.getByRole('button',{name:'Revise withdrawn application'}).click();await page.reload();await expect(page.getByText(/Application draft/)).toBeVisible();await expect(page.getByRole('list',{name:'Payment release history'})).toContainText('payment-certificate-withdrawn');});

test('released variation rebases an open payment application',async({page})=>{await page.goto('/subcontract-variations');const vr=page.getByLabel('Variation role');await page.getByRole('button',{name:'Issue site instruction'}).click();await vr.selectOption('Subcontractor');await page.getByRole('button',{name:'Submit variation quotation'}).click();await vr.selectOption('Quantity Surveyor');await page.getByRole('button',{name:'Assess variation quotation'}).click();await vr.selectOption('Commercial Manager');await page.getByRole('button',{name:'Approve subcontract variation'}).click();await vr.selectOption('Project Director');await page.getByRole('button',{name:'Commit subcontract variation'}).click();await vr.selectOption('Contract Administrator');await page.getByRole('button',{name:'Release variation work'}).click();await page.goto('/payment-release');const pr=page.getByLabel('Payment role');await page.getByRole('button',{name:'Create payment application'}).click();await page.getByRole('button',{name:'Submit application with waiver'}).click();await pr.selectOption('Project Manager');await page.getByRole('button',{name:'Reconcile released variation'}).click();await expect(page.getByRole('status')).toContainText('reconciled');await expect(page.getByText(/Application draft/)).toBeVisible();await expect(page.getByText(/Subcontract value 1030000 · reconciled variations 1/)).toBeVisible();});
