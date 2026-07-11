/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { randomBytes } from 'crypto';
import { getSupabaseServerClient } from '../../lib/supabase-server';
import type { AdminUserSummary, AdminUserActivity, AdminSystemStats } from '../../../src/types';
import type { CreateUserInput, UpdateUserInput } from './schemas';

/** Matches scripts/seed-users.ts — generated once, shown once, never stored. */
export function generatePassword(): string {
  return randomBytes(12).toString('base64url');
}

interface ProfileRow {
  id: string;
  full_name: string;
  role: string;
  institution: string | null;
  created_at: string;
}

export async function getAllUsersWithAuth(): Promise<AdminUserSummary[]> {
  const supabase = getSupabaseServerClient();

  const { data: profileRows, error: profileError } = await supabase
    .from('profiles')
    .select('id, full_name, role, institution, created_at')
    .order('full_name');
  if (profileError) throw new Error(`getAllUsersWithAuth (profiles) failed: ${profileError.message}`);

  const result = await supabase.auth.admin.listUsers({ perPage: 200 });
  if (result.error) throw new Error(`getAllUsersWithAuth (auth) failed: ${result.error.message}`);
  // NOTE: explicit type — same Supabase client narrowing quirk documented in
  // server/features/users/repository.ts.
  const authUsers: Array<{ id: string; email?: string; last_sign_in_at?: string | null; banned_until?: string | null }> = result.data.users;
  const authMap = new Map(authUsers.map((u) => [u.id, u]));

  return (profileRows as ProfileRow[]).map((p) => {
    const au = authMap.get(p.id);
    const bannedUntil = au?.banned_until ?? null;
    const isBanned = !!bannedUntil && new Date(bannedUntil).getTime() > Date.now();
    return {
      id: p.id,
      full_name: p.full_name,
      email: au?.email ?? '(nepoznato)',
      role: p.role as AdminUserSummary['role'],
      institution: p.institution as AdminUserSummary['institution'],
      created_at: p.created_at,
      last_sign_in_at: au?.last_sign_in_at ?? null,
      is_banned: isBanned,
    };
  });
}

