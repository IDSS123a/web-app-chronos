/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * FEATURE: Internal notification system (Sprint 09)
 * PURPOSE: Recipient groups, scheduled daily reports, and manual broadcasts
 *          — on top of the Resend transport already proven by the reminder
 *          engine (server/features/reminders). See CONSTITUTION.md §5.8.
 */

import { HttpError } from '../../lib/errors';
import { sendEmail } from '../../lib/resend';
import * as repo from './repository';
import * as obligationsRepo from '../obligations/repository';
import { createAuditLog } from '../audit-logs/repository';
import { MAX_RESOLVED_RECIPIENTS, type ManualSendInput, type NotificationGroupInput, type NotificationScheduleInput, type NotificationScheduleUpdateInput } from './schemas';
import type { AuthenticatedProfile } from '../../types';
import type { NotificationGroup, NotificationSchedule, NotificationStatus, RecipientStatus } from '../../../src/types';

/** Free text (group/schedule names, manual subject/body) — escape before it
 * ever reaches an outbound email or gets echoed back, same lesson as the
 * reminder engine's title-escaping fix (security audit, 2026-07-10). */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// --- Groups ---

export async function createGroup(input: NotificationGroupInput, profile: AuthenticatedProfile): Promise<NotificationGroup> {
  const group = await repo.createGroup(input, profile.id);
  await createAuditLog({
    user_id: profile.id,
    username: profile.username,
    action_type: 'KREIRANJE',
    target_table: 'Notifications',
    target_id: group.id,
    changes: `Kreirana grupa primalaca "${group.name}" (${group.member_ids.length} članova).`,
  });
  return group;
}

export async function updateGroup(id: string, input: Partial<NotificationGroupInput>, profile: AuthenticatedProfile): Promise<NotificationGroup> {
  const existing = await repo.getGroupById(id);
  if (!existing) throw new HttpError(404, 'Grupa nije pronađena.');
  const group = await repo.updateGroup(id, input);
  await createAuditLog({
    user_id: profile.id,
    username: profile.username,
    action_type: 'IZMJENA',
    target_table: 'Notifications',
    target_id: id,
    changes: `Ažurirana grupa primalaca "${group.name}".`,
  });
  return group;
}

export async function deleteGroup(id: string, profile: AuthenticatedProfile): Promise<void> {
  const existing = await repo.getGroupById(id);
  if (!existing) throw new HttpError(404, 'Grupa nije pronađena.');
  await repo.deleteGroup(id);
  await createAuditLog({
    user_id: profile.id,
    username: profile.username,
    action_type: 'BRISANJE',
    target_table: 'Notifications',
    target_id: id,
    changes: `Obrisana grupa primalaca "${existing.name}".`,
  });
}

// --- Schedules ---

export async function createSchedule(input: NotificationScheduleInput, profile: AuthenticatedProfile): Promise<NotificationSchedule> {
  const group = await repo.getGroupById(input.group_id);
  if (!group) throw new HttpError(422, 'Odabrana grupa ne postoji.');

  const schedule = await repo.createSchedule(input, profile.id);
  await createAuditLog({
    user_id: profile.id,
    username: profile.username,
    action_type: 'KREIRANJE',
    target_table: 'Notifications',
    target_id: schedule.id,
    changes: `Kreiran raspored "${schedule.name}" (${schedule.send_time}, grupa "${schedule.group_name}", ${schedule.enabled ? 'uključen' : 'isključen'}).`,
  });
  return schedule;
}

export async function updateSchedule(id: string, input: NotificationScheduleUpdateInput, profile: AuthenticatedProfile): Promise<NotificationSchedule> {
  const existing = await repo.getScheduleById(id);
  if (!existing) throw new HttpError(404, 'Raspored nije pronađen.');

  if (input.group_id) {
    const group = await repo.getGroupById(input.group_id);
    if (!group) throw new HttpError(422, 'Odabrana grupa ne postoji.');
  }

  const schedule = await repo.updateSchedule(id, input);
  await createAuditLog({
    user_id: profile.id,
    username: profile.username,
    action_type: 'IZMJENA',
    target_table: 'Notifications',
    target_id: id,
    changes: `Ažuriran raspored "${schedule.name}" (${schedule.enabled ? 'uključen' : 'isključen'}).`,
  });
  return schedule;
}

