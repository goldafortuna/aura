'use client';

import Link from 'next/link';
import { SignedIn, SignedOut } from '@clerk/nextjs';
import {
  FileText,
  ClipboardList,
  Calendar,
  MessageSquare,
  CheckSquare,
  BookOpen,
  Sparkles,
  ArrowRight,
  Shield,
  Zap,
  Brain,
} from 'lucide-react';

const features = [
  {
    icon: FileText,
    label: 'Review Dokumen',
    desc: 'Analisis typo & ambiguitas dokumen dengan AI secara otomatis',
    color: 'from-violet-500/20 to-purple-500/20',
    iconColor: 'text-violet-600',
    iconBg: 'bg-violet-100',
  },
  {
    icon: ClipboardList,
    label: 'Notula Rapat',
    desc: 'Generate CTA otomatis dari notula dan distribusi ke tim',
    color: 'from-blue-500/20 to-cyan-500/20',
    iconColor: 'text-blue-600',
    iconBg: 'bg-blue-100',
  },
  {
    icon: Calendar,
    label: 'Agenda Pimpinan',
    desc: 'Sinkronisasi agenda dengan Google Calendar secara real-time',
    color: 'from-green-500/20 to-emerald-500/20',
    iconColor: 'text-green-600',
    iconBg: 'bg-green-100',
  },
  {
    icon: MessageSquare,
    label: 'WhatsApp Reminder',
    desc: 'Kirim pengingat otomatis dari agenda melalui WhatsApp',
    color: 'from-teal-500/20 to-green-500/20',
    iconColor: 'text-teal-600',
    iconBg: 'bg-teal-100',
  },
  {
    icon: CheckSquare,
    label: 'Manajemen Tugas',
    desc: 'Kanban board untuk tracking progress tugas tim',
    color: 'from-orange-500/20 to-amber-500/20',
    iconColor: 'text-orange-600',
    iconBg: 'bg-orange-100',
  },
  {
    icon: BookOpen,
    label: 'Academy',
    desc: 'Pelatihan terstruktur dan bersertifikat untuk sekretaris',
    color: 'from-pink-500/20 to-rose-500/20',
    iconColor: 'text-pink-600',
    iconBg: 'bg-pink-100',
  },
];

const highlights = [
  {
    icon: Brain,
    title: 'Didukung AI',
    desc: 'Gunakan Claude, GPT, atau DeepSeek untuk analisis dokumen & notula.',
    note:
      'Permintaan AI diproses atas nama akun Anda; konten tidak dipublikasikan ke pengguna lain dan tidak dipakai untuk melatih model publik.',
  },
  {
    icon: Zap,
    title: 'Serba Otomatis',
    desc: 'Dari review dokumen hingga pengiriman reminder, semua berjalan otomatis',
    note:
      'Alur kerja harian disederhanakan dengan automasi end-to-end agar tim fokus pada keputusan, bukan pekerjaan repetitif.',
  },
  {
    icon: Shield,
    title: 'Aman & Terpercaya',
    desc: 'Data terenkripsi, autentikasi aman, dan kontrol akses berbasis peran',
    note:
      'Akses sistem dibatasi sesuai peran pengguna, dengan kontrol audit dasar untuk menjaga integritas operasional organisasi.',
  },
];

