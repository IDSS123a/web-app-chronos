/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { getSupabaseServerClient } from '../../lib/supabase-server';
import type { Obligation, ChecklistItem, ObligationStatus } from '../../../src/types';

/**
 * DB row shape. Note: the `attachment_path` column (Supabase Storage path,
 * wired up in Sprint 03) is mapped to/from the frontend's `attachment_url`
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

function mapRow(row: ObligationRow): Obligation {
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
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/** Get all obligations, every institution, ordered by due date. */
export async function getAllObligations(): Promise<Obligation[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('obligations')
    .select('*')
    .order('due_date', { ascending: true });

  if (error) throw new Error(`getAllObligations failed: ${error.message}`);
  return (data as ObligationRow[]).map(mapRow);
}

export async function getObligationById(id: string): Promise<Obligation | null> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.from('obligations').select('*').eq('id', id).maybeSingle();

  if (error) throw new Error(`getObligationById failed: ${error.message}`);
  return data ? mapRow(data as ObligationRow) : null;
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
  return mapRow(data as ObligationRow);
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
  return mapRow(data as ObligationRow);
}

export async function deleteObligation(id: string): Promise<void> {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase.from('obligations').delete().eq('id', id);
  if (error) throw new Error(`deleteObligation failed: ${error.message}`);
}
