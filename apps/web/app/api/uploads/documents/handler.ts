import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { db } from '../../../../db';
import { webdavConfigs } from '../../../../db/schema';
import { decrypt } from '../../../../lib/encryption';
import { requireSecretary, secretaryAccessDeniedMessage } from '../../../../lib/middleware/auth';
import { uploadObject, getObjectStorageProvider } from '../../../../lib/objectStorage';
import { validateUploadedFile } from '../../../../lib/utils/fileValidation';
import { createRateLimitMiddleware } from '../../../../lib/middleware/rateLimit';
import { internalServerError } from '../../../../lib/httpErrors';
import { uploadFileToWebdav } from '../../../../lib/webdav';

const app = new Hono();

const MAX_FILES = 5;
const MAX_BYTES = 10 * 1024 * 1024; // 10MB

function sanitizeFilename(name: string) {
  return name
    .replace(/[^\w.\-()\s]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 120);
}

app.post('/', createRateLimitMiddleware(10, 60000), async (c) => {
  try {
    const dbUser = await requireSecretary(c);
    if (!dbUser) {
      let message = 'Akses ditolak. Silakan login ulang.';
      try {
        message = await secretaryAccessDeniedMessage();
      } catch {
        /* gunakan pesan default */
      }
      return c.json({ error: message }, 401);
    }

    let formData: FormData;
    try {
      formData = await c.req.formData();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Malformed multipart form data.';
      return c.json({ error: `Gagal membaca upload form: ${message}` }, 400);
    }

    const files = Array.from(formData.getAll('files')).filter((f): f is File => f instanceof File);

    if (files.length === 0) {
      return c.json({ error: 'No files uploaded.' }, 400);
    }
    if (files.length > MAX_FILES) {
      return c.json({ error: `Max ${MAX_FILES} files per upload.` }, 400);
    }

    const bucket = process.env.R2_BUCKET || process.env.OBJECT_STORAGE_BUCKET || 'documents';
    const now = Date.now();
    const results: Array<{
      filename: string;
      fileType: string;
      fileSize: number;
      storagePath: string;
    }> = [];
    const warnings: string[] = [];

    let webdavConfig: (typeof webdavConfigs.$inferSelect) | undefined;
    try {
      const [row] = await db
        .select()
        .from(webdavConfigs)
        .where(eq(webdavConfigs.userId, dbUser.id))
        .limit(1);
      webdavConfig = row;
    } catch (error) {
      console.warn('[uploads/documents] WebDAV config lookup failed (upload tetap dilanjutkan):', error);
    }

    for (const file of files) {
    if (file.size > MAX_BYTES) {
      return c.json({ error: `File terlalu besar: ${file.name}. Maks 10MB.` }, 400);
    }

    const arrayBuffer = await file.arrayBuffer();
    const validation = validateUploadedFile(arrayBuffer, file.type);
    if (!validation.isValid) {
      return c.json(
        { error: `File validation failed for ${file.name}: ${validation.error}` },
        400,
      );
    }

    const safeName = sanitizeFilename(file.name || 'dokumen');
    const random = Math.random().toString(16).slice(2);
    const storagePath = `documents/${dbUser.id}/${now}-${random}-${safeName}`;

    try {
      await uploadObject({
        path: storagePath,
        body: arrayBuffer,
        contentType: validation.detectedMimeType || 'application/octet-stream',
        upsert: false,
      });
    } catch (error) {
      const storageError = error instanceof Error ? error : new Error('Unknown storage error');
      console.error('[uploads/documents] Object storage error:', {
        provider: getObjectStorageProvider(),
        name: storageError.name,
        message: storageError.message,
        bucket,
        storagePath,
        fileType: validation.detectedMimeType || 'application/octet-stream',
        fileSize: file.size,
      });
      return internalServerError(
        c,
        'uploads/documents/storage',
        error,
        'Upload gagal diproses. Silakan coba lagi.',
      );
    }

    if (webdavConfig?.isEnabled) {
      try {
        await uploadFileToWebdav({
          baseUrl: webdavConfig.baseUrl,
          username: webdavConfig.username,
          password: decrypt(webdavConfig.password),
          documentReviewFolder: webdavConfig.documentReviewFolder,
          filename: safeName,
          body: arrayBuffer,
          contentType: validation.detectedMimeType || 'application/octet-stream',
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown WebDAV error';
        console.warn('[uploads/documents] WebDAV sync warning:', {
          userId: dbUser.id,
          filename: safeName,
          documentReviewFolder: webdavConfig.documentReviewFolder,
          message,
        });
        warnings.push(`WebDAV gagal untuk ${safeName}: ${message}`);
      }
    }

      results.push({
        filename: safeName,
        fileType: validation.detectedMimeType || 'application/octet-stream',
        fileSize: file.size,
        storagePath,
      });
    }

    return c.json({ data: results, warnings }, 201);
  } catch (error) {
    return internalServerError(c, 'uploads/documents', error, 'Upload gagal diproses. Silakan coba lagi.');
  }
});

export default app;