export async function deleteSchedule(id: string, profile: AuthenticatedProfile): Promise<void> {
  const existing = await repo.getScheduleById(id);
  if (!existing) throw new HttpError(404, 'Raspored nije pronađen.');
  await repo.deleteSchedule(id);
  await createAuditLog({
    user_id: profile.id,
    username: profile.username,
    action_type: 'BRISANJE',
    target_table: 'Notifications',
    target_id: id,
    changes: `Obrisan raspored "${existing.name}".`,
  });
}

// --- Report generators (report_type registry — Q4 of the earlier analysis:
// adding a new schedule/time/group is a data change; adding a genuinely new
// report TYPE means registering one more function here, nothing else). ---

async function generateDailyOverviewReport(): Promise<{ subject: string; html: string }> {
  // Schedules are SUPER_ADMIN-only to create (canManageNotifications), so a
  // system-wide view (not per-recipient-personalized) is the correct scope
  // here — this mirrors what the schedule's creator can already see.
  const obligations = (await obligationsRepo.getActiveObligationsForReminderScan())
    .slice()
    .sort((a, b) => a.due_date.localeCompare(b.due_date));

  const rows = obligations.length === 0
    ? '<tr><td colspan="4" style="padding:12px;text-align:center;color:#94a3b8;">Nema aktivnih obaveza.</td></tr>'
    : obligations.map((o) => `
        <tr>
          <td style="padding:8px;border-bottom:1px solid #e2e8f0;">${escapeHtml(o.title)}</td>
          <td style="padding:8px;border-bottom:1px solid #e2e8f0;">${o.institution === 'IDSS' ? 'IDSS' : 'IMH'}</td>
          <td style="padding:8px;border-bottom:1px solid #e2e8f0;">${o.due_date.split('-').reverse().join('.')}</td>
          <td style="padding:8px;border-bottom:1px solid #e2e8f0;">${escapeHtml(o.responsible_person)}</td>
        </tr>`).join('');

  const html = `
    <div style="font-family: sans-serif; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; max-width: 700px;">
      <div style="background-color: #035EA1; padding: 15px; border-radius: 8px 8px 0 0; color: white;">
        <h1 style="margin: 0; font-size: 18px; text-transform: uppercase;">[CHRONOS] Dnevni pregled obaveza</h1>
      </div>
      <div style="padding: 20px; color: #1f2937;">
        <p>Trenutni pregled svih aktivnih (nezavršenih) obaveza u sistemu:</p>
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <thead>
            <tr style="background:#f8fafc;text-align:left;">
              <th style="padding:8px;">Naziv</th>
              <th style="padding:8px;">Ustanova</th>
              <th style="padding:8px;">Rok</th>
              <th style="padding:8px;">Odgovorna osoba</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <p style="margin-top: 20px; font-size: 11px; color: #94a3b8;">Automatski dnevni izvještaj — Chronos sistem, IDSS i IMH Sarajevo.</p>
      </div>
    </div>`;

  return { subject: `[CHRONOS] Dnevni pregled obaveza — ${obligations.length} aktivnih`, html };
}

const REPORT_GENERATORS: Record<NotificationSchedule['report_type'], () => Promise<{ subject: string; html: string }>> = {
  DNEVNI_PREGLED: generateDailyOverviewReport,
};

// --- Sending ---

interface SendResult {
  status: NotificationStatus;
  recipients: Array<{ email: string; status: RecipientStatus; error_message: string | null }>;
}

async function dispatch(subject: string, html: string, emailMap: Map<string, string>): Promise<SendResult> {
  const emails = [...new Set(emailMap.values())];
  if (emails.length === 0) {
    return { status: 'FAILED', recipients: [] };
  }

  try {
    await sendEmail({ to: emails, subject, html });
    return { status: 'SUCCESS', recipients: emails.map((email) => ({ email, status: 'SENT', error_message: null })) };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Nepoznata greška pri slanju.';
    return { status: 'FAILED', recipients: emails.map((email) => ({ email, status: 'FAILED', error_message: message })) };
  }
}

