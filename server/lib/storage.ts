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

/** Magic-byte signatures for each allowed type — the client-declared MIME
 * type (from the multipart Content-Type field) is otherwise just whatever
 * the uploader's browser/script claims, so without this a file's *actual*
 * bytes never have to match what it says it is (e.g. HTML content uploaded
 * declaring `image/png`, which Storage then serves back with a PNG
 * Content-Type header). */
function matchesMagicBytes(mimeType: string, buffer: Buffer): boolean {
  const bytes = (...expected: number[]) => expected.every((b, i) => buffer[i] === b);

  switch (mimeType) {
    case 'application/pdf':
      return bytes(0x25, 0x50, 0x44, 0x46, 0x2d); // %PDF-
    case 'image/jpeg':
      return bytes(0xff, 0xd8, 0xff);
    case 'image/png':
      return bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
    case 'application/msword':
      return bytes(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1); // OLE2
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      return bytes(0x50, 0x4b, 0x03, 0x04) || bytes(0x50, 0x4b, 0x05, 0x06) || bytes(0x50, 0x4b, 0x07, 0x08); // ZIP/OOXML
    default:
      return false;
  }
}

export function validateAttachmentFile(mimeType: string, sizeBytes: number, buffer?: Buffer): string | null {
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    return 'Nepodržan tip fajla. Dozvoljeno: PDF, DOCX, DOC, JPEG, PNG.';
  }
  if (sizeBytes > MAX_FILE_SIZE_BYTES) {
    return 'Priložena datoteka premašuje maksimalni limit od 10MB.';
  }
  if (buffer && !matchesMagicBytes(mimeType, buffer)) {
    return 'Sadržaj fajla ne odgovara prijavljenom tipu (fajl je oštećen ili je tip pogrešno prijavljen).';
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
