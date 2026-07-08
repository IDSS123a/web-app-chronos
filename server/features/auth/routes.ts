/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';

export const authRouter = Router();

/**
 * GET /api/auth/me
 * Role required: any authenticated user
 * Response: { success: true, data: AuthenticatedProfile }
 * Errors: 401 (unauthenticated/invalid session), 403 (no Chronos profile), 500 (server)
 *
 * Actual login/logout happens client-side via Supabase Auth
 * (src/lib/supabase-browser.ts) — this route only resolves the
 * Chronos-specific profile (role, institution, full name) for the
 * currently authenticated Supabase session.
 */
authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ success: true, data: req.profile });
});
