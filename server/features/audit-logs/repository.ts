/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { getSupabaseServerClient } from '../../lib/supabase-server';
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

export async function getAllAuditLogs(): Promise<AuditLog[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('audit_logs')
    .select('*')
    .order('timestamp', { ascending: false });

  if (error) throw new Error(`getAllAuditLogs failed: ${error.message}`);
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
