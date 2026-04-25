import { Hono } from 'hono';
import { handle } from 'hono/vercel';

import meetingMinutesRoute from './handler';

const app = new Hono().basePath('/api');

app.route('/meeting-minutes', meetingMinutesRoute);

export const meetingMinutesHandler = handle(app);
