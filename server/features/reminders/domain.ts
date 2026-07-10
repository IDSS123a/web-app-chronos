/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * FEATURE: Daily reminder scan
 * PURPOSE: Replace the client-side "cron simulator" (App.tsx, pre-Sprint 06)
 *          with a real scan that emails whoever can see an obligation
 *          (CONSTITUTION.md §5.7) when it's due in exactly 3 days.
 * TOUCHES: obligations, obligation_watchers, profiles, audit_logs
 * SPRINT: 06
 * CONSTITUTION REF: §5.5 (reminder engine), §5.7 (visibility)
 */

import { getActiveObligationsForReminderScan } from '../obligations/repository';
import { getSuperAdminIds, getUserEmailMap } from '../users/repository';
import { createAuditLog } from '../audit-logs/repository';
import { sendEmail } from '../../lib/resend';
import type { Obligation } from '../../../src/types';

const REMINDER_DAYS_AHEAD = 3;

/** Obligation fields (title, responsible_person) are free-text user input —
 * escape before interpolating into the outbound email HTML, otherwise a
 * title like `<a href="...">` would render as a live link/markup in every
 * recipient's inbox instead of literal text. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildReminderEmailHtml(obligation: Obligation): string {
  return `
    <div style="font-family: sans-serif; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; max-width: 600px;">
      <div style="background-color: #035EA1; padding: 15px; border-radius: 8px 8px 0 0; color: white;">
        <h1 style="margin: 0; font-size: 18px; text-transform: uppercase;">[CHRONOS] Obaveštenje o roku dospijeća</h1>
      </div>
      <div style="padding: 20px; color: #1f2937;">
        <p>Poštovani,</p>
        <p>Ovo je automatski podsjetnik da administrativni rok za stavku dospijeva za tačno <strong>3 dana</strong>:</p>

        <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #E30613;">
          <p style="margin: 0 0 5px 0;"><strong>Obaveza:</strong> ${escapeHtml(obligation.title)}</p>
          <p style="margin: 0 0 5px 0;"><strong>Ustanova:</strong> ${obligation.institution === 'IDSS' ? 'Internationale Deutsche Schule (IDSS)' : 'IMH Montessori House'}</p>
          <p style="margin: 0 0 5px 0;"><strong>Rok dospijeća:</strong> ${obligation.due_date.split('-').reverse().join('.')}</p>
          <p style="margin: 0;"><strong>Odgovorna osoba:</strong> ${escapeHtml(obligation.responsible_person)}</p>
        </div>

        <p>Molimo Vas da blagovremeno poduzmete akcije, ažurirate kontrolne stavke u aplikaciji Chronos i priložite relevantne dokumente.</p>
        <p style="margin-top: 25px; font-size: 11px; color: #94a3b8;">Odgovori na ovaj e-mail biće proslijeđeni na: <a href="mailto:direktor@idss.ba">direktor@idss.ba</a></p>
      </div>
    </div>
  `;
}

function getDaysUntilDue(dueDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export interface ReminderScanResult {
  scannedCount: number;
  triggeredCount: number;
  emailsSent: number;
  errors: string[];
}

/**
 * Scans every active obligation for ones due in exactly REMINDER_DAYS_AHEAD
 * days, and emails everyone who can currently see that obligation — its
 * creator, its watchers, and every SUPER_ADMIN (CONSTITUTION.md §5.7: the
 * same people who can see an obligation are the ones who should be
 * reminded about it, replacing the old fixed "direktor+sekretar" mock).
 */
export async function runDailyReminderScan(
  triggeredBy: { id: string; username: string } | null
): Promise<ReminderScanResult> {
  const [obligations, superAdminIds, emailMap] = await Promise.all([
    getActiveObligationsForReminderScan(),
    getSuperAdminIds(),
    getUserEmailMap(),
  ]);

  let triggeredCount = 0;
  let emailsSent = 0;
  const errors: string[] = [];

  for (const obligation of obligations) {
    if (getDaysUntilDue(obligation.due_date) !== REMINDER_DAYS_AHEAD) continue;
    triggeredCount++;

    const recipientIds = new Set<string>([...superAdminIds, obligation.created_by, ...obligation.watcher_ids]);
    const recipientEmails = [...recipientIds]
      .map((id) => emailMap.get(id))
      .filter((email): email is string => Boolean(email));

    if (recipientEmails.length === 0) continue;

    try {
      await sendEmail({
        to: recipientEmails,
        // Strip CR/LF defensively — a title is free text and should never
        // need embedded newlines; this keeps the subject a single line
        // regardless of what the Resend API itself would otherwise allow.
        subject: `[CHRONOS] Obaveza ističe za 3 dana: ${obligation.title.replace(/[\r\n]+/g, ' ')}`,
        html: buildReminderEmailHtml(obligation),
      });
      emailsSent++;
    } catch (err) {
      errors.push(`"${obligation.title}": ${err instanceof Error ? err.message : 'nepoznata greška'}`);
    }
  }

  await createAuditLog({
    user_id: triggeredBy?.id ?? null,
    username: triggeredBy?.username ?? 'system-cron',
    action_type: 'IZMJENA',
    target_table: 'Obligations',
    target_id: 'SISTEM',
    changes:
      `Jutarnji scan podsjetnika: ${triggeredCount} obaveza dospijeva za ${REMINDER_DAYS_AHEAD} dana, ` +
      `${emailsSent} email(ova) poslano${errors.length ? `, ${errors.length} grešaka` : ''}.`,
  });

  return { scannedCount: obligations.length, triggeredCount, emailsSent, errors };
}
