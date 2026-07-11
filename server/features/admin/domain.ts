/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * FEATURE: Super Admin panel (Sprint 10)
 * PURPOSE: User lifecycle management, system stats, bulk calendar import —
 *          all SUPER_ADMIN-only. See CONSTITUTION.md §5.9.
 */

import { HttpError } from '../../lib/errors';
import { createAuditLog } from '../audit-logs/repository';
import { insertObligation } from '../obligations/repository';
import * as repo from './repository';
import type { CreateUserInput, UpdateUserInput, CalendarImportInput } from './schemas';
import type { AuthenticatedProfile } from '../../types';
import type { AdminUserSummary, AdminUserActivity, AdminSystemStats, CalendarImportResult } from '../../../src/types';

export async function listUsers(): Promise<AdminUserSummary[]> {
  return repo.getAllUsersWithAuth();
}

export async function createUser(input: CreateUserInput, actor: AuthenticatedProfile): Promise<{ id: string; password: string }> {
  const result = await repo.createUser(input);

  await createAuditLog({
    user_id: actor.id,
    username: actor.username,
    action_type: 'KREIRANJE',
    target_table: 'Users',
    target_id: result.id,
    changes: `Kreiran novi korisnički nalog "${input.full_name}" (${input.email}, uloga: ${input.role}).`,
  });

  return result;
}

export async function updateUser(id: string, input: UpdateUserInput, actor: AuthenticatedProfile): Promise<void> {
  if (id === actor.id && input.role && input.role !== 'SUPER_ADMIN') {
    throw new HttpError(400, 'Ne možete sami sebi ukinuti Super Admin ulogu — zatražite da to uradi drugi Super Admin.');
  }
  if (!(await repo.profileExists(id))) {
    throw new HttpError(404, 'Korisnički nalog nije pronađen.');
  }

  await repo.updateUserProfile(id, input);

  await createAuditLog({
    user_id: actor.id,
    username: actor.username,
    action_type: 'IZMJENA',
    target_table: 'Users',
    target_id: id,
    changes: `Ažuriran profil korisnika (${Object.keys(input).join(', ')}).`,
  });
}

export async function setUserBanned(id: string, banned: boolean, actor: AuthenticatedProfile): Promise<void> {
  if (id === actor.id && banned) {
    throw new HttpError(400, 'Ne možete blokirati sami sebe.');
  }
  if (!(await repo.profileExists(id))) {
    throw new HttpError(404, 'Korisnički nalog nije pronađen.');
  }

  await repo.setUserBanned(id, banned);

  await createAuditLog({
    user_id: actor.id,
    username: actor.username,
    action_type: 'IZMJENA',
    target_table: 'Users',
    target_id: id,
    changes: banned ? 'Korisnički nalog blokiran (ne može se prijaviti).' : 'Korisnički nalog deblokiran.',
  });
}

export interface DeleteUserResult {
  deleted: boolean;
  blockers?: repo.DeletionBlockers;
}

export async function deleteUser(id: string, actor: AuthenticatedProfile): Promise<DeleteUserResult> {
  if (id === actor.id) {
    throw new HttpError(400, 'Ne možete obrisati sami sebe.');
  }
  if (!(await repo.profileExists(id))) {
    throw new HttpError(404, 'Korisnički nalog nije pronađen.');
  }

  const blockers = await repo.getDeletionBlockers(id);
  const hasBlockers = Object.values(blockers).some((count) => count > 0);
  if (hasBlockers) {
    return { deleted: false, blockers };
  }

  await repo.deleteUserHard(id);

  await createAuditLog({
    user_id: actor.id,
    username: actor.username,
    action_type: 'BRISANJE',
    target_table: 'Users',
    target_id: id,
    changes: 'Korisnički nalog trajno obrisan (nije imao ni obaveza ni istoriju aktivnosti).',
  });

  return { deleted: true };
}

export async function getUserActivity(id: string): Promise<AdminUserActivity> {
  return repo.getUserActivity(id);
}

export async function getSystemStats(): Promise<AdminSystemStats> {
  return repo.getSystemStats();
}

/** Bulk calendar import — reuses the exact same insert+watchers+audit path
 * as a normal obligation creation (obligations/repository.ts), just looped.
 * Every visible staff account is added as a watcher, matching the manual
 * imports done earlier this project (institutional calendar dates are
 * explicitly non-sensitive — CONSTITUTION §5.7/§5.9). */
export async function importCalendar(input: CalendarImportInput, actor: AuthenticatedProfile, allStaffIds: string[]): Promise<CalendarImportResult> {
  let created = 0;
  const errors: string[] = [];

  for (const entry of input.entries) {
    try {
      const obligation = await insertObligation({
        title: entry.title,
        institution: input.institution,
        category: entry.category,
        due_date: entry.due_date,
        responsible_person: entry.responsible_person ?? `Uprava ${input.institution === 'IDSS' ? 'IDSS' : 'IMH'}`,
        priority: entry.priority ?? 'SREDNJI',
        status: 'NOVO',
        checklist_items: [],
        is_recurring: false,
        recurring_interval: 'NONE',
        created_by: actor.id,
        watcher_ids: allStaffIds,
      });

      await createAuditLog({
        user_id: actor.id,
        username: actor.username,
        action_type: 'KREIRANJE',
        target_table: 'Obligations',
        target_id: obligation.id,
        changes: `Zavedena nova obaveza "${entry.title}" za ustanovu ${input.institution} (bulk uvoz kalendara).`,
      });

      created++;
    } catch (err) {
      errors.push(`${entry.title}: ${err instanceof Error ? err.message : 'nepoznata greška'}`);
    }
  }

  return { created, errors };
}
