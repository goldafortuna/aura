import { Hono } from 'hono';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import path from 'path';
import { z } from 'zod';
import { db } from '../../../db';
import { downloadObject } from '../../../lib/objectStorage';
import {
  academyCourses,
  academyLessons,
  academyModules,
  academyQuizQuestions,
  userAcademyProgress,
  userLessonCompletions,
  userQuizAttempts,
} from '../../../db/schema';
import { requireSecretary, requireSuperAdmin } from '../../../lib/middleware/auth';

const app = new Hono();

const completeLessonSchema = z.object({
  timeSpent: z.number().int().positive().optional(),
});

const quizAttemptSchema = z.object({
  selectedOption: z.number().int().nonnegative(),
  timeSpent: z.number().int().positive().optional(),
});

const courseStatusSchema = z.enum(['draft', 'published', 'archived']);
const courseSchema = z.object({
  slug: z.string().min(1).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug hanya boleh huruf kecil, angka, dan tanda hubung.'),
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  thumbnail: z.string().url().optional().or(z.literal('')).nullable(),
  totalDuration: z.number().int().nonnegative().optional().nullable(),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional().nullable(),
  status: courseStatusSchema.optional(),
  isPublic: z.boolean().optional(),
});

const moduleSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  order: z.number().int().positive(),
  colorGradient: z.string().optional().nullable(),
  bgColor: z.string().optional().nullable(),
  iconColor: z.string().optional().nullable(),
});

const lessonSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  duration: z.number().int().positive().optional(),
  contentType: z.enum(['text', 'video', 'slides']).optional(),
  contentData: z.unknown().optional().nullable(),
  order: z.number().int().positive(),
  isRequired: z.boolean().optional(),
});

const adminQuizQuestionBaseSchema = z.object({
  question: z.string().min(1),
  options: z.array(z.string().min(1)).min(2).max(6),
  correctIndex: z.number().int().nonnegative(),
  explanation: z.string().optional().nullable(),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
  order: z.number().int().positive(),
});

const adminQuizQuestionSchema = adminQuizQuestionBaseSchema.refine((value) => value.correctIndex < value.options.length, {
  message: 'correctIndex harus merujuk salah satu opsi.',
  path: ['correctIndex'],
});

function normalizeNullableText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function courseValues(data: z.infer<typeof courseSchema>) {
  return {
    slug: data.slug,
    title: data.title,
    description: normalizeNullableText(data.description),
    category: normalizeNullableText(data.category),
    thumbnail: normalizeNullableText(data.thumbnail),
    totalDuration: data.totalDuration ?? null,
    difficulty: data.difficulty ?? 'beginner',
    status: data.status ?? 'draft',
    isPublic: data.isPublic ?? false,
    updatedAt: new Date(),
  };
}

function partialCourseValues(data: Partial<z.infer<typeof courseSchema>>) {
  const values: Record<string, unknown> = { updatedAt: new Date() };
  if (data.slug !== undefined) values.slug = data.slug;
  if (data.title !== undefined) values.title = data.title;
  if (data.description !== undefined) values.description = normalizeNullableText(data.description);
  if (data.category !== undefined) values.category = normalizeNullableText(data.category);
  if (data.thumbnail !== undefined) values.thumbnail = normalizeNullableText(data.thumbnail);
  if (data.totalDuration !== undefined) values.totalDuration = data.totalDuration ?? null;
  if (data.difficulty !== undefined) values.difficulty = data.difficulty ?? 'beginner';
  if (data.status !== undefined) values.status = data.status;
  if (data.isPublic !== undefined) values.isPublic = data.isPublic;
  return values;
}

function moduleValues(data: z.infer<typeof moduleSchema>) {
  return {
    title: data.title,
    description: normalizeNullableText(data.description),
    order: data.order,
    colorGradient: normalizeNullableText(data.colorGradient),
    bgColor: normalizeNullableText(data.bgColor),
    iconColor: normalizeNullableText(data.iconColor),
    updatedAt: new Date(),
  };
}

function partialModuleValues(data: Partial<z.infer<typeof moduleSchema>>) {
  const values: Record<string, unknown> = { updatedAt: new Date() };
  if (data.title !== undefined) values.title = data.title;
  if (data.description !== undefined) values.description = normalizeNullableText(data.description);
  if (data.order !== undefined) values.order = data.order;
  if (data.colorGradient !== undefined) values.colorGradient = normalizeNullableText(data.colorGradient);
  if (data.bgColor !== undefined) values.bgColor = normalizeNullableText(data.bgColor);
  if (data.iconColor !== undefined) values.iconColor = normalizeNullableText(data.iconColor);
  return values;
}

