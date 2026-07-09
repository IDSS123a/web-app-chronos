/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Resend } from 'resend';

let cachedClient: Resend | null = null;

function getResendClient(): Resend {
  if (cachedClient) return cachedClient;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('RESEND_API_KEY must be set in .env before sending email.');
  }

  cachedClient = new Resend(apiKey);
  return cachedClient;
}

export interface SendEmailInput {
  to: string[];
  subject: string;
  html: string;
}

/** Sends one email via Resend. Throws on failure — callers decide how to handle it. */
export async function sendEmail(input: SendEmailInput): Promise<void> {
  const client = getResendClient();
  const from = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

  const { error } = await client.emails.send({
    from: `Chronos - IDSS & IMH <${from}>`,
    to: input.to,
    subject: input.subject,
    html: input.html,
  });

  if (error) {
    throw new Error(`sendEmail failed: ${error.message}`);
  }
}
