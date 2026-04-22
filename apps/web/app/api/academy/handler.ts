import { Hono } from 'hono';
import { and, desc, eq, sql } from 'drizzle-orm';
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
import { requireDbUser } from '../../../lib/middleware/auth';

const app = new Hono();

const completeLessonSchema = z.object({
  timeSpent: z.number().int().positive().optional(),
});

const quizAttemptSchema = z.object({
  selectedOption: z.number().int().min(0).max(3),
  timeSpent: z.number().int().positive().optional(),
});

app.get('/courses', async (c) => {
  const dbUser = await requireDbUser(c);
  if (!dbUser) return c.json({ error: 'Unauthorized' }, 401);

  const rows = await db
    .select()
    .from(academyCourses)
    .where(eq(academyCourses.status, 'published'))
    .orderBy(desc(academyCourses.createdAt));

  return c.json({ data: rows });
});

app.get('/courses/:id', async (c) => {
  const dbUser = await requireDbUser(c);
  if (!dbUser) return c.json({ error: 'Unauthorized' }, 401);

  const id = c.req.param('id');
  const [course] = await db.select().from(academyCourses).where(eq(academyCourses.id, id)).limit(1);
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
  const dbUser = await requireDbUser(c);
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
  const dbUser = await requireDbUser(c);
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
  const dbUser = await requireDbUser(c);
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
