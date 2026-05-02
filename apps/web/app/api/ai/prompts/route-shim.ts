import { Hono } from 'hono';
import { handle } from 'hono/vercel';

import promptsRoute from './handler';

// Mount at full path so promptsRoute receives "/" regardless of basePath behaviour.
const app = new Hono();

app.route('/api/ai/prompts', promptsRoute);

export const aiPromptsHandler = handle(app);
