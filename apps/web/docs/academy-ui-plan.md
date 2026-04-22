# Academy Frontend Pages Structure

Berdasarkan UI prototype dan struktur aplikasi yang sudah ada, berikut adalah plan untuk frontend pages structure untuk fitur Academy:

## Folder Structure

```
app/academy/
├── layout.tsx                    # Academy layout dengan sidebar
├── page.tsx                      # Academy dashboard / catalog
├── courses/
│   ├── page.tsx                  # Course catalog/list
│   └── [courseId]/
│       ├── page.tsx              # Course detail dengan module list
│       ├── layout.tsx            # Course layout untuk navigation
│       └── modules/
│           └── [moduleId]/
│               ├── page.tsx      # Module detail dengan lesson list
│               └── quiz/
│                   └── page.tsx  # Module quiz
├── lessons/
│   └── [lessonId]/
│       └── page.tsx              # Lesson content viewer
├── progress/
│   ├── page.tsx                  # User learning progress dashboard
│   └── [courseId]/
│       └── page.tsx              # Course-specific progress detail
├── certificates/
│   ├── page.tsx                  # User certificates list
│   └── [certificateId]/
│       └── page.tsx              # Certificate detail & download
└── admin/                        # Optional admin interface
    ├── page.tsx                  # Academy admin dashboard
    ├── courses/
    │   ├── page.tsx              # Manage courses
    │   └── [courseId]/
    │       └── page.tsx          # Edit course
    └── content/
        └── page.tsx              # Manage course content
```

## Page Components

### 1. **Academy Layout** (`/app/academy/layout.tsx`)
- Wrapper untuk semua academy pages
- Menggunakan Sidebar component yang sudah ada
- Menambahkan Academy-specific navigation items
- Responsive design

### 2. **Academy Dashboard** (`/app/academy/page.tsx`)
- Overview learning progress
- Featured courses
- Recently accessed lessons
- Learning statistics
- Quick access to continue learning

### 3. **Course Catalog** (`/app/academy/courses/page.tsx`)
- Grid/list view of available courses
- Filter by category, difficulty, duration
- Search functionality
- Course cards with progress indicators
- "Featured", "Popular", "New" sections

### 4. **Course Detail** (`/app/academy/courses/[courseId]/page.tsx`)
- Course overview
- Module list dengan progress indicators
- Course statistics (duration, lessons, quizzes)
- Enroll/Start button
- Syllabus preview

### 5. **Module Detail** (`/app/academy/courses/[courseId]/modules/[moduleId]/page.tsx`)
- Module overview
- Lesson list with completion status
- Module quiz preview
- Navigation to next/previous module
- Progress tracking within module

### 6. **Lesson Viewer** (`/app/academy/lessons/[lessonId]/page.tsx`)
- Dynamic content rendering based on `contentType`
- Text content display
- Video player (if video content)
- Slides viewer (if slides content)
- Navigation controls (previous/next lesson)
- Mark as complete button
- Lesson duration timer

### 7. **Quiz Page** (`/app/academy/courses/[courseId]/modules/[moduleId]/quiz/page.tsx`)
- Quiz question display
- Multiple choice options
- Navigation between questions
- Timer (optional)
- Submit and review answers
- Score display

### 8. **Progress Dashboard** (`/app/academy/progress/page.tsx`)
- Overall learning statistics
- Course progress visualization
- Time spent learning
- Completion rates
- Achievement badges (optional)

### 9. **Certificates List** (`/app/academy/certificates/page.tsx`)
- Grid/list of earned certificates
- Certificate preview
- Download/share functionality
- Filter by course/date

### 10. **Certificate Detail** (`/app/academy/certificates/[certificateId]/page.tsx`)
- Full certificate display
- Download options (PDF, PNG)
- Share functionality
- Certificate validation information

## Component Hierarchy

