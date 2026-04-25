import { Hono } from 'hono';
import { requireSecretary } from '../../../../lib/middleware/auth';
import { uploadObject } from '../../../../lib/objectStorage';
import { validateUploadedFile } from '../../../../lib/utils/fileValidation';
import { createRateLimitMiddleware } from '../../../../lib/middleware/rateLimit';
import { internalServerError } from '../../../../lib/httpErrors';

const app = new Hono();

const MAX_FILES = 1;
const MAX_BYTES = 10 * 1024 * 1024; // 10MB

function sanitizeFilename(name: string) {
  return name
    .replace(/[^\w.\-()\s]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 120);
}

// Apply rate limiting to file uploads
app.post('/', createRateLimitMiddleware(10, 60000), async (c) => {
  const dbUser = await requireSecretary(c);
  if (!dbUser) return c.json({ error: 'Unauthorized' }, 401);

  const formData = await c.req.formData();
  const files = Array.from(formData.getAll('files')).filter((f): f is File => f instanceof File);

  if (files.length === 0) return c.json({ error: 'No files uploaded.' }, { status: 400 });
  if (files.length > MAX_FILES) return c.json({ error: 'Max 1 file per upload.' }, { status: 400 });

  const file = files[0];

  if (file.size > MAX_BYTES) {
    return c.json({ error: `File terlalu besar: ${file.name}. Maks 10MB.` }, { status: 400 });
  }

  // Read file buffer to validate type by magic bytes (secure validation)
  const arrayBuffer = await file.arrayBuffer();
  
  // Perform secure file validation using magic bytes
  const validation = validateUploadedFile(arrayBuffer, file.type);
  if (!validation.isValid) {
    return c.json(
      { error: `File validation failed for ${file.name}: ${validation.error}` },
      { status: 400 },
    );
  }

  const now = Date.now();
  const safeName = sanitizeFilename(file.name || 'notula');
  const random = Math.random().toString(16).slice(2);
  const storagePath = `meeting-minutes/${dbUser.id}/${now}-${random}-${safeName}`;

  try {
    await uploadObject({
      path: storagePath,
      body: arrayBuffer,
      contentType: validation.detectedMimeType || 'application/octet-stream',
      upsert: false,
    });
  } catch (error) {
    return internalServerError(
      c,
      'uploads/meeting-minutes',
      error,
      'Upload gagal diproses. Silakan coba lagi.',
    );
  }

  return c.json(
    {
      data: {
        filename: safeName,
        fileType: validation.detectedMimeType || 'application/octet-stream',
        fileSize: file.size,
        storagePath,
      },
    },
    { status: 201 },
  );
});

export default app;

