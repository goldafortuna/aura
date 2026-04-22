import { z } from 'zod';

/**
 * Some models return confidence as 0–100; we store 0–1 everywhere.
 */
export const confidence01Optional = z.preprocess((val: unknown) => {
  if (val === undefined || val === null) return undefined;
  const n = typeof val === 'number' ? val : Number(val);
  if (!Number.isFinite(n)) return undefined;
  if (n >= 0 && n <= 1) return n;
  if (n > 1 && n <= 100) return n / 100;
  if (n < 0) return 0;
  return 1;
}, z.number().min(0).max(1).optional());
