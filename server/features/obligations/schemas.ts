/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * NOTE: types below are declared manually rather than via z.infer<>. The
 * installed Zod version (3.25.x, a zod-4-compatibility bridge release) infers
 * every field with `.default()` — and, oddly, nested object fields inside
 * arrays too — as optional in the OUTPUT type, which is incorrect for a
 * parsed/validated payload. The Zod schemas below are still the actual
 * runtime validators (Commander E-2); only the compile-time types are hand
 * written to work around this inference bug.
 */

import { z } from 'zod';
import type { ChecklistItem, InstitutionType, PriorityType, RecurringInterval } from '../../../src/types';

// Mirrors the keys of CATEGORY_STYLE_MAP (src/types.ts) — kept as an
// explicit enum here (rather than a bare `z.string()`) so a direct API call
// can't set an arbitrary category value that only the UI happens to render
// safely via its fallback style.
export const OBLIGATION_CATEGORIES = [
  'NERADNI_DAN',
  'DOGAĐAJ',
  'RASPUST',
  'NENASTAVNI_DAN',
  'PROJEKT',
  'ADMINISTRACIJA',
] as const;

export const ChecklistItemSchema = z.object({
  task: z.string().trim().min(1).max(300, 'Stavka kontrolne liste je predugačka (max 300 karaktera).'),
  done: z.boolean(),
});

export const ObligationCreateSchema = z.object({
  title: z.string().trim().min(3, 'Naziv obaveze mora imati najmanje 3 karaktera.').max(200, 'Naziv obaveze je predugačak (max 200 karaktera).'),
  institution: z.enum(['IDSS', 'MONTESSORI']),
  category: z.enum(OBLIGATION_CATEGORIES),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Datum dospijeća nije u ispravnom formatu (YYYY-MM-DD).'),
  responsible_person: z.string().trim().min(2, 'Morate navesti ime odgovorne osobe.').max(120, 'Ime odgovorne osobe je predugačko (max 120 karaktera).'),
  priority: z.enum(['NIZAK', 'SREDNJI', 'VISOK']),
  checklist_items: z.array(ChecklistItemSchema).max(50, 'Previše stavki kontrolne liste (max 50).').default([]),
  is_recurring: z.boolean().default(false),
  recurring_interval: z.enum(['NONE', 'MONTHLY', 'HALF_YEARLY', 'YEARLY']).default('NONE'),
  watcher_ids: z.array(z.string().uuid()).max(50, 'Previše watchers (max 50).').default([]),
});

export const ObligationUpdateSchema = ObligationCreateSchema.partial();

// NOTE: no attachment_url/attachment_name here — attachments are set via the
// dedicated POST/DELETE /api/obligations/:id/attachment endpoints (Sprint 04),
// not as part of the create/update JSON payload.
export interface ObligationCreateInput {
  title: string;
  institution: InstitutionType;
  category: (typeof OBLIGATION_CATEGORIES)[number];
  due_date: string;
  responsible_person: string;
  priority: PriorityType;
  checklist_items: ChecklistItem[];
  is_recurring: boolean;
  recurring_interval: RecurringInterval;
  watcher_ids: string[];
}

export type ObligationUpdateInput = Partial<ObligationCreateInput>;