export async function sendManualNotification(input: ManualSendInput, profile: AuthenticatedProfile) {
  const emailMap = await repo.resolveRecipientEmails(input.group_ids, input.user_ids);

  if (emailMap.size === 0) {
    throw new HttpError(422, 'Nijedan važeći primalac nije pronađen za odabrane grupe/korisnike.');
  }
  if (emailMap.size > MAX_RESOLVED_RECIPIENTS) {
    throw new HttpError(422, `Previše primalaca (${emailMap.size}). Maksimalno ${MAX_RESOLVED_RECIPIENTS} po slanju — podijelite u više manjih slanja.`);
  }

  // Plain-text body, escaped then line-broken — never trust free text as raw HTML.
  const bodyHtml = escapeHtml(input.body).replace(/\n/g, '<br>');
  const html = `
    <div style="font-family: sans-serif; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; max-width: 600px;">
      <div style="background-color: #035EA1; padding: 15px; border-radius: 8px 8px 0 0; color: white;">
        <h1 style="margin: 0; font-size: 16px; text-transform: uppercase;">[CHRONOS] ${escapeHtml(input.subject)}</h1>
      </div>
      <div style="padding: 20px; color: #1f2937; font-size: 14px; line-height: 1.6;">
        ${bodyHtml}
        <p style="margin-top: 25px; font-size: 11px; color: #94a3b8;">Poslao: ${escapeHtml(profile.fullName)} — Chronos sistem, IDSS i IMH Sarajevo.</p>
      </div>
    </div>`;

  // Same defense-in-depth as the reminder engine's subject line (security
  // audit, 2026-07-10): strip embedded newlines before the subject reaches
  // the outbound email, even though Resend's own API already sanitizes this.
  const result = await dispatch(`[CHRONOS] ${input.subject.replace(/[\r\n]+/g, ' ')}`, html, emailMap);

  await repo.createNotificationLog({
    sent_by: profile.id,
    schedule_id: null,
    subject: input.subject,
    status: result.status,
    recipients: result.recipients,
  });

  await createAuditLog({
    user_id: profile.id,
    username: profile.username,
    action_type: 'IZMJENA',
    target_table: 'Notifications',
    target_id: 'RUČNO_SLANJE',
    changes: `Ručno poslana obavijest "${input.subject}" na ${emailMap.size} primalaca (status: ${result.status}).`,
  });

  if (result.status === 'FAILED') {
    throw new HttpError(502, 'Slanje nije uspjelo. Provjerite evidenciju za detalje.');
  }

  return { recipientCount: emailMap.size, status: result.status };
}

/** Fires every enabled schedule whose send_time has passed today and hasn't
 * already run today — called by the cron tick (cron.ts) and, for manual
 * testing, could be exposed the same way reminders/run is. Self-healing: a
 * missed tick (server restart, etc.) still fires on the next tick since it
 * only checks "has today's time passed + not yet sent today", not an exact
 * time-window match. */
export async function runDueSchedules(): Promise<void> {
  const schedules = await repo.getEnabledSchedules();
  const nowSarajevo = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Sarajevo', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
  const todaySarajevo = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Sarajevo' }).format(new Date());

  for (const schedule of schedules) {
    if (schedule.last_run_date === todaySarajevo) continue;
    if (schedule.send_time > nowSarajevo) continue;

    try {
      const group = await repo.getGroupById(schedule.group_id);
      if (!group || group.member_ids.length === 0) {
        await repo.markScheduleRun(schedule.id, todaySarajevo);
        continue;
      }

      const generator = REPORT_GENERATORS[schedule.report_type];
      const { subject, html } = await generator();
      const emailMap = await repo.resolveRecipientEmails([schedule.group_id], []);
      const result = await dispatch(subject, html, emailMap);

      await repo.createNotificationLog({
        sent_by: null,
        schedule_id: schedule.id,
        subject,
        status: result.status,
        recipients: result.recipients,
      });
      await repo.markScheduleRun(schedule.id, todaySarajevo);
    } catch (err) {
      console.error(`[notifications] scheduled send failed for schedule ${schedule.id}:`, err);
      // Deliberately do NOT mark last_run_date here — retry on the next tick.
    }
  }
}
