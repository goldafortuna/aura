'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  BookMarked,
  ChevronRight,
  Compass,
  ExternalLink,
  Info,
  Lightbulb,
  Loader2,
  MapPin,
  Plane,
  Sparkles,
} from 'lucide-react';
import type {
  PerjadinGuidelineChapter,
  PerjadinGuidelineContent,
  PerjadinGuidelineSection,
} from '@/lib/perjadinGuidelineContent';

type SectionWithOcr = PerjadinGuidelineSection & {
  ocrText?: string;
  sbuTarifRows?: {
    blok?: string;
    kategoriJabatan?: string;
    jabatan: string;
    tiketPesawat: string;
    uangHarian: string;
    penginapan?: string;
    representasi?: string;
  }[];
};
import { cn } from '@/lib/utils';

type GuidelineResponse = {
  data?: {
    title: string;
    versionLabel: string;
    updatedAt: string;
    content: PerjadinGuidelineContent;
  };
  error?: string;
};

function formatUpdatedAt(iso: string) {
  try {
    return new Intl.DateTimeFormat('id-ID', { dateStyle: 'long' }).format(new Date(iso));
  } catch {
    return iso;
  }
}

const calloutStyles = {
  info: {
    icon: Info,
    box: 'border-sky-200 bg-sky-50 text-sky-900',
    iconClass: 'text-sky-600',
  },
  warning: {
    icon: AlertTriangle,
    box: 'border-amber-200 bg-amber-50 text-amber-900',
    iconClass: 'text-amber-600',
  },
  tip: {
    icon: Lightbulb,
    box: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    iconClass: 'text-emerald-600',
  },
} as const;

