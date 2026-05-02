import { expect, test } from '@playwright/test';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

async function createSampleDocx(targetPath: string) {
  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            children: [new TextRun('Notula Rapim Uji Playwright')],
          }),
          new Paragraph('Tanggal: 21 April 2026'),
          new Paragraph('Unit Kerja: Direktorat SDM'),
          new Paragraph('Daftar Hadir: Andi, Budi, Citra, Deni'),
          new Paragraph('rapim menyepakati tindak lanjut untuk Direktorat SDM.'),
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, buffer);
}

test.describe('Meeting Minutes E2E', () => {
  test('uploads, reviews, approves, downloads, appears in monitoring, and opens distribution flow', async ({
    page,
    request,
    baseURL,
  }, testInfo) => {
    const stamp = Date.now();
    const unitName = `Direktorat SDM E2E ${stamp}`;
    const title = `Notula E2E ${stamp}`;
    const fixturePath = testInfo.outputPath(`fixtures/notula-e2e-${stamp}.docx`);

    await createSampleDocx(fixturePath);

    const unitRes = await request.post(`${baseURL}/api/unit-kerja`, {
      data: {
        name: unitName,
        aliases: ['DSDM E2E', 'Dit SDM E2E'],
        email: `sdm-e2e-${stamp}@example.com`,
        description: 'Seed unit kerja untuk Playwright',
      },
    });
    expect(unitRes.ok()).toBeTruthy();

    await page.goto('/app?tab=minutes');

    await expect(page.getByRole('heading', { name: 'Manajemen Notula Rapat' })).toBeVisible();
    await page.locator('input[type="file"]').first().setInputFiles(fixturePath);

    await expect(page.getByRole('heading', { name: 'Upload Notula', exact: true })).toBeVisible();
    await page.getByLabel(/Judul Notula/i).fill(title);
    await page.getByRole('button', { name: /Upload & Analisa AI/i }).click();

    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
    await expect(page.getByText('1 tindak lanjut').first()).toBeVisible({ timeout: 20_000 });

    await expect
      .poll(
        async () => {
          const res = await request.get(`${baseURL}/api/meeting-minutes`);
          const json = (await res.json()) as { data: Array<{ title: string; status: string }> };
          return json.data.find((minute) => minute.title === title)?.status;
        },
        { timeout: 30_000 },
      )
      .toBe('reviewed');

    await page.reload();
    const minuteRow = page
      .getByRole('heading', { name: title, exact: true })
      .locator('xpath=ancestor::div[contains(@class, "p-5")][1]');
    await minuteRow.getByRole('button', { name: 'Lihat Detail' }).click();
    await expect(page.getByRole('button', { name: /Pilih Semua/i })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/Temuan\s*\(1\)/)).toBeVisible();
    await expect(page.getByText(/Tindak Lanjut\s*\(1\)/)).toBeVisible();
    await expect(page.getByText('rapim')).toBeVisible();

    await page.getByRole('button', { name: /Pilih Semua/i }).click();
    await page.getByRole('button', { name: /Setujui 1 Perubahan/i }).click();
    await expect(page.getByText('Dokumen terkoreksi siap diunduh')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: /Unduh \.docx/i })).toBeVisible();

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /Unduh \.docx/i }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('.docx');

    await page.getByRole('button', { name: /Tindak Lanjut \(1\)/i }).click();
    await expect(page.getByText('Unit:', { exact: false })).toBeVisible();
    await expect(page.getByText(unitName)).toBeVisible();

    await page.getByRole('button', { name: /Distribusi Notula & Tindak Lanjut via Email/i }).click();
    await expect(page.getByRole('heading', { name: 'Distribusi Notula' })).toBeVisible();
    await page.getByRole('button', { name: new RegExp(unitName) }).click();
    await page.getByRole('button', { name: /Kirim ke Semua Penerima/i }).click();
    await expect(page.getByText('Konfigurasi email SMTP belum diatur.')).toBeVisible({ timeout: 15_000 });

    await page.goto('/app?tab=cta-dashboard');
    await expect(page.getByRole('heading', { name: 'Monitoring Tindak Lanjut' })).toBeVisible();
    await expect(page.getByText(unitName)).toBeVisible();
  });
});
