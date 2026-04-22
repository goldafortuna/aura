import { expect, test } from '@playwright/test';

test.describe('Agenda Planner E2E', () => {
  test('loads mocked agenda data and generates WA reminders', async ({ page }) => {
    await page.goto('/app?tab=planner');

    await expect(page.getByRole('heading', { name: 'Agenda Pimpinan' })).toBeVisible();
    await expect(page.getByText('Rapat Koordinasi Playwright').first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Audiensi Mitra Strategis').first()).toBeVisible();
    await expect(page.getByText('Peninjauan Lapangan').first()).toBeVisible();

    await page.getByRole('button', { name: 'WA' }).first().click();
    await expect(page.locator('textarea').first()).toBeVisible();
    await expect(page.locator('textarea').first()).toHaveValue(/Rapat Koordinasi Playwright/);
    await page.getByRole('button', { name: 'Tutup' }).click();

    await page.getByTitle('Generate WA reminder untuk acara ini').first().click();
    await expect(page.locator('textarea').first()).toBeVisible();
    await expect(page.locator('textarea').first()).toHaveValue(/Pengingat Agenda/);
    await expect(page.locator('textarea').first()).toHaveValue(/Rapat Koordinasi Playwright/);
    await page.getByRole('button', { name: 'Tutup' }).click();

    await page.getByRole('button', { name: 'Muat ulang' }).click();
    await expect(page.getByText('Rapat Koordinasi Playwright').first()).toBeVisible();
  });
});