function SectionBlock({ section }: { section: SectionWithOcr }) {
  const callout = section.callout;
  const [showRawOcr, setShowRawOcr] = useState(false);

  return (
    <article id={section.id} className="scroll-mt-28 space-y-4">
      <h3 className="text-xl font-semibold text-gray-900">{section.heading}</h3>
      {section.body ? <p className="text-base leading-8 text-gray-700">{section.body}</p> : null}
      {Array.isArray(section.points) && section.points.length > 0 ? (
        <ul className="space-y-3">
          {section.points.map((point, index) => (
            <li key={`${section.id}-point-${index}`} className="flex items-start gap-3 text-base leading-7 text-gray-700">
              <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-indigo-500" />
              <span>{point}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {callout ? (
        <div className={cn('flex gap-3 rounded-2xl border p-4', calloutStyles[callout.type].box)}>
          {(() => {
            const Icon = calloutStyles[callout.type].icon;
            return <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', calloutStyles[callout.type].iconClass)} />;
          })()}
          <div className="space-y-1 text-sm leading-6">
            {callout.title ? <p className="font-semibold">{callout.title}</p> : null}
            <p>{callout.body}</p>
          </div>
        </div>
      ) : null}
      {section.table ? (
        <div className="overflow-x-auto rounded-2xl border border-gray-200">
          {section.table.caption ? (
            <p className="border-b border-gray-100 bg-gray-50 px-4 py-2 text-xs font-medium text-gray-600">
              {section.table.caption}
            </p>
          ) : null}
          <table className="min-w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-700">
              <tr>
                {section.table.headers.map((header, index) => (
                  <th key={`${section.id}-th-${index}`} className="px-4 py-3 font-semibold">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {section.table.rows.map((row, rowIndex) => (
                <tr key={`${section.id}-tr-${rowIndex}`} className="border-t border-gray-100">
                  {row.map((cell, cellIndex) => (
                    <td key={`${section.id}-td-${rowIndex}-${cellIndex}`} className="px-4 py-3 text-gray-700">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {section.ocrText ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/80">
          <button
            type="button"
            onClick={() => setShowRawOcr((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-3 text-left text-xs font-semibold text-gray-600 hover:text-gray-900"
          >
            Teks OCR mentah {showRawOcr ? '(sembunyikan)' : '(tampilkan)'}
          </button>
          {showRawOcr ? (
            <pre className="max-h-64 overflow-auto whitespace-pre-wrap border-t border-gray-200 px-4 py-3 font-mono text-[11px] leading-5 text-gray-600">
              {section.ocrText}
            </pre>
          ) : null}
        </div>
      ) : null}
      {section.figure ? (
        <figure className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <a href={section.figure.src} target="_blank" rel="noopener noreferrer" className="group block">
            <img
              src={section.figure.src}
              alt={section.figure.alt}
              className="max-h-[min(70vh,720px)] w-full object-contain bg-gray-50 transition group-hover:opacity-95"
              loading="lazy"
            />
          </a>
          <figcaption className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 bg-gray-50 px-4 py-3 text-xs text-gray-600">
            <span>{section.figure.caption ?? section.figure.alt}</span>
            <span className="inline-flex items-center gap-1 font-medium text-indigo-600">
              <ExternalLink className="h-3.5 w-3.5" />
              Buka gambar penuh
            </span>
          </figcaption>
        </figure>
      ) : null}
    </article>
  );
}

function ChapterPanel({
  chapter,
  isActive,
}: {
  chapter: PerjadinGuidelineChapter;
  isActive: boolean;
}) {
  return (
    <section
      id={`chapter-${chapter.id}`}
      className={cn(
        'scroll-mt-24 rounded-3xl border bg-white p-6 shadow-sm sm:p-8',
        isActive ? 'border-indigo-200 ring-2 ring-indigo-100' : 'border-gray-200',
      )}
    >
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          {chapter.badge ? (
            <span className="inline-flex rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
              {chapter.badge}
            </span>
          ) : null}
          <h2 className="mt-2 text-2xl font-bold text-gray-900">{chapter.title}</h2>
          {chapter.description ? <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600">{chapter.description}</p> : null}
        </div>
      </div>
      <div className="space-y-10">
        {chapter.sections.map((section) => (
          <SectionBlock key={section.id} section={section} />
        ))}
      </div>
    </section>
  );
}

export default function PedomanPerjadinPlaybook() {
  const [payload, setPayload] = useState<GuidelineResponse['data'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeChapterId, setActiveChapterId] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/perjadin-guidelines', { cache: 'no-store' });
        const json = (await res.json()) as GuidelineResponse;
        if (!res.ok) throw new Error(json.error ?? `Gagal memuat pedoman (HTTP ${res.status})`);
        if (!cancelled) {
          setPayload(json.data ?? null);
          const firstChapter = json.data?.content.chapters[0]?.id ?? null;
          setActiveChapterId(firstChapter);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Gagal memuat pedoman perjadin.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const content = payload?.content;
  const chapters = content?.chapters ?? [];

  const scrollToChapter = useCallback((chapterId: string) => {
    setActiveChapterId(chapterId);
    const el = document.getElementById(`chapter-${chapterId}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const scrollToSection = useCallback((chapterId: string, sectionId?: string) => {
    setActiveChapterId(chapterId);
    if (sectionId) {
      const el = document.getElementById(sectionId);
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    scrollToChapter(chapterId);
  }, [scrollToChapter]);

  useEffect(() => {
    if (!chapters.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => (b.intersectionRatio ?? 0) - (a.intersectionRatio ?? 0))[0];
        if (visible?.target?.id?.startsWith('chapter-')) {
          setActiveChapterId(visible.target.id.replace('chapter-', ''));
        }
      },
      { root: null, rootMargin: '-20% 0px -55% 0px', threshold: [0.1, 0.35, 0.6] },
    );

    chapters.forEach((ch) => {
      const el = document.getElementById(`chapter-${ch.id}`);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [chapters]);

  const quickLinks = useMemo(() => content?.quickLinks ?? [], [content?.quickLinks]);

  if (loading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-3xl border border-gray-200 bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (error || !content || !payload) {
    return (
      <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
        <p className="font-semibold">Pedoman perjadin belum dapat ditampilkan</p>
        <p className="mt-2 text-sm leading-6">{error ?? 'Data tidak ditemukan.'}</p>
        <p className="mt-3 text-xs text-amber-800">
          Admin: jalankan <code className="rounded bg-white/70 px-1">npm run db:ensure-perjadin-guidelines</code> lalu{' '}
          <code className="rounded bg-white/70 px-1">npm run db:seed-perjadin-guidelines</code>.
        </p>
      </div>
    );
  }

  const efficiency = content.meta.efficiencyPolicy;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-700 via-indigo-600 to-sky-600 p-8 text-white">
        <div className="pointer-events-none absolute inset-0 opacity-10">
          <Plane className="absolute right-8 top-8 h-24 w-24 rotate-12" />
          <MapPin className="absolute bottom-10 right-32 h-16 w-16" />
        </div>
        <div className="relative max-w-3xl">
          <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold backdrop-blur-sm">
            <Sparkles className="h-3 w-3" /> Playbook · {payload.versionLabel}
          </span>
          <h1 className="mt-3 text-3xl font-bold leading-tight">{content.meta.title}</h1>
          {content.meta.subtitle ? <p className="mt-3 text-sm leading-6 text-white/85">{content.meta.subtitle}</p> : null}
          <p className="mt-2 text-xs text-white/70">Diperbarui: {formatUpdatedAt(payload.updatedAt)}</p>
        </div>
      </div>

      {(efficiency?.domestic || efficiency?.international) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {efficiency.domestic ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Efisiensi dalam negeri</p>
              <p className="mt-1 text-sm leading-6 text-emerald-900">{efficiency.domestic}</p>
            </div>
          ) : null}
          {efficiency.international ? (
            <div className="rounded-2xl border border-violet-200 bg-violet-50/80 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-violet-800">Efisiensi luar negeri</p>
              <p className="mt-1 text-sm leading-6 text-violet-900">{efficiency.international}</p>
            </div>
          ) : null}
        </div>
      )}

      {quickLinks.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          <span className="flex w-full items-center gap-1 text-xs font-semibold uppercase tracking-wide text-gray-500 sm:w-auto">
            <Compass className="h-3.5 w-3.5" /> Navigasi cepat
          </span>
          {quickLinks.map((link) => (
            <button
              key={`${link.chapterId}-${link.sectionId ?? 'all'}`}
              type="button"
              onClick={() => scrollToSection(link.chapterId, link.sectionId)}
              className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-800"
            >
              {link.label}
            </button>
          ))}
        </div>
      ) : null}

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <aside className="lg:sticky lg:top-6 lg:w-64 lg:shrink-0">
          <nav className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
            <p className="mb-2 flex items-center gap-2 px-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
              <BookMarked className="h-3.5 w-3.5" /> Daftar isi
            </p>
            <ul className="space-y-1">
              {chapters.map((chapter) => {
                const active = activeChapterId === chapter.id;
                return (
                  <li key={chapter.id}>
                    <button
                      type="button"
                      onClick={() => scrollToChapter(chapter.id)}
                      className={cn(
                        'flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition',
                        active
                          ? 'bg-gradient-to-r from-primary/20 to-secondary/20 font-semibold text-indigo-900'
                          : 'text-gray-600 hover:bg-gray-50',
                      )}
                    >
                      <span className="line-clamp-2">{chapter.title}</span>
                      <ChevronRight className={cn('h-4 w-4 shrink-0', active ? 'text-indigo-600' : 'text-gray-300')} />
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
        </aside>

        <div ref={contentRef} className="min-w-0 flex-1 space-y-8">
          {chapters.map((chapter) => (
            <ChapterPanel key={chapter.id} chapter={chapter} isActive={activeChapterId === chapter.id} />
          ))}

          {Array.isArray(content.meta.sourceNotes) && content.meta.sourceNotes.length > 0 ? (
            <section className="rounded-2xl border border-gray-200 bg-gray-50 p-5 text-sm text-gray-600">
              <p className="font-semibold text-gray-800">Catatan sumber</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {content.meta.sourceNotes.map((note, index) => (
                  <li key={`note-${index}`}>{note}</li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </div>
    </motion.div>
  );
}
