/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * One-off/idempotent admin script (Commander Sprint 01): ensures the real
 * Chronos accounts (CONSTITUTION.md §5.1.1) exist as Supabase Auth users with
 * matching `profiles` rows, and removes obsolete placeholder test accounts
 * from an earlier seed run. Run with: npm run seed
 *
 * Safe to re-run: existing users are left alone (only their profile row is
 * upserted), only genuinely new users get a freshly generated password
 * printed once — save it immediately, it is not stored anywhere else.
 */

import 'dotenv/config';
import { randomBytes } from 'crypto';
import { createClient } from '@supabase/supabase-js';
import type { InstitutionType, UserRole } from '../src/types';

interface SeedUser {
  email: string;
  fullName: string;
  role: UserRole;
  institution: InstitutionType | 'BOTH';
}

// Real Chronos accounts — see CONSTITUTION.md §5.1.1 for the source of truth.
const SEED_USERS: SeedUser[] = [
  { email: 'direktor@idss.ba', fullName: 'Davor Mulalić (Direktor)', role: 'SUPER_ADMIN', institution: 'BOTH' },
  { email: 'info-mejtas@montessorihouse.ba', fullName: 'Azra Morić (Office Manager)', role: 'STANDARD_USER', institution: 'MONTESSORI' },
  { email: 'pedagog@idss.ba', fullName: 'Adnana Agić (Pedagog IDSS)', role: 'STANDARD_USER', institution: 'IDSS' },
  { email: 'info@idss.ba', fullName: 'Anesa Karaman (Sekretar)', role: 'STANDARD_USER', institution: 'BOTH' },
  { email: 'financije@idss.ba', fullName: 'Azra Rahmanović (Finansijsko-administrativni saradnik)', role: 'STANDARD_USER', institution: 'BOTH' },
  { email: 'amina.habul@outlook.com', fullName: 'Amina Habul (Pedagog IMH)', role: 'STANDARD_USER', institution: 'MONTESSORI' },
  { email: 'arminah98@hotmail.com', fullName: 'Armina Huremović (Pedagog/Odgajatelj IMH)', role: 'STANDARD_USER', institution: 'MONTESSORI' },
];

// Placeholder accounts created during initial Sprint 01 wiring, before the
// real user roster was confirmed. Removed on every seed run.
const OBSOLETE_EMAILS = ['sekretar@idss.ba', 'racunovodstvo@idss.ba'];

function generatePassword(): string {
  return randomBytes(12).toString('base64url'); // ~16 chars, URL-safe
}

async function main() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey || serviceRoleKey === 'PASTE_SERVICE_ROLE_KEY_HERE') {
    console.error(
      'SUPABASE_URL and a real SUPABASE_SERVICE_ROLE_KEY must be set in .env before seeding.\n' +
      'Get the service role key from: Supabase Dashboard → Project Settings → API.'
    );
    process.exit(1);
  }

  const supabase = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1. Clean up obsolete placeholder accounts from the initial Sprint 01 wiring.
  // NOTE: narrow via direct property access on `listUsersResult` (not a
  // renamed destructure) — supabase-js's correlated `{data, error}` union
  // types `data.users` as `[]` on the error branch, which TS only resolves
  // correctly when narrowing on the same property path.
  const listUsersResult = await supabase.auth.admin.listUsers({ perPage: 200 });
  if (listUsersResult.error) {
    console.error('Failed to list existing users:', listUsersResult.error.message);
    process.exit(1);
  }
  const existingUsers: Array<{ id: string; email?: string }> = listUsersResult.data.users;

  for (const email of OBSOLETE_EMAILS) {
    const match = existingUsers.find((u) => u.email === email);
    if (match) {
      const { error: deleteError } = await supabase.auth.admin.deleteUser(match.id);
      if (deleteError) {
        console.error(`Failed to delete obsolete user ${email}:`, deleteError.message);
      } else {
        console.log(`Removed obsolete placeholder account: ${email}`);
      }
    }
  }

  // 2. Create or update the real user roster.
  const created: { email: string; password: string }[] = [];
  const updated: string[] = [];

  for (const seedUser of SEED_USERS) {
    const existing = existingUsers.find((u) => u.email === seedUser.email);

    let userId: string;

    if (existing) {
      userId = existing.id;
      updated.push(seedUser.email);
    } else {
      const password = generatePassword();
      const { data, error } = await supabase.auth.admin.createUser({
        email: seedUser.email,
        password,
        email_confirm: true,
      });

      if (error || !data.user) {
        console.error(`Failed to create ${seedUser.email}:`, error?.message);
        continue;
      }

      userId = data.user.id;
      created.push({ email: seedUser.email, password });
    }

    const { error: profileError } = await supabase.from('profiles').upsert({
      id: userId,
      full_name: seedUser.fullName,
      role: seedUser.role,
      institution: seedUser.institution,
    });

    if (profileError) {
      console.error(`Failed to upsert profile for ${seedUser.email}:`, profileError.message);
    }
  }

  console.log('\n=== Chronos seed rezultat ===\n');
  if (updated.length > 0) {
    console.log('Već postojeći nalozi (samo profil ažuriran, lozinka nepromijenjena):');
    updated.forEach((email) => console.log(`  ${email}`));
  }
  if (created.length > 0) {
    console.log('\nNOVI nalozi — SAČUVAJTE OVE LOZINKE, prikazuju se samo jednom:\n');
    created.forEach((r) => console.log(`  ${r.email.padEnd(35)} lozinka: ${r.password}`));
  }
  console.log('\n==============================\n');
}

main().catch((err) => {
  console.error('[seed-users] unexpected error:', err);
  process.exit(1);
});
