import { Hono } from 'hono';
import { requireDbUser } from '../_lib/auth';

const router = new Hono();

router.get('/health', (c) => {
  return c.json({ status: 'ok', service: 'secretary-api', timestamp: new Date().toISOString() });
});

router.get('/me', async (c) => {
  const dbUser = await requireDbUser();
  if (!dbUser) return c.json({ error: 'Unauthorized' }, 401);
  return c.json({ user: dbUser });
});

export default router;
