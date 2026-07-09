/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { canRunReminderScan } from '../../lib/permissions';
import { runDailyReminderScan } from './domain';

export const remindersRouter = Router();
remindersRouter.use(requireAuth);

/**
 * POST /api/reminders/run
 * Role required: SUPER_ADMIN
 * Response: { success: true, data: ReminderScanResult }
 * Errors: 401, 403, 500
 * Manual trigger for testing — runs the exact same scan the 08:00 cron job runs.
 */
remindersRouter.post('/run', async (req, res) => {
  if (!canRunReminderScan(req.profile!.role)) {
    res.status(403).json({ success: false, error: 'Samo Super Admin može ručno pokrenuti podsjetnike.' });
    return;
  }

  try {
    const result = await runDailyReminderScan({ id: req.profile!.id, username: req.profile!.username });
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('[POST /api/reminders/run]', err);
    res.status(500).json({ success: false, error: 'Greška pri pokretanju scan-a podsjetnika.' });
  }
});
