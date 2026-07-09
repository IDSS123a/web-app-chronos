/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { getSupabaseServerClient } from '../../lib/supabase-server';
import type { UserSummary } from '../../../src/types';

/** Minimal roster (id, name, role) used to populate the "who can see this" watcher picker. */
export async function getAllUserSummaries(): Promise<UserSummary[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .order('full_name', { ascending: true });

  if (error) throw new Error(`getAllUserSummaries failed: ${error.message}`);

  return (data ?? []).map((row) => ({
    id: row.id,
    fullName: row.full_name,
    role: row.role as UserSummary['role'],
  }));
}

/** All SUPER_ADMIN user ids — always included as reminder-email recipients. */
export async function getSuperAdminIds(): Promise<string[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.from('profiles').select('id').eq('role', 'SUPER_ADMIN');

  if (error) throw new Error(`getSuperAdminIds failed: ${error.message}`);
  return (data ?? []).map((row) => row.id);
}

/** Maps user id -> email. Email lives in Supabase Auth, not `profiles`, so
 * this goes through the admin API (same one used by scripts/seed-users.ts). */
export async function getUserEmailMap(): Promise<Map<string, string>> {
  const supabase = getSupabaseServerClient();
  const result = await supabase.auth.admin.listUsers({ perPage: 200 });

  if (result.error) throw new Error(`getUserEmailMap failed: ${result.error.message}`);

  // NOTE: explicit type — see scripts/seed-users.ts for why this Supabase
  // client version's correlated {data,error} union doesn't narrow cleanly.
  const users: Array<{ id: string; email?: string }> = result.data.users;
  const map = new Map<string, string>();
  for (const user of users) {
    if (user.email) map.set(user.id, user.email);
  }
  return map;
}
