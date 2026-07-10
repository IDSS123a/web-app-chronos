/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { getSupabaseServerClient } from '../../lib/supabase-server';
import type {
  NotificationGroup,
  NotificationSchedule,
  NotificationLogEntry,
  NotificationStatus,
  RecipientStatus,
} from '../../../src/types';
import type { NotificationGroupInput, NotificationScheduleInput, NotificationScheduleUpdateInput } from './schemas';

// --- Groups ---

interface GroupRow {
  id: string;
  name: string;
  created_at: string;
}

async function attachMembers(groups: GroupRow[]): Promise<NotificationGroup[]> {
  if (groups.length === 0) return [];
  const supabase = getSupabaseServerClient();

  const { data: memberRows, error } = await supabase
    .from('notification_group_members')
    .select('group_id, user_id, profiles(full_name)')
    .in('group_id', groups.map((g) => g.id));
  if (error) throw new Error(`attachMembers failed: ${error.message}`);

  const byGroup = new Map<string, { ids: string[]; names: string[] }>();
  for (const row of memberRows ?? []) {
    const entry = byGroup.get(row.group_id) ?? { ids: [], names: [] };
    entry.ids.push(row.user_id);
    // Supabase's PostgREST embed returns an object here (not an array) for a
    // to-one relationship, but the generated type is looser — narrow it.
    const profile = row.profiles as unknown as { full_name: string } | null;
    entry.names.push(profile?.full_name ?? '(nepoznat korisnik)');
    byGroup.set(row.group_id, entry);
  }

  return groups.map((g) => ({
    id: g.id,
    name: g.name,
    created_at: g.created_at,
    member_ids: byGroup.get(g.id)?.ids ?? [],
    member_names: byGroup.get(g.id)?.names ?? [],
  }));
}

export async function getAllGroups(): Promise<NotificationGroup[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.from('notification_groups').select('id, name, created_at').order('name');
  if (error) throw new Error(`getAllGroups failed: ${error.message}`);
  return attachMembers((data ?? []) as GroupRow[]);
}

export async function getGroupById(id: string): Promise<NotificationGroup | null> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.from('notification_groups').select('id, name, created_at').eq('id', id).maybeSingle();
  if (error) throw new Error(`getGroupById failed: ${error.message}`);
  if (!data) return null;
  const [group] = await attachMembers([data as GroupRow]);
  return group;
}

export async function createGroup(input: NotificationGroupInput, createdBy: string): Promise<NotificationGroup> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('notification_groups')
    .insert({ name: input.name, created_by: createdBy })
    .select('id, name, created_at')
    .single();
  if (error) throw new Error(`createGroup failed: ${error.message}`);

  if (input.member_ids.length > 0) {
    const { error: memberError } = await supabase
      .from('notification_group_members')
      .insert(input.member_ids.map((userId) => ({ group_id: data.id, user_id: userId })));
    if (memberError) throw new Error(`createGroup (members) failed: ${memberError.message}`);
  }

  const [group] = await attachMembers([data as GroupRow]);
  return group;
}

export async function updateGroup(id: string, input: Partial<NotificationGroupInput>): Promise<NotificationGroup> {
  const supabase = getSupabaseServerClient();

  if (input.name !== undefined) {
    const { error } = await supabase.from('notification_groups').update({ name: input.name }).eq('id', id);
    if (error) throw new Error(`updateGroup (name) failed: ${error.message}`);
  }

  if (input.member_ids !== undefined) {
    const { error: deleteError } = await supabase.from('notification_group_members').delete().eq('group_id', id);
    if (deleteError) throw new Error(`updateGroup (clear members) failed: ${deleteError.message}`);

    if (input.member_ids.length > 0) {
      const { error: insertError } = await supabase
        .from('notification_group_members')
        .insert(input.member_ids.map((userId) => ({ group_id: id, user_id: userId })));
      if (insertError) throw new Error(`updateGroup (insert members) failed: ${insertError.message}`);
    }
  }

  const group = await getGroupById(id);
  if (!group) throw new Error('updateGroup: group not found after update');
  return group;
}

export async function deleteGroup(id: string): Promise<void> {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase.from('notification_groups').delete().eq('id', id);
  if (error) throw new Error(`deleteGroup failed: ${error.message}`);
}

// --- Schedules ---

interface ScheduleRow {
  id: string;
  name: string;
  report_type: string;
  group_id: string;
  send_time: string;
  enabled: boolean;
  last_run_date: string | null;
  created_at: string;
  notification_groups: { name: string } | null;
}

function mapSchedule(row: ScheduleRow): NotificationSchedule {
  return {
    id: row.id,
    name: row.name,
    report_type: row.report_type as NotificationSchedule['report_type'],
    group_id: row.group_id,
    group_name: row.notification_groups?.name ?? '(obrisana grupa)',
    send_time: row.send_time,
    enabled: row.enabled,
    last_run_date: row.last_run_date,
    created_at: row.created_at,
  };
}

const SCHEDULE_SELECT = 'id, name, report_type, group_id, send_time, enabled, last_run_date, created_at, notification_groups(name)';

export async function getAllSchedules(): Promise<NotificationSchedule[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.from('notification_schedules').select(SCHEDULE_SELECT).order('send_time');
  if (error) throw new Error(`getAllSchedules failed: ${error.message}`);
  return (data as unknown as ScheduleRow[]).map(mapSchedule);
}

export async function getScheduleById(id: string): Promise<NotificationSchedule | null> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.from('notification_schedules').select(SCHEDULE_SELECT).eq('id', id).maybeSingle();
  if (error) throw new Error(`getScheduleById failed: ${error.message}`);
  return data ? mapSchedule(data as unknown as ScheduleRow) : null;
}

