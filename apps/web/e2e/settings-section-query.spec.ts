import { expect, test } from '@playwright/test';

/**
 * Smoke: `useSearchParams` + `?section=` pada /settings (Next 15 + Client Component).
 * Membutuhkan env yang sama seperti suite lain (DEV_BYPASS_AUTH di playwright.config).
 */
test.describe('Settings ?section= query', () => {
  test('membuka tab yang sesuai dari URL dan fallback section tidak dikenal', async ({ page }) => {
    await page.goto('/settings?section=google');
    await expect(page.getByRole('heading', { name: 'Pengaturan' })).toBeVisible({ timeout: 20_000 });
    await expect(page).toHaveURL(/section=google/);
    await expect(page.getByRole('heading', { name: 'Integrasi Google Calendar' })).toBeVisible({ timeout: 20_000 });

    await page.goto('/settings?section=ai');
    await expect(page).toHaveURL(/section=ai/);
    await expect(page.getByRole('heading', { name: 'Provider AI' })).toBeVisible({ timeout: 20_000 });

    await page.goto('/settings?section=email');
    await expect(page).toHaveURL(/section=email/);
    await expect(page.getByRole('heading', { name: 'Konfigurasi Email SMTP' })).toBeVisible({ timeout: 20_000 });

    await page.goto('/settings?section=tidak-ada-section-ini');
    await expect(page.getByRole('heading', { name: 'Approval User' })).toBeVisible({ timeout: 20_000 });
  });
});
