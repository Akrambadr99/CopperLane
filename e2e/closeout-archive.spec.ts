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
  await archive.getByRole('button', { name: 'Restore verified project closeout' }).click()
  await expect(page.getByRole('status')).toContainText('recovery history')
  await expect(archive.getByRole('list', { name: 'Closeout archive restoration history' })).toContainText('PROJECT-SOUTH')
  await expect(page.getByLabel('Closeout archive preview')).toContainText('restore blocked')
  await page.reload()
  await expect(page.getByLabel('Closeout archive preview')).toContainText('restore blocked')
})
