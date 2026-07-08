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
