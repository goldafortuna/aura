import { Hono } from 'hono';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { perjadinGuidelines } from '@/db/schema';
import { parsePerjadinGuidelineContent } from '@/lib/perjadinGuidelineContent';
import { requireSecretary } from '@/lib/middleware/auth';

const app = new Hono();

app.get('/', async (c) => {
  const dbUser = await requireSecretary(c);
  if (!dbUser) return c.json({ error: 'Unauthorized' }, 401);

  const [row] = await db
    .select({
      id: perjadinGuidelines.id,
      slug: perjadinGuidelines.slug,
      title: perjadinGuidelines.title,
      versionLabel: perjadinGuidelines.versionLabel,
      status: perjadinGuidelines.status,
      content: perjadinGuidelines.content,
      updatedAt: perjadinGuidelines.updatedAt,
    })
    .from(perjadinGuidelines)
    .where(and(eq(perjadinGuidelines.isActive, true), eq(perjadinGuidelines.status, 'published')))
    .orderBy(desc(perjadinGuidelines.updatedAt))
    .limit(1);

  if (!row) {
    return c.json(
      {
        error:
          'Pedoman perjadin belum tersedia. Jalankan `npm run db:ensure-perjadin-guidelines` lalu `npm run db:seed-perjadin-guidelines`.',
      },
      404,
    );
  }

  try {
    const content = parsePerjadinGuidelineContent(row.content);
    return c.json({
      data: {
        id: row.id,
        slug: row.slug,
        title: row.title,
        versionLabel: row.versionLabel,
        status: row.status,
        updatedAt: row.updatedAt,
        content,
      },
    });
  } catch {
    return c.json({ error: 'Konten pedoman perjadin tidak valid. Periksa struktur JSON di database.' }, 500);
  }
});

app.get('/:slug', async (c) => {
  const dbUser = await requireSecretary(c);
  if (!dbUser) return c.json({ error: 'Unauthorized' }, 401);

  const slug = c.req.param('slug');

  const [row] = await db
    .select({
      id: perjadinGuidelines.id,
      slug: perjadinGuidelines.slug,
      title: perjadinGuidelines.title,
      versionLabel: perjadinGuidelines.versionLabel,
      status: perjadinGuidelines.status,
      content: perjadinGuidelines.content,
      updatedAt: perjadinGuidelines.updatedAt,
    })
    .from(perjadinGuidelines)
    .where(
      and(
        eq(perjadinGuidelines.slug, slug),
        eq(perjadinGuidelines.isActive, true),
        eq(perjadinGuidelines.status, 'published'),
      ),
    )
    .limit(1);

  if (!row) {
    return c.json({ error: 'Pedoman perjadin tidak ditemukan.' }, 404);
  }

  try {
    const content = parsePerjadinGuidelineContent(row.content);
    return c.json({
      data: {
        id: row.id,
        slug: row.slug,
        title: row.title,
        versionLabel: row.versionLabel,
        status: row.status,
        updatedAt: row.updatedAt,
        content,
      },
    });
  } catch {
    return c.json({ error: 'Konten pedoman perjadin tidak valid. Periksa struktur JSON di database.' }, 500);
  }
});

export default app;
