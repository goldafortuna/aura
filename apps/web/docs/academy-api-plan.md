# Academy API Routes Design

Berdasarkan pola API yang sudah ada di aplikasi menggunakan Hono.js, berikut adalah desain API routes untuk fitur Academy:

## Base Path: `/api/academy`

Semua endpoint mengikuti authentication pattern yang sudah ada dengan `requireDbUser()`.

## 1. Courses Management

### GET `/api/academy/courses`
**Description:** List semua courses yang tersedia
**Query Parameters:**
- `category` (optional): Filter by category
- `status` (optional): Filter by status
- `is_public` (optional): Filter public courses only

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "slug": "professional-secretary-academy",
      "title": "Akademi Sekretaris Profesional",
      "description": "Program pembelajaran komprehensif...",
      "category": "fundamental",
      "thumbnail": "https://...",
      "totalDuration": 300,
      "difficulty": "beginner",
      "status": "published",
      "isPublic": true,
      "createdAt": "2026-04-19T...",
      "updatedAt": "2026-04-19T..."
    }
  ]
}
```

### GET `/api/academy/courses/:id`
**Description:** Get detail course dengan modul-modulnya

**Response:**
```json
{
  "data": {
    "id": "uuid",
    "slug": "professional-secretary-academy",
    "title": "Akademi Sekretaris Profesional",
    "description": "Program pembelajaran komprehensif...",
    "modules": [
      {
        "id": "module_uuid",
        "title": "Peran & Tanggung Jawab Sekretaris Pimpinan",
        "description": "Memahami hakikat...",
        "order": 1,
        "colorGradient": "from-purple-500 to-indigo-500",
        "bgColor": "bg-purple-50",
        "iconColor": "text-purple-600",
        "lessonCount": 3,
        "quizCount": 2,
        "userProgress": {
          "completedLessons": 2,
          "totalLessons": 3,
          "quizCompleted": false
        }
      }
    ],
    "userProgress": {
      "status": "in_progress",
      "progressPercentage": 25,
      "startedAt": "2026-04-19T...",
      "lastAccessedAt": "2026-04-19T..."
    }
  }
}
```

## 2. Modules & Lessons

### GET `/api/academy/courses/:courseId/modules/:moduleId`
**Description:** Get detail module dengan lessons dan user progress

**Response:**
```json
{
  "data": {
    "id": "module_uuid",
    "title": "Peran & Tanggung Jawab Sekretaris Pimpinan",
    "description": "Memahami hakikat...",
    "order": 1,
    "lessons": [
      {
        "id": "lesson_uuid",
        "title": "Definisi dan Ruang Lingkup Tugas",
        "duration": 10,
        "contentType": "text",
        "order": 1,
        "isRequired": true,
        "userCompleted": true,
        "completedAt": "2026-04-19T..."
      }
    ],
    "quiz": {
      "questionCount": 2,
      "userAttempted": false,
      "bestScore": null
    }
  }
}
```

### GET `/api/academy/lessons/:id`
**Description:** Get lesson content

**Response:**
```json
{
  "data": {
    "id": "lesson_uuid",
    "title": "Definisi dan Ruang Lingkup Tugas",
    "duration": 10,
    "contentType": "text",
    "contentData": {
      "type": "text",
      "sections": [
        {
          "heading": "Apa itu Sekretaris Pimpinan?",
          "body": "Sekretaris pimpinan adalah profesional..."
        }
      ]
    },
    "module": {
      "id": "module_uuid",
      "title": "Peran & Tanggung Jawab Sekretaris Pimpinan",
      "order": 1
    },
    "previousLesson": "previous_lesson_id_or_null",
    "nextLesson": "next_lesson_id_or_null",
    "userCompleted": true
  }
}
```

## 3. User Progress Tracking

### POST `/api/academy/progress/lessons/:lessonId/complete`
**Description:** Mark lesson as completed
**Request Body:**
```json
{
  "timeSpent": 600 // seconds
}
```

**Response:**
```json
{
  "data": {
    "lessonId": "lesson_uuid",
    "completedAt": "2026-04-19T...",
    "timeSpent": 600,
    "courseProgress": {
      "progressPercentage": 30,
      "status": "in_progress"
    }
  }
}
```

### POST `/api/academy/progress/lessons/:lessonId/uncomplete`
**Description:** Unmark lesson completion

**Response:**
```json
{
  "data": {
    "lessonId": "lesson_uuid",
    "courseProgress": {
      "progressPercentage": 20,
      "status": "in_progress"
    }
  }
}
```

### GET `/api/academy/progress/courses/:courseId`
**Description:** Get user progress for a course

**Response:**
```json
{
  "data": {
    "courseId": "course_uuid",
    "status": "in_progress",
    "progressPercentage": 25,
    "completedLessons": 3,
    "totalLessons": 12,
    "startedAt": "2026-04-19T...",
    "lastAccessedAt": "2026-04-19T...",
    "moduleProgress": [
      {
        "moduleId": "module_uuid",
        "completedLessons": 2,
        "totalLessons": 3,
        "quizCompleted": false
      }
    ]
  }
}
```

## 4. Quiz System

### GET `/api/academy/modules/:moduleId/quiz`
**Description:** Get quiz questions for a module

**Response:**
```json
{
  "data": {
    "moduleId": "module_uuid",
    "questions": [
      {
        "id": "question_uuid",
        "question": "Manakah yang BUKAN termasuk ruang lingkup utama...",
        "options": ["Manajemen korespondensi", "Pengelolaan keuangan...", "Koordinasi rapat", "Pengelolaan informasi"],
        "order": 1,
        "userPreviousAnswer": 1,
        "userPreviousCorrect": false
      }
    ],
    "userAttempted": false,
    "userScore": null
  }
}
```

### POST `/api/academy/quiz/:questionId/attempt`
**Description:** Submit answer for a quiz question
**Request Body:**
```json
{
  "selectedOption": 1,
  "timeSpent": 30 // seconds
}
```

**Response:**
```json
{
  "data": {
    "questionId": "question_uuid",
    "selectedOption": 1,
    "isCorrect": false,
    "correctIndex": 0,
    "explanation": "Pengelolaan keuangan perusahaan bukan tugas utama...",
    "attemptedAt": "2026-04-19T...",
    "timeSpent": 30
  }
}
```

### GET `/api/academy/modules/:moduleId/quiz/summary`
**Description:** Get quiz summary after completion

**Response:**
```json
{
  "data": {
    "moduleId": "module_uuid",
    "totalQuestions": 5,
    "correctAnswers": 3,
    "scorePercentage": 60,
    "passed": true, // if score >= passing threshold (e.g., 70%)
    "attempts": [
      {
        "questionId": "question_uuid",
        "selectedOption": 1,
        "isCorrect": false,
        "correctIndex": 0,
        "explanation": "Pengelolaan keuangan perusahaan bukan tugas utama..."
      }
    ]
  }
}
```

## 5. Certificates

### POST `/api/academy/courses/:courseId/certificate/generate`
**Description:** Generate certificate after course completion

**Response:**
```json
{
  "data": {
    "certificateId": "CERT-2026-001",
    "certificateUrl": "https://storage.example.com/certificates/CERT-2026-001.pdf",
    "issuedAt": "2026-04-19T...",
    "expiryDate": "2027-04-19",
    "metadata": {
      "courseTitle": "Akademi Sekretaris Profesional",
      "userName": "John Doe",
      "completionDate": "2026-04-19"
    }
  }
}
```

### GET `/api/academy/certificates`
**Description:** List user certificates

**Response:**
```json
{
  "data": [
    {
      "id": "certificate_uuid",
      "certificateId": "CERT-2026-001",
      "certificateUrl": "https://storage.example.com/certificates/CERT-2026-001.pdf",
      "issuedAt": "2026-04-19T...",
      "expiryDate": "2027-04-19",
      "course": {
        "id": "course_uuid",
        "title": "Akademi Sekretaris Profesional",
        "description": "Program pembelajaran komprehensif..."
      }
    }
  ]
}
```

### GET `/api/academy/certificates/:id`
**Description:** Get certificate detail

**Response:**
```json
{
  "data": {
    "id": "certificate_uuid",
    "certificateId": "CERT-2026-001",
    "certificateUrl": "https://storage.example.com/certificates/CERT-2026-001.pdf",
    "issuedAt": "2026-04-19T...",
    "expiryDate": "2027-04-19",
    "metadata": {
      "courseTitle": "Akademi Sekretaris Profesional",
      "userName": "John Doe",
      "completionDate": "2026-04-19",
      "score": 85
    },
    "course": {
      "id": "course_uuid",
      "title": "Akademi Sekretaris Profesional",
      "description": "Program pembelajaran komprehensif...",
      "thumbnail": "https://..."
    }
  }
}
```

## 6. Admin Endpoints (Optional)

### POST `/api/academy/admin/courses`
**Description:** Create new course (admin only)

### PUT `/api/academy/admin/courses/:id`
**Description:** Update course (admin only)

### POST `/api/academy/admin/courses/:courseId/modules`
**Description:** Create module in course (admin only)

### POST `/api/academy/admin/modules/:moduleId/lessons`
**Description:** Create lesson in module (admin only)

## Zod Schema Examples

```typescript
// Course creation schema
const createCourseSchema = z.object({
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
  title: z.string().min(1),
  description: z.string().optional(),
  category: z.enum(['fundamental', 'advanced', 'specialized']).optional(),
  thumbnail: z.string().url().optional(),
  totalDuration: z.number().int().positive().optional(),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']).default('beginner'),
  status: z.enum(['draft', 'published', 'archived']).default('published'),
  isPublic: z.boolean().default(false),
});

// Lesson completion schema
const completeLessonSchema = z.object({
  timeSpent: z.number().int().positive().optional(),
});

// Quiz attempt schema
const quizAttemptSchema = z.object({
  selectedOption: z.number().int().min(0).max(3),
  timeSpent: z.number().int().positive().optional(),
});
```

## Implementation Notes

1. **Authentication**: Semua endpoint menggunakan `requireDbUser()` pattern yang sudah ada
2. **Authorization**: Admin endpoints memerlukan role check (`user.role === 'admin'`)
3. **Error Handling**: Mengikuti pola error response yang sudah ada
4. **Validation**: Menggunakan Zod schema validation
5. **Pagination**: Untuk list endpoints (courses, certificates) perlu implement pagination
6. **Caching**: Consider caching untuk course content yang jarang berubah
7. **Rate Limiting**: Implement rate limiting untuk quiz attempts

## Next Steps

1. Tambahkan API routes ke `app/api/[[...route]]/route.ts`
2. Buat Zod schemas untuk validation
3. Implement business logic untuk progress tracking
4. Implement certificate generation (PDF)
5. Tambahkan error handling dan logging