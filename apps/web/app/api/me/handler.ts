import { Hono } from 'hono';
import { requireDbUser } from '../../../lib/middleware/auth';

const app = new Hono();

app.get('/', async (c) => {
  const dbUser = await requireDbUser(c);
  if (!dbUser) return c.json({ error: 'Unauthorized' }, 401);
  return c.json({ user: dbUser });
});

export default app;