export default function Home() {
  return (
    <main className="relative flex min-h-screen w-full flex-col overflow-x-hidden bg-[#f8f7ff]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="animate-landing-blob-1 absolute -right-40 -top-40 h-[500px] w-[500px] rounded-full bg-violet-200/40 blur-3xl will-change-transform" />
        <div className="animate-landing-blob-2 absolute -bottom-40 -left-40 h-[500px] w-[500px] rounded-full bg-blue-200/40 blur-3xl will-change-transform" />
        <div className="animate-landing-blob-3 absolute left-1/2 top-1/2 h-[320px] w-[320px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-200/25 blur-3xl will-change-transform" />
        <div className="animate-landing-shimmer absolute inset-0 bg-gradient-to-br from-violet-100/30 via-transparent to-blue-100/25" />
        <div
          className="animate-landing-grid absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage:
              'linear-gradient(#6d28d9 1px, transparent 1px), linear-gradient(to right, #6d28d9 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />
      </div>

      <header className="relative z-10 flex items-center justify-between px-8 py-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 shadow-md shadow-violet-200">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <span className="text-lg font-bold tracking-tight text-gray-900">AURA-AI Powered Secretary Asistant</span>
        </div>

        <nav className="flex items-center gap-3">
          <SignedOut>
            <Link
              href="/sign-in"
              className="rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-md shadow-violet-200/50 transition hover:opacity-90"
            >
              Masuk ke Sistem
            </Link>
          </SignedOut>
          <SignedIn>
            <Link
              href="/app"
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-md shadow-violet-200/50 transition hover:opacity-90"
            >
              Buka Dashboard <ArrowRight className="h-4 w-4" />
            </Link>
          </SignedIn>
        </nav>
      </header>

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 pb-4">
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-violet-200 bg-white/80 px-4 py-1.5 text-xs font-semibold text-violet-700 shadow-sm backdrop-blur-sm">
            <Sparkles className="h-3 w-3" />
            Sistem Manajemen Administrasi Berbasis AI
          </div>

          <h1 className="mx-auto max-w-2xl text-4xl font-extrabold leading-[1.15] tracking-tight text-gray-900 sm:text-5xl">
            Administrasi Sekretaris
            <span className="block bg-gradient-to-r from-violet-600 via-indigo-600 to-blue-600 bg-clip-text text-transparent">
              Lebih Cerdas &amp; Efisien
            </span>
          </h1>

          <p className="mx-auto mt-4 max-w-xl text-base text-gray-500">
            Platform all-in-one untuk sekretaris pimpinan - review dokumen otomatis, notula cerdas,
            manajemen agenda, dan pengingat WhatsApp dalam satu sistem terintegrasi.
          </p>
        </div>

        <div className="mb-8 grid w-full max-w-4xl grid-cols-2 gap-3 sm:grid-cols-3">
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.label}
                className={`group relative overflow-hidden rounded-2xl border border-white/60 bg-gradient-to-br ${f.color} p-4 shadow-sm backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:shadow-md`}
              >
                <div className={`mb-2.5 inline-flex h-9 w-9 items-center justify-center rounded-xl ${f.iconBg}`}>
                  <Icon className={`h-4 w-4 ${f.iconColor}`} />
                </div>
                <p className="text-sm font-semibold text-gray-800">{f.label}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-gray-500">{f.desc}</p>
              </div>
            );
          })}
        </div>

        <div className="grid w-full max-w-4xl grid-cols-1 gap-3 sm:grid-cols-3">
          {highlights.map((h) => {
            const Icon = h.icon;
            return (
              <div
                key={h.title}
                className="flex w-full min-h-[120px] items-start gap-2.5 rounded-xl border border-white/70 bg-white/70 px-4 py-2.5 shadow-sm backdrop-blur-sm"
              >
                <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-indigo-500">
                  <Icon className="h-3.5 w-3.5 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-gray-800">{h.title}</p>
                  <p className="text-[10px] leading-snug text-gray-500">{h.desc}</p>
                  {h.note ? (
                    <p className="mt-1 border-t border-violet-100/80 pt-1 text-[10px] leading-snug text-gray-600">
                      {h.note}
                    </p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <footer className="relative z-10 py-4 text-center text-xs text-gray-400">
        <div className="mb-1 flex items-center justify-center gap-3">
          <Link href="/privacy-policy" className="text-gray-500 hover:text-violet-600">
            Privacy Policy
          </Link>
          <span className="text-gray-300">|</span>
          <Link href="/terms-of-service" className="text-gray-500 hover:text-violet-600">
            Terms of Service
          </Link>
        </div>
        Copyright 2026 Golda Fortuna
      </footer>
    </main>
  );
}