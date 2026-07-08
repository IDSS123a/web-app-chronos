/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Single place that knows about `/api/*` routes (Commander M-7).
 */

import { supabase } from './supabase-browser';
import type { User } from '../types';

/**
 * Fetch the Chronos profile (role, institution, full name) for the
 * currently authenticated Supabase session by calling the Express backend.
 * Returns null if there is no active session.
 */
export async function fetchCurrentUser(): Promise<User | null> {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) return null;

  const response = await fetch('/api/auth/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) return null;

  const body = await response.json();
  if (!body.success) return null;

  return {
    id: body.data.id,
    username: body.data.username,
    fullName: body.data.fullName,
    role: body.data.role,
    institution: body.data.institution,
  };
}
