import { Hono } from 'hono';
import { handle } from 'hono/vercel';

import documentsRoute from '../documents/handler';
import meetingMinutesRoute from '../meeting-minutes/handler';
import tasksRoute from '../tasks/handler';
import aiLegacyRoute from './routes/ai';
import ctaRoute from '../ctas/handler';
import googleCalendarRoute from '../google/calendar/handler';
import waTemplatesRoute from '../wa-templates/handler';
import unitKerjaRoute from '../unit-kerja/handler';
import emailConfigRoute from '../email-config/handler';
import webdavConfigRoute from '../webdav-config/handler';
import healthRoute from '../health/handler';
import documentsUploadRoute from '../uploads/documents/handler';
import meetingMinutesUploadRoute from '../uploads/meeting-minutes/handler';
import academyRoute from '../academy/handler';
import meRoute from '../me/handler';
import adminUsersRoute from '../admin/users/handler';
import timeSavingsAnalyticsRoute from '../analytics/time-savings/handler';
import adminTimeSavingsSettingsRoute from '../admin/time-savings-settings/handler';

const app = new Hono().basePath('/api');

app.route('/documents', documentsRoute);
app.route('/meeting-minutes', meetingMinutesRoute);
app.route('/tasks', tasksRoute);
app.route('/ai', aiLegacyRoute);
app.route('/ctas', ctaRoute);
app.route('/google/calendar', googleCalendarRoute);
app.route('/wa-templates', waTemplatesRoute);
app.route('/unit-kerja', unitKerjaRoute);
app.route('/email-config', emailConfigRoute);
app.route('/webdav-config', webdavConfigRoute);
app.route('/health', healthRoute);
app.route('/uploads/documents', documentsUploadRoute);
app.route('/uploads/meeting-minutes', meetingMinutesUploadRoute);
app.route('/academy', academyRoute);
app.route('/me', meRoute);
app.route('/admin/users', adminUsersRoute);
app.route('/analytics/time-savings', timeSavingsAnalyticsRoute);
app.route('/admin/time-savings-settings', adminTimeSavingsSettingsRoute);

export const GET = handle(app);
export const POST = handle(app);
export const PUT = handle(app);
export const PATCH = handle(app);
export const DELETE = handle(app);