function lessonValues(data: z.infer<typeof lessonSchema>) {
  return {
    title: data.title,
    description: normalizeNullableText(data.description),
    duration: data.duration ?? 15,
    contentType: data.contentType ?? 'text',
    contentData: data.contentData ?? null,
    order: data.order,
    isRequired: data.isRequired ?? true,
    updatedAt: new Date(),
  };
}

function partialLessonValues(data: Partial<z.infer<typeof lessonSchema>>) {
  const values: Record<string, unknown> = { updatedAt: new Date() };
  if (data.title !== undefined) values.title = data.title;
  if (data.description !== undefined) values.description = normalizeNullableText(data.description);
  if (data.duration !== undefined) values.duration = data.duration ?? 15;
  if (data.contentType !== undefined) values.contentType = data.contentType ?? 'text';
  if (data.contentData !== undefined) values.contentData = data.contentData ?? null;
  if (data.order !== undefined) values.order = data.order;
  if (data.isRequired !== undefined) values.isRequired = data.isRequired ?? true;
  return values;
}

function quizQuestionValues(data: z.infer<typeof adminQuizQuestionSchema>) {
  return {
    question: data.question,
    options: data.options,
    correctIndex: data.correctIndex,
    explanation: normalizeNullableText(data.explanation),
    difficulty: data.difficulty ?? 'medium',
    order: data.order,
    updatedAt: new Date(),
  };
}

function partialQuizQuestionValues(data: Partial<z.infer<typeof adminQuizQuestionBaseSchema>>) {
  const values: Record<string, unknown> = { updatedAt: new Date() };
  if (data.question !== undefined) values.question = data.question;
  if (data.options !== undefined) values.options = data.options;
  if (data.correctIndex !== undefined) values.correctIndex = data.correctIndex;
  if (data.explanation !== undefined) values.explanation = normalizeNullableText(data.explanation);
  if (data.difficulty !== undefined) values.difficulty = data.difficulty ?? 'medium';
  if (data.order !== undefined) values.order = data.order;
  return values;
}

function getWorkspaceAcademyRoot() {
  const candidates = [
    path.resolve(process.cwd(), 'MateriAcademy'),
    path.resolve(process.cwd(), '..', '..', '..', 'MateriAcademy'),
  ];
  return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0];
}

function getLessonAssetPath(contentData: unknown) {
  if (!contentData || typeof contentData !== 'object') return null;
  const assetPath = (contentData as { assetPath?: unknown }).assetPath;
  return typeof assetPath === 'string' && assetPath.trim() ? assetPath.trim() : null;
}

function getLessonStoragePath(contentData: unknown) {
  if (!contentData || typeof contentData !== 'object') return null;
  const storagePath = (contentData as { storagePath?: unknown }).storagePath;
  return typeof storagePath === 'string' && storagePath.trim() ? storagePath.trim() : null;
}

function getMimeTypeFromFilePath(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.pdf') return 'application/pdf';
  return 'application/octet-stream';
}

