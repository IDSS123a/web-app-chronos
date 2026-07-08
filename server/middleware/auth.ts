/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { NextFunction, Request, Response } from 'express';
import { getSupabaseServerClient } from '../lib/supabase-server';
import { getProfileByUserId } from '../features/auth/repository';

/**
 * Verifies the Supabase JWT sent as `Authorization: Bearer <token>` and
 * attaches the resolved Chronos profile to `req.profile`. Rejects with 401
 * if the token is missing/invalid, or 403 if the user has no Chronos profile.
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      res.status(401).json({ success: false, error: 'Niste prijavljeni.' });
      return;
    }

    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      res.status(401).json({ success: false, error: 'Sesija je nevažeća ili je istekla.' });
      return;
    }

    const profile = await getProfileByUserId(data.user.id, data.user.email ?? '');

    if (!profile) {
      res.status(403).json({ success: false, error: 'Korisnički profil nije pronađen.' });
      return;
    }

    req.profile = profile;
    next();
  } catch (err) {
    console.error('[requireAuth] unexpected error:', err);
    res.status(500).json({ success: false, error: 'Greška servera prilikom provjere sesije.' });
  }
}
