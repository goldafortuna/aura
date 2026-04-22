import { Context, MiddlewareHandler } from 'hono';
import { Redis } from '@upstash/redis';

type CounterState = {
  count: number;
  resetTime: number;
};

const memoryStore = new Map<string, CounterState>();
const RATE_LIMIT_NAMESPACE = 'rl:v1';

let redisClient: Redis | null | undefined;
function getRedisClient(): Redis | null {
  if (redisClient !== undefined) return redisClient;

  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  redisClient = url && token ? new Redis({ url, token }) : null;
  return redisClient;
}

function extractClientIp(c: Context): string {
  const cfIp = c.req.header('CF-Connecting-IP')?.trim();
  if (cfIp) return cfIp;

  const xff = c.req.header('X-Forwarded-For');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }

  return 'anonymous';
}

function memoryRateLimit(key: string, windowMs: number): CounterState {
  const now = Date.now();
  const prev = memoryStore.get(key);

  if (!prev || prev.resetTime < now) {
    const next = { count: 1, resetTime: now + windowMs };
    memoryStore.set(key, next);
    return next;
  }

  const next = { ...prev, count: prev.count + 1 };
  memoryStore.set(key, next);
  return next;
}

async function redisRateLimit(key: string, windowMs: number): Promise<CounterState> {
  const redis = getRedisClient();
  if (!redis) {
    return memoryRateLimit(key, windowMs);
  }

  const namespacedKey = `${RATE_LIMIT_NAMESPACE}:${key}`;
  try {
    const results = await redis.pipeline().incr(namespacedKey).pttl(namespacedKey).exec();

    const countRaw = results[0] as unknown;
    const ttlRaw = results[1] as unknown;

    const count = typeof countRaw === 'number' ? countRaw : Number(countRaw ?? 0);
    let ttl = typeof ttlRaw === 'number' ? ttlRaw : Number(ttlRaw ?? -1);

    if (!Number.isFinite(ttl) || ttl <= 0) {
      await redis.pexpire(namespacedKey, windowMs);
      ttl = windowMs;
    }

    return { count, resetTime: Date.now() + ttl };
  } catch (error) {
    console.error('[rateLimit] Redis unavailable, fallback to in-memory store:', error);
    return memoryRateLimit(key, windowMs);
  }
}

export function createRateLimitMiddleware(maxRequests: number = 10, windowMs: number = 60000): MiddlewareHandler {
  return async (c: Context, next: () => Promise<void>) => {
    const ip = extractClientIp(c);
    const key = `${ip}:${c.req.path}`;
    const state = await redisRateLimit(key, windowMs);

    c.header('X-RateLimit-Limit', maxRequests.toString());
    c.header('X-RateLimit-Remaining', Math.max(0, maxRequests - state.count).toString());
    c.header('X-RateLimit-Reset', state.resetTime.toString());

    if (state.count > maxRequests) {
      return c.json({ error: 'Too Many Requests' }, 429);
    }

    await next();
  };
}