async function recalculateCourseProgress(userId: string, courseId: string) {
  const modules = await db
    .select({ id: academyModules.id })
    .from(academyModules)
    .where(eq(academyModules.courseId, courseId))
    .orderBy(asc(academyModules.order), asc(academyModules.createdAt));

  const moduleIds = modules.map((module) => module.id);
  if (moduleIds.length === 0) {
    const [updated] = await db
      .update(userAcademyProgress)
      .set({
        status: 'completed',
        progressPercentage: 100,
        lastAccessedAt: new Date(),
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(userAcademyProgress.userId, userId), eq(userAcademyProgress.courseId, courseId)))
      .returning();

    if (!updated) {
      await db.insert(userAcademyProgress).values({
        userId,
        courseId,
        status: 'completed',
        progressPercentage: 100,
        startedAt: new Date(),
        lastAccessedAt: new Date(),
        completedAt: new Date(),
      });
    }

    return { progressPercentage: 100, status: 'completed' as const };
  }

  const [lessons, quizQuestions, completedLessonRows, attemptedQuestionRows] = await Promise.all([
    db
      .select({ id: academyLessons.id, moduleId: academyLessons.moduleId })
      .from(academyLessons)
      .where(inArray(academyLessons.moduleId, moduleIds)),
    db
      .select({ id: academyQuizQuestions.id, moduleId: academyQuizQuestions.moduleId })
      .from(academyQuizQuestions)
      .where(inArray(academyQuizQuestions.moduleId, moduleIds)),
    db
      .select({ lessonId: userLessonCompletions.lessonId })
      .from(userLessonCompletions)
      .innerJoin(academyLessons, eq(userLessonCompletions.lessonId, academyLessons.id))
      .where(and(eq(userLessonCompletions.userId, userId), inArray(academyLessons.moduleId, moduleIds))),
    db
      .select({ questionId: userQuizAttempts.questionId })
      .from(userQuizAttempts)
      .innerJoin(academyQuizQuestions, eq(userQuizAttempts.questionId, academyQuizQuestions.id))
      .where(and(eq(userQuizAttempts.userId, userId), inArray(academyQuizQuestions.moduleId, moduleIds))),
  ]);

  const completedLessonIds = new Set(completedLessonRows.map((row) => row.lessonId));
  const attemptedQuestionIds = new Set(attemptedQuestionRows.map((row) => row.questionId));

  let completedUnits = 0;
  let totalUnits = 0;

  for (const moduleId of moduleIds) {
    const moduleLessonRows = lessons.filter((lesson) => lesson.moduleId === moduleId);
    const moduleQuizRows = quizQuestions.filter((question) => question.moduleId === moduleId);

    totalUnits += moduleLessonRows.length;
    completedUnits += moduleLessonRows.filter((lesson) => completedLessonIds.has(lesson.id)).length;

    if (moduleQuizRows.length > 0) {
      totalUnits += 1;
      const quizCompleted = moduleQuizRows.every((question) => attemptedQuestionIds.has(question.id));
      if (quizCompleted) completedUnits += 1;
    }
  }

  const progressPercentage = totalUnits > 0 ? Math.round((completedUnits / totalUnits) * 100) : 0;
  const status = progressPercentage >= 100 ? 'completed' : progressPercentage > 0 ? 'in_progress' : 'not_started';

  const [updated] = await db
    .update(userAcademyProgress)
    .set({
      status,
      progressPercentage,
      lastAccessedAt: new Date(),
      completedAt: progressPercentage >= 100 ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(and(eq(userAcademyProgress.userId, userId), eq(userAcademyProgress.courseId, courseId)))
    .returning();

  if (!updated) {
    await db.insert(userAcademyProgress).values({
      userId,
      courseId,
      status,
      progressPercentage,
      startedAt: progressPercentage > 0 ? new Date() : null,
      lastAccessedAt: new Date(),
      completedAt: progressPercentage >= 100 ? new Date() : null,
    });
  }

  return { progressPercentage, status };
}

async function syncModuleLessonCompletionsFromQuiz(userId: string, moduleId: string) {
  const [moduleLessons, moduleQuizQuestions] = await Promise.all([
    db
      .select({ id: academyLessons.id })
      .from(academyLessons)
      .where(eq(academyLessons.moduleId, moduleId)),
    db
      .select({ id: academyQuizQuestions.id })
      .from(academyQuizQuestions)
      .where(eq(academyQuizQuestions.moduleId, moduleId)),
  ]);

  if (moduleQuizQuestions.length === 0 || moduleLessons.length === 0) return;

  const attemptedRows = await db
    .select({ questionId: userQuizAttempts.questionId })
    .from(userQuizAttempts)
    .where(and(eq(userQuizAttempts.userId, userId), inArray(userQuizAttempts.questionId, moduleQuizQuestions.map((question) => question.id))));

  const attemptedQuestionIds = new Set(attemptedRows.map((row) => row.questionId));
  const quizCompleted = moduleQuizQuestions.every((question) => attemptedQuestionIds.has(question.id));
  if (!quizCompleted) return;

  const existingCompletions = await db
    .select({ lessonId: userLessonCompletions.lessonId })
    .from(userLessonCompletions)
    .where(and(eq(userLessonCompletions.userId, userId), inArray(userLessonCompletions.lessonId, moduleLessons.map((lesson) => lesson.id))));

  const completedLessonIds = new Set(existingCompletions.map((row) => row.lessonId));
  const missingLessonIds = moduleLessons
    .map((lesson) => lesson.id)
    .filter((lessonId) => !completedLessonIds.has(lessonId));

  if (missingLessonIds.length === 0) return;

  await db.insert(userLessonCompletions).values(
    missingLessonIds.map((lessonId) => ({
      userId,
      lessonId,
      completedAt: new Date(),
      timeSpent: 0,
    })),
  );
}

async function syncCourseLessonCompletionsFromQuiz(userId: string, courseId: string) {
  const moduleRows = await db
    .select({ id: academyModules.id })
    .from(academyModules)
    .where(eq(academyModules.courseId, courseId));

  for (const moduleRow of moduleRows) {
    await syncModuleLessonCompletionsFromQuiz(userId, moduleRow.id);
  }
}

async function getAdminCourseDetail(courseId: string) {
  const [course] = await db.select().from(academyCourses).where(eq(academyCourses.id, courseId)).limit(1);
  if (!course) return null;

  const modules = await db
    .select()
    .from(academyModules)
    .where(eq(academyModules.courseId, courseId))
    .orderBy(asc(academyModules.order), asc(academyModules.createdAt));

  const moduleDetails = await Promise.all(
    modules.map(async (module) => {
      const [lessons, quizQuestions] = await Promise.all([
        db
          .select()
          .from(academyLessons)
          .where(eq(academyLessons.moduleId, module.id))
          .orderBy(asc(academyLessons.order), asc(academyLessons.createdAt)),
        db
          .select()
          .from(academyQuizQuestions)
          .where(eq(academyQuizQuestions.moduleId, module.id))
          .orderBy(asc(academyQuizQuestions.order), asc(academyQuizQuestions.createdAt)),
      ]);

      return { ...module, lessons, quizQuestions };
    }),
  );

  return { ...course, modules: moduleDetails };
}

app.get('/admin/courses', async (c) => {
  const dbUser = await requireSuperAdmin(c);
  if (!dbUser) return c.json({ error: 'Unauthorized' }, 401);

  const status = c.req.query('status') ?? 'all';
  if (status !== 'all' && !courseStatusSchema.safeParse(status).success) {
    return c.json({ error: 'Status tidak valid.' }, 400);
  }

  const rows = await db
    .select({
      id: academyCourses.id,
      slug: academyCourses.slug,
      title: academyCourses.title,
      description: academyCourses.description,
      category: academyCourses.category,
      thumbnail: academyCourses.thumbnail,
      totalDuration: academyCourses.totalDuration,
      difficulty: academyCourses.difficulty,
      status: academyCourses.status,
      isPublic: academyCourses.isPublic,
      createdAt: academyCourses.createdAt,
      updatedAt: academyCourses.updatedAt,
      moduleCount: sql<number>`count(distinct ${academyModules.id})`,
    })
    .from(academyCourses)
    .leftJoin(academyModules, eq(academyModules.courseId, academyCourses.id))
    .$dynamic()
    .where(status === 'all' ? undefined : eq(academyCourses.status, status))
    .groupBy(academyCourses.id)
    .orderBy(desc(academyCourses.updatedAt));

  return c.json({ data: rows });
});

app.post('/admin/courses', async (c) => {
  const dbUser = await requireSuperAdmin(c);
  if (!dbUser) return c.json({ error: 'Unauthorized' }, 401);

  const parsed = courseSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);

  try {
    const [created] = await db.insert(academyCourses).values(courseValues(parsed.data)).returning();
    return c.json({ data: created }, 201);
  } catch (error) {
    return c.json({ error: 'Gagal membuat course. Pastikan slug belum dipakai.', detail: error instanceof Error ? error.message : String(error) }, 400);
  }
});

app.get('/admin/courses/:courseId', async (c) => {
  const dbUser = await requireSuperAdmin(c);
  if (!dbUser) return c.json({ error: 'Unauthorized' }, 401);

  const detail = await getAdminCourseDetail(c.req.param('courseId'));
  if (!detail) return c.json({ error: 'Course not found' }, 404);
  return c.json({ data: detail });
});

app.patch('/admin/courses/:courseId', async (c) => {
  const dbUser = await requireSuperAdmin(c);
  if (!dbUser) return c.json({ error: 'Unauthorized' }, 401);

  const parsed = courseSchema.partial().safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);

  const [updated] = await db
    .update(academyCourses)
    .set(partialCourseValues(parsed.data))
    .where(eq(academyCourses.id, c.req.param('courseId')))
    .returning();
  if (!updated) return c.json({ error: 'Course not found' }, 404);
  return c.json({ data: updated });
});

app.delete('/admin/courses/:courseId', async (c) => {
  const dbUser = await requireSuperAdmin(c);
  if (!dbUser) return c.json({ error: 'Unauthorized' }, 401);

  const [deleted] = await db.delete(academyCourses).where(eq(academyCourses.id, c.req.param('courseId'))).returning();
  if (!deleted) return c.json({ error: 'Course not found' }, 404);
  return c.json({ data: deleted });
});

app.post('/admin/courses/:courseId/modules', async (c) => {
  const dbUser = await requireSuperAdmin(c);
  if (!dbUser) return c.json({ error: 'Unauthorized' }, 401);

  const courseId = c.req.param('courseId');
  const parsed = moduleSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);

  const [course] = await db.select({ id: academyCourses.id }).from(academyCourses).where(eq(academyCourses.id, courseId)).limit(1);
  if (!course) return c.json({ error: 'Course not found' }, 404);

  const [created] = await db.insert(academyModules).values({ courseId, ...moduleValues(parsed.data) }).returning();
  return c.json({ data: created }, 201);
});

app.patch('/admin/modules/:moduleId', async (c) => {
  const dbUser = await requireSuperAdmin(c);
  if (!dbUser) return c.json({ error: 'Unauthorized' }, 401);

  const parsed = moduleSchema.partial().safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);

  const [updated] = await db.update(academyModules).set(partialModuleValues(parsed.data)).where(eq(academyModules.id, c.req.param('moduleId'))).returning();
  if (!updated) return c.json({ error: 'Module not found' }, 404);
  return c.json({ data: updated });
});

