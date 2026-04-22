/* eslint-disable no-console */
const { config } = require('dotenv');
const postgres = require('postgres');

config({ path: '.env' });
config({ path: '.env.local', override: true });

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
  }

  const sql = postgres(connectionString, { prepare: false });

  try {
    console.log('Starting Academy seed data...');

    // 1. Create main academy course for Secretary Professional Development
    const courseResult = await sql`
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
        'professional-secretary-academy',
        'Akademi Sekretaris Profesional',
        'Program pembelajaran komprehensif untuk mengembangkan kompetensi inti sekretaris pimpinan modern dengan pendekatan microlearning.',
        'fundamental',
        'https://images.unsplash.com/photo-1611224923853-80b023f02d71?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
        300,
        'beginner',
        'published',
        true
      )
      on conflict (slug)
      do update set
        title = excluded.title,
        description = excluded.description,
        updated_at = now()
      returning id
    `;

    const courseId = courseResult[0]?.id;
    if (!courseId) {
      throw new Error('Failed to create academy course');
    }

    console.log(`Created course with ID: ${courseId}`);

    // 2. Create modules based on UI prototype structure
    const modules = [
      {
        title: 'Peran & Tanggung Jawab Sekretaris Pimpinan',
        description: 'Memahami hakikat, ruang lingkup, dan kompetensi inti seorang sekretaris pimpinan modern.',
        order: 1,
        color_gradient: 'from-purple-500 to-indigo-500',
        bg_color: 'bg-purple-50',
        icon_color: 'text-purple-600',
        lessons: [
          {
            title: 'Definisi dan Ruang Lingkup Tugas',
            duration: 10,
            content_type: 'text',
            order: 1,
            content_data: {
              type: 'text',
              sections: [
                {
                  heading: 'Apa itu Sekretaris Pimpinan?',
                  body: 'Sekretaris pimpinan adalah profesional yang bertugas sebagai tangan kanan pimpinan dalam mengelola informasi, jadwal, korespondensi, dan koordinasi internal maupun eksternal organisasi. Peran ini jauh melampaui sekadar mengurus administrasi — seorang sekretaris pimpinan adalah mitra strategis yang turut menentukan efektivitas kerja pemimpin.'
                },
                {
                  heading: 'Ruang Lingkup Utama',
                  body: 'Tugas sekretaris pimpinan mencakup: (1) Manajemen korespondensi dan dokumentasi — menyusun, menerima, mendistribusikan, serta mengarsipkan surat dan dokumen; (2) Manajemen jadwal dan agenda — merencanakan, mengonfirmasi, dan mengingatkan jadwal pimpinan; (3) Koordinasi rapat — dari persiapan undangan hingga distribusi notula; (4) Pengelolaan informasi — menjadi pusat informasi yang dapat diandalkan; (5) Representasi pimpinan — berinteraksi dengan tamu, klien, dan mitra atas nama pimpinan.'
                }
              ]
            }
          },
          {
            title: 'Evolusi Peran di Era Digital',
            duration: 12,
            content_type: 'video',
            order: 2,
            content_data: {
              type: 'video',
              thumbnail: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
              videoUrl: 'https://example.com/videos/evolution-of-secretary-role.mp4',
              description: 'Bagaimana peran sekretaris berubah dengan perkembangan teknologi dan tuntutan bisnis modern.',
              keyPoints: [
                'Dari administrasi ke strategic partnership',
                'Penguasaan tools digital dan AI',
                'Peran sebagai information gatekeeper',
                'Skillset yang diperlukan di era digital'
              ],
              transcript: 'Dalam video ini kita akan membahas bagaimana peran sekretaris telah berevolusi dari sekadar administrasi menjadi mitra strategis yang mengelola informasi dan koordinasi dengan tools digital modern.'
            }
          }
        ],
        quiz_questions: [
          {
            question: 'Manakah yang BUKAN termasuk ruang lingkup utama tugas sekretaris pimpinan?',
            options: ['Manajemen korespondensi', 'Pengelolaan keuangan perusahaan', 'Koordinasi rapat', 'Pengelolaan informasi'],
            correct_index: 1,
            explanation: 'Pengelolaan keuangan perusahaan bukan tugas utama sekretaris pimpinan. Tugas utama meliputi manajemen korespondensi, koordinasi rapat, dan pengelolaan informasi.'
          }
        ]
      },
      {
        title: 'Komunikasi Efektif & Korespondensi Profesional',
        description: 'Teknik komunikasi tertulis dan lisan yang efektif dalam konteks profesional, termasuk penyusunan surat dinas dan email.',
        order: 2,
        color_gradient: 'from-blue-500 to-cyan-500',
        bg_color: 'bg-blue-50',
        icon_color: 'text-blue-600',
        lessons: [
          {
            title: 'Prinsip Dasar Komunikasi Profesional',
            duration: 15,
            content_type: 'slides',
            order: 1,
            content_data: {
              type: 'slides',
              slides: [
                {
                  title: 'Slide 1: 7C of Communication',
                  content: 'Prinsip komunikasi efektif',
                  bullets: ['Clear (Jelas)', 'Concise (Ringkas)', 'Concrete (Konkret)', 'Correct (Benar)', 'Coherent (Koheren)', 'Complete (Lengkap)', 'Courteous (Sopan)']
                },
                {
                  title: 'Slide 2: Audience Analysis',
                  content: 'Memahami audiens Anda',
                  bullets: ['Siapa pembaca/pendengar?', 'Apa kebutuhan informasi mereka?', 'Apa level pengetahuan mereka?', 'Apa ekspektasi mereka?']
                }
              ]
            }
          }
        ],
        quiz_questions: [
          {
            question: 'Manakah dari berikut ini yang termasuk dalam 7C of Communication?',
            options: ['Creative', 'Concise', 'Complex', 'Casual'],
            correct_index: 1,
            explanation: 'Concise (Ringkas) adalah salah satu dari 7C. Creative, Complex, dan Casual bukan bagian dari 7C.'
          }
        ]
      }
    ];

    // Insert modules and their content
    for (const moduleData of modules) {
      const moduleResult = await sql`
        insert into academy_modules (
          course_id,
          title,
          description,
          order,
          color_gradient,
          bg_color,
          icon_color
        )
        values (
          ${courseId},
          ${moduleData.title},
          ${moduleData.description},
          ${moduleData.order},
          ${moduleData.color_gradient},
          ${moduleData.bg_color},
          ${moduleData.icon_color}
        )
        on conflict do nothing
        returning id
      `;

      const moduleId = moduleResult[0]?.id;
      if (!moduleId) {
        // Try to get existing module ID
        const existingModule = await sql`
          select id from academy_modules 
          where course_id = ${courseId} and title = ${moduleData.title}
          limit 1
        `;
        if (existingModule[0]) {
          moduleId = existingModule[0].id;
        } else {
          console.warn(`Failed to create/retrieve module: ${moduleData.title}`);
          continue;
        }
      }

      console.log(`Created module: ${moduleData.title}`);

      // Insert lessons
      for (const lessonData of moduleData.lessons) {
        await sql`
          insert into academy_lessons (
            module_id,
            title,
            description,
            duration,
            content_type,
            content_data,
            order,
            is_required
          )
          values (
            ${moduleId},
            ${lessonData.title},
            ${lessonData.description || ''},
            ${lessonData.duration},
            ${lessonData.content_type},
            ${JSON.stringify(lessonData.content_data)},
            ${lessonData.order},
            true
          )
          on conflict do nothing
        `;
      }

      // Insert quiz questions
      for (const [index, questionData] of moduleData.quiz_questions.entries()) {
        await sql`
          insert into academy_quiz_questions (
            module_id,
            question,
            options,
            correct_index,
            explanation,
            difficulty,
            order
          )
          values (
            ${moduleId},
            ${questionData.question},
            ${JSON.stringify(questionData.options)},
            ${questionData.correct_index},
            ${questionData.explanation},
            'medium',
            ${index + 1}
          )
          on conflict do nothing
        `;
      }
    }

    // 3. Optional: Create a test user progress if we have a test user
    const testUser = await sql`
      select id from users 
      where clerk_user_id = 'seed-clerk-user'
      limit 1
    `;

    if (testUser[0]) {
      const userId = testUser[0].id;
      
      // Create user progress
      await sql`
        insert into user_academy_progress (
          user_id,
          course_id,
          status,
          progress_percentage,
          started_at
        )
        values (
          ${userId},
          ${courseId},
          'in_progress',
          25,
          now()
        )
        on conflict (user_id, course_id)
        do update set
          progress_percentage = 25,
          updated_at = now()
      `;

      // Mark first lesson as completed
      const firstLesson = await sql`
        select l.id 
        from academy_lessons l
        join academy_modules m on l.module_id = m.id
        where m.course_id = ${courseId}
        order by m.order, l.order
        limit 1
      `;

      if (firstLesson[0]) {
        await sql`
          insert into user_lesson_completions (
            user_id,
            lesson_id,
            completed_at,
            time_spent
          )
          values (
            ${userId},
            ${firstLesson[0].id},
            now(),
            600
          )
          on conflict (user_id, lesson_id) do nothing
        `;
      }

      console.log(`Created progress for test user: ${userId}`);
    }

    console.log('🎉 Academy seed data completed successfully!');
    console.log(`Course available at: /academy/courses/${courseId}`);
    
  } catch (error) {
    console.error('Error during Academy seeding:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
