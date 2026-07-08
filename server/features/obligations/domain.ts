/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * FEATURE: Obligations business rules
 * PURPOSE: Ownership-based edit rules, audit logging, and the recurring
 *          cycle engine — moved 1:1 from the original client-side App.tsx
 *          (Commander M-11 Refactoring Boundary: same behaviour, better
 *          structure).
 * TOUCHES: obligations, audit_logs tables
 * SPRINT: 02
 * CONSTITUTION REF: §5.1 (RBAC), §5.2 (lifecycle), §5.3 (recurring engine), §5.4 (audit log)
 */

import { HttpError } from '../../lib/errors';
import { canDeleteObligation } from '../../lib/permissions';
import * as repo from './repository';
import * as auditRepo from '../audit-logs/repository';
import type { AuthenticatedProfile } from '../../types';
import type { Obligation, ChecklistItem, RecurringInterval } from '../../../src/types';
import type { ObligationCreateInput, ObligationUpdateInput } from './schemas';

/** SUPER_ADMIN may edit anything; STANDARD_USER only their own obligations. */
export function canEditObligation(profile: AuthenticatedProfile, obligation: Obligation): boolean {
  return profile.role === 'SUPER_ADMIN' || obligation.created_by === profile.id;
}

function requireEditable(profile: AuthenticatedProfile, obligation: Obligation): void {
  if (!canEditObligation(profile, obligation)) {
    throw new HttpError(403, 'Možete uređivati samo obaveze koje ste sami kreirali.');
  }
}

/** Mirrors the original App.tsx calculateNextDueDate (PRD Section 5.3). */
export function calculateNextDueDate(currentDueDate: string, interval: RecurringInterval): string | null {
  const date = new Date(currentDueDate);
  switch (interval) {
    case 'MONTHLY':
      date.setMonth(date.getMonth() + 1);
      break;
    case 'HALF_YEARLY':
      date.setMonth(date.getMonth() + 6);
      break;
    case 'YEARLY':
      date.setFullYear(date.getFullYear() + 1);
      break;
    default:
      return null;
  }
  return date.toISOString().split('T')[0];
}

export async function createObligation(
  input: ObligationCreateInput,
  profile: AuthenticatedProfile
): Promise<Obligation> {
  const obligation = await repo.insertObligation({
    ...input,
    status: 'NOVO',
    created_by: profile.id,
  });

  await auditRepo.createAuditLog({
    user_id: profile.id,
    username: profile.username,
    action_type: 'KREIRANJE',
    target_table: 'Obligations',
    target_id: obligation.id,
    changes: `Zavedena nova obaveza "${obligation.title}" za ustanovu ${obligation.institution === 'IDSS' ? 'IDSS' : 'IMH'}.`,
  });

  return obligation;
}

export async function updateObligationWithAudit(
  id: string,
  patch: ObligationUpdateInput,
  profile: AuthenticatedProfile
): Promise<Obligation> {
  const target = await repo.getObligationById(id);
  if (!target) throw new HttpError(404, 'Obaveza nije pronađena.');
  requireEditable(profile, target);

  const updated = await repo.updateObligation(id, patch);

  await auditRepo.createAuditLog({
    user_id: profile.id,
    username: profile.username,
    action_type: 'IZMJENA',
    target_table: 'Obligations',
    target_id: id,
    changes: `Ažurirani detalji obaveze "${updated.title}".`,
  });

  return updated;
}

export async function deleteObligationWithAudit(id: string, profile: AuthenticatedProfile): Promise<void> {
  if (!canDeleteObligation(profile.role)) {
    throw new HttpError(403, 'Samo Super Admin može brisati obaveze.');
  }

  const target = await repo.getObligationById(id);
  if (!target) throw new HttpError(404, 'Obaveza nije pronađena.');

  await repo.deleteObligation(id);

  await auditRepo.createAuditLog({
    user_id: profile.id,
    username: profile.username,
    action_type: 'BRISANJE',
    target_table: 'Obligations',
    target_id: id,
    changes: `Trajno obrisana obaveza "${target.title}" iz registra.`,
  });
}

export interface ToggleStatusResult {
  obligation: Obligation;
  nextCycle: Obligation | null;
}

/** Complete (with recurring-cycle creation) or reactivate an obligation. */
export async function toggleObligationStatus(
  id: string,
  profile: AuthenticatedProfile
): Promise<ToggleStatusResult> {
  const target = await repo.getObligationById(id);
  if (!target) throw new HttpError(404, 'Obaveza nije pronađena.');
  requireEditable(profile, target);

  if (target.status === 'ZAVRŠENO') {
    const reactivated = await repo.updateObligation(id, { status: 'U_TOKU' });

    await auditRepo.createAuditLog({
      user_id: profile.id,
      username: profile.username,
      action_type: 'IZMJENA',
      target_table: 'Obligations',
      target_id: id,
      changes: `Ponovno aktiviran rok "${target.title}" (status promijenjen u U TOKU).`,
    });

    return { obligation: reactivated, nextCycle: null };
  }

  const completed = await repo.updateObligation(id, { status: 'ZAVRŠENO' });
  let nextCycle: Obligation | null = null;

  if (target.is_recurring) {
    const nextDue = calculateNextDueDate(target.due_date, target.recurring_interval);

    if (nextDue) {
      const resetChecklist: ChecklistItem[] = target.checklist_items.map((item) => ({ ...item, done: false }));

      nextCycle = await repo.insertObligation({
        title: target.title,
        institution: target.institution,
        category: target.category,
        due_date: nextDue,
        responsible_person: target.responsible_person,
        priority: target.priority,
        status: 'NOVO',
        checklist_items: resetChecklist,
        attachment_url: '',
        attachment_name: '',
        is_recurring: target.is_recurring,
        recurring_interval: target.recurring_interval,
        created_by: target.created_by,
      });

      await auditRepo.createAuditLog({
        user_id: profile.id,
        username: profile.username,
        action_type: 'ZAVRŠETAK',
        target_table: 'Obligations',
        target_id: id,
        changes: `Završena ponavljajuća obaveza "${target.title}". Sistem je automatski kreirao novi ciklus (rok: ${nextDue.split('-').reverse().join('.')}) sa resetovanom kontrolnom listom.`,
      });

      return { obligation: completed, nextCycle };
    }
  }

  await auditRepo.createAuditLog({
    user_id: profile.id,
    username: profile.username,
    action_type: 'ZAVRŠETAK',
    target_table: 'Obligations',
    target_id: id,
    changes: `Obaveza "${target.title}" uspješno ispunjena i arhivirana.`,
  });

  return { obligation: completed, nextCycle };
}

export async function toggleChecklistItem(
  id: string,
  itemIndex: number,
  profile: AuthenticatedProfile
): Promise<Obligation> {
  const target = await repo.getObligationById(id);
  if (!target) throw new HttpError(404, 'Obaveza nije pronađena.');
  requireEditable(profile, target);

  if (itemIndex < 0 || itemIndex >= target.checklist_items.length) {
    throw new HttpError(422, 'Nepostojeća stavka kontrolne liste.');
  }

  const updatedChecklist = target.checklist_items.map((item, idx) =>
    idx === itemIndex ? { ...item, done: !item.done } : item
  );

  return repo.updateObligation(id, { checklist_items: updatedChecklist });
}
