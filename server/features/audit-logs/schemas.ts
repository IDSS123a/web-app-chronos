/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { z } from 'zod';

// Restricted to login/logout style events — the client cannot report an
// arbitrary user_id/username (always stamped server-side from the verified
// session), which is what keeps this endpoint from being an audit-log
// injection backdoor.
export const AuditLogCreateSchema = z.object({
  action_type: z.enum(['IZMJENA']),
  target_table: z.enum(['Users']),
  target_id: z.string().min(1),
  changes: z.string().min(1),
});

export interface AuditLogCreateInput {
  action_type: 'IZMJENA';
  target_table: 'Users';
  target_id: string;
  changes: string;
}
