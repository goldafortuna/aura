import { Hono } from 'hono';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import nodemailer from 'nodemailer';
import { z } from 'zod';
import { db } from '../../../db';
import { emailConfigs, taskAttachments, taskChecklistItems, tasks } from '../../../db/schema';
import { decrypt } from '../../../lib/encryption';
import { extractDocumentText } from '../../../lib/extractDocumentText';
import { extractVisualDocumentTextWithAi } from '../../../lib/extractVisualDocumentTextWithAi';
import { internalServerError } from '../../../lib/httpErrors';
import { requireSecretary } from '../../../lib/middleware/auth';
import { removeObjects, uploadObject } from '../../../lib/objectStorage';
import { validateUploadedFile } from '../../../lib/utils/fileValidation';

const app = new Hono();

const TRAVEL_ACCOUNTABILITY_KIND = 'travel-accountability';
const TASK_ATTACHMENT_PREFIX = 'task-attachments';
const MAX_FILES = 5;
const MAX_BYTES = 10 * 1024 * 1024;

const TRAVEL_CHECKLIST_LABELS = [
  'Surat Tugas',
  'E-Ticket',
  'Invoice',
  'Boarding Pass',
] as const;

type TaskStatusValue = 'todo' | 'in-progress' | 'completed';
type TaskPriorityValue = 'high' | 'medium' | 'low';

type LegacyTaskRow = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_date: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

const createTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  kind: z.enum(['general', TRAVEL_ACCOUNTABILITY_KIND]).optional(),
  status: z.enum(['todo', 'in-progress', 'completed']).optional(),
  priority: z.enum(['high', 'medium', 'low']).optional(),
  dueDate: z.string().nullable().optional(),
  financePicEmail: z.string().email().nullable().optional(),
});

const updateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  kind: z.enum(['general', TRAVEL_ACCOUNTABILITY_KIND]).optional(),
  status: z.enum(['todo', 'in-progress', 'completed']).optional(),
  priority: z.enum(['high', 'medium', 'low']).optional(),
  dueDate: z.string().nullable().optional(),
  financePicEmail: z.string().email().nullable().optional(),
});

const moveAttachmentSchema = z.object({
  checklistItemId: z.string().uuid(),
});

function parseDueDate(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value.trim() === '') return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Format tenggat waktu tidak valid.');
  }
  return parsed;
}

