/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * FEATURE: Database health check
 * PURPOSE: Replace the previously hardcoded "● ONLINE" header label (App.tsx)
 *          with a status that actually reflects live Supabase connectivity.
 *          Public (no auth) — leaks nothing beyond ONLINE/OFFLINE, and doubles
 *          as a real health-check URL for uptime monitors / Render.
 */

import { Router } from 'express';
import { getSupabaseServerClient } from '../../lib/supabase-server';

export const healthRouter = Router();

/**
 * GET /api/health
 * Response (up):   200 { success: true,  data: { database: 'ONLINE' } }
 * Response (down): 503 { success: false, data: { database: 'OFFLINE' }, error }
 * Does a single cheap, indexed probe against `profiles` (head+count, no rows
 * transferred) — succeeds only if the Supabase Postgres connection is live.
 */
healthRouter.get('/', async (_req, res) => {
  try {
    const supabase = getSupabaseServerClient();
    const { error } = await supabase
      .from('profiles')
      .select('id', { head: true, count: 'exact' })
      .limit(1);

    if (error) {
      res.status(503).json({ success: false, data: { database: 'OFFLINE' }, error: 'Baza podataka nedostupna.' });
      return;
    }

    res.json({ success: true, data: { database: 'ONLINE' } });
  } catch (err) {
    console.error('[GET /api/health]', err);
    res.status(503).json({ success: false, data: { database: 'OFFLINE' }, error: 'Baza podataka nedostupna.' });
  }
});
