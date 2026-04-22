import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL;

const createMissingDbProxy = () =>
  new Proxy(
    {},
    {
      get() {
        throw new Error('DATABASE_URL is not set');
      },
    },
  ) as unknown as ReturnType<typeof drizzle<typeof schema>>;

export const db = connectionString
  ? drizzle(neon(connectionString), { schema })
  : createMissingDbProxy();
