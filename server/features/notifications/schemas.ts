/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * NOTE: manual TS interfaces instead of z.infer<> — same Zod 3.25.x
 * `.default()` inference bug documented in obligations/schemas.ts.
 */

import { z } from 'zod';

const MAX_GROUPS_PER_SEND = 20;
const MAX_DIRECT_USERS_PER_SEND = 100;
// Hard ceiling on a single manual send's resolved recipient count — the
// "zaštita od slučajnog masovnog slanja" safeguard requested for this
// feature. Deliberately generous for the institution's real scale, but
// still catches a fat-fingered "select everyone" mistake.
export const MAX_RESOLVED_RECIPIENTS = 200;

export const NotificationGroupSchema = z.object({
  name: z.string().trim().min(2, 'Naziv grupe mora imati najmanje 2 karaktera.').max(100, 'Naziv grupe je predugačak (max 100 karaktera).'),
  member_ids: z.array(z.string().uuid()).max(200, 'Previše članova (max 200).').default([]),
});

export interface NotificationGroupInput {
  name: string;
  member_ids: string[];
}

export const NotificationScheduleSchema = z.object({
  name: z.string().trim().min(2, 'Naziv rasporeda mora imati najmanje 2 karaktera.').max(100, 'Naziv rasporeda je predugačak (max 100 karaktera).'),
  report_type: z.enum(['DNEVNI_PREGLED']),
  group_id: z.string().uuid('Morate odabrati grupu.'),
  send_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Vrijeme mora biti u formatu HH:MM (24h).'),
  enabled: z.boolean().default(false),
});

export interface NotificationScheduleInput {
  name: string;
  report_type: 'DNEVNI_PREGLED';
  group_id: string;
  send_time: string;
  enabled: boolean;
}

export const NotificationScheduleUpdateSchema = NotificationScheduleSchema.partial();
export type NotificationScheduleUpdateInput = Partial<NotificationScheduleInput>;

export const ManualSendSchema = z.object({
  subject: z.string().trim().min(3, 'Naslov mora imati najmanje 3 karaktera.').max(200, 'Naslov je predugačak (max 200 karaktera).'),
  body: z.string().trim().min(1, 'Poruka ne smije biti prazna.').max(5000, 'Poruka je predugačka (max 5000 karaktera).'),
  group_ids: z.array(z.string().uuid()).max(MAX_GROUPS_PER_SEND, `Previše grupa odabrano (max ${MAX_GROUPS_PER_SEND}).`).default([]),
  user_ids: z.array(z.string().uuid()).max(MAX_DIRECT_USERS_PER_SEND, `Previše pojedinačnih korisnika (max ${MAX_DIRECT_USERS_PER_SEND}).`).default([]),
});

export interface ManualSendInput {
  subject: string;
  body: string;
  group_ids: string[];
  user_ids: string[];
}
