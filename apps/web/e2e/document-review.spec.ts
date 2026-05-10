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
            children: [new TextRun('Surat Uji Review Dokumen Playwright')],
          }),
          new Paragraph('Dokumen ini dibuat untuk pengujian alur review dokumen.'),
          new Paragraph('Terdapat kata Kemedikbudristek yang sengaja salah eja.'),
          new Paragraph('Tindak lanjut segera ditindaklanjuti oleh tim terkait.'),
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, buffer);
}

test.describe('Document Review E2E', () => {
  test('uploads, reviews, opens findings, previews, and resolves storage link', async ({
    page,
    request,
    baseURL,
  }, testInfo) => {
    const stamp = Date.now();
    const filename = `surat-review-e2e-${stamp}.docx`;
    const fixturePath = testInfo.outputPath(`fixtures/${filename}`);

    await createSampleDocx(fixturePath);

    await page.goto('/app?tab=documents');

    await expect(page.getByRole('heading', { name: 'Review Dokumen' })).toBeVisible({ timeout: 30_000 });
    await page.locator('input[type="file"]').first().setInputFiles(fixturePath);

    await expect(page.getByRole('heading', { name: filename, exact: true })).toBeVisible({ timeout: 30_000 });
    const row = page
      .getByRole('heading', { name: filename, exact: true })
      .locator('xpath=ancestor::div[contains(@class,"border-l-")][1]');

    await expect(row.getByText('Direview')).toBeVisible({ timeout: 30_000 });
    await expect(row.getByText('Typo: 1')).toBeVisible();
    await expect(row.getByText('Ambigu: 1')).toBeVisible();

    await row.getByTitle('Lihat detail typo').first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText('Mock review Playwright')).toBeVisible();
    await expect(page.getByText('Kemedikbudristek')).toBeVisible();
    await expect(page.getByText('Kemendikbudristek')).toBeVisible();
    await page.getByLabel('Tutup').click();

    await row.getByTitle('Preview').click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(
      page.getByTitle('Document preview').or(page.getByText('Preview belum tersedia')),
    ).toBeVisible({ timeout: 10_000 });
    await page.getByLabel('Tutup').click();

    const documentsRes = await request.get(`${baseURL}/api/documents`);
    expect(documentsRes.ok()).toBeTruthy();
    const documentsJson = (await documentsRes.json()) as {
      data: Array<{ id: string; filename: string }>;
    };
    const createdDoc = documentsJson.data.find((doc) => doc.filename === filename);
    expect(createdDoc).toBeTruthy();

    const signedUrlRes = await request.get(`${baseURL}/api/documents/${createdDoc!.id}/signed-url`);
    expect(signedUrlRes.ok()).toBeTruthy();
    const signedUrlJson = (await signedUrlRes.json()) as { data?: { url?: string } };
    expect(signedUrlJson.data?.url).toContain('/api/storage/object?path=');

    const objectRes = await request.get(`${baseURL}${signedUrlJson.data!.url}`);
    expect(objectRes.ok()).toBeTruthy();
    expect(objectRes.headers()['content-type']).toContain('application/');
  });
});