export async function createUser(input: CreateUserInput): Promise<{ id: string; password: string }> {
  const supabase = getSupabaseServerClient();
  const password = generatePassword();

  const { data, error } = await supabase.auth.admin.createUser({
    email: input.email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`createUser (auth) failed: ${error?.message ?? 'unknown error'}`);

  const { error: profileError } = await supabase.from('profiles').insert({
    id: data.user.id,
    full_name: input.full_name,
    role: input.role,
    institution: input.institution,
  });
  if (profileError) {
    // Roll back the orphaned auth user so a failed profile insert doesn't
    // leave a login-capable account with no profile.
    await supabase.auth.admin.deleteUser(data.user.id).catch(() => {});
    throw new Error(`createUser (profile) failed: ${profileError.message}`);
  }

  return { id: data.user.id, password };
}

export async function updateUserProfile(id: string, patch: UpdateUserInput): Promise<void> {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase.from('profiles').update(patch).eq('id', id);
  if (error) throw new Error(`updateUserProfile failed: ${error.message}`);
}

export async function setUserBanned(id: string, banned: boolean): Promise<void> {
  const supabase = getSupabaseServerClient();
  // Supabase's ban_duration takes a Go duration string; "none" lifts a ban.
  // ~100 years reads as "indefinite" without relying on a magic sentinel.
  const { error } = await supabase.auth.admin.updateUserById(id, {
    ban_duration: banned ? '876000h' : 'none',
  });
  if (error) throw new Error(`setUserBanned failed: ${error.message}`);
}

export interface DeletionBlockers {
  obligations: number;
  auditLogs: number;
  notificationGroups: number;
  notificationSchedules: number;
  notificationSends: number;
}

/** All the FK relationships from profiles(id) that are ON DELETE NO ACTION
 * (see SPRINT_10.md) — a hard delete fails at the DB level if any of these
 * are non-zero, so check first and give a real answer instead of a raw
 * Postgres error. */
export async function getDeletionBlockers(id: string): Promise<DeletionBlockers> {
  const supabase = getSupabaseServerClient();

  const [obligations, auditLogs, notificationGroups, notificationSchedules, notificationSends] = await Promise.all([
    supabase.from('obligations').select('id', { count: 'exact', head: true }).eq('created_by', id),
    supabase.from('audit_logs').select('id', { count: 'exact', head: true }).eq('user_id', id),
    supabase.from('notification_groups').select('id', { count: 'exact', head: true }).eq('created_by', id),
    supabase.from('notification_schedules').select('id', { count: 'exact', head: true }).eq('created_by', id),
    supabase.from('notification_log').select('id', { count: 'exact', head: true }).eq('sent_by', id),
  ]);

  for (const r of [obligations, auditLogs, notificationGroups, notificationSchedules, notificationSends]) {
    if (r.error) throw new Error(`getDeletionBlockers failed: ${r.error.message}`);
  }

  return {
    obligations: obligations.count ?? 0,
    auditLogs: auditLogs.count ?? 0,
    notificationGroups: notificationGroups.count ?? 0,
    notificationSchedules: notificationSchedules.count ?? 0,
    notificationSends: notificationSends.count ?? 0,
  };
}

export async function deleteUserHard(id: string): Promise<void> {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase.auth.admin.deleteUser(id);
  if (error) throw new Error(`deleteUserHard failed: ${error.message}`);
}

export async function getUserActivity(id: string): Promise<AdminUserActivity> {
  const supabase = getSupabaseServerClient();

  const [createdRes, completedRes, logsRes] = await Promise.all([
    supabase.from('obligations').select('id', { count: 'exact', head: true }).eq('created_by', id),
    supabase.from('obligations').select('id', { count: 'exact', head: true }).eq('created_by', id).eq('status', 'ZAVRŠENO'),
    supabase.from('audit_logs').select('timestamp, action_type, target_table, changes').eq('user_id', id).order('timestamp', { ascending: false }).limit(20),
  ]);

  if (createdRes.error) throw new Error(`getUserActivity (created) failed: ${createdRes.error.message}`);
  if (completedRes.error) throw new Error(`getUserActivity (completed) failed: ${completedRes.error.message}`);
  if (logsRes.error) throw new Error(`getUserActivity (logs) failed: ${logsRes.error.message}`);

  return {
    obligationsCreated: createdRes.count ?? 0,
    obligationsCompleted: completedRes.count ?? 0,
    recentActivity: (logsRes.data ?? []).map((row) => ({
      timestamp: row.timestamp,
      action_type: row.action_type,
      target_table: row.target_table,
      changes: row.changes,
    })),
  };
}

export async function getSystemStats(): Promise<AdminSystemStats> {
  const supabase = getSupabaseServerClient();

  const [
    usersByRole,
    obligationsByStatus,
    obligationsByInstitution,
    obligationsByCategory,
    notificationLogRes,
  ] = await Promise.all([
    supabase.from('profiles').select('role'),
    supabase.from('obligations').select('status'),
    supabase.from('obligations').select('institution'),
    supabase.from('obligations').select('category'),
    supabase.from('notification_log').select('status'),
  ]);

  for (const r of [usersByRole, obligationsByStatus, obligationsByInstitution, obligationsByCategory, notificationLogRes]) {
    if (r.error) throw new Error(`getSystemStats failed: ${r.error.message}`);
  }

  const tally = (rows: Array<Record<string, string>> | null, key: string): Record<string, number> => {
    const map: Record<string, number> = {};
    for (const row of rows ?? []) {
      const value = row[key];
      map[value] = (map[value] ?? 0) + 1;
    }
    return map;
  };

  return {
    usersByRole: tally(usersByRole.data, 'role'),
    obligationsByStatus: tally(obligationsByStatus.data, 'status'),
    obligationsByInstitution: tally(obligationsByInstitution.data, 'institution'),
    obligationsByCategory: tally(obligationsByCategory.data, 'category'),
    notificationSendsByStatus: tally(notificationLogRes.data, 'status'),
    totalObligations: obligationsByStatus.data?.length ?? 0,
    totalUsers: usersByRole.data?.length ?? 0,
  };
}
