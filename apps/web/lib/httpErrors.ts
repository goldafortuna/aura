import type { Context } from 'hono';

export function internalServerError(
  c: Context,
  scope: string,
  error: unknown,
  message: string = 'Internal server error. Please try again later.',
) {
  console.error(`[${scope}]`, error);
  return c.json({ error: message }, 500);
}