```
AcademyLayout
├── AcademySidebar (modified)
├── AcademyHeader
└── Page Content
    ├── CourseCatalog
    │   ├── CourseCard[]
    │   ├── CourseFilters
    │   └── SearchBar
    ├── CourseDetail
    │   ├── CourseHero
    │   ├── ModuleList
    │   │   └── ModuleCard[]
    │   ├── CourseStats
    │   └── CourseActions
    ├── LessonViewer
    │   ├── LessonContent (Text/Video/Slides)
    │   ├── LessonNavigation
    │   └── LessonActions
    └── QuizViewer
        ├── QuizQuestion
        ├── QuizOptions[]
        ├── QuizNavigation
        └── QuizResults
```

## UI Components to Create/Modify

### New Components:
1. **CourseCard** - Card untuk menampilkan course di catalog
2. **ModuleCard** - Card untuk module dalam course
3. **LessonCard** - Card untuk lesson dalam module
4. **ProgressBar** - Progress visualization component
5. **ContentRenderer** - Dynamic content renderer (text, video, slides)
6. **QuizComponent** - Interactive quiz component
7. **CertificatePreview** - Certificate display component

### Modified Components:
1. **Sidebar** - Tambahkan Academy menu item
2. **Header** - Tambahkan Academy-specific actions

## Data Flow

1. **Data Fetching**: Menggunakan React Query untuk data fetching
2. **State Management**: Local state untuk UI state, React Query untuk server state
3. **API Integration**: Mengikuti pola yang sudah ada di aplikasi
4. **Form Handling**: Menggunakan React Hook Form dengan Zod validation

## Styling & Theme

Mengikuti design system yang sudah ada:
- **Colors**: Menggunakan Tailwind color palette dari design system
- **Typography**: Mengikuti typography scale aplikasi
- **Spacing**: Menggunakan spacing system yang konsisten
- **Animations**: Menggunakan Framer Motion untuk micro-interactions

## Integration with Existing App

### 1. **Navigation**:
- Tambahkan "Academy" item ke Sidebar menu
- Update App.tsx untuk include Academy tab
- Integrasi dengan existing routing system

### 2. **Authentication**:
- Menggunakan Clerk authentication yang sudah ada
- Protected routes untuk academy content
- Role-based access untuk admin features

### 3. **State Management**:
- Menggunakan React Query untuk server state
- Local state untuk UI interactions
- Context untuk academy-specific state (optional)

### 4. **Error Handling**:
- Mengikuti error handling pattern yang ada
- Error boundaries untuk academy pages
- Loading states dengan skeleton UI

## Implementation Priority

### Phase 1 (MVP):
1. Academy layout & navigation
2. Course catalog page
3. Course detail page
4. Basic lesson viewer (text content)
5. Progress tracking basics

### Phase 2:
1. Video and slides content support
2. Quiz system
3. Certificate generation
4. Advanced progress tracking

### Phase 3:
1. Admin interface
2. Advanced analytics
3. Social features (discussions, sharing)
4. Mobile optimizations

## Mobile Responsiveness

Semua pages harus fully responsive:
- **Mobile**: Single column, touch-friendly controls
- **Tablet**: Optimized layouts
- **Desktop**: Full-featured interfaces

## Accessibility

- Semantic HTML structure
- ARIA labels untuk interactive elements
- Keyboard navigation support
- Screen reader compatibility
- Color contrast compliance

## Performance Considerations

1. **Code Splitting**: Lazy load academy features
2. **Image Optimization**: Optimize course thumbnails
3. **Caching**: Cache course content dengan React Query
4. **Bundle Size**: Monitor bundle size dengan code splitting

## Testing Strategy

1. **Unit Tests**: Components dan utilities
2. **Integration Tests**: API integration
3. **E2E Tests**: User flows
4. **Accessibility Tests**: WCAG compliance

## Migration from UI Prototype

Banyak UI components bisa diadaptasi dari `UI/pages/Academy.tsx`:
- Type definitions (`LessonData`, `ModuleData`, etc.)
- UI components dan styling
- State management patterns
- Interaction patterns

## Next Steps

1. Setup folder structure
2. Create base layout and pages
3. Implement API integration
4. Adapt UI components dari prototype
5. Add authentication and authorization
6. Test and refine