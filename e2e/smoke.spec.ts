import { expect, test } from '@playwright/test'

test('BuildLedger exposes its primary domain workflow', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle('BuildLedger')
  await expect(page.getByRole('heading', { level: 1, name: 'Drawing revision register' })).toBeVisible()
  await page.getByRole('button', { name: 'field records' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Inspection & RFI references' })).toBeVisible()
})