/** Enabled schedules due to fire — used by the cron tick (server/features/notifications/cron.ts). */
export async function getEnabledSchedules(): Promise<NotificationSchedule[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.from('notification_schedules').select(SCHEDULE_SELECT).eq('enabled', true);
  if (error) throw new Error(`getEnabledSchedules failed: ${error.message}`);
  return (data as unknown as ScheduleRow[]).map(mapSchedule);
}

export async function createSchedule(input: NotificationScheduleInput, createdBy: string): Promise<NotificationSchedule> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('notification_schedules')
    .insert({
      name: input.name,
      report_type: input.report_type,
      group_id: input.group_id,
      send_time: input.send_time,
      enabled: input.enabled,
      created_by: createdBy,
    })
    .select(SCHEDULE_SELECT)
    .single();
  if (error) throw new Error(`createSchedule failed: ${error.message}`);
  return mapSchedule(data as unknown as ScheduleRow);
}

export async function updateSchedule(id: string, patch: NotificationScheduleUpdateInput): Promise<NotificationSchedule> {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase.from('notification_schedules').update(patch).eq('id', id);
  if (error) throw new Error(`updateSchedule failed: ${error.message}`);
  const schedule = await getScheduleById(id);
  if (!schedule) throw new Error('updateSchedule: schedule not found after update');
  return schedule;
}

export async function deleteSchedule(id: string): Promise<void> {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase.from('notification_schedules').delete().eq('id', id);
  if (error) throw new Error(`deleteSchedule failed: ${error.message}`);
}

export async function markScheduleRun(id: string, dateStr: string): Promise<void> {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase.from('notification_schedules').update({ last_run_date: dateStr }).eq('id', id);
  if (error) throw new Error(`markScheduleRun failed: ${error.message}`);
}

// --- Recipient resolution ---

/** Resolves group_ids + user_ids into a deduplicated {userId -> email} map,
 * skipping any user without a known email (shouldn't happen in practice —
 * every profile is backed by a real Supabase Auth user). */
export async function resolveRecipientEmails(groupIds: string[], userIds: string[]): Promise<Map<string, string>> {
  const supabase = getSupabaseServerClient();
  const allUserIds = new Set<string>(userIds);

  if (groupIds.length > 0) {
    const { data, error } = await supabase
      .from('notification_group_members')
      .select('user_id')
      .in('group_id', groupIds);
    if (error) throw new Error(`resolveRecipientEmails (members) failed: ${error.message}`);
    for (const row of data ?? []) allUserIds.add(row.user_id);
  }

  if (allUserIds.size === 0) return new Map();

  const result = await supabase.auth.admin.listUsers({ perPage: 200 });
  if (result.error) throw new Error(`resolveRecipientEmails (listUsers) failed: ${result.error.message}`);
  // NOTE: explicit type — same Supabase client narrowing quirk documented in
  // server/features/users/repository.ts.
  const users: Array<{ id: string; email?: string }> = result.data.users;

  const emailMap = new Map<string, string>();
  for (const user of users) {
    if (allUserIds.has(user.id) && user.email) emailMap.set(user.id, user.email);
  }
  return emailMap;
}

// --- Send log ---

export interface NotificationLogInsertInput {
  sent_by: string | null;
  schedule_id: string | null;
  subject: string;
  status: NotificationStatus;
  recipients: Array<{ email: string; status: RecipientStatus; error_message: string | null }>;
}

export async function createNotificationLog(input: NotificationLogInsertInput): Promise<void> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('notification_log')
    .insert({
      sent_by: input.sent_by,
      schedule_id: input.schedule_id,
      subject: input.subject,
      recipient_count: input.recipients.length,
      status: input.status,
    })
    .select('id')
    .single();
  if (error) throw new Error(`createNotificationLog failed: ${error.message}`);

  if (input.recipients.length > 0) {
    const { error: recError } = await supabase.from('notification_log_recipients').insert(
      input.recipients.map((r) => ({
        notification_log_id: data.id,
        email: r.email,
        status: r.status,
        error_message: r.error_message,
      }))
    );
    if (recError) throw new Error(`createNotificationLog (recipients) failed: ${recError.message}`);
  }
}

interface LogRow {
  id: string;
  subject: string;
  recipient_count: number;
  status: string;
  sent_at: string;
  profiles: { full_name: string } | null;
  notification_schedules: { name: string } | null;
}

export async function getAllNotificationLogs(): Promise<NotificationLogEntry[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('notification_log')
    .select('id, subject, recipient_count, status, sent_at, profiles(full_name), notification_schedules(name)')
    .order('sent_at', { ascending: false })
    .limit(200);
  if (error) throw new Error(`getAllNotificationLogs failed: ${error.message}`);

  const rows = data as unknown as LogRow[];
  if (rows.length === 0) return [];

  const { data: recipientRows, error: recError } = await supabase
    .from('notification_log_recipients')
    .select('notification_log_id, email, status, error_message')
    .in('notification_log_id', rows.map((r) => r.id));
  if (recError) throw new Error(`getAllNotificationLogs (recipients) failed: ${recError.message}`);

  const recipientsByLog = new Map<string, NotificationLogEntry['recipients']>();
  for (const r of recipientRows ?? []) {
    const list = recipientsByLog.get(r.notification_log_id) ?? [];
    list.push({ email: r.email, status: r.status as RecipientStatus, error_message: r.error_message });
    recipientsByLog.set(r.notification_log_id, list);
  }

  return rows.map((row) => ({
    id: row.id,
    sent_by_name: row.profiles?.full_name ?? null,
    schedule_name: row.notification_schedules?.name ?? null,
    subject: row.subject,
    recipient_count: row.recipient_count,
    status: row.status as NotificationStatus,
    sent_at: row.sent_at,
    recipients: recipientsByLog.get(row.id) ?? [],
  }));
}
