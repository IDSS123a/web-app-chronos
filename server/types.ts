/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { UserRole, InstitutionType } from '../src/types';

/** Chronos profile attached to `req.profile` by the auth middleware. */
export interface AuthenticatedProfile {
  id: string;
  username: string; // email, from auth.users
  fullName: string;
  role: UserRole;
  institution: InstitutionType | 'BOTH' | null;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      profile?: AuthenticatedProfile;
    }
  }
}

export {};