app.delete('/admin/modules/:moduleId', async (c) => {
  const dbUser = await requireSuperAdmin(c);
  if (!dbUser) return c.json({ error: 'Unauthorized' }, 401);

  const [deleted] = await db.delete(academyModules).where(eq(academyModules.id, c.req.param('moduleId'))).returning();
  if (!deleted) return c.json({ error: 'Module not found' }, 404);
  return c.json({ data: deleted });
});

app.post('/admin/modules/:moduleId/lessons', async (c) => {
  const dbUser = await requireSuperAdmin(c);
  if (!dbUser) return c.json({ error: 'Unauthorized' }, 401);

  const moduleId = c.req.param('moduleId');
  const parsed = lessonSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);

  const [module] = await db.select({ id: academyModules.id }).from(academyModules).where(eq(academyModules.id, moduleId)).limit(1);
  if (!module) return c.json({ error: 'Module not found' }, 404);

  const [created] = await db.insert(academyLessons).values({ moduleId, ...lessonValues(parsed.data) }).returning();
  return c.json({ data: created }, 201);
});

app.patch('/admin/lessons/:lessonId', async (c) => {
  const dbUser = await requireSuperAdmin(c);
  if (!dbUser) return c.json({ error: 'Unauthorized' }, 401);

  const parsed = lessonSchema.partial().safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);

  const [updated] = await db.update(academyLessons).set(partialLessonValues(parsed.data)).where(eq(academyLessons.id, c.req.param('lessonId'))).returning();
  if (!updated) return c.json({ error: 'Lesson not found' }, 404);
  return c.json({ data: updated });
});

app.delete('/admin/lessons/:lessonId', async (c) => {
  const dbUser = await requireSuperAdmin(c);
  if (!dbUser) return c.json({ error: 'Unauthorized' }, 401);

  const [deleted] = await db.delete(academyLessons).where(eq(academyLessons.id, c.req.param('lessonId'))).returning();
  if (!deleted) return c.json({ error: 'Lesson not found' }, 404);
  return c.json({ data: deleted });
});

app.post('/admin/modules/:moduleId/quiz-questions', async (c) => {
  const dbUser = await requireSuperAdmin(c);
  if (!dbUser) return c.json({ error: 'Unauthorized' }, 401);

  const moduleId = c.req.param('moduleId');
  const parsed = adminQuizQuestionSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);

  const [module] = await db.select({ id: academyModules.id }).from(academyModules).where(eq(academyModules.id, moduleId)).limit(1);
  if (!module) return c.json({ error: 'Module not found' }, 404);

  const [created] = await db.insert(academyQuizQuestions).values({ moduleId, ...quizQuestionValues(parsed.data) }).returning();
  return c.json({ data: created }, 201);
});

app.patch('/admin/quiz-questions/:questionId', async (c) => {
  const dbUser = await requireSuperAdmin(c);
  if (!dbUser) return c.json({ error: 'Unauthorized' }, 401);

  const parsed = adminQuizQuestionBaseSchema.partial().safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);

  const [existing] = await db.select().from(academyQuizQuestions).where(eq(academyQuizQuestions.id, c.req.param('questionId'))).limit(1);
  if (!existing) return c.json({ error: 'Question not found' }, 404);
  const nextOptions = parsed.data.options ?? (existing.options as string[]);
  const nextCorrectIndex = parsed.data.correctIndex ?? existing.correctIndex;
  if (nextCorrectIndex >= nextOptions.length) {
    return c.json({ error: 'correctIndex harus merujuk salah satu opsi.' }, 400);
  }

  const [updated] = await db.update(academyQuizQuestions).set(partialQuizQuestionValues(parsed.data)).where(eq(academyQuizQuestions.id, c.req.param('questionId'))).returning();
  if (!updated) return c.json({ error: 'Question not found' }, 404);
  return c.json({ data: updated });
});

