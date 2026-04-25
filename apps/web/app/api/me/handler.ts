import { Hono } from 'hono';
import { parseUserRoles, requireDbUser } from '../../../lib/middleware/auth';

const app = new Hono();

app.get('/', async (c) => {
  const dbUser = await requireDbUser(c);
  if (!dbUser) return c.json({ error: 'Unauthorized' }, 401);
  return c.json({
    user: dbUser,
    data: {
      id: dbUser.id,
      email: dbUser.email,
      fullName: dbUser.fullName,
      roles: parseUserRoles(dbUser),
      approvalStatus: dbUser.approvalStatus,
    },
  });
});

export default app;
