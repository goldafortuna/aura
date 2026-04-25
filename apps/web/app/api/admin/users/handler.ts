import { Hono } from 'hono';
import { z } from 'zod';
import { and, eq, ne, sql } from 'drizzle-orm';
import { db } from '../../../../db';
import { users } from '../../../../db/schema';
import {
  parseUserRoles,
  requireSuperAdmin,
  serializeUserRoles,
  type UserRole,
} from '../../../../lib/middleware/auth';

const app = new Hono();

const updateRolesSchema = z.object({
  roles: z.array(z.enum(['secretary', 'super_admin'])).min(1),
});

const rejectUserSchema = z.object({
  reason: z.string().max(500).optional().default(''),
});

function toUserDto(user: typeof users.$inferSelect) {
  return {
    id: user.id,
    clerkUserId: user.clerkUserId,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    roles: parseUserRoles(user),
    approvalStatus: user.approvalStatus,
    approvedAt: user.approvedAt,
    approvedByUserId: user.approvedByUserId,
    rejectedAt: user.rejectedAt,
    rejectedReason: user.rejectedReason,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

async function activeSuperAdminCount(excludeUserId?: string) {
  const where = excludeUserId
    ? and(
        eq(users.approvalStatus, 'approved'),
        ne(users.id, excludeUserId),
        sql`${users.rolesJson}::jsonb ? 'super_admin'`,
      )
    : and(eq(users.approvalStatus, 'approved'), sql`${users.rolesJson}::jsonb ? 'super_admin'`);

  const [row] = await db.select({ count: sql<number>`count(*)` }).from(users).where(where);
  return Number(row?.count ?? 0);
}

async function ensureCanRemoveSuperAdmin(target: typeof users.$inferSelect, actorId: string) {
  if (!parseUserRoles(target).includes('super_admin')) return true;
  if (target.id !== actorId) return true;
  return (await activeSuperAdminCount(target.id)) > 0;
}

app.get('/', async (c) => {
  const actor = await requireSuperAdmin(c);
  if (!actor) return c.json({ error: 'Forbidden' }, 403);

  const status = c.req.query('status') ?? 'pending';
  const allowedStatuses = ['pending', 'approved', 'rejected', 'all'];
  if (!allowedStatuses.includes(status)) {
    return c.json({ error: 'Status tidak valid. Pilih: pending, approved, rejected, all.' }, 400);
  }

  const rows =
    status === 'all'
      ? await db.select().from(users).orderBy(users.createdAt)
      : await db
          .select()
          .from(users)
          .where(eq(users.approvalStatus, status))
          .orderBy(users.createdAt);

  return c.json({ data: rows.map(toUserDto) });
});

app.patch('/:id/approve', async (c) => {
  const actor = await requireSuperAdmin(c);
  if (!actor) return c.json({ error: 'Forbidden' }, 403);

  const id = c.req.param('id');
  const [target] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!target) return c.json({ error: 'User not found' }, 404);

  const roles = parseUserRoles(target);
  const nextRoles = roles.length > 0 ? roles : (['secretary'] as UserRole[]);
  const [updated] = await db
    .update(users)
    .set({
      role: nextRoles[0] ?? 'secretary',
      rolesJson: serializeUserRoles(nextRoles),
      approvalStatus: 'approved',
      approvedAt: new Date(),
      approvedByUserId: actor.id,
      rejectedAt: null,
      rejectedReason: null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, id))
    .returning();

  return c.json({ data: toUserDto(updated) });
});

app.patch('/:id/reject', async (c) => {
  const actor = await requireSuperAdmin(c);
  if (!actor) return c.json({ error: 'Forbidden' }, 403);

  const id = c.req.param('id');
  const [target] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!target) return c.json({ error: 'User not found' }, 404);
  if (!(await ensureCanRemoveSuperAdmin(target, actor.id))) {
    return c.json({ error: 'Tidak bisa menolak Super Admin aktif terakhir.' }, 400);
  }

  const body = await c.req.json().catch(() => ({}));
  const parsed = rejectUserSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);

  const [updated] = await db
    .update(users)
    .set({
      approvalStatus: 'rejected',
      rejectedAt: new Date(),
      rejectedReason: parsed.data.reason.trim() || null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, id))
    .returning();

  return c.json({ data: toUserDto(updated) });
});

app.patch('/:id/roles', async (c) => {
  const actor = await requireSuperAdmin(c);
  if (!actor) return c.json({ error: 'Forbidden' }, 403);

  const id = c.req.param('id');
  const [target] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!target) return c.json({ error: 'User not found' }, 404);

  const body = await c.req.json();
  const parsed = updateRolesSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);

  const nextRoles = parsed.data.roles;
  if (target.id === actor.id && parseUserRoles(target).includes('super_admin') && !nextRoles.includes('super_admin')) {
    if ((await activeSuperAdminCount(target.id)) === 0) {
      return c.json({ error: 'Tidak bisa menghapus role Super Admin aktif terakhir.' }, 400);
    }
  }

  const [updated] = await db
    .update(users)
    .set({
      role: nextRoles[0] ?? 'secretary',
      rolesJson: serializeUserRoles(nextRoles),
      updatedAt: new Date(),
    })
    .where(eq(users.id, id))
    .returning();

  return c.json({ data: toUserDto(updated) });
});

export default app;
