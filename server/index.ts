/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import express from 'express';
import { authRouter } from './features/auth/routes';
import { obligationsRouter } from './features/obligations/routes';
import { auditLogsRouter } from './features/audit-logs/routes';
import { usersRouter } from './features/users/routes';
import { remindersRouter } from './features/reminders/routes';
import { registerReminderCronJob } from './features/reminders/cron';
import { notificationsRouter } from './features/notifications/routes';
import { registerNotificationCronJob } from './features/notifications/cron';

const app = express();
const isProduction = process.env.NODE_ENV === 'production';

// Local dev (via `npm run dev`) deliberately does NOT read `PORT` — some
// dev/hosting sandboxes export a generic `PORT` for the primary web process
// (Vite here), which would collide if Express also bound to it. In real
// production (CD-006, single Node service), Render assigns the port to
// listen on via `PORT` at runtime, so that takes priority there instead.
const PORT = Number(isProduction ? process.env.PORT : process.env.API_PORT) || 3001;

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRouter);
app.use('/api/obligations', obligationsRouter);
app.use('/api/audit-logs', auditLogsRouter);
app.use('/api/users', usersRouter);
app.use('/api/reminders', remindersRouter);
app.use('/api/notifications', notificationsRouter);

// Production (CD-006): this one Express process also serves the built Vite
// frontend, instead of relying on Vite's dev server. Dev mode keeps using
// `vite --port=3000` with its `/api` proxy (see vite.config.ts) instead.
if (isProduction) {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const distDir = path.resolve(__dirname, '..', 'dist');
  app.use(express.static(distDir));
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`[chronos-server] Express listening on http://localhost:${PORT}${isProduction ? ' (production, serving built frontend)' : ' (API only — frontend served by Vite dev server)'}`);
});

registerReminderCronJob();
registerNotificationCronJob();
