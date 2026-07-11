/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Single source of truth for role-based permission checks (Commander A-4).
 * Every API route imports from here instead of inlining role comparisons.
 */

import type { UserRole } from '../../src/types';

export function canDeleteObligation(role: UserRole): boolean {
  return role === 'SUPER_ADMIN';
}

export function canClearAuditLogs(role: UserRole): boolean {
  return role === 'SUPER_ADMIN';
}

export function canRunReminderScan(role: UserRole): boolean {
  return role === 'SUPER_ADMIN';
}

/** Interni notifikacioni sistem (Sprint 09) — upravljanje grupama/rasporedima
 * i ručno slanje je SUPER_ADMIN-only u v1 (vidi CONSTITUTION.md §5.8). */
export function canManageNotifications(role: UserRole): boolean {
  return role === 'SUPER_ADMIN';
}

/** Super Admin panel (Sprint 10) — upravljanje korisnicima, sistemske
 * statistike, bulk uvoz kalendara. SUPER_ADMIN-only (vidi CONSTITUTION.md §5.9). */
export function canManageUsers(role: UserRole): boolean {
  return role === 'SUPER_ADMIN';
}
