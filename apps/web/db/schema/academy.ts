import { boolean, date, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from './users';

// Academy course - high-level curriculum
export const academyCourses = pgTable('academy_courses', {
  id: uuid('id').defaultRandom().primaryKey(),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  description: text('description'),
  category: text('category'), // e.g., 'fundamental', 'advanced', 'specialized'
  thumbnail: text('thumbnail'), // URL to course thumbnail
  totalDuration: integer('total_duration'), // minutes
  difficulty: text('difficulty').default('beginner'),
  status: text('status').default('published'), // draft, published, archived
  isPublic: boolean('is_public').default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Academy modules - sections within a course
export const academyModules = pgTable('academy_modules', {
  id: uuid('id').defaultRandom().primaryKey(),
  courseId: uuid('course_id')
    .references(() => academyCourses.id, { onDelete: 'cascade' })
    .notNull(),
  title: text('title').notNull(),
  description: text('description'),
  order: integer('order').notNull(),
  colorGradient: text('color_gradient'), // e.g., 'from-purple-500 to-indigo-500'
  bgColor: text('bg_color'), // e.g., 'bg-purple-50'
  iconColor: text('icon_color'), // e.g., 'text-purple-600'
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Academy lessons - individual learning units
export const academyLessons = pgTable('academy_lessons', {
  id: uuid('id').defaultRandom().primaryKey(),
  moduleId: uuid('module_id')
    .references(() => academyModules.id, { onDelete: 'cascade' })
    .notNull(),
  title: text('title').notNull(),
  description: text('description'),
  duration: integer('duration').notNull().default(15), // minutes
  contentType: text('content_type').notNull().default('text'), // 'text', 'video', 'slides'
  contentData: jsonb('content_data'), // JSON data for content
  order: integer('order').notNull(),
  isRequired: boolean('is_required').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Academy quiz questions
export const academyQuizQuestions = pgTable('academy_quiz_questions', {
  id: uuid('id').defaultRandom().primaryKey(),
  moduleId: uuid('module_id')
    .references(() => academyModules.id, { onDelete: 'cascade' })
    .notNull(),
  question: text('question').notNull(),
  options: jsonb('options').notNull(), // JSON array of strings
  correctIndex: integer('correct_index').notNull(),
  explanation: text('explanation'),
  difficulty: text('difficulty').default('medium'),
  order: integer('order').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// User academy progress tracking
export const userAcademyProgress = pgTable('user_academy_progress', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  courseId: uuid('course_id')
    .references(() => academyCourses.id, { onDelete: 'cascade' })
    .notNull(),
  status: text('status').default('in_progress'), // not_started, in_progress, completed
  progressPercentage: integer('progress_percentage').default(0),
  lastAccessedAt: timestamp('last_accessed_at', { withTimezone: true }),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// User lesson completions
export const userLessonCompletions = pgTable('user_lesson_completions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  lessonId: uuid('lesson_id')
    .references(() => academyLessons.id, { onDelete: 'cascade' })
    .notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }).defaultNow().notNull(),
  timeSpent: integer('time_spent'), // seconds
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// User quiz attempts
export const userQuizAttempts = pgTable('user_quiz_attempts', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  questionId: uuid('question_id')
    .references(() => academyQuizQuestions.id, { onDelete: 'cascade' })
    .notNull(),
  selectedOption: integer('selected_option'),
  isCorrect: boolean('is_correct').notNull(),
  attemptedAt: timestamp('attempted_at', { withTimezone: true }).defaultNow().notNull(),
  timeSpent: integer('time_spent'), // seconds
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// User certificates
export const userCertificates = pgTable('user_certificates', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  courseId: uuid('course_id')
    .references(() => academyCourses.id, { onDelete: 'cascade' })
    .notNull(),
  certificateId: text('certificate_id').notNull().unique(),
  certificateUrl: text('certificate_url'),
  issuedAt: timestamp('issued_at', { withTimezone: true }).defaultNow().notNull(),
  expiryDate: date('expiry_date'),
  metadata: jsonb('metadata'), // Additional certificate data
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Type exports
export type AcademyCourse = typeof academyCourses.$inferSelect;
export type NewAcademyCourse = typeof academyCourses.$inferInsert;
export type AcademyModule = typeof academyModules.$inferSelect;
export type NewAcademyModule = typeof academyModules.$inferInsert;
export type AcademyLesson = typeof academyLessons.$inferSelect;
export type NewAcademyLesson = typeof academyLessons.$inferInsert;
export type AcademyQuizQuestion = typeof academyQuizQuestions.$inferSelect;
export type NewAcademyQuizQuestion = typeof academyQuizQuestions.$inferInsert;
export type UserAcademyProgress = typeof userAcademyProgress.$inferSelect;
export type NewUserAcademyProgress = typeof userAcademyProgress.$inferInsert;
export type UserLessonCompletion = typeof userLessonCompletions.$inferSelect;
export type NewUserLessonCompletion = typeof userLessonCompletions.$inferInsert;
export type UserQuizAttempt = typeof userQuizAttempts.$inferSelect;
export type NewUserQuizAttempt = typeof userQuizAttempts.$inferInsert;
export type UserCertificate = typeof userCertificates.$inferSelect;
export type NewUserCertificate = typeof userCertificates.$inferInsert;