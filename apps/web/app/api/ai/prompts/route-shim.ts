import { Hono } from 'hono';
import { handle } from 'hono/vercel';

import promptsRoute from './handler';

const app = new Hono().basePath('/api');

app.route('/ai/prompts', promptsRoute);

export const aiPromptsHandler = handle(app);
