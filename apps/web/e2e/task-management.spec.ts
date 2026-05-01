import { expect, test } from '@playwright/test';

test.describe('Task Management E2E', () => {
  test('creates, updates status, manages travel checklist, and deletes tasks', async ({ page }) => {
    const stamp = Date.now();
    const title = `Tugas Playwright ${stamp}`;
    const updatedTitle = `${title} Updated`;
    const travelTitle = `Perjadin Playwright ${stamp}`;
    const dueDateTime = '2026-04-30T09:00';

    await page.goto('/app?tab=tasks');

    await expect(page.getByRole('heading', { name: 'Manajemen Tugas' })).toBeVisible();

    await page.getByRole('button', { name: 'Tambah Tugas', exact: true }).click();
    const modal = page.locator('div.fixed.inset-0.z-50').filter({
      has: page.getByRole('heading', { name: 'Tambah Tugas Baru' }),
    });

    await modal.getByPlaceholder(/Contoh: Pertanggungjawaban perjalanan dinas/i).fill(title);
    await modal.getByPlaceholder(/Tambahkan detail atau catatan/i).fill('Tugas otomatis untuk verifikasi Playwright.');
    await modal.locator('select').nth(1).selectOption('high');
    await modal.locator('select').nth(2).selectOption('todo');
    await modal.locator('input[type="datetime-local"]').fill(dueDateTime);
    await modal.getByRole('button', { name: 'Simpan dan Lanjutkan' }).click();

    await expect(page.getByText('Tugas berhasil ditambahkan.')).toBeVisible();

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
    await editModal.getByPlaceholder(/Contoh: Pertanggungjawaban perjalanan dinas/i).fill(updatedTitle);
    await editModal.locator('select').nth(1).selectOption('low');
    await editModal.locator('select').nth(2).selectOption('in-progress');
    await editModal.getByRole('button', { name: 'Simpan Perubahan' }).click();

    await expect(page.getByText('Tugas berhasil diperbarui.')).toBeVisible();
    await editModal.getByRole('button', { name: 'Tutup' }).click();

    await page.getByPlaceholder(/Cari tugas/i).fill(updatedTitle);
    await expect(page.getByText(updatedTitle)).toBeVisible();

    await page.locator('select').first().selectOption('low');
    await expect(page.getByText(updatedTitle)).toBeVisible();

    await page.getByPlaceholder(/Cari tugas/i).clear();
    await page.getByRole('button', { name: 'Tambah Tugas', exact: true }).click();
    const travelModal = page.locator('div.fixed.inset-0.z-50').filter({
      has: page.getByRole('heading', { name: 'Tambah Tugas Baru' }),
    });

    await travelModal.getByPlaceholder(/Contoh: Pertanggungjawaban perjalanan dinas/i).fill(travelTitle);
    await travelModal.locator('select').nth(0).selectOption('travel-accountability');
    await travelModal.getByPlaceholder('keuangan@unit.ac.id').fill(`keuangan-${stamp}@example.com`);
    await travelModal.getByRole('button', { name: 'Simpan dan Lanjutkan' }).click();

    await expect(page.getByText('Lanjutkan upload dokumen checklist.')).toBeVisible();
    await expect(travelModal.getByText('Surat Tugas')).toBeVisible();
    await expect(travelModal.getByText('Boarding Pass')).toBeVisible();

    const uploadInputs = travelModal.locator('input[type="file"]');
    const samplePdf = {
      name: 'surat-tugas.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF'),
    };
    await uploadInputs.nth(0).setInputFiles(samplePdf);
    await expect(page.getByText('Dokumen berhasil diunggah.')).toBeVisible();

    await expect(travelModal.getByText('1 dokumen terunggah')).toBeVisible();
    await expect(travelModal.getByRole('button', { name: 'Kirim ke Keuangan' })).toBeDisabled();

    await travelModal.getByRole('button', { name: 'Tutup' }).click();

    const filteredCard = page.locator('.group.relative').filter({ hasText: updatedTitle }).first();
    await filteredCard.getByLabel('Hapus tugas').click();
    await expect(page.getByRole('heading', { name: 'Hapus Tugas?' })).toBeVisible();
    await page.getByRole('button', { name: 'Ya, Hapus' }).click();

    await expect(page.getByText('Tugas berhasil dihapus.')).toBeVisible();
    await expect(page.getByText(updatedTitle)).not.toBeVisible();
  });
});
