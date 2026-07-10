/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import cron from 'node-cron';
import { runDueSchedules } from './domain';

/** Ticks every 15 minutes and fires any enabled schedule whose configured
 * send_time has passed today and hasn't already run today (see
 * runDueSchedules — data-driven, so a new schedule/time/group needs no code
 * change, only a new row). Separate from the 08:00-only reminder cron
 * (reminders/cron.ts) since schedules can fire at arbitrary times. */
export function registerNotificationCronJob(): void {
  cron.schedule(
    '*/15 * * * *',
    () => {
      runDueSchedules().catch((err) => console.error('[notifications-cron] tick failed:', err));
    },
    { timezone: 'Europe/Sarajevo' }
  );
  console.log('[chronos-server] Notification schedule cron job registered: every 15 min, Europe/Sarajevo');
}
