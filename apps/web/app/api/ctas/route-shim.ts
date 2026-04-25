import { Hono } from 'hono';
import { handle } from 'hono/vercel';

import ctaRoute from './handler';

const app = new Hono().basePath('/api');

app.route('/ctas', ctaRoute);

export const ctasHandler = handle(app);