function sanitizeFilename(name: string) {
  return name
    .replace(/[^\w.\-()\s]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 120);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function normalizeForDetection(value: string) {
  return value
    .toLowerCase()
    .replace(/[_\-.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function classifyChecklistLabel(params: { filename: string; text?: string | null }) {
  const filename = normalizeForDetection(params.filename);
  const text = normalizeForDetection(params.text || '');
  const combined = `${filename} ${text}`.trim();

  const hasAny = (...terms: string[]) => terms.some((term) => combined.includes(term));
  const hasAll = (...terms: string[]) => terms.every((term) => combined.includes(term));

  if (
    hasAny('surat tugas', 'assignment letter') ||
    hasAll('nomor', 'surat') ||
    hasAny('memberi tugas', 'menugaskan', 'pelaksana perjalanan dinas')
  ) {
    return 'Surat Tugas';
  }

  if (
    hasAny('boarding pass', 'board pass') ||
    hasAll('boarding', 'gate') ||
    hasAll('seat', 'gate') ||
    hasAll('boarding time', 'flight')
  ) {
    return 'Boarding Pass';
  }

  if (
    hasAny('e ticket', 'eticket', 'e-ticket', 'itinerary receipt', 'passenger itinerary') ||
    hasAll('booking code', 'flight') ||
    hasAll('kode booking', 'penerbangan') ||
    hasAll('itinerary', 'flight')
  ) {
    return 'E-Ticket';
  }

  if (
    hasAny('invoice', 'receipt', 'kwitansi', 'tagihan', 'payment receipt') ||
    hasAll('invoice number', 'total') ||
    hasAll('subtotal', 'total') ||
    hasAll('jumlah tagihan', 'total')
  ) {
    return 'Invoice';
  }

  return null;
}

async function uploadValidatedTaskAttachment(params: {
  userId: string;
  taskId: string;
  checklistItemId: string;
  file: File;
  now: number;
}) {
  const { userId, taskId, checklistItemId, file, now } = params;
  if (file.size > MAX_BYTES) {
    throw new Error(`File terlalu besar: ${file.name}. Maks 10MB.`);
  }

  const arrayBuffer = await file.arrayBuffer();
  const validation = validateUploadedFile(arrayBuffer, file.type);
  if (!validation.isValid) {
    throw new Error(`File validation failed for ${file.name}: ${validation.error}`);
  }

  const safeName = sanitizeFilename(file.name || 'dokumen');
  const random = Math.random().toString(16).slice(2);
  const storagePath = `${TASK_ATTACHMENT_PREFIX}/${userId}/${now}-${random}-${safeName}`;

  await uploadObject({
    path: storagePath,
    body: arrayBuffer,
    contentType: validation.detectedMimeType || 'application/octet-stream',
    upsert: false,
  });

  return {
    row: {
      taskId,
      checklistItemId,
      filename: safeName,
      fileType: validation.detectedMimeType || 'application/octet-stream',
      fileSize: file.size,
      storagePath,
    } satisfies typeof taskAttachments.$inferInsert,
    bytes: new Uint8Array(arrayBuffer),
    detectedMimeType: validation.detectedMimeType || 'application/octet-stream',
  };
}

function isTaskSchemaCompatibilityError(error: unknown) {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes('task_checklist_items') ||
    message.includes('task_attachments') ||
    message.includes('finance_pic_email') ||
    message.includes('finance_email_sent_at') ||
    message.includes('column "kind"') ||
    message.includes('column tasks.kind') ||
    message.includes('kind does not exist')
  );
}

function toIsoString(value: Date | string | null | undefined) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString();
}

function serializeLegacyTasks(rows: LegacyTaskRow[]) {
  return rows.map((task) => ({
    id: task.id,
    userId: task.user_id,
    title: task.title,
    description: task.description,
    kind: 'general' as const,
    status: (task.status as TaskStatusValue) ?? 'todo',
    priority: (task.priority as TaskPriorityValue) ?? 'medium',
    financePicEmail: null,
    financeEmailSentAt: null,
    dueDate: toIsoString(task.due_date),
    createdAt: toIsoString(task.created_at),
    updatedAt: toIsoString(task.updated_at),
    checklistItems: [],
    checklistSummary: {
      requiredCount: 0,
      completedRequiredCount: 0,
      isComplete: false,
    },
  }));
}

async function loadLegacyTasks(userId: string, taskIds?: string[]) {
  const filters = [sql`user_id = ${userId}`];
  if (taskIds && taskIds.length > 0) {
    filters.push(sql`id in (${sql.join(taskIds.map((id) => sql`${id}`), sql`, `)})`);
  }

  const query = sql`
    select id, user_id, title, description, status, priority, due_date, created_at, updated_at
    from tasks
    where ${sql.join(filters, sql` and `)}
    order by created_at desc
  `;

  const result = await db.execute(query);
  return serializeLegacyTasks(result.rows as LegacyTaskRow[]);
}

async function insertLegacyTask(input: {
  userId: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: Date | null | undefined;
}) {
  const result = await db.execute(sql`
    insert into tasks (user_id, title, description, status, priority, due_date)
    values (
      ${input.userId},
      ${input.title},
      ${input.description},
      ${input.status},
      ${input.priority},
      ${input.dueDate ?? null}
    )
    returning id, user_id, title, description, status, priority, due_date, created_at, updated_at
  `);

  return serializeLegacyTasks(result.rows as LegacyTaskRow[])[0] ?? null;
}

async function updateLegacyTask(input: {
  userId: string;
  taskId: string;
  title?: string;
  description?: string | null;
  status?: string;
  priority?: string;
  dueDate?: Date | null;
}) {
  const setClauses = [sql`updated_at = now()`];
  if (input.title !== undefined) setClauses.push(sql`title = ${input.title}`);
  if (input.description !== undefined) setClauses.push(sql`description = ${input.description}`);
  if (input.status !== undefined) setClauses.push(sql`status = ${input.status}`);
  if (input.priority !== undefined) setClauses.push(sql`priority = ${input.priority}`);
  if (input.dueDate !== undefined) setClauses.push(sql`due_date = ${input.dueDate}`);

  const result = await db.execute(sql`
    update tasks
    set ${sql.join(setClauses, sql`, `)}
    where id = ${input.taskId} and user_id = ${input.userId}
    returning id, user_id, title, description, status, priority, due_date, created_at, updated_at
  `);

  return serializeLegacyTasks(result.rows as LegacyTaskRow[])[0] ?? null;
}

async function getOwnedTask(userId: string, taskId: string) {
  const [task] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)))
    .limit(1);

  return task ?? null;
}

async function ensureTravelChecklist(taskId: string) {
  const existing = await db
    .select({ id: taskChecklistItems.id })
    .from(taskChecklistItems)
    .where(eq(taskChecklistItems.taskId, taskId))
    .limit(1);

  if (existing.length > 0) return;

  await db.insert(taskChecklistItems).values(
    TRAVEL_CHECKLIST_LABELS.map((label, index) => ({
      taskId,
      label,
      isRequired: true,
      sortOrder: index,
    })),
  );
}

