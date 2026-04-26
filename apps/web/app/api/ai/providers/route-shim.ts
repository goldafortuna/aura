import { Hono } from 'hono';
import { handle } from 'hono/vercel';

import providersRoute from './handler';

const app = new Hono().basePath('/api');

app.route('/ai/providers', providersRoute);

export const aiProvidersHandler = handle(app);
