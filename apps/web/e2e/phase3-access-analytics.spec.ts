import { expect, test } from '@playwright/test';

test.describe('Phase 3 access and analytics', () => {
  test('role ganda sees secretary features, system settings, and time savings analytics', async ({ page, request }) => {
    await page.goto('/app');

    await expect(page.locator('main h1').filter({ hasText: 'Dashboard' })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: /Review Dokumen/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Notula Rapat/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /Pengaturan Sistem/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Waktu Dihemat' })).toBeVisible();

    const analyticsRes = await request.get('/api/analytics/time-savings?period=monthly');
    expect(analyticsRes.ok()).toBeTruthy();
    const analyticsJson = (await analyticsRes.json()) as {
      data?: { totals?: { savedMinutes?: number }; breakdown?: Array<{ feature: string }> };
    };
    expect(typeof analyticsJson.data?.totals?.savedMinutes).toBe('number');
    expect(analyticsJson.data?.breakdown?.map((item) => item.feature)).toEqual([
      'document_review',
      'minutes_cta',
      'wa_reminder',
    ]);

    await page.getByRole('link', { name: /Pengaturan Sistem/ }).click();
    await expect(page.getByRole('heading', { name: 'Pengaturan' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Approval User/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Analytics/ })).toBeVisible();

    await page.getByRole('button', { name: /Analytics/ }).click();
    await expect(page.getByRole('heading', { name: 'Formula Time Savings' })).toBeVisible();

    const settingsRes = await request.get('/api/admin/time-savings-settings');
    expect(settingsRes.ok()).toBeTruthy();
  });
});
