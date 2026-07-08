/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import { authRouter } from './features/auth/routes';
import { obligationsRouter } from './features/obligations/routes';
import { auditLogsRouter } from './features/audit-logs/routes';

const app = express();
// Deliberately NOT named `PORT` — some dev/hosting environments export a
// generic `PORT` for the primary web process, which would collide with Vite.
const PORT = Number(process.env.API_PORT) || 3001;

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRouter);
app.use('/api/obligations', obligationsRouter);
app.use('/api/audit-logs', auditLogsRouter);

app.listen(PORT, () => {
  console.log(`[chronos-server] Express API listening on http://localhost:${PORT}`);
});
