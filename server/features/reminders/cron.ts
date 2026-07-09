/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import cron from 'node-cron';
import { runDailyReminderScan } from './domain';

/** Registers the 08:00 Europe/Sarajevo daily reminder scan (CONSTITUTION.md §5.5). */
export function registerReminderCronJob(): void {
  cron.schedule(
    '0 8 * * *',
    () => {
      runDailyReminderScan(null).catch((err) => {
        console.error('[reminder-cron] daily scan failed:', err);
      });
    },
    { timezone: 'Europe/Sarajevo' }
  );

  console.log('[chronos-server] Reminder cron job registered: 08:00 Europe/Sarajevo daily');
}