app.delete('/admin/quiz-questions/:questionId', async (c) => {
  const dbUser = await requireSuperAdmin(c);
  if (!dbUser) return c.json({ error: 'Unauthorized' }, 401);

  const [deleted] = await db.delete(academyQuizQuestions).where(eq(academyQuizQuestions.id, c.req.param('questionId'))).returning();
  if (!deleted) return c.json({ error: 'Question not found' }, 404);
  return c.json({ data: deleted });
});

app.get('/courses', async (c) => {
  const dbUser = await requireSecretary(c);
  if (!dbUser) return c.json({ error: 'Unauthorized' }, 401);

  const rows = await db
    .select()
    .from(academyCourses)
    .where(eq(academyCourses.status, 'published'))
    .orderBy(desc(academyCourses.createdAt));

  return c.json({ data: rows });
});

app.get('/courses/:id', async (c) => {
  const dbUser = await requireSecretary(c);
  if (!dbUser) return c.json({ error: 'Unauthorized' }, 401);

  const id = c.req.param('id');
  const [course] = await db.select().from(academyCourses).where(and(eq(academyCourses.id, id), eq(academyCourses.status, 'published'))).limit(1);
  if (!course) return c.json({ error: 'Course not found' }, 404);

  await syncCourseLessonCompletionsFromQuiz(dbUser.id, id);

  const modules = await db
    .select()
    .from(academyModules)
    .where(eq(academyModules.courseId, id))
    .orderBy(academyModules.order);

  const moduleIds = modules.map((module) => module.id);
  const lessons = moduleIds.length
    ? await db
      .select()
      .from(academyLessons)
      .where(inArray(academyLessons.moduleId, moduleIds))
      .orderBy(asc(academyLessons.order), asc(academyLessons.createdAt))
    : [];

  const quizQuestions = moduleIds.length
    ? await db
      .select()
      .from(academyQuizQuestions)
      .where(inArray(academyQuizQuestions.moduleId, moduleIds))
      .orderBy(asc(academyQuizQuestions.order), asc(academyQuizQuestions.createdAt))
    : [];

  const lessonIds = lessons.map((lesson) => lesson.id);
  const completedRows = lessonIds.length
    ? await db
      .select({ lessonId: userLessonCompletions.lessonId })
      .from(userLessonCompletions)
      .where(and(eq(userLessonCompletions.userId, dbUser.id), inArray(userLessonCompletions.lessonId, lessonIds)))
    : [];

  const attemptedRows = moduleIds.length
    ? await db
      .select({
        moduleId: academyQuizQuestions.moduleId,
        questionId: academyQuizQuestions.id,
      })
      .from(userQuizAttempts)
      .innerJoin(academyQuizQuestions, eq(userQuizAttempts.questionId, academyQuizQuestions.id))
      .where(and(eq(userQuizAttempts.userId, dbUser.id), inArray(academyQuizQuestions.moduleId, moduleIds)))
    : [];

  const completedLessonIds = new Set(completedRows.map((row) => row.lessonId));
  const attemptedQuestionIds = new Set(attemptedRows.map((row) => row.questionId));
  const lessonsByModule = new Map<string, typeof lessons>();
  const quizByModule = new Map<string, typeof quizQuestions>();

  for (const lesson of lessons) {
    const bucket = lessonsByModule.get(lesson.moduleId) ?? [];
    bucket.push(lesson);
    lessonsByModule.set(lesson.moduleId, bucket);
  }

  for (const question of quizQuestions) {
    const bucket = quizByModule.get(question.moduleId) ?? [];
    bucket.push(question);
    quizByModule.set(question.moduleId, bucket);
  }

  const modulesWithContent = modules.map((module) => {
    const moduleLessons = (lessonsByModule.get(module.id) ?? []).map((lesson) => ({
      ...lesson,
      isCompleted: completedLessonIds.has(lesson.id),
    }));
    const moduleQuiz = quizByModule.get(module.id) ?? [];

    return {
      ...module,
      lessons: moduleLessons,
      quizQuestionCount: moduleQuiz.length,
      completedLessons: moduleLessons.filter((lesson) => lesson.isCompleted).length,
      quizCompleted: moduleQuiz.length > 0 && moduleQuiz.every((question) => attemptedQuestionIds.has(question.id)),
    };
  });

  const progress = await recalculateCourseProgress(dbUser.id, id);

  return c.json({
    data: {
      ...course,
      modules: modulesWithContent,
      userProgress: progress,
    },
  });
});

app.get('/lessons/:lessonId', async (c) => {
  const dbUser = await requireSecretary(c);
  if (!dbUser) return c.json({ error: 'Unauthorized' }, 401);

  const lessonId = c.req.param('lessonId');
  const [lesson] = await db.select().from(academyLessons).where(eq(academyLessons.id, lessonId)).limit(1);
  if (!lesson) return c.json({ error: 'Lesson not found' }, 404);

  const [module] = await db.select().from(academyModules).where(eq(academyModules.id, lesson.moduleId)).limit(1);
  if (!module) return c.json({ error: 'Module not found' }, 404);

  const [course] = await db
    .select()
    .from(academyCourses)
    .where(and(eq(academyCourses.id, module.courseId), eq(academyCourses.status, 'published')))
    .limit(1);
  if (!course) return c.json({ error: 'Course not found' }, 404);

  const [moduleLessons, completion] = await Promise.all([
    db
      .select()
      .from(academyLessons)
      .where(eq(academyLessons.moduleId, module.id))
      .orderBy(asc(academyLessons.order), asc(academyLessons.createdAt)),
    db
      .select({ lessonId: userLessonCompletions.lessonId })
      .from(userLessonCompletions)
      .where(and(eq(userLessonCompletions.userId, dbUser.id), eq(userLessonCompletions.lessonId, lessonId)))
      .limit(1),
  ]);

  const currentIndex = moduleLessons.findIndex((item) => item.id === lessonId);
  const previousLesson = currentIndex > 0 ? moduleLessons[currentIndex - 1] : null;
  const nextLesson = currentIndex >= 0 && currentIndex < moduleLessons.length - 1 ? moduleLessons[currentIndex + 1] : null;

  return c.json({
    data: {
      ...lesson,
      module: {
        id: module.id,
        title: module.title,
        order: module.order,
      },
      course: {
        id: course.id,
        title: course.title,
        slug: course.slug,
      },
      previousLesson: previousLesson ? { id: previousLesson.id, title: previousLesson.title } : null,
      nextLesson: nextLesson ? { id: nextLesson.id, title: nextLesson.title } : null,
      isCompleted: Boolean(completion),
    },
  });
});

app.get('/lessons/:lessonId/asset', async (c) => {
  const dbUser = await requireSecretary(c);
  if (!dbUser) return c.json({ error: 'Unauthorized' }, 401);

  const lessonId = c.req.param('lessonId');
  const [lesson] = await db.select().from(academyLessons).where(eq(academyLessons.id, lessonId)).limit(1);
  if (!lesson) return c.json({ error: 'Lesson not found' }, 404);

  const storagePath = getLessonStoragePath(lesson.contentData);
  if (storagePath) {
    try {
      const downloaded = await downloadObject(storagePath);
      return new Response(Buffer.from(downloaded.body), {
        headers: {
          'Content-Type': downloaded.contentType || 'application/pdf',
          'Content-Disposition': 'inline; filename="lesson.pdf"',
          'Cache-Control': 'private, max-age=300',
          'X-Robots-Tag': 'noindex, noarchive, nosnippet',
        },
      });
    } catch {
      // Fallback ke local asset agar rollout tetap aman bila upload R2 belum lengkap.
    }
  }

  const assetPath = getLessonAssetPath(lesson.contentData);
  if (!assetPath) return c.json({ error: 'Lesson asset not configured' }, 400);

  const filePath = path.resolve(getWorkspaceAcademyRoot(), assetPath);

  try {
    const fileBuffer = await readFile(filePath);
    return new Response(fileBuffer, {
      headers: {
        'Content-Type': getMimeTypeFromFilePath(filePath),
        'Content-Disposition': `inline; filename="${path.basename(filePath)}"`,
        'Cache-Control': 'private, max-age=300',
        'X-Robots-Tag': 'noindex, noarchive, nosnippet',
      },
    });
  } catch {
    return c.json({ error: 'Lesson asset not found' }, 404);
  }
});

app.get('/modules/:moduleId/quiz', async (c) => {
  const dbUser = await requireSecretary(c);
  if (!dbUser) return c.json({ error: 'Unauthorized' }, 401);

  const moduleId = c.req.param('moduleId');
  const [module] = await db.select().from(academyModules).where(eq(academyModules.id, moduleId)).limit(1);
  if (!module) return c.json({ error: 'Module not found' }, 404);

  const [course, questions, attempts] = await Promise.all([
    db
      .select()
      .from(academyCourses)
      .where(and(eq(academyCourses.id, module.courseId), eq(academyCourses.status, 'published')))
      .limit(1),
    db
      .select()
      .from(academyQuizQuestions)
      .where(eq(academyQuizQuestions.moduleId, moduleId))
      .orderBy(asc(academyQuizQuestions.order), asc(academyQuizQuestions.createdAt)),
    db
      .select({
        questionId: userQuizAttempts.questionId,
        selectedOption: userQuizAttempts.selectedOption,
        isCorrect: userQuizAttempts.isCorrect,
      })
      .from(userQuizAttempts)
      .innerJoin(academyQuizQuestions, eq(userQuizAttempts.questionId, academyQuizQuestions.id))
      .where(and(eq(userQuizAttempts.userId, dbUser.id), eq(academyQuizQuestions.moduleId, moduleId))),
  ]);

  if (!course[0]) return c.json({ error: 'Course not found' }, 404);

  const attemptsByQuestion = new Map(attempts.map((attempt) => [attempt.questionId, attempt]));

  return c.json({
    data: {
      module: {
        id: module.id,
        title: module.title,
        order: module.order,
      },
      course: {
        id: course[0].id,
        title: course[0].title,
      },
      questions: questions.map((question) => ({
        id: question.id,
        question: question.question,
        options: question.options,
        order: question.order,
        explanation: question.explanation,
        attempt: attemptsByQuestion.get(question.id) ?? null,
      })),
    },
  });
});

