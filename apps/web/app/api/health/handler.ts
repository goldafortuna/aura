import { Hono } from 'hono';
import { db } from '../../../db';
import { sql } from 'drizzle-orm';

const app = new Hono();

app.get('/', async (c) => {
  try {
    // Basic health check - check database connectivity
    await db.execute(sql`SELECT 1`);
    
    return c.json({ 
      status: 'ok', 
      service: 'secretary-api', 
      timestamp: new Date().toISOString(),
      checks: {
        database: 'ok'
      }
    });
  } catch (error) {
    return c.json({ 
      status: 'error', 
      service: 'secretary-api', 
      timestamp: new Date().toISOString(),
      error: 'Database connection failed',
      checks: {
        database: 'failed'
      }
    }, 503);
  }
});

export default app;