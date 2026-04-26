/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const { config } = require('dotenv');
const postgres = require('postgres');

config({ path: '.env' });
config({ path: '.env.local', override: true });

const workspaceRoot = path.resolve(__dirname, '..', '..', '..', '..');
const academySourceRoot = path.join(workspaceRoot, 'MateriAcademy');
const configPath = path.join(__dirname, 'academy-master-course.config.json');

function readConfig() {
  return JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

function getModuleSelection() {
  const arg = process.argv.find((value) => value.startsWith('--module='));
  return arg ? arg.split('=')[1] : '';
}

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function sanitizeInlineMarkdown(value) {
  return normalizeText(value)
    .replace(/^>\s*/, '')
    .replace(/\*\*/g, '')
    .replace(/__/g, '')
    .replace(/_/g, '')
    .replace(/`/g, '')
    .replace(/\\\./g, '.')
    .trim();
}

function parseQuizMarkdown(raw) {
  const lines = raw.split(/\r?\n/);
  const questions = [];
  let current = null;
  let pendingQuestionHeading = false;
  let collectingExplanation = false;

  const pushCurrent = () => {
    if (!current) return;
    current.question = sanitizeInlineMarkdown(current.question);
    current.options = current.options.map((option) => sanitizeInlineMarkdown(option));
    current.explanation = sanitizeInlineMarkdown(current.explanation);
    if (current.question && current.options.length >= 2 && Number.isInteger(current.correctIndex) && current.correctIndex >= 0) {
      questions.push(current);
    }
    current = null;
    pendingQuestionHeading = false;
    collectingExplanation = false;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      if (collectingExplanation && current?.explanation) current.explanation += ' ';
      continue;
    }

    const numberedQuestion = line.match(/^\*\*(\d+)\\?\.\s*(.+?)\*\*$/);
    const headingQuestion = line.match(/^##\s+Soal\s+(\d+)/i);
    const optionMatch = line.match(/^(?:-\s*)?(?:\*\*)?([A-F])\.(?:\*\*)?\s*(.+)$/i);
    const answerMatch = line.match(/jawaban benar:\s*([A-F])/i);
    const explanationMatch = line.match(/^>?\s*\*?\*?Penjelasan:?\*?\*?\s*(.*)$/i);

    if (numberedQuestion) {
      pushCurrent();
      current = {
        order: Number(numberedQuestion[1]),
        question: numberedQuestion[2],
        options: [],
        correctIndex: -1,
        explanation: '',
      };
      continue;
    }

    if (headingQuestion) {
      pushCurrent();
      current = {
        order: Number(headingQuestion[1]),
        question: '',
        options: [],
        correctIndex: -1,
        explanation: '',
      };
      pendingQuestionHeading = true;
      continue;
    }

    if (!current) continue;

    if (pendingQuestionHeading && !optionMatch) {
      current.question = current.question ? `${current.question} ${line}` : line;
      continue;
    }

    pendingQuestionHeading = false;

    if (optionMatch) {
      current.options.push(optionMatch[2]);
      continue;
    }

    if (answerMatch) {
      current.correctIndex = answerMatch[1].toUpperCase().charCodeAt(0) - 65;
      collectingExplanation = false;
      continue;
    }

    if (explanationMatch) {
      collectingExplanation = true;
      current.explanation = explanationMatch[1] || '';
      continue;
    }

    if (collectingExplanation) {
      if (/^---+$/.test(line) || /^##\s+rekap/i.test(line) || /^>\s*skor/i.test(line)) {
        collectingExplanation = false;
        continue;
      }
      current.explanation = current.explanation ? `${current.explanation} ${line}` : line;
    }
  }

  pushCurrent();
  return questions;
}

async function upsertCourse(sql, courseConfig) {
  const [existing] = await sql`
    select id
    from academy_courses
    where slug = ${courseConfig.slug}
    limit 1
  `;

  if (existing) {
    const [updated] = await sql`
      update academy_courses
      set
        title = ${courseConfig.title},
        description = ${courseConfig.description},
        category = ${courseConfig.category},
        thumbnail = null,
        total_duration = ${courseConfig.totalDuration},
        difficulty = ${courseConfig.difficulty},
        status = ${courseConfig.status},
        is_public = ${courseConfig.isPublic},
        updated_at = now()
      where id = ${existing.id}
      returning id
    `;
    return updated.id;
  }

  const [created] = await sql`
    insert into academy_courses (
      slug,
      title,
      description,
      category,
      thumbnail,
      total_duration,
      difficulty,
      status,
      is_public
    )
    values (
      ${courseConfig.slug},
      ${courseConfig.title},
      ${courseConfig.description},
      ${courseConfig.category},
      null,
      ${courseConfig.totalDuration},
      ${courseConfig.difficulty},
      ${courseConfig.status},
      ${courseConfig.isPublic}
    )
    returning id
  `;

  return created.id;
}

async function upsertModule(sql, courseId, moduleConfig) {
  const [existing] = await sql`
    select id
    from academy_modules
    where course_id = ${courseId} and "order" = ${moduleConfig.order}
    limit 1
  `;

  if (existing) {
    const [updated] = await sql`
      update academy_modules
      set
        title = ${moduleConfig.title},
        description = ${moduleConfig.description},
        color_gradient = ${moduleConfig.colorGradient},
        bg_color = ${moduleConfig.bgColor},
        icon_color = ${moduleConfig.iconColor},
        updated_at = now()
      where id = ${existing.id}
      returning id
    `;
    return updated.id;
  }

  const [created] = await sql`
    insert into academy_modules (
      course_id,
      title,
      description,
      "order",
      color_gradient,
      bg_color,
      icon_color
    )
    values (
      ${courseId},
      ${moduleConfig.title},
      ${moduleConfig.description},
      ${moduleConfig.order},
      ${moduleConfig.colorGradient},
      ${moduleConfig.bgColor},
      ${moduleConfig.iconColor}
    )
    returning id
  `;

  return created.id;
}

async function upsertLesson(sql, moduleId, assetBasePath, moduleConfig, lessonConfig) {
  const assetPath = path.posix.join(
    assetBasePath,
    moduleConfig.slug,
    `${lessonConfig.order.toString().padStart(2, '0')}-${lessonConfig.slug}.pdf`,
  );

  const contentData = {
    type: 'pdf',
    assetPath,
    sourceDeck: moduleConfig.sourcePptx,
    sourcePdf: moduleConfig.sourcePdf ?? null,
    slideRange: lessonConfig.slideRange,
  };

  const [existing] = await sql`
    select id
    from academy_lessons
    where module_id = ${moduleId} and "order" = ${lessonConfig.order}
    limit 1
  `;

  if (existing) {
    await sql`
      update academy_lessons
      set
        title = ${lessonConfig.title},
        description = ${lessonConfig.description},
        duration = ${lessonConfig.duration},
        content_type = 'slides',
        content_data = ${JSON.stringify(contentData)},
        is_required = true,
        updated_at = now()
      where id = ${existing.id}
    `;
    return;
  }

  await sql`
    insert into academy_lessons (
      module_id,
      title,
      description,
      duration,
      content_type,
      content_data,
      "order",
      is_required
    )
    values (
      ${moduleId},
      ${lessonConfig.title},
      ${lessonConfig.description},
      ${lessonConfig.duration},
      'slides',
      ${JSON.stringify(contentData)},
      ${lessonConfig.order},
      true
    )
  `;
}

async function replaceQuizQuestions(sql, moduleId, quizQuestions) {
  await sql`delete from academy_quiz_questions where module_id = ${moduleId}`;

  for (const question of quizQuestions) {
    await sql`
      insert into academy_quiz_questions (
        module_id,
        question,
        options,
        correct_index,
        explanation,
        difficulty,
        "order"
      )
      values (
        ${moduleId},
        ${question.question},
        ${JSON.stringify(question.options)},
        ${question.correctIndex},
        ${question.explanation || null},
        'medium',
        ${question.order}
      )
    `;
  }
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not set');

  const sql = postgres(connectionString, { prepare: false });
  const configData = readConfig();
  const selectedModuleSlug = getModuleSelection();
  const modulesToImport = selectedModuleSlug
    ? configData.modules.filter((module) => module.slug === selectedModuleSlug)
    : configData.modules;

  try {
    console.log('Importing master Academy course...');
    if (selectedModuleSlug && modulesToImport.length === 0) {
      throw new Error(`Module ${selectedModuleSlug} tidak ditemukan di config.`);
    }

    const courseId = await upsertCourse(sql, configData.course);
    console.log(`Course ready: ${configData.course.title} (${courseId})`);

    for (const moduleConfig of modulesToImport) {
      const moduleId = await upsertModule(sql, courseId, moduleConfig);
      console.log(`Module ready: ${moduleConfig.order}. ${moduleConfig.title}`);

      for (const lessonConfig of moduleConfig.lessons) {
        await upsertLesson(sql, moduleId, configData.assetBasePath, moduleConfig, lessonConfig);
      }

      const quizPath = path.join(academySourceRoot, moduleConfig.quizMarkdown);
      const quizContent = fs.readFileSync(quizPath, 'utf8');
      const quizQuestions = parseQuizMarkdown(quizContent);
      if (quizQuestions.length === 0) {
        throw new Error(`Quiz parser gagal membaca soal dari ${moduleConfig.quizMarkdown}`);
      }

      await replaceQuizQuestions(sql, moduleId, quizQuestions);
      console.log(`Quiz ready: ${quizQuestions.length} soal`);
    }

    console.log('Master Academy course import complete.');
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error) => {
  console.error('Failed to import master Academy course:', error);
  process.exitCode = 1;
});