app.get('/progress/courses/:courseId', async (c) => {
  const dbUser = await requireSecretary(c);
  if (!dbUser) return c.json({ error: 'Unauthorized' }, 401);

  const courseId = c.req.param('courseId');
  const [progress] = await db
    .select()
    .from(userAcademyProgress)
    .where(and(eq(userAcademyProgress.userId, dbUser.id), eq(userAcademyProgress.courseId, courseId)))
    .limit(1);

  if (!progress) {
    const [created] = await db
      .insert(userAcademyProgress)
      .values({
        userId: dbUser.id,
        courseId,
        status: 'in_progress',
        startedAt: new Date(),
      })
      .returning();
    return c.json({ data: created });
  }

  return c.json({ data: progress });
});

app.post('/progress/lessons/:lessonId/complete', async (c) => {
  const dbUser = await requireSecretary(c);
  if (!dbUser) return c.json({ error: 'Unauthorized' }, 401);

  const lessonId = c.req.param('lessonId');
  const body = await c.req.json();
  const parsed = completeLessonSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);

  const [lesson] = await db.select().from(academyLessons).where(eq(academyLessons.id, lessonId)).limit(1);
  if (!lesson) return c.json({ error: 'Lesson not found' }, 404);

  await db
    .insert(userLessonCompletions)
    .values({
      userId: dbUser.id,
      lessonId,
      timeSpent: parsed.data.timeSpent || 0,
    })
    .onConflictDoNothing();

  const [module] = await db
    .select({ courseId: academyModules.courseId })
    .from(academyModules)
    .where(eq(academyModules.id, lesson.moduleId))
    .limit(1);
  if (!module) return c.json({ error: 'Module not found' }, 404);

  const progress = await recalculateCourseProgress(dbUser.id, module.courseId);

  return c.json({
    data: {
      lessonId,
      completedAt: new Date(),
      timeSpent: parsed.data.timeSpent || 0,
      courseProgress: {
        progressPercentage: progress.progressPercentage,
        status: progress.status,
      },
    },
  });
});

app.post('/quiz/:questionId/attempt', async (c) => {
  const dbUser = await requireSecretary(c);
  if (!dbUser) return c.json({ error: 'Unauthorized' }, 401);

  const questionId = c.req.param('questionId');
  const body = await c.req.json();
  const parsed = quizAttemptSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);

  const [question] = await db
    .select()
    .from(academyQuizQuestions)
    .where(eq(academyQuizQuestions.id, questionId))
    .limit(1);
  if (!question) return c.json({ error: 'Question not found' }, 404);
  if (parsed.data.selectedOption >= (question.options as unknown[]).length) {
    return c.json({ error: 'selectedOption tidak valid untuk soal ini.' }, 400);
  }

  const isCorrect = parsed.data.selectedOption === question.correctIndex;
  const [module] = await db
    .select({ courseId: academyModules.courseId })
    .from(academyModules)
    .where(eq(academyModules.id, question.moduleId))
    .limit(1);
  if (!module) return c.json({ error: 'Module not found' }, 404);

  await db.insert(userQuizAttempts).values({
    userId: dbUser.id,
    questionId,
    selectedOption: parsed.data.selectedOption,
    isCorrect,
    timeSpent: parsed.data.timeSpent || 0,
  });

  await syncModuleLessonCompletionsFromQuiz(dbUser.id, question.moduleId);
  const progress = await recalculateCourseProgress(dbUser.id, module.courseId);

  return c.json({
    data: {
      questionId,
      selectedOption: parsed.data.selectedOption,
      isCorrect,
      correctIndex: question.correctIndex,
      explanation: question.explanation,
      attemptedAt: new Date(),
      timeSpent: parsed.data.timeSpent || 0,
      courseProgress: progress,
    },
  });
});

export default app;
