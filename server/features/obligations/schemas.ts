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

export const ChecklistItemSchema = z.object({
  task: z.string().trim().min(1),
  done: z.boolean(),
});

export const ObligationCreateSchema = z.object({
  title: z.string().trim().min(3, 'Naziv obaveze mora imati najmanje 3 karaktera.'),
  institution: z.enum(['IDSS', 'MONTESSORI']),
  category: z.string().min(1),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Datum dospijeća nije u ispravnom formatu (YYYY-MM-DD).'),
  responsible_person: z.string().trim().min(2, 'Morate navesti ime odgovorne osobe.'),
  priority: z.enum(['NIZAK', 'SREDNJI', 'VISOK']),
  checklist_items: z.array(ChecklistItemSchema).default([]),
  attachment_url: z.string().default(''),
  attachment_name: z.string().default(''),
  is_recurring: z.boolean().default(false),
  recurring_interval: z.enum(['NONE', 'MONTHLY', 'HALF_YEARLY', 'YEARLY']).default('NONE'),
});

export const ObligationUpdateSchema = ObligationCreateSchema.partial();

export interface ObligationCreateInput {
  title: string;
  institution: InstitutionType;
  category: string;
  due_date: string;
  responsible_person: string;
  priority: PriorityType;
  checklist_items: ChecklistItem[];
  attachment_url: string;
  attachment_name: string;
  is_recurring: boolean;
  recurring_interval: RecurringInterval;
}

export type ObligationUpdateInput = Partial<ObligationCreateInput>;