async function loadTaskGraph(userId: string, taskIds?: string[]) {
  const taskWhere =
    taskIds && taskIds.length > 0
      ? and(eq(tasks.userId, userId), inArray(tasks.id, taskIds))
      : eq(tasks.userId, userId);

  const taskRows = await db
    .select()
    .from(tasks)
    .where(taskWhere)
    .orderBy(desc(tasks.createdAt));

  const ids = taskRows.map((row) => row.id);
  if (ids.length === 0) {
    return { taskRows, checklistRows: [], attachmentRows: [] };
  }

  const [checklistRows, attachmentRows] = await Promise.all([
    db
      .select()
      .from(taskChecklistItems)
      .where(inArray(taskChecklistItems.taskId, ids))
      .orderBy(asc(taskChecklistItems.sortOrder), asc(taskChecklistItems.createdAt)),
    db
      .select()
      .from(taskAttachments)
      .where(inArray(taskAttachments.taskId, ids))
      .orderBy(desc(taskAttachments.createdAt)),
  ]);

  return { taskRows, checklistRows, attachmentRows };
}

function serializeTasks(input: {
  taskRows: Array<typeof tasks.$inferSelect>;
  checklistRows: Array<typeof taskChecklistItems.$inferSelect>;
  attachmentRows: Array<typeof taskAttachments.$inferSelect>;
}) {
  const attachmentByChecklist = new Map<string, Array<typeof taskAttachments.$inferSelect>>();
  for (const attachment of input.attachmentRows) {
    const bucket = attachmentByChecklist.get(attachment.checklistItemId) ?? [];
    bucket.push(attachment);
    attachmentByChecklist.set(attachment.checklistItemId, bucket);
  }

  const checklistByTask = new Map<string, Array<typeof taskChecklistItems.$inferSelect>>();
  for (const item of input.checklistRows) {
    const bucket = checklistByTask.get(item.taskId) ?? [];
    bucket.push(item);
    checklistByTask.set(item.taskId, bucket);
  }

  return input.taskRows.map((task) => {
    const checklist = (checklistByTask.get(task.id) ?? []).map((item) => {
      const attachments = attachmentByChecklist.get(item.id) ?? [];
      return {
        id: item.id,
        label: item.label,
        isRequired: item.isRequired,
        sortOrder: item.sortOrder,
        isCompleted: attachments.length > 0,
        attachments: attachments.map((attachment) => ({
          id: attachment.id,
          filename: attachment.filename,
          fileType: attachment.fileType,
          fileSize: attachment.fileSize,
          storagePath: attachment.storagePath,
          downloadUrl: `/api/storage/object?path=${encodeURIComponent(attachment.storagePath)}`,
          createdAt: attachment.createdAt.toISOString(),
        })),
      };
    });

    const requiredCount = checklist.filter((item) => item.isRequired).length;
    const completedRequiredCount = checklist.filter((item) => item.isRequired && item.isCompleted).length;

    return {
      ...task,
      dueDate: task.dueDate ? task.dueDate.toISOString() : null,
      financeEmailSentAt: task.financeEmailSentAt ? task.financeEmailSentAt.toISOString() : null,
      checklistItems: checklist,
      checklistSummary: {
        requiredCount,
        completedRequiredCount,
        isComplete: requiredCount > 0 && requiredCount === completedRequiredCount,
      },
    };
  });
}

