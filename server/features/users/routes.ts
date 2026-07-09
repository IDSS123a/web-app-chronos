/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { getAllUserSummaries } from './repository';

export const usersRouter = Router();
usersRouter.use(requireAuth);

/**
 * GET /api/users
 * Role required: any authenticated user
 * Response: { success: true, data: UserSummary[] }
 * Used to populate the obligation "who can see this" watcher picker. Only
 * exposes id/fullName/role — no email or other profile data.
 */
usersRouter.get('/', async (_req, res) => {
  try {
    const users = await getAllUserSummaries();
    res.json({ success: true, data: users });
  } catch (err) {
    console.error('[GET /api/users]', err);
    res.status(500).json({ success: false, error: 'Greška pri učitavanju liste korisnika.' });
  }
});
