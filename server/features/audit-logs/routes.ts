/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { canClearAuditLogs } from '../../lib/permissions';
import { AuditLogCreateSchema, type AuditLogCreateInput } from './schemas';
import * as repo from './repository';

export const auditLogsRouter = Router();
auditLogsRouter.use(requireAuth);

/**
 * POST /api/audit-logs
 * Role required: any authenticated user
 * Body: AuditLogCreateSchema (restricted to login/logout style Users events —
 *       user_id/username are always taken from the verified session, never
 *       the request body, so this cannot be used to spoof another user)
 * Response: { success: true, data: AuditLog }
 */
auditLogsRouter.post('/', async (req, res) => {
  const parsed = AuditLogCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ success: false, error: parsed.error.issues[0]?.message ?? 'Neispravan unos.' });
    return;
  }

  try {
    const input = parsed.data as AuditLogCreateInput;
    const log = await repo.createAuditLog({
      user_id: req.profile!.id,
      username: req.profile!.username,
      action_type: input.action_type,
      target_table: input.target_table,
      target_id: input.target_id,
      changes: input.changes,
    });
    res.status(201).json({ success: true, data: log });
  } catch (err) {
    console.error('[POST /api/audit-logs]', err);
    res.status(500).json({ success: false, error: 'Greška pri upisu u dnevnik aktivnosti.' });
  }
});

/**
 * GET /api/audit-logs
 * Role required: any authenticated user
 * Response: { success: true, data: AuditLog[] }
 */
auditLogsRouter.get('/', async (_req, res) => {
  try {
    const logs = await repo.getAllAuditLogs();
    res.json({ success: true, data: logs });
  } catch (err) {
    console.error('[GET /api/audit-logs]', err);
    res.status(500).json({ success: false, error: 'Greška pri učitavanju dnevnika aktivnosti.' });
  }
});

/**
 * DELETE /api/audit-logs
 * Role required: SUPER_ADMIN
 * Response: { success: true, data: null }
 * Errors: 401, 403, 500
 */
auditLogsRouter.delete('/', async (req, res) => {
  if (!canClearAuditLogs(req.profile!.role)) {
    res.status(403).json({ success: false, error: 'Samo Super Admin može isprazniti dnevnik aktivnosti.' });
    return;
  }

  try {
    await repo.clearAllAuditLogs();
    res.json({ success: true, data: null });
  } catch (err) {
    console.error('[DELETE /api/audit-logs]', err);
    res.status(500).json({ success: false, error: 'Greška pri pražnjenju dnevnika aktivnosti.' });
  }
});