function buildFinanceEmailHtml(payload: {
  title: string;
  description: string | null;
  dueDate: string | null;
  checklistItems: Array<{
    label: string;
    attachments: Array<{ filename: string }>;
  }>;
}) {
  const rows = payload.checklistItems
    .map((item) => {
      const fileNames = item.attachments.map((attachment) => escapeHtml(attachment.filename)).join(', ');
      return `
        <tr>
          <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#111827;">${escapeHtml(item.label)}</td>
          <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#374151;">${fileNames || '-'}</td>
        </tr>
      `;
    })
    .join('');

  return `
    <div style="font-family:Segoe UI,Arial,sans-serif;background:#f8fafc;padding:24px;color:#111827;">
      <div style="max-width:720px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:18px;overflow:hidden;">
        <div style="padding:24px 28px;background:linear-gradient(135deg,#0f766e,#1d4ed8);color:#ffffff;">
          <p style="margin:0 0 6px;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;opacity:0.8;">Manajemen Tugas</p>
          <h1 style="margin:0;font-size:22px;line-height:1.3;">Dokumen pertanggungjawaban siap ditinjau</h1>
        </div>
        <div style="padding:24px 28px;">
          <p style="margin:0 0 16px;font-size:14px;line-height:1.7;">
            Tugas <strong>${escapeHtml(payload.title)}</strong> telah dilengkapi seluruh dokumen wajib dan dikirimkan untuk tindak lanjut bagian keuangan.
          </p>
          ${
            payload.description
              ? `<p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:#475569;">${escapeHtml(payload.description)}</p>`
              : ''
          }
          ${
            payload.dueDate
              ? `<p style="margin:0 0 16px;font-size:13px;color:#475569;">Tenggat tugas: ${escapeHtml(payload.dueDate)}</p>`
              : ''
          }
          <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
            <thead>
              <tr style="background:#f8fafc;">
                <th style="padding:10px 14px;text-align:left;font-size:12px;color:#64748b;border-bottom:1px solid #e5e7eb;">Checklist</th>
                <th style="padding:10px 14px;text-align:left;font-size:12px;color:#64748b;border-bottom:1px solid #e5e7eb;">Dokumen</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          <p style="margin:16px 0 0;font-size:12px;color:#94a3b8;">Email ini dikirim otomatis oleh Sistem Sekretariat.</p>
        </div>
      </div>
    </div>
  `;
}

app.get('/', async (c) => {
  const dbUser = await requireSecretary(c);
  if (!dbUser) return c.json({ error: 'Unauthorized' }, 401);

  try {
    const graph = await loadTaskGraph(dbUser.id);
    return c.json({ data: serializeTasks(graph) });
  } catch (error) {
    if (isTaskSchemaCompatibilityError(error)) {
      const data = await loadLegacyTasks(dbUser.id);
      return c.json({
        data,
        meta: {
          schemaReady: false,
          warning: 'Schema task checklist belum diterapkan. Task lama tetap ditampilkan.',
        },
      });
    }
    return internalServerError(c, 'tasks/get', error, 'Gagal memuat data tugas.');
  }
});

app.post('/', async (c) => {
  const dbUser = await requireSecretary(c);
  if (!dbUser) return c.json({ error: 'Unauthorized' }, 401);

  const body = await c.req.json();
  const parsed = createTaskSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
  }

  let dueDate: Date | null | undefined;
  try {
    dueDate = parseDueDate(parsed.data.dueDate);
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'Format tenggat waktu tidak valid.' }, 400);
  }

  try {
    const [created] = await db
      .insert(tasks)
      .values({
        userId: dbUser.id,
        title: parsed.data.title.trim(),
        description: parsed.data.description?.trim() || null,
        kind: parsed.data.kind ?? 'general',
        status: parsed.data.status ?? 'todo',
        priority: parsed.data.priority ?? 'medium',
        financePicEmail: parsed.data.financePicEmail?.trim() || null,
        dueDate,
      })
      .returning();

    if (created.kind === TRAVEL_ACCOUNTABILITY_KIND) {
      await ensureTravelChecklist(created.id);
    }

    const graph = await loadTaskGraph(dbUser.id, [created.id]);
    const [serialized] = serializeTasks(graph);
    return c.json({ data: serialized }, 201);
  } catch (error) {
    if (isTaskSchemaCompatibilityError(error)) {
      if ((parsed.data.kind ?? 'general') === TRAVEL_ACCOUNTABILITY_KIND || parsed.data.financePicEmail) {
        return c.json(
          { error: 'Fitur checklist perjadin belum aktif di database. Jalankan `npm run db:ensure-task-docs`.' },
          409,
        );
      }

      const created = await insertLegacyTask({
        userId: dbUser.id,
        title: parsed.data.title.trim(),
        description: parsed.data.description?.trim() || null,
        status: parsed.data.status ?? 'todo',
        priority: parsed.data.priority ?? 'medium',
        dueDate,
      });
      return c.json({ data: created }, 201);
    }
    return internalServerError(c, 'tasks/post', error, 'Gagal membuat tugas.');
  }
});

app.post('/:id/attachments', async (c) => {
  const dbUser = await requireSecretary(c);
  if (!dbUser) return c.json({ error: 'Unauthorized' }, 401);

  const taskId = c.req.param('id');
  let task;
  try {
    task = await getOwnedTask(dbUser.id, taskId);
  } catch (error) {
    if (isTaskSchemaCompatibilityError(error)) {
      return c.json({ error: 'Fitur checklist perjadin belum aktif di database. Jalankan `npm run db:ensure-task-docs`.' }, 409);
    }
    return internalServerError(c, 'tasks/attachments/get-owned-task', error, 'Gagal memuat task.');
  }
  if (!task) return c.json({ error: 'Task not found' }, 404);

  let formData: FormData;
  try {
    formData = await c.req.formData();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Malformed multipart form data.';
    return c.json({ error: `Gagal membaca upload form: ${message}` }, 400);
  }

  const checklistItemId = String(formData.get('checklistItemId') || '');
  if (!checklistItemId) return c.json({ error: 'Checklist item wajib dipilih.' }, 400);

  const [checklistItem] = await db
    .select()
    .from(taskChecklistItems)
    .where(and(eq(taskChecklistItems.id, checklistItemId), eq(taskChecklistItems.taskId, task.id)))
    .limit(1);

  if (!checklistItem) {
    return c.json({ error: 'Checklist item tidak ditemukan.' }, 404);
  }

  const files = Array.from(formData.getAll('files')).filter((file): file is File => file instanceof File);
  if (files.length === 0) {
    return c.json({ error: 'No files uploaded.' }, 400);
  }
  if (files.length > MAX_FILES) {
    return c.json({ error: `Max ${MAX_FILES} files per upload.` }, 400);
  }

  const now = Date.now();
  const rowsToInsert: Array<typeof taskAttachments.$inferInsert> = [];

  for (const file of files) {
    try {
      const uploaded = await uploadValidatedTaskAttachment({
        userId: dbUser.id,
        taskId: task.id,
        checklistItemId: checklistItem.id,
        file,
        now,
      });
      rowsToInsert.push(uploaded.row);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Upload lampiran gagal diproses.';
      if (message.startsWith('File terlalu besar') || message.startsWith('File validation failed')) {
        return c.json({ error: message }, 400);
      }
      return internalServerError(
        c,
        'tasks/attachments/upload',
        error,
        'Upload lampiran gagal diproses. Silakan coba lagi.',
      );
    }
  }

  await db.insert(taskAttachments).values(rowsToInsert);
  await db.update(tasks).set({ updatedAt: new Date() }).where(eq(tasks.id, task.id));

  const graph = await loadTaskGraph(dbUser.id, [task.id]);
  const [serialized] = serializeTasks(graph);
  return c.json({ data: serialized }, 201);
});

app.post('/:id/attachments/auto-classify', async (c) => {
  const dbUser = await requireSecretary(c);
  if (!dbUser) return c.json({ error: 'Unauthorized' }, 401);

  const taskId = c.req.param('id');
  let task;
  try {
    task = await getOwnedTask(dbUser.id, taskId);
  } catch (error) {
    if (isTaskSchemaCompatibilityError(error)) {
      return c.json({ error: 'Fitur checklist perjadin belum aktif di database. Jalankan `npm run db:ensure-task-docs`.' }, 409);
    }
    return internalServerError(c, 'tasks/attachments/auto/get-owned-task', error, 'Gagal memuat task.');
  }
  if (!task) return c.json({ error: 'Task not found' }, 404);
  if (task.kind !== TRAVEL_ACCOUNTABILITY_KIND) {
    return c.json({ error: 'Auto-classify hanya tersedia untuk task pertanggungjawaban perjalanan dinas.' }, 400);
  }
  await ensureTravelChecklist(task.id);

  let formData: FormData;
  try {
    formData = await c.req.formData();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Malformed multipart form data.';
    return c.json({ error: `Gagal membaca upload form: ${message}` }, 400);
  }

  const files = Array.from(formData.getAll('files')).filter((file): file is File => file instanceof File);
  if (files.length === 0) {
    return c.json({ error: 'No files uploaded.' }, 400);
  }
  if (files.length > MAX_FILES) {
    return c.json({ error: `Max ${MAX_FILES} files per upload.` }, 400);
  }

  const checklistRows = await db
    .select()
    .from(taskChecklistItems)
    .where(eq(taskChecklistItems.taskId, task.id))
    .orderBy(asc(taskChecklistItems.sortOrder), asc(taskChecklistItems.createdAt));

  if (checklistRows.length === 0) {
    return c.json({ error: 'Checklist dokumen belum tersedia untuk task ini.' }, 400);
  }

  const checklistByLabel = new Map(checklistRows.map((item) => [item.label, item] as const));
  const now = Date.now();
  const rowsToInsert: Array<typeof taskAttachments.$inferInsert> = [];
  const matched: Array<{ filename: string; checklistLabel: string; via: 'content' | 'ocr' | 'filename' }> = [];
  const unmatched: string[] = [];

  for (const file of files) {
    try {
      const uploaded = await uploadValidatedTaskAttachment({
        userId: dbUser.id,
        taskId: task.id,
        checklistItemId: checklistRows[0]?.id ?? '',
        file,
        now,
      });

      let extractedText = '';
      let detectedVia: 'content' | 'ocr' | 'filename' | null = null;
      try {
        extractedText = (await extractDocumentText({
          bytes: uploaded.bytes,
          mimeType: uploaded.detectedMimeType,
          filename: file.name,
        })).trim();
      } catch {
        extractedText = '';
      }

      if (!extractedText && (uploaded.detectedMimeType.startsWith('image/') || uploaded.detectedMimeType === 'application/pdf')) {
        try {
          extractedText = (await extractVisualDocumentTextWithAi({
            userId: dbUser.id,
            bytes: uploaded.bytes,
            mimeType: uploaded.detectedMimeType,
            filename: file.name,
          })).trim();
          if (extractedText) detectedVia = 'ocr';
        } catch {
          extractedText = '';
        }
      }

      const contentLabel = extractedText ? classifyChecklistLabel({ filename: file.name, text: extractedText }) : null;
      const fallbackLabel = classifyChecklistLabel({ filename: file.name, text: '' });
      const checklistLabel = contentLabel ?? fallbackLabel;
      const via = contentLabel ? (detectedVia ?? 'content') : fallbackLabel ? 'filename' as const : null;

      if (!checklistLabel || !via) {
        unmatched.push(file.name);
        await removeObjects([uploaded.row.storagePath]);
        continue;
      }

      const checklistItem = checklistByLabel.get(checklistLabel);
      if (!checklistItem) {
        unmatched.push(file.name);
        await removeObjects([uploaded.row.storagePath]);
        continue;
      }

      rowsToInsert.push({
        ...uploaded.row,
        checklistItemId: checklistItem.id,
      });
      matched.push({ filename: file.name, checklistLabel, via });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Upload lampiran gagal diproses.';
      if (message.startsWith('File terlalu besar') || message.startsWith('File validation failed')) {
        return c.json({ error: message }, 400);
      }
      return internalServerError(
        c,
        'tasks/attachments/auto-classify',
        error,
        'Auto-classify dokumen gagal diproses. Silakan coba lagi.',
      );
    }
  }

  if (rowsToInsert.length === 0) {
    return c.json({
      error: 'Tidak ada file yang berhasil dikenali otomatis. Gunakan upload manual per item.',
      meta: { unmatched },
    }, 400);
  }

  await db.insert(taskAttachments).values(rowsToInsert);
  await db.update(tasks).set({ updatedAt: new Date() }).where(eq(tasks.id, task.id));

  const graph = await loadTaskGraph(dbUser.id, [task.id]);
  const [serialized] = serializeTasks(graph);
  return c.json({
    data: serialized,
    meta: {
      matched,
      unmatched,
    },
  }, 201);
});

app.delete('/:id/attachments/:attachmentId', async (c) => {
  const dbUser = await requireSecretary(c);
  if (!dbUser) return c.json({ error: 'Unauthorized' }, 401);

  const taskId = c.req.param('id');
  const attachmentId = c.req.param('attachmentId');
  let task;
  try {
    task = await getOwnedTask(dbUser.id, taskId);
  } catch (error) {
    if (isTaskSchemaCompatibilityError(error)) {
      return c.json({ error: 'Fitur checklist perjadin belum aktif di database. Jalankan `npm run db:ensure-task-docs`.' }, 409);
    }
    return internalServerError(c, 'tasks/attachments/delete/get-owned-task', error, 'Gagal memuat task.');
  }
  if (!task) return c.json({ error: 'Task not found' }, 404);

  const [attachment] = await db
    .select()
    .from(taskAttachments)
    .where(and(eq(taskAttachments.id, attachmentId), eq(taskAttachments.taskId, task.id)))
    .limit(1);

  if (!attachment) return c.json({ error: 'Lampiran tidak ditemukan.' }, 404);

  await db.delete(taskAttachments).where(eq(taskAttachments.id, attachment.id));

  try {
    await removeObjects([attachment.storagePath]);
  } catch (error) {
    console.error('[tasks/attachments/delete/storage]', error);
  }

  await db.update(tasks).set({ updatedAt: new Date() }).where(eq(tasks.id, task.id));

  const graph = await loadTaskGraph(dbUser.id, [task.id]);
  const [serialized] = serializeTasks(graph);
  return c.json({ data: serialized });
});

app.patch('/:id/attachments/:attachmentId', async (c) => {
  const dbUser = await requireSecretary(c);
  if (!dbUser) return c.json({ error: 'Unauthorized' }, 401);

  const taskId = c.req.param('id');
  const attachmentId = c.req.param('attachmentId');
  let task;
  try {
    task = await getOwnedTask(dbUser.id, taskId);
  } catch (error) {
    if (isTaskSchemaCompatibilityError(error)) {
      return c.json({ error: 'Fitur checklist perjadin belum aktif di database. Jalankan `npm run db:ensure-task-docs`.' }, 409);
    }
    return internalServerError(c, 'tasks/attachments/move/get-owned-task', error, 'Gagal memuat task.');
  }
  if (!task) return c.json({ error: 'Task not found' }, 404);

  const body = await c.req.json();
  const parsed = moveAttachmentSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
  }

  const [attachment] = await db
    .select()
    .from(taskAttachments)
    .where(and(eq(taskAttachments.id, attachmentId), eq(taskAttachments.taskId, task.id)))
    .limit(1);

  if (!attachment) return c.json({ error: 'Lampiran tidak ditemukan.' }, 404);

  const [targetChecklistItem] = await db
    .select()
    .from(taskChecklistItems)
    .where(and(eq(taskChecklistItems.id, parsed.data.checklistItemId), eq(taskChecklistItems.taskId, task.id)))
    .limit(1);

  if (!targetChecklistItem) {
    return c.json({ error: 'Kategori tujuan tidak ditemukan pada task ini.' }, 404);
  }

  if (attachment.checklistItemId === targetChecklistItem.id) {
    const graph = await loadTaskGraph(dbUser.id, [task.id]);
    const [serialized] = serializeTasks(graph);
    return c.json({ data: serialized });
  }

  await db
    .update(taskAttachments)
    .set({ checklistItemId: targetChecklistItem.id })
    .where(eq(taskAttachments.id, attachment.id));

  await db.update(tasks).set({ updatedAt: new Date() }).where(eq(tasks.id, task.id));

  const graph = await loadTaskGraph(dbUser.id, [task.id]);
  const [serialized] = serializeTasks(graph);
  return c.json({ data: serialized });
});

app.post('/:id/send-to-finance', async (c) => {
  const dbUser = await requireSecretary(c);
  if (!dbUser) return c.json({ error: 'Unauthorized' }, 401);

  const taskId = c.req.param('id');
  let serialized;
  try {
    const graph = await loadTaskGraph(dbUser.id, [taskId]);
    [serialized] = serializeTasks(graph);
  } catch (error) {
    if (isTaskSchemaCompatibilityError(error)) {
      return c.json({ error: 'Fitur checklist perjadin belum aktif di database. Jalankan `npm run db:ensure-task-docs`.' }, 409);
    }
    return internalServerError(c, 'tasks/send-to-finance/load', error, 'Gagal memuat task.');
  }
  if (!serialized) return c.json({ error: 'Task not found' }, 404);

  if (serialized.kind !== TRAVEL_ACCOUNTABILITY_KIND) {
    return c.json({ error: 'Fitur kirim ke keuangan hanya tersedia untuk task pertanggungjawaban perjalanan dinas.' }, 400);
  }

  if (!serialized.financePicEmail) {
    return c.json({ error: 'Email PIC keuangan belum diisi.' }, 400);
  }

  if (!serialized.checklistSummary.isComplete) {
    return c.json({ error: 'Dokumen wajib belum lengkap. Lengkapi seluruh checklist terlebih dahulu.' }, 400);
  }

  const [emailCfg] = await db
    .select()
    .from(emailConfigs)
    .where(eq(emailConfigs.userId, dbUser.id))
    .limit(1);

  if (!emailCfg) {
    return c.json({ error: 'Konfigurasi email Gmail belum diatur. Buka Pengaturan → Email.' }, 400);
  }

  const attachmentsForEmail = await Promise.all(
    serialized.checklistItems.flatMap((item) =>
      item.attachments.map(async (attachment) => {
        const downloaded = await import('../../../lib/objectStorage').then((m) => m.downloadObject(attachment.storagePath));
        return {
          filename: attachment.filename,
          content: Buffer.from(downloaded.body),
          contentType: downloaded.contentType || attachment.fileType || 'application/octet-stream',
        };
      }),
    ),
  );

  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: emailCfg.gmailAddress,
      pass: decrypt(emailCfg.gmailAppPassword),
    },
    tls: {
      rejectUnauthorized: true,
    },
  });

  try {
    await transporter.sendMail({
      from: `"${emailCfg.fromName}" <${emailCfg.gmailAddress}>`,
      to: serialized.financePicEmail,
      subject: `Dokumen pertanggungjawaban siap diproses - ${serialized.title}`,
      html: buildFinanceEmailHtml({
        title: serialized.title,
        description: serialized.description,
        dueDate: serialized.dueDate,
        checklistItems: serialized.checklistItems.map((item) => ({
          label: item.label,
          attachments: item.attachments.map((attachment) => ({ filename: attachment.filename })),
        })),
      }),
      text: `Dokumen pertanggungjawaban untuk tugas "${serialized.title}" telah lengkap dan siap diproses.`,
      attachments: attachmentsForEmail,
    });
  } catch (error) {
    return internalServerError(
      c,
      'tasks/send-to-finance',
      error,
      'Gagal mengirim email ke PIC keuangan.',
    );
  }

  await db
    .update(tasks)
    .set({ financeEmailSentAt: new Date(), updatedAt: new Date() })
    .where(eq(tasks.id, serialized.id));

  const refreshed = await loadTaskGraph(dbUser.id, [serialized.id]);
  const [updated] = serializeTasks(refreshed);
  return c.json({ data: updated });
});

app.get('/:id', async (c) => {
  const dbUser = await requireSecretary(c);
  if (!dbUser) return c.json({ error: 'Unauthorized' }, 401);

  const taskId = c.req.param('id');
  try {
    const graph = await loadTaskGraph(dbUser.id, [taskId]);
    const [serialized] = serializeTasks(graph);
    if (!serialized) return c.json({ error: 'Task not found' }, 404);
    return c.json({ data: serialized });
  } catch (error) {
    if (isTaskSchemaCompatibilityError(error)) {
      const [legacy] = await loadLegacyTasks(dbUser.id, [taskId]);
      if (!legacy) return c.json({ error: 'Task not found' }, 404);
      return c.json({ data: legacy, meta: { schemaReady: false } });
    }
    return internalServerError(c, 'tasks/get-by-id', error, 'Gagal memuat task.');
  }
});

app.patch('/:id', async (c) => {
  const dbUser = await requireSecretary(c);
  if (!dbUser) return c.json({ error: 'Unauthorized' }, 401);

  const id = c.req.param('id');
  const body = await c.req.json();
  const parsed = updateTaskSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
  }

  let dueDate: Date | null | undefined;
  try {
    dueDate = parseDueDate(parsed.data.dueDate);
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'Format tenggat waktu tidak valid.' }, 400);
  }

  try {
    const [updated] = await db
      .update(tasks)
      .set({
        ...(parsed.data.title !== undefined ? { title: parsed.data.title.trim() } : {}),
        ...(parsed.data.description !== undefined ? { description: parsed.data.description?.trim() || null } : {}),
        ...(parsed.data.kind !== undefined ? { kind: parsed.data.kind } : {}),
        ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
        ...(parsed.data.priority !== undefined ? { priority: parsed.data.priority } : {}),
        ...(parsed.data.financePicEmail !== undefined ? { financePicEmail: parsed.data.financePicEmail?.trim() || null } : {}),
        ...(dueDate !== undefined ? { dueDate } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(tasks.id, id), eq(tasks.userId, dbUser.id)))
      .returning();

    if (!updated) return c.json({ error: 'Task not found' }, 404);

    if (updated.kind === TRAVEL_ACCOUNTABILITY_KIND) {
      await ensureTravelChecklist(updated.id);
    }

    const graph = await loadTaskGraph(dbUser.id, [updated.id]);
    const [serialized] = serializeTasks(graph);
    return c.json({ data: serialized });
  } catch (error) {
    if (isTaskSchemaCompatibilityError(error)) {
      if (parsed.data.kind === TRAVEL_ACCOUNTABILITY_KIND || parsed.data.financePicEmail !== undefined) {
        return c.json(
          { error: 'Fitur checklist perjadin belum aktif di database. Jalankan `npm run db:ensure-task-docs`.' },
          409,
        );
      }

      const updated = await updateLegacyTask({
        userId: dbUser.id,
        taskId: id,
        title: parsed.data.title?.trim(),
        description: parsed.data.description !== undefined ? parsed.data.description?.trim() || null : undefined,
        status: parsed.data.status,
        priority: parsed.data.priority,
        dueDate,
      });
      if (!updated) return c.json({ error: 'Task not found' }, 404);
      return c.json({ data: updated });
    }
    return internalServerError(c, 'tasks/patch', error, 'Gagal memperbarui tugas.');
  }
});

app.delete('/:id', async (c) => {
  const dbUser = await requireSecretary(c);
  if (!dbUser) return c.json({ error: 'Unauthorized' }, 401);

  const id = c.req.param('id');
  try {
    const task = await getOwnedTask(dbUser.id, id);
    if (!task) return c.json({ error: 'Task not found' }, 404);

    const attachments = await db
      .select({ storagePath: taskAttachments.storagePath })
      .from(taskAttachments)
      .where(eq(taskAttachments.taskId, task.id));

    const [deleted] = await db
      .delete(tasks)
      .where(and(eq(tasks.id, id), eq(tasks.userId, dbUser.id)))
      .returning();

    if (attachments.length > 0) {
      try {
        await removeObjects(attachments.map((attachment) => attachment.storagePath));
      } catch (error) {
        console.error('[tasks/delete/storage]', error);
      }
    }

    return c.json({ data: deleted });
  } catch (error) {
    if (isTaskSchemaCompatibilityError(error)) {
      const result = await db.execute(sql`
        delete from tasks
        where id = ${id} and user_id = ${dbUser.id}
        returning id, user_id, title, description, status, priority, due_date, created_at, updated_at
      `);
      const [deleted] = serializeLegacyTasks(result.rows as LegacyTaskRow[]);
      if (!deleted) return c.json({ error: 'Task not found' }, 404);
      return c.json({ data: deleted });
    }
    return internalServerError(c, 'tasks/delete', error, 'Gagal menghapus tugas.');
  }
});

export default app;
