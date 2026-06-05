import { z } from 'zod';

const calloutSchema = z.object({
  type: z.enum(['info', 'warning', 'tip']),
  title: z.string().optional(),
  body: z.string(),
});

const tableSchema = z.object({
  caption: z.string().optional(),
  headers: z.array(z.string()).min(1),
  rows: z.array(z.array(z.string())).min(1),
});

const figureSchema = z.object({
  src: z.string().min(1),
  alt: z.string().min(1),
  caption: z.string().optional(),
});

const sbuTarifRowSchema = z.object({
  blok: z.string().optional(),
  kategoriJabatan: z.string().optional(),
  jabatan: z.string(),
  tiketPesawat: z.string(),
  uangHarian: z.string(),
  penginapan: z.string().optional(),
  representasi: z.string().optional(),
});

const sectionSchema = z.object({
  id: z.string().min(1),
  heading: z.string().min(1),
  body: z.string().optional(),
  points: z.array(z.string()).optional(),
  callout: calloutSchema.optional(),
  table: tableSchema.optional(),
  figure: figureSchema.optional(),
  ocrText: z.string().optional(),
  sbuTarifRows: z.array(sbuTarifRowSchema).optional(),
});

const chapterSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  badge: z.string().optional(),
  gradient: z.string().optional(),
  sections: z.array(sectionSchema).min(1),
});

const quickLinkSchema = z.object({
  label: z.string().min(1),
  chapterId: z.string().min(1),
  sectionId: z.string().optional(),
});

export const perjadinGuidelineContentSchema = z.object({
  meta: z.object({
    title: z.string().min(1),
    subtitle: z.string().optional(),
    version: z.string().min(1),
    effectiveDate: z.string().optional(),
    sourceNotes: z.array(z.string()).optional(),
    efficiencyPolicy: z
      .object({
        domestic: z.string().optional(),
        international: z.string().optional(),
      })
      .optional(),
  }),
  chapters: z.array(chapterSchema).min(1),
  quickLinks: z.array(quickLinkSchema).optional(),
});

export type PerjadinGuidelineContent = z.infer<typeof perjadinGuidelineContentSchema>;
export type PerjadinGuidelineChapter = z.infer<typeof chapterSchema>;
export type PerjadinGuidelineSection = z.infer<typeof sectionSchema>;

export function parsePerjadinGuidelineContent(raw: unknown): PerjadinGuidelineContent {
  return perjadinGuidelineContentSchema.parse(raw);
}
