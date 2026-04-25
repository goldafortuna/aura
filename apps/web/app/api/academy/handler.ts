import { Hono } from 'hono';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../../db';
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
  selectedOption: z.number().int().min(0).max(3),
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

  const modules = await db
    .select()
    .from(academyModules)
    .where(eq(academyModules.courseId, id))
    .orderBy(academyModules.order);

  const [progress] = await db
    .select()
    .from(userAcademyProgress)
    .where(and(eq(userAcademyProgress.userId, dbUser.id), eq(userAcademyProgress.courseId, id)))
    .limit(1);

  return c.json({
    data: {
      ...course,
      modules,
      userProgress: progress || null,
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

  const totalLessonsResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(academyLessons)
    .where(eq(academyLessons.moduleId, lesson.moduleId));

  const completedLessonsResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(userLessonCompletions)
    .innerJoin(academyLessons, eq(userLessonCompletions.lessonId, academyLessons.id))
    .where(and(eq(userLessonCompletions.userId, dbUser.id), eq(academyLessons.moduleId, lesson.moduleId)));

  const totalCount = totalLessonsResult[0]?.count || 0;
  const completedCount = completedLessonsResult[0]?.count || 0;
  const progressPercentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  await db
    .update(userAcademyProgress)
    .set({
      progressPercentage,
      lastAccessedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(userAcademyProgress.userId, dbUser.id), eq(userAcademyProgress.courseId, module.courseId)));

  return c.json({
    data: {
      lessonId,
      completedAt: new Date(),
      timeSpent: parsed.data.timeSpent || 0,
      courseProgress: {
        progressPercentage,
        status: 'in_progress',
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

  const isCorrect = parsed.data.selectedOption === question.correctIndex;

  await db.insert(userQuizAttempts).values({
    userId: dbUser.id,
    questionId,
    selectedOption: parsed.data.selectedOption,
    isCorrect,
    timeSpent: parsed.data.timeSpent || 0,
  });

  return c.json({
    data: {
      questionId,
      selectedOption: parsed.data.selectedOption,
      isCorrect,
      correctIndex: question.correctIndex,
      explanation: question.explanation,
      attemptedAt: new Date(),
      timeSpent: parsed.data.timeSpent || 0,
    },
  });
});

export default app;
