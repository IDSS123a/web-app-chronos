/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * NOTE: manual TS interfaces instead of z.infer<> — same Zod 3.25.x
 * `.default()` inference bug documented in obligations/schemas.ts.
 */

import { z } from 'zod';
import { OBLIGATION_CATEGORIES } from '../obligations/schemas';

export const CreateUserSchema = z.object({
  full_name: z.string().trim().min(2, 'Ime mora imati najmanje 2 karaktera.').max(120, 'Ime je predugačko (max 120 karaktera).'),
  email: z.string().trim().toLowerCase().email('Neispravna email adresa.'),
  role: z.enum(['SUPER_ADMIN', 'STANDARD_USER']),
  institution: z.enum(['IDSS', 'MONTESSORI', 'BOTH']),
});

export interface CreateUserInput {
  full_name: string;
  email: string;
  role: 'SUPER_ADMIN' | 'STANDARD_USER';
  institution: 'IDSS' | 'MONTESSORI' | 'BOTH';
}

export const UpdateUserSchema = z.object({
  full_name: z.string().trim().min(2).max(120).optional(),
  role: z.enum(['SUPER_ADMIN', 'STANDARD_USER']).optional(),
  institution: z.enum(['IDSS', 'MONTESSORI', 'BOTH']).optional(),
});

export interface UpdateUserInput {
  full_name?: string;
  role?: 'SUPER_ADMIN' | 'STANDARD_USER';
  institution?: 'IDSS' | 'MONTESSORI' | 'BOTH';
}

// --- Bulk calendar import ---
// Deliberately a normalized, Chronos-owned shape rather than an attempt to
// auto-parse arbitrary raw school-calendar exports (the two real IDSS/IMH
// files handled this sprint used different field names for equivalent
// concepts, and changed shape between two versions of the same file — see
// SPRINT_10.md). Someone (SUPER_ADMIN, or an AI assistant helping curate
// the source file) normalizes into this shape first; the app then just
// validates + previews + imports it, instead of guessing.

export const CalendarImportEntrySchema = z.object({
  title: z.string().trim().min(3).max(200),
  category: z.enum(OBLIGATION_CATEGORIES),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Datum mora biti u formatu YYYY-MM-DD.'),
  responsible_person: z.string().trim().min(2).max(120).optional(),
  priority: z.enum(['NIZAK', 'SREDNJI', 'VISOK']).optional(),
});

export const CalendarImportSchema = z.object({
  institution: z.enum(['IDSS', 'MONTESSORI']),
  entries: z.array(CalendarImportEntrySchema).min(1, 'Fajl ne sadrži nijedan unos.').max(300, 'Previše unosa u jednom fajlu (max 300).'),
});

export interface CalendarImportEntryInput {
  title: string;
  category: (typeof OBLIGATION_CATEGORIES)[number];
  due_date: string;
  responsible_person?: string;
  priority?: 'NIZAK' | 'SREDNJI' | 'VISOK';
}

export interface CalendarImportInput {
  institution: 'IDSS' | 'MONTESSORI';
  entries: CalendarImportEntryInput[];
}
