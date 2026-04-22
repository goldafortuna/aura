import { expect, test } from '@playwright/test';

test.describe('Task Management E2E', () => {
  test('creates, updates status, edits, filters, and deletes a task', async ({ page }) => {
    const stamp = Date.now();
    const title = `Tugas Playwright ${stamp}`;
    const updatedTitle = `${title} Updated`;
    const dueDate = '2026-04-30';

    await page.goto('/app?tab=tasks');

    await expect(page.getByRole('heading', { name: 'Manajemen Tugas' })).toBeVisible();

    await page.getByRole('button', { name: 'Tambah Tugas' }).click();
    const modal = page.locator('div.fixed.inset-0.z-50').filter({
      has: page.getByRole('heading', { name: 'Tambah Tugas Baru' }),
    });
    await expect(modal.getByRole('heading', { name: 'Tambah Tugas Baru' })).toBeVisible();

    await modal.getByPlaceholder(/Contoh: Siapkan laporan kinerja bulan ini/i).fill(title);
    await modal.getByPlaceholder(/Tambahkan detail atau catatan/i).fill('Tugas otomatis untuk verifikasi Playwright.');
    await modal.locator('select').nth(0).selectOption('high');
    await modal.locator('select').nth(1).selectOption('todo');
    await modal.locator('input[type="date"]').fill(dueDate);
    await page.getByRole('button', { name: 'Tambah Tugas' }).last().click();

    await expect(page.getByText('Tugas berhasil ditambahkan.')).toBeVisible();
    await expect(page.getByText(title)).toBeVisible();

    await page.getByPlaceholder(/Cari tugas/i).fill(title);
    const taskCard = page.locator('.group.relative').filter({ hasText: title }).first();
    await expect(taskCard).toBeVisible();

    await taskCard.getByLabel('Tandai selesai').click();
    await expect(page.getByText('Dipindahkan ke "Selesai".')).toBeVisible();

    await page.getByPlaceholder(/Cari tugas/i).clear();
    const updatedCard = page.locator('.group.relative').filter({ hasText: title }).first();
    await updatedCard.getByLabel('Edit tugas').click();
    const editModal = page.locator('div.fixed.inset-0.z-50').filter({
      has: page.getByRole('heading', { name: 'Edit Tugas' }),
    });
    await expect(editModal.getByRole('heading', { name: 'Edit Tugas' })).toBeVisible();
    await editModal.getByPlaceholder(/Contoh: Siapkan laporan kinerja bulan ini/i).fill(updatedTitle);
    await editModal.locator('select').nth(0).selectOption('low');
    await editModal.locator('select').nth(1).selectOption('in-progress');
    await page.getByRole('button', { name: 'Simpan Perubahan' }).click();

    await expect(page.getByText('Tugas berhasil diperbarui.')).toBeVisible();

    await page.getByPlaceholder(/Cari tugas/i).fill(updatedTitle);
    await page.getByText(updatedTitle).waitFor();

    await page.locator('select').first().selectOption('low');
    await expect(page.getByText(updatedTitle)).toBeVisible();

    const filteredCard = page.locator('.group.relative').filter({ hasText: updatedTitle }).first();
    await filteredCard.getByLabel('Hapus tugas').click();
    await expect(page.getByRole('heading', { name: 'Hapus Tugas?' })).toBeVisible();
    await page.getByRole('button', { name: 'Ya, Hapus' }).click();

    await expect(page.getByText('Tugas berhasil dihapus.')).toBeVisible();
    await expect(page.getByText(updatedTitle)).not.toBeVisible();
  });
});
