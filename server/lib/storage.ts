/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { getSupabaseServerClient } from './supabase-server';

const BUCKET = 'obligation-attachments';
const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
]);

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB, matches bucket config

export function validateAttachmentFile(mimeType: string, sizeBytes: number): string | null {
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    return 'Nepodržan tip fajla. Dozvoljeno: PDF, DOCX, DOC, JPEG, PNG.';
  }
  if (sizeBytes > MAX_FILE_SIZE_BYTES) {
    return 'Priložena datoteka premašuje maksimalni limit od 10MB.';
  }
  return null;
}

/** Uploads a file buffer and returns the storage path (not a public URL). */
export async function uploadAttachment(
  obligationId: string,
  originalFilename: string,
  fileBuffer: Buffer,
  mimeType: string
): Promise<string> {
  const supabase = getSupabaseServerClient();
  const path = `${obligationId}/${Date.now()}_${sanitizeFilename(originalFilename)}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, fileBuffer, {
    contentType: mimeType,
    upsert: false,
  });

  if (error) throw new Error(`uploadAttachment failed: ${error.message}`);
  return path;
}

export async function deleteAttachment(path: string): Promise<void> {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) throw new Error(`deleteAttachment failed: ${error.message}`);
}

/** Generates a short-lived signed URL for reading a stored attachment. */
export async function getSignedAttachmentUrl(path: string): Promise<string | null> {
  if (!path) return null;
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);

  if (error) {
    console.error('[getSignedAttachmentUrl] failed:', error.message);
    return null;
  }
  return data.signedUrl;
}

function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-100);
}
