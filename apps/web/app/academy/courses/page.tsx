'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { 
  BookOpen, Clock, Award, Filter, Search, TrendingUp, 
  Star, Users, ArrowLeft, ChevronRight 
} from 'lucide-react';

interface Course {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  totalDuration: number;
  difficulty: string;
  category: string;
  status: string;
  isPublic: boolean;
  createdAt: string;
}

interface FilterOptions {
  category: string;
  difficulty: string;
  status: string;
}

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<FilterOptions>({
    category: 'all',
    difficulty: 'all',
    status: 'published',
  });

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    try {
      const response = await fetch('/api/academy/courses');
      const data = await response.json();
      if (data.data) {
        setCourses(data.data);
      }
    } catch (error) {
      console.error('Error fetching courses:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredCourses = courses.filter(course => {
    // Search filter
    const matchesSearch = searchQuery === '' || 
      course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      course.description.toLowerCase().includes(searchQuery.toLowerCase());

    // Category filter
    const matchesCategory = filters.category === 'all' || course.category === filters.category;

    // Difficulty filter
    const matchesDifficulty = filters.difficulty === 'all' || course.difficulty === filters.difficulty;

    // Status filter
    const matchesStatus = course.status === filters.status;

    return matchesSearch && matchesCategory && matchesDifficulty && matchesStatus;
  });

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'bg-green-100 text-green-800';
      case 'intermediate': return 'bg-yellow-100 text-yellow-800';
      case 'advanced': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'fundamental': return 'bg-blue-100 text-blue-800';
      case 'advanced': return 'bg-purple-100 text-purple-800';
      case 'specialized': return 'bg-pink-100 text-pink-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const categories = [
    { id: 'all', label: 'Semua Kategori' },
    { id: 'fundamental', label: 'Fundamental' },
    { id: 'advanced', label: 'Lanjutan' },
    { id: 'specialized', label: 'Spesialisasi' },
  ];

  const difficulties = [
    { id: 'all', label: 'Semua Level' },
    { id: 'beginner', label: 'Pemula' },
    { id: 'intermediate', label: 'Menengah' },
    { id: 'advanced', label: 'Lanjutan' },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <Link
          href="/app?tab=academy"
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali ke Dashboard
        </Link>
        <div className="mt-4 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Katalog Kursus</h1>
            <p className="mt-2 text-gray-600">
              Temukan kursus yang tepat untuk mengembangkan kompetensi Anda sebagai sekretaris pimpinan
            </p>
          </div>
          <div className="hidden md:block">
            <div className="rounded-xl bg-primary/10 p-3">
              <BookOpen className="h-8 w-8 text-primary" />
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Kursus</p>
              <p className="text-2xl font-bold">{courses.length}</p>
            </div>
            <BookOpen className="h-8 w-8 text-primary/40" />
          </div>
        </div>
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Kursus Aktif</p>
              <p className="text-2xl font-bold">
                {courses.filter(c => c.status === 'published').length}
              </p>
            </div>
            <TrendingUp className="h-8 w-8 text-green-400" />
          </div>
        </div>
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Kategori</p>
              <p className="text-2xl font-bold">
                {new Set(courses.map(c => c.category)).size}
              </p>
            </div>
            <Star className="h-8 w-8 text-yellow-400" />
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6">
        <div className="space-y-6">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Cari kursus..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-gray-300 bg-gray-50 py-3 pl-10 pr-4 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700">
                <Filter className="h-4 w-4" />
                Kategori
              </label>
              <select
                value={filters.category}
                onChange={(e) => setFilters({ ...filters, category: e.target.value })}
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                {categories.map(category => (
                  <option key={category.id} value={category.id}>
                    {category.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700">
                <TrendingUp className="h-4 w-4" />
                Level Kesulitan
              </label>
              <select
                value={filters.difficulty}
                onChange={(e) => setFilters({ ...filters, difficulty: e.target.value })}
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                {difficulties.map(difficulty => (
                  <option key={difficulty.id} value={difficulty.id}>
                    {difficulty.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700">
                <Award className="h-4 w-4" />
                Status
              </label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="published">Published</option>
                <option value="draft">Draft</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>

          {/* Results Count */}
          <div className="flex items-center justify-between border-t border-gray-100 pt-4">
            <p className="text-sm text-gray-600">
              Menampilkan {filteredCourses.length} dari {courses.length} kursus
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setFilters({
                  category: 'all',
                  difficulty: 'all',
                  status: 'published',
                });
              }}
              className="text-sm font-medium text-primary hover:text-primary/80"
            >
              Reset Filter
            </button>
          </div>
        </div>
      </div>

      {/* Course Grid */}
      {loading ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-80 animate-pulse rounded-2xl bg-gray-200"></div>
          ))}
        </div>
      ) : filteredCourses.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 py-16 text-center">
          <BookOpen className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-4 text-lg font-semibold text-gray-900">Tidak ada kursus ditemukan</h3>
          <p className="mt-2 text-gray-600">
            Coba ubah filter pencarian Anda atau periksa kembali nanti.
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setFilters({
                category: 'all',
                difficulty: 'all',
                status: 'published',
              });
            }}
            className="mt-4 rounded-lg bg-primary px-6 py-2 font-medium text-white hover:opacity-90"
          >
            Reset Pencarian
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredCourses.map((course, index) => (
            <motion.div
              key={course.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="group overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition-all hover:shadow-lg"
            >
              {/* Course Image */}
              <div className="relative h-48 bg-gradient-to-r from-primary/20 to-secondary/20">
                {course.thumbnail ? (
                  <Image
                    src={course.thumbnail}
                    alt={course.title}
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <BookOpen className="h-16 w-16 text-primary/30" />
                  </div>
                )}
                <div className="absolute right-3 top-3 space-y-2">
                  <span className={`rounded-full px-3 py-1 text-xs font-medium ${getDifficultyColor(course.difficulty)}`}>
                    {course.difficulty === 'beginner' ? 'Pemula' : 
                     course.difficulty === 'intermediate' ? 'Menengah' : 'Lanjutan'}
                  </span>
                  {course.category && (
                    <span className={`block rounded-full px-3 py-1 text-xs font-medium ${getCategoryColor(course.category)}`}>
                      {course.category === 'fundamental' ? 'Fundamental' : 
                       course.category === 'advanced' ? 'Lanjutan' : 'Spesialisasi'}
                    </span>
                  )}
                </div>
              </div>

              {/* Course Content */}
              <div className="p-6">
                <h3 className="line-clamp-2 text-xl font-bold text-gray-900 group-hover:text-primary">
                  {course.title}
                </h3>
                <p className="mt-3 line-clamp-3 text-sm text-gray-600">
                  {course.description || 'Deskripsi kursus belum tersedia.'}
                </p>

                <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    <span>{course.totalDuration || 0} menit</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    <span>Self-paced</span>
                  </div>
                </div>

                <div className="mt-6">
                  <Link
                    href={`/academy/courses/${course.id}`}
                    className="flex w-full items-center justify-between rounded-xl bg-gray-50 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-100"
                  >
                    <span>Lihat Detail Kursus</span>
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Featured Categories */}
      <div className="mt-12 rounded-2xl bg-gradient-to-r from-primary/10 to-secondary/10 p-8">
        <h2 className="text-2xl font-bold text-gray-900">Kategori Populer</h2>
        <p className="mt-2 text-gray-600">
          Jelajahi kursus berdasarkan area kompetensi yang paling dicari
        </p>
        
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl bg-white p-5 text-center shadow-sm">
            <div className="mx-auto mb-3 inline-flex items-center justify-center rounded-lg bg-blue-100 p-3">
              <BookOpen className="h-6 w-6 text-blue-600" />
            </div>
            <h3 className="font-semibold text-gray-900">Fundamental</h3>
            <p className="mt-1 text-sm text-gray-600">
              Dasar-dasar administrasi
            </p>
          </div>
          
          <div className="rounded-xl bg-white p-5 text-center shadow-sm">
            <div className="mx-auto mb-3 inline-flex items-center justify-center rounded-lg bg-purple-100 p-3">
              <TrendingUp className="h-6 w-6 text-purple-600" />
            </div>
            <h3 className="font-semibold text-gray-900">Komunikasi</h3>
            <p className="mt-1 text-sm text-gray-600">
              Korespondensi profesional
            </p>
          </div>
          
          <div className="rounded-xl bg-white p-5 text-center shadow-sm">
            <div className="mx-auto mb-3 inline-flex items-center justify-center rounded-lg bg-green-100 p-3">
              <Award className="h-6 w-6 text-green-600" />
            </div>
            <h3 className="font-semibold text-gray-900">Manajemen</h3>
            <p className="mt-1 text-sm text-gray-600">
              Organisasi & koordinasi
            </p>
          </div>
          
          <div className="rounded-xl bg-white p-5 text-center shadow-sm">
            <div className="mx-auto mb-3 inline-flex items-center justify-center rounded-lg bg-yellow-100 p-3">
              <Star className="h-6 w-6 text-yellow-600" />
            </div>
            <h3 className="font-semibold text-gray-900">Teknologi</h3>
            <p className="mt-1 text-sm text-gray-600">
              Tools & aplikasi digital
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
