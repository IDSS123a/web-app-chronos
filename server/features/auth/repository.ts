/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { getSupabaseServerClient } from '../../lib/supabase-server';
import type { AuthenticatedProfile } from '../../types';

/**
 * Load the Chronos profile (role, institution, full name) for a given
 * Supabase Auth user ID, combined with their email as `username`.
 */
export async function getProfileByUserId(
  userId: string,
  email: string
): Promise<AuthenticatedProfile | null> {
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, role, institution')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw new Error(`getProfileByUserId failed: ${error.message}`);
  if (!data) return null;

  return {
    id: data.id,
    username: email,
    fullName: data.full_name,
    role: data.role,
    institution: data.institution,
  };
}
