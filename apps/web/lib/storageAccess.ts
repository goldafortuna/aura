import { and, eq, or } from 'drizzle-orm';
import { db } from '../db';
import { documents, meetingMinutes, taskAttachments, tasks } from '../db/schema';

const DOCUMENTS_PREFIX = 'documents';
const MEETING_MINUTES_PREFIX = 'meeting-minutes';
const TASK_ATTACHMENTS_PREFIX = 'task-attachments';

function normalizeStoragePath(input: string) {
  const normalized = input.replace(/\\/g, '/').trim().replace(/^\/+/, '');
  if (!normalized) return null;

  const segments = normalized.split('/');
  if (segments.some((segment) => !segment || segment === '.' || segment === '..')) {
    return null;
  }

  return segments.join('/');
}

export function getUserStoragePrefixes(userId: string) {
  return [
    `${DOCUMENTS_PREFIX}/${userId}/`,
    `${MEETING_MINUTES_PREFIX}/${userId}/`,
    `${TASK_ATTACHMENTS_PREFIX}/${userId}/`,
  ] as const;
}

export function validateUserScopedStoragePath(userId: string, input: string) {
  const normalizedPath = normalizeStoragePath(input);
  if (!normalizedPath) {
    return {
      ok: false as const,
      error: 'Storage path tidak valid.',
    };
  }

  const allowedPrefixes = getUserStoragePrefixes(userId);
  const isAllowed = allowedPrefixes.some((prefix) => normalizedPath.startsWith(prefix));
  if (!isAllowed) {
    return {
      ok: false as const,
      error: 'Storage path harus berada di namespace file milik user.',
    };
  }

  return {
    ok: true as const,
    normalizedPath,
  };
}

export async function userOwnsStoragePath(userId: string, input: string) {
  const validated = validateUserScopedStoragePath(userId, input);
  if (!validated.ok) return validated;

  const normalizedPath = validated.normalizedPath;

  const [documentRow] = await db
    .select({ id: documents.id })
    .from(documents)
    .where(and(eq(documents.userId, userId), eq(documents.storagePath, normalizedPath)))
    .limit(1);

  if (documentRow) {
    return { ok: true as const, normalizedPath };
  }

  const [meetingRow] = await db
    .select({ id: meetingMinutes.id })
    .from(meetingMinutes)
    .where(
      and(
        eq(meetingMinutes.userId, userId),
        or(
          eq(meetingMinutes.storagePath, normalizedPath),
          eq(meetingMinutes.correctedStoragePath, normalizedPath),
        ),
      ),
    )
    .limit(1);

  if (meetingRow) {
    return { ok: true as const, normalizedPath };
  }

  const [taskAttachmentRow] = await db
    .select({ id: taskAttachments.id })
    .from(taskAttachments)
    .innerJoin(tasks, eq(tasks.id, taskAttachments.taskId))
    .where(and(eq(tasks.userId, userId), eq(taskAttachments.storagePath, normalizedPath)))
    .limit(1);

  if (taskAttachmentRow) {
    return { ok: true as const, normalizedPath };
  }

  return {
    ok: false as const,
    error: 'Storage object tidak ditemukan atau bukan milik user.',
  };
}
