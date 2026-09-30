import { expect, test } from '@playwright/test'

test('director archives final closeout and cannot restore it over newer work', async ({ page }) => {
  await page.goto('/practical-completion')
  const archive = page.getByRole('region', { name: 'Project closeout archive' })
  await expect(archive.getByRole('button', { name: 'Capture final closeout archive' })).toBeDisabled()
  await page.getByLabel('Portfolio authority').selectOption('Commercial Director')
  await page.getByRole('button', { name: 'Schedule overdue closeout intervention' }).click()
  await page.getByRole('button', { name: 'Authorize evidence-based project closure' }).click()
  await page.getByRole('button', { name: 'Assemble closeout evidence package' }).click()
  await archive.getByRole('button', { name: 'Capture final closeout archive' }).click()
  await expect(page.getByLabel('Closeout archive preview')).toContainText('verified for restore')
  const href = await archive.getByRole('link', { name: 'Download closeout archive' }).getAttribute('href')
  if (!href) throw new Error('Archive download missing')
  const saved = decodeURIComponent(href.slice(href.indexOf(',') + 1))
  const duplicated = JSON.parse(saved) as { documentCustody: unknown[] }
  duplicated.documentCustody.push(duplicated.documentCustody[0])
  await page.getByLabel('Import closeout archive').setInputFiles({ name: 'duplicate.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(duplicated)) })
  await expect(archive.getByRole('alert')).toContainText('repeats an evidence identity')
  await expect(archive.getByRole('button', { name: 'Restore verified project closeout' })).toBeDisabled()
  await page.getByLabel('Import closeout archive').setInputFiles({ name: 'valid.json', mimeType: 'application/json', buffer: Buffer.from(saved) })
  await archive.getByRole('button', { name: 'Restore verified project closeout' }).click()
  await expect(page.getByRole('status')).toContainText('recovery history')
  await expect(archive.getByRole('list', { name: 'Closeout archive restoration history' })).toContainText('PROJECT-SOUTH')
  await expect(page.getByLabel('Closeout archive preview')).toContainText('restore blocked')
  await page.reload()
  await expect(page.getByLabel('Closeout archive preview')).toContainText('restore blocked')
})

test('director accepts exact recipient completion and sees new policy supersede the preserved certificate', async ({ page }) => {
  await page.goto('/practical-completion')
  const acceptance = page.getByRole('region', { name: 'Project handover acceptance' })
  const accept = acceptance.getByRole('button', { name: 'Accept recipient-complete handover' })
  await expect(accept).toBeDisabled()
  await page.getByLabel('Portfolio authority').selectOption('Commercial Director')
  await page.getByRole('button', { name: 'Schedule overdue closeout intervention' }).click()
  await page.getByRole('button', { name: 'Authorize evidence-based project closure' }).click()
  await page.getByRole('button', { name: 'Assemble closeout evidence package' }).click()
  for (const recipient of ['Client representative', 'Commercial manager', 'Main contractor']) {
    await page.getByRole('combobox', { name: 'Handoff recipient' }).selectOption(recipient)
    await page.getByRole('button', { name: 'Prepare manual recipient handoff' }).click()
    await page.getByRole('button', { name: 'Record recipient acknowledgement' }).click()
  }
  await acceptance.getByLabel('Handover acceptance reference').fill('')
  await accept.click()
  await expect(page.getByRole('status')).toContainText('Acceptance reference')
  await expect(page.getByRole('status')).toBeFocused()
  await expect(page.getByLabel('Handover acceptance status')).toHaveText('ready for acceptance')
  await acceptance.getByLabel('Handover acceptance reference').fill('HANDOVER-SOUTH-100')
  await accept.click()
  await expect(page.getByLabel('Handover acceptance status')).toHaveText('handover accepted')
  await page.reload()
  await expect(page.getByLabel('Handover acceptance status')).toHaveText('handover accepted')
  await page.getByLabel('Portfolio authority').selectOption('Commercial Director')
  await page.getByRole('button', { name: 'Require recipient acknowledgement' }).click()
  await expect(page.getByLabel('Handover acceptance status')).toHaveText('acceptance superseded')
  await expect(accept).toBeDisabled()
  await acceptance.getByText('Handover acceptance history (1)').click()
  await expect(acceptance.getByRole('list', { name: 'Handover acceptance history' })).toContainText('HANDOVER-SOUTH-100')
  await expect(acceptance.getByRole('list', { name: 'Handover acceptance history' })).toContainText('superseded')
  await expect(page.getByRole('list', { name: 'Required closeout recipients' })).toContainText('Independent certifier · not prepared')
})

test('closes and accepts north project handover without consuming south project readiness', async ({ page }) => {
  await page.goto('/practical-completion')
  await page.getByLabel('Portfolio authority').selectOption('Commercial Director')
  await page.getByLabel('Operational closeout project').selectOption('PROJECT-NORTH')
  await expect(page.getByLabel('Selected closeout source')).toContainText('FA-2026-017')
  await page.getByRole('button', { name: 'Schedule overdue closeout intervention' }).click()
  await page.getByLabel('Verified document references').fill('NORTH-MANUAL-001, NORTH-WARRANTY-002')
  await page.getByLabel('Satisfied documents').fill('1')
  await page.getByLabel('Final account closure reference').fill('FA-NORTH-017-FINAL')
  await page.getByLabel('Document custody reference').fill('NORTH-CUSTODY-001')
  await page.getByRole('button', { name: 'Authorize evidence-based project closure' }).click()
  await expect(page.getByRole('status')).toContainText('Every open document')
  await expect(page.getByLabel('Verified document references')).toHaveValue('NORTH-MANUAL-001, NORTH-WARRANTY-002')
  await page.getByLabel('Satisfied documents').fill('2')
  await page.getByRole('button', { name: 'Authorize evidence-based project closure' }).click()
  await page.getByRole('button', { name: 'Assemble closeout evidence package' }).click()
  for (const recipient of ['Client representative', 'Commercial manager', 'Main contractor']) {
    await page.getByRole('combobox', { name: 'Handoff recipient' }).selectOption(recipient)
    await page.getByRole('button', { name: 'Prepare manual recipient handoff' }).click()
    await page.getByLabel('Manual receipt reference').fill(`NORTH-${recipient}-RECEIPT`)
    await page.getByRole('button', { name: 'Record recipient acknowledgement' }).click()
  }
  await page.getByLabel('Handover acceptance reference').fill('NORTH-HANDOVER-017')
  await page.getByRole('button', { name: 'Accept recipient-complete handover' }).click()
  await expect(page.getByLabel('Handover acceptance status')).toHaveText('handover accepted')
  await page.getByLabel('Operational closeout project').selectOption('PROJECT-SOUTH')
  await expect(page.getByLabel('Selected closeout source')).toContainText('open documents 3')
  await expect(page.getByRole('button', { name: 'Schedule overdue closeout intervention' })).toBeEnabled()
  await expect(page.getByRole('list', { name: 'Project closure history' })).not.toContainText('PROJECT-NORTH')
  await page.getByLabel('Operational closeout project').selectOption('PROJECT-NORTH')
  await page.reload()
  await expect(page.getByLabel('Operational closeout project')).toHaveValue('PROJECT-NORTH')
  await expect(page.getByLabel('Handover acceptance status')).toHaveText('handover accepted')
})

test('director issues a pinned document manifest and supersedes only the corrected document revision', async ({ page }) => {
  await page.goto('/practical-completion'); await page.getByLabel('Portfolio authority').selectOption('Commercial Director'); await page.getByRole('button', { name: 'Schedule overdue closeout intervention' }).click(); await page.getByRole('button', { name: 'Authorize evidence-based project closure' }).click(); await page.getByText('Register a document revision', { exact: true }).click();
  for (const document of ['DOC-O&M-9', 'DOC-WARRANTY-3']) { await page.getByLabel('Closeout custody document').selectOption({ label: document }); await page.getByLabel('Document revision label').fill('A'); await page.getByLabel('Document revision evidence').fill('CONTROLLED-' + document + '-A'); await page.getByRole('button', { name: 'Register closeout document revision' }).click(); await page.getByLabel('Portfolio authority').selectOption('Document Controller'); await page.getByLabel('Technical release evidence').fill('RELEASE-' + document); await page.getByLabel('Technical review rationale').fill('Independent contents review confirms the verified closeout document.'); await page.getByRole('button', { name: 'Release reviewed closeout document' }).click(); await page.getByLabel('Portfolio authority').selectOption('Commercial Director'); }
  await page.getByRole('button', { name: 'Assemble closeout evidence package' }).click(); await expect(page.getByLabel('Closeout document manifest status')).toHaveText('current document revisions'); await expect(page.getByRole('list', { name: 'Pinned closeout document manifest' })).toContainText('DOC-O&M-9 · revision A');
  await page.getByLabel('Closeout custody document').selectOption({ label: 'DOC-O&M-9' }); await page.getByLabel('Document revision label').fill('B'); await page.getByLabel('Document revision evidence').fill('CONTROLLED-OM-REPLACEMENT-B'); await page.getByRole('button', { name: 'Register closeout document revision' }).click(); await expect(page.getByLabel('Closeout document manifest status')).toContainText('document revisions changed'); await expect(page.getByRole('button', { name: 'Prepare manual recipient handoff' })).toBeDisabled(); await expect(page.getByRole('list', { name: 'Pinned closeout document manifest' })).toContainText('DOC-O&M-9 · revision A');
  await page.getByLabel('Portfolio authority').selectOption('Document Controller'); await page.getByLabel('Technical release evidence').fill('RELEASE-REPLACEMENT-B'); await page.getByLabel('Technical review rationale').fill('Corrected operating manual independently verified against equipment.'); await page.getByRole('button', { name: 'Release reviewed closeout document' }).click(); await page.getByLabel('Portfolio authority').selectOption('Commercial Director'); await page.getByRole('button', { name: 'Assemble closeout evidence package' }).click(); await expect(page.getByRole('list', { name: 'Pinned closeout document manifest' })).toContainText('DOC-O&M-9 · revision B'); await expect(page.getByRole('list', { name: 'Pinned closeout document manifest' })).toContainText('DOC-WARRANTY-3 · revision A'); await page.getByRole('button', { name: 'Prepare manual recipient handoff' }).click(); await expect(page.getByRole('status')).toContainText('handoff'); await page.reload(); await expect(page.getByLabel('Closeout document manifest status')).toHaveText('current document revisions'); await page.getByText('Document revision history', { exact: true }).click(); await expect(page.getByRole('list', { name: 'Closeout document revision history' })).toContainText('superseding prior revision');
});
test('independent controller returns a document and releases its corrected revision while preserving review drafts', async ({ page }) => {
  await page.goto('/practical-completion'); const authority = page.getByLabel('Portfolio authority'); await authority.selectOption('Commercial Director'); await page.getByRole('button', { name: 'Schedule overdue closeout intervention' }).click(); await page.getByRole('button', { name: 'Authorize evidence-based project closure' }).click(); await page.getByText('Register a document revision', { exact: true }).click();
  for (const document of ['DOC-O&M-9', 'DOC-WARRANTY-3']) { await page.getByLabel('Closeout custody document').selectOption({ label: document }); await page.getByLabel('Document revision label').fill('A'); await page.getByLabel('Document revision evidence').fill('CONTROLLED-' + document); await page.getByRole('button', { name: 'Register closeout document revision' }).click(); }
  await page.getByRole('button', { name: 'Assemble closeout evidence package' }).click(); await expect(page.getByRole('status')).toContainText('independent technical release'); await expect(page.getByRole('button', { name: 'Release reviewed closeout document' })).toBeDisabled();
  await authority.selectOption('Document Controller'); await page.getByLabel('Technical release evidence').fill('VERIFIED-WARRANTY-A'); await page.getByLabel('Technical review rationale').fill('Warranty evidence independently matches the installed equipment.'); await page.getByRole('button', { name: 'Release reviewed closeout document' }).click();
  await page.getByLabel('Closeout custody document').selectOption({ label: 'DOC-O&M-9' }); await page.getByLabel('Technical release evidence').fill('RETURN-MANUAL-A'); await page.getByLabel('Technical review rationale').fill('Operating manual omits the final equipment maintenance schedule.'); await page.getByLabel('Technical review date').fill('2026-10-23'); await page.getByRole('button', { name: 'Return closeout document for correction' }).click(); await expect(page.getByRole('status')).toContainText('chronological'); await expect(page.getByLabel('Technical review rationale')).toHaveValue('Operating manual omits the final equipment maintenance schedule.'); await page.getByLabel('Technical review date').fill('2026-10-25'); await page.getByRole('button', { name: 'Return closeout document for correction' }).click();
  await authority.selectOption('Commercial Director'); await page.getByLabel('Document revision label').fill('B'); await page.getByLabel('Document revision evidence').fill('CORRECTED-MANUAL-B'); await page.getByRole('button', { name: 'Register closeout document revision' }).click(); await authority.selectOption('Document Controller'); await expect(page.getByLabel('Technical review rationale')).toHaveValue(''); await page.getByLabel('Technical release evidence').fill('VERIFIED-MANUAL-B'); await page.getByLabel('Technical review rationale').fill('Corrected manual contains the complete installed-equipment maintenance schedule.'); await page.getByRole('button', { name: 'Release reviewed closeout document' }).click(); await authority.selectOption('Commercial Director'); await page.getByRole('button', { name: 'Assemble closeout evidence package' }).click();
  await expect(page.getByLabel('Closeout document manifest status')).toHaveText('current document revisions'); await page.reload(); await page.getByText('Document technical release history', { exact: true }).click(); await expect(page.getByRole('list', { name: 'Technical release decisions' })).toContainText('returned'); await expect(page.getByRole('list', { name: 'Technical release decisions' })).toContainText('VERIFIED-MANUAL-B'); await expect(page.getByRole('list', { name: 'Pinned closeout document manifest' })).toContainText('revision B');
});
