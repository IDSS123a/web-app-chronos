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
