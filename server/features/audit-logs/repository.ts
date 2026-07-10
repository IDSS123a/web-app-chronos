/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { getSupabaseServerClient } from '../../lib/supabase-server';
import { getVisibleObligationIds } from '../obligations/repository';
import type { AuthenticatedProfile } from '../../types';
import type { AuditLog } from '../../../src/types';

interface AuditLogRow {
  id: string;
  timestamp: string;
  username: string;
  action_type: string;
  target_table: string;
  target_id: string;
  changes: string;
}

function mapRow(row: AuditLogRow): AuditLog {
  return {
    id: row.id,
    timestamp: row.timestamp,
    username: row.username,
    action_type: row.action_type as AuditLog['action_type'],
    target_table: row.target_table as AuditLog['target_table'],
    target_id: row.target_id,
    changes: row.changes,
  };
}

export interface AuditLogInsertInput {
  user_id: string | null;
  username: string;
  action_type: AuditLog['action_type'];
  target_table: AuditLog['target_table'];
  target_id: string;
  changes: string;
}

export async function createAuditLog(input: AuditLogInsertInput): Promise<AuditLog> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.from('audit_logs').insert(input).select('*').single();

  if (error) throw new Error(`createAuditLog failed: ${error.message}`);
  return mapRow(data as AuditLogRow);
}

/**
 * Audit log rows visible to `profile` — mirrors the obligation confidentiality
 * boundary (CONSTITUTION.md §5.7) instead of returning every row to every
 * authenticated user. SUPER_ADMIN sees everything. Everyone else sees:
 *  - non-Obligations entries (e.g. login/logout), which carry no financial
 *    obligation content, plus
 *  - entries about their own actions (so deleting/editing your own obligation
 *    still shows in your own history even after it no longer exists), plus
 *  - Obligations entries whose target is an obligation they can currently see
 *    (creator or watcher) — this is what previously leaked private obligation
 *    titles (via the `changes` text) to any authenticated user.
 */
export async function getVisibleAuditLogs(profile: AuthenticatedProfile): Promise<AuditLog[]> {
  const supabase = getSupabaseServerClient();
  let query = supabase.from('audit_logs').select('*').order('timestamp', { ascending: false });

  if (profile.role !== 'SUPER_ADMIN') {
    const visibleObligationIds = await getVisibleObligationIds(profile);
    const clauses = [`target_table.neq.Obligations`, `user_id.eq.${profile.id}`];
    if (visibleObligationIds && visibleObligationIds.length > 0) {
      clauses.push(`target_id.in.(${visibleObligationIds.join(',')})`);
    }
    query = query.or(clauses.join(','));
  }

  const { data, error } = await query;
  if (error) throw new Error(`getVisibleAuditLogs failed: ${error.message}`);
  return (data as AuditLogRow[]).map(mapRow);
}

/** Deletes every row. Supabase requires a filter even for "delete all". */
export async function clearAllAuditLogs(): Promise<void> {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase
    .from('audit_logs')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');

  if (error) throw new Error(`clearAllAuditLogs failed: ${error.message}`);
}
