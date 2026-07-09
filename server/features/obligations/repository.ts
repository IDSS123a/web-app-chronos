/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { getSupabaseServerClient } from '../../lib/supabase-server';
import type { AuthenticatedProfile } from '../../types';
import type { Obligation, ChecklistItem, ObligationStatus } from '../../../src/types';

/**
 * DB row shape. Note: the `attachment_path` column (Supabase Storage path,
 * wired up in Sprint 04) is mapped to/from the frontend's `attachment_url`
 * field — until real uploads exist it just holds whatever string value is
 * given (currently a mock URL from ObligationForm).
 */
interface ObligationRow {
  id: string;
  title: string;
  institution: string;
  category: string;
  due_date: string;
  responsible_person: string;
  priority: string;
  status: string;
  checklist_items: ChecklistItem[];
  attachment_path: string | null;
  attachment_name: string | null;
  is_recurring: boolean;
  recurring_interval: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

function mapRow(row: ObligationRow, watcherIds: string[]): Obligation {
  return {
    id: row.id,
    title: row.title,
    institution: row.institution as Obligation['institution'],
    category: row.category,
    due_date: row.due_date,
    responsible_person: row.responsible_person,
    priority: row.priority as Obligation['priority'],
    status: row.status as Obligation['status'],
    checklist_items: row.checklist_items,
    attachment_url: row.attachment_path ?? '',
    attachment_name: row.attachment_name ?? '',
    is_recurring: row.is_recurring,
    recurring_interval: row.recurring_interval as Obligation['recurring_interval'],
    created_by: row.created_by ?? '',
    watcher_ids: watcherIds,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function getWatcherIdsByObligation(obligationIds: string[]): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (obligationIds.length === 0) return map;

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('obligation_watchers')
    .select('obligation_id, user_id')
    .in('obligation_id', obligationIds);

  if (error) throw new Error(`getWatcherIdsByObligation failed: ${error.message}`);

  for (const row of data ?? []) {
    const list = map.get(row.obligation_id) ?? [];
    list.push(row.user_id);
    map.set(row.obligation_id, list);
  }
  return map;
}

/**
 * Obligations visible to `profile`: SUPER_ADMIN sees everything; everyone
 * else sees what they created plus what they've been explicitly added to
 * watch (CONSTITUTION.md §5.1 — financial-data confidentiality).
 */
export async function getVisibleObligations(profile: AuthenticatedProfile): Promise<Obligation[]> {
  const supabase = getSupabaseServerClient();

  if (profile.role === 'SUPER_ADMIN') {
    const { data, error } = await supabase.from('obligations').select('*').order('due_date', { ascending: true });
    if (error) throw new Error(`getVisibleObligations failed: ${error.message}`);
    const rows = data as ObligationRow[];
    const watcherMap = await getWatcherIdsByObligation(rows.map((r) => r.id));
    return rows.map((row) => mapRow(row, watcherMap.get(row.id) ?? []));
  }

  const { data: watchedRows, error: watchedError } = await supabase
    .from('obligation_watchers')
    .select('obligation_id')
    .eq('user_id', profile.id);
  if (watchedError) throw new Error(`getVisibleObligations (watched) failed: ${watchedError.message}`);

  const watchedIds = (watchedRows ?? []).map((r) => r.obligation_id as string);

  let query = supabase.from('obligations').select('*').order('due_date', { ascending: true });
  query =
    watchedIds.length > 0
      ? query.or(`created_by.eq.${profile.id},id.in.(${watchedIds.join(',')})`)
      : query.eq('created_by', profile.id);

  const { data, error } = await query;
  if (error) throw new Error(`getVisibleObligations failed: ${error.message}`);

  const rows = data as ObligationRow[];
  const watcherMap = await getWatcherIdsByObligation(rows.map((r) => r.id));
  return rows.map((row) => mapRow(row, watcherMap.get(row.id) ?? []));
}

export async function getObligationById(id: string): Promise<Obligation | null> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.from('obligations').select('*').eq('id', id).maybeSingle();

  if (error) throw new Error(`getObligationById failed: ${error.message}`);
  if (!data) return null;

  const watcherMap = await getWatcherIdsByObligation([data.id]);
  return mapRow(data as ObligationRow, watcherMap.get(data.id) ?? []);
}

/** Replaces the full watcher list for an obligation (small lists — delete + reinsert is simplest and correct). */
export async function setObligationWatchers(obligationId: string, userIds: string[]): Promise<void> {
  const supabase = getSupabaseServerClient();

  const { error: deleteError } = await supabase
    .from('obligation_watchers')
    .delete()
    .eq('obligation_id', obligationId);
  if (deleteError) throw new Error(`setObligationWatchers (clear) failed: ${deleteError.message}`);

  if (userIds.length === 0) return;

  const { error: insertError } = await supabase
    .from('obligation_watchers')
    .insert(userIds.map((userId) => ({ obligation_id: obligationId, user_id: userId })));
  if (insertError) throw new Error(`setObligationWatchers (insert) failed: ${insertError.message}`);
}

export interface ObligationInsertInput {
  title: string;
  institution: Obligation['institution'];
  category: string;
  due_date: string;
  responsible_person: string;
  priority: Obligation['priority'];
  status: ObligationStatus;
  checklist_items: ChecklistItem[];
  attachment_url: string;
  attachment_name: string;
  is_recurring: boolean;
  recurring_interval: Obligation['recurring_interval'];
  created_by: string;
  watcher_ids: string[];
}

/** Insert a new obligation row. Used both for user-created obligations and
 * for the next cycle of a completed recurring obligation. */
export async function insertObligation(input: ObligationInsertInput): Promise<Obligation> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('obligations')
    .insert({
      title: input.title,
      institution: input.institution,
      category: input.category,
      due_date: input.due_date,
      responsible_person: input.responsible_person,
      priority: input.priority,
      status: input.status,
      checklist_items: input.checklist_items,
      attachment_path: input.attachment_url || null,
      attachment_name: input.attachment_name || null,
      is_recurring: input.is_recurring,
      recurring_interval: input.recurring_interval,
      created_by: input.created_by,
    })
    .select('*')
    .single();

  if (error) throw new Error(`insertObligation failed: ${error.message}`);

  await setObligationWatchers(data.id, input.watcher_ids);

  return mapRow(data as ObligationRow, input.watcher_ids);
}

export interface ObligationUpdatePatch {
  title?: string;
  institution?: Obligation['institution'];
  category?: string;
  due_date?: string;
  responsible_person?: string;
  priority?: Obligation['priority'];
  status?: ObligationStatus;
  checklist_items?: ChecklistItem[];
  attachment_url?: string;
  attachment_name?: string;
  is_recurring?: boolean;
  recurring_interval?: Obligation['recurring_interval'];
}

export async function updateObligation(id: string, patch: ObligationUpdatePatch): Promise<Obligation> {
  const supabase = getSupabaseServerClient();
  const dbPatch: Record<string, unknown> = { ...patch };

  if ('attachment_url' in patch) {
    dbPatch.attachment_path = patch.attachment_url;
    delete dbPatch.attachment_url;
  }

  const { data, error } = await supabase
    .from('obligations')
    .update(dbPatch)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw new Error(`updateObligation failed: ${error.message}`);

  const watcherMap = await getWatcherIdsByObligation([id]);
  return mapRow(data as ObligationRow, watcherMap.get(id) ?? []);
}

export async function deleteObligation(id: string): Promise<void> {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase.from('obligations').delete().eq('id', id);
  if (error) throw new Error(`deleteObligation failed: ${error.message}`);
}
