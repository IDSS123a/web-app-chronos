/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Single place that knows about `/api/*` routes (Commander M-7).
 */

import { supabase } from './supabase-browser';
import type { User, Obligation, AuditLog, ChecklistItem, UserSummary, NotificationGroup, NotificationSchedule, NotificationLogEntry } from '../types';

interface ApiSuccess<T> {
  success: true;
  data: T;
}
interface ApiFailure {
  success: false;
  error: string;
}
type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

async function authorizedFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;

  const headers = new Headers(options.headers);
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  // FormData sets its own multipart boundary — never override its Content-Type.
  if (options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  return fetch(url, { ...options, headers });
}

async function parseResponse<T>(response: Response): Promise<T> {
  const body = (await response.json()) as ApiResponse<T>;
  if (body.success === false) {
    throw new Error(body.error || 'Greška servera.');
  }
  return body.data;
}

/**
 * Fetch the Chronos profile (role, institution, full name) for the
 * currently authenticated Supabase session by calling the Express backend.
 * Returns null if there is no active session.
 */
export async function fetchCurrentUser(): Promise<User | null> {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) return null;

  const response = await authorizedFetch('/api/auth/me');
  if (!response.ok) return null;

  const body = (await response.json()) as ApiResponse<{
    id: string;
    username: string;
    fullName: string;
    role: User['role'];
    institution: User['institution'];
  }>;
  if (!body.success) return null;

  return {
    id: body.data.id,
    username: body.data.username,
    fullName: body.data.fullName,
    role: body.data.role,
    institution: body.data.institution,
  };
}

/** Records a login/logout event in the server-side audit log. */
export async function logUserAction(targetUserId: string, changes: string): Promise<void> {
  const response = await authorizedFetch('/api/audit-logs', {
    method: 'POST',
    body: JSON.stringify({
      action_type: 'IZMJENA',
      target_table: 'Users',
      target_id: targetUserId,
      changes,
    }),
  });
  await parseResponse<AuditLog>(response);
}

export async function fetchObligations(): Promise<Obligation[]> {
  const response = await authorizedFetch('/api/obligations');
  return parseResponse<Obligation[]>(response);
}

// NOTE: no attachment_url/attachment_name — attachments are uploaded
// separately via uploadObligationAttachment() once the obligation exists.
export interface ObligationPayload {
  title: string;
  institution: Obligation['institution'];
  category: string;
  due_date: string;
  responsible_person: string;
  priority: Obligation['priority'];
  checklist_items: ChecklistItem[];
  is_recurring: boolean;
  recurring_interval: Obligation['recurring_interval'];
  watcher_ids: string[];
}

/** Colleague roster for the "who can see this obligation" picker (CONSTITUTION.md §5.7). */
export async function fetchUsers(): Promise<UserSummary[]> {
  const response = await authorizedFetch('/api/users');
  return parseResponse<UserSummary[]>(response);
}

export async function createObligation(payload: ObligationPayload): Promise<Obligation> {
  const response = await authorizedFetch('/api/obligations', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return parseResponse<Obligation>(response);
}

export async function updateObligation(id: string, payload: Partial<ObligationPayload>): Promise<Obligation> {
  const response = await authorizedFetch(`/api/obligations/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  return parseResponse<Obligation>(response);
}

export async function deleteObligation(id: string): Promise<void> {
  const response = await authorizedFetch(`/api/obligations/${id}`, { method: 'DELETE' });
  await parseResponse<null>(response);
}

export interface ToggleStatusResult {
  obligation: Obligation;
  nextCycle: Obligation | null;
}

export async function toggleObligationStatus(id: string): Promise<ToggleStatusResult> {
  const response = await authorizedFetch(`/api/obligations/${id}/toggle-status`, { method: 'POST' });
  return parseResponse<ToggleStatusResult>(response);
}

export async function toggleChecklistItem(id: string, itemIndex: number): Promise<Obligation> {
  const response = await authorizedFetch(`/api/obligations/${id}/checklist/${itemIndex}`, { method: 'PATCH' });
  return parseResponse<Obligation>(response);
}

/** Uploads (or replaces) the attachment for an obligation. */
export async function uploadObligationAttachment(id: string, file: File): Promise<Obligation> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await authorizedFetch(`/api/obligations/${id}/attachment`, {
    method: 'POST',
    body: formData,
  });
  return parseResponse<Obligation>(response);
}

export async function deleteObligationAttachment(id: string): Promise<Obligation> {
  const response = await authorizedFetch(`/api/obligations/${id}/attachment`, { method: 'DELETE' });
  return parseResponse<Obligation>(response);
}

export async function fetchAuditLogs(): Promise<AuditLog[]> {
  const response = await authorizedFetch('/api/audit-logs');
  return parseResponse<AuditLog[]>(response);
}

export async function clearAuditLogs(): Promise<void> {
  const response = await authorizedFetch('/api/audit-logs', { method: 'DELETE' });
  await parseResponse<null>(response);
}

export interface ReminderScanResult {
  scannedCount: number;
  triggeredCount: number;
  emailsSent: number;
  errors: string[];
}

/** SUPER_ADMIN-only manual trigger for the daily reminder scan (Sprint 06). */
export async function runReminderScan(): Promise<ReminderScanResult> {
  const response = await authorizedFetch('/api/reminders/run', { method: 'POST' });
  return parseResponse<ReminderScanResult>(response);
}

// --- Interni notifikacioni sistem (Sprint 09) — sve rute SUPER_ADMIN-only ---

export interface NotificationGroupPayload {
  name: string;
  member_ids: string[];
}

export async function fetchNotificationGroups(): Promise<NotificationGroup[]> {
  const response = await authorizedFetch('/api/notifications/groups');
  return parseResponse<NotificationGroup[]>(response);
}

export async function createNotificationGroup(payload: NotificationGroupPayload): Promise<NotificationGroup> {
  const response = await authorizedFetch('/api/notifications/groups', { method: 'POST', body: JSON.stringify(payload) });
  return parseResponse<NotificationGroup>(response);
}

export async function updateNotificationGroup(id: string, payload: Partial<NotificationGroupPayload>): Promise<NotificationGroup> {
  const response = await authorizedFetch(`/api/notifications/groups/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
  return parseResponse<NotificationGroup>(response);
}

export async function deleteNotificationGroup(id: string): Promise<void> {
  const response = await authorizedFetch(`/api/notifications/groups/${id}`, { method: 'DELETE' });
  await parseResponse<null>(response);
}

export interface NotificationSchedulePayload {
  name: string;
  report_type: 'DNEVNI_PREGLED';
  group_id: string;
  send_time: string;
  enabled: boolean;
}

export async function fetchNotificationSchedules(): Promise<NotificationSchedule[]> {
  const response = await authorizedFetch('/api/notifications/schedules');
  return parseResponse<NotificationSchedule[]>(response);
}

export async function createNotificationSchedule(payload: NotificationSchedulePayload): Promise<NotificationSchedule> {
  const response = await authorizedFetch('/api/notifications/schedules', { method: 'POST', body: JSON.stringify(payload) });
  return parseResponse<NotificationSchedule>(response);
}

export async function updateNotificationSchedule(id: string, payload: Partial<NotificationSchedulePayload>): Promise<NotificationSchedule> {
  const response = await authorizedFetch(`/api/notifications/schedules/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
  return parseResponse<NotificationSchedule>(response);
}

export async function deleteNotificationSchedule(id: string): Promise<void> {
  const response = await authorizedFetch(`/api/notifications/schedules/${id}`, { method: 'DELETE' });
  await parseResponse<null>(response);
}

export interface ManualSendPayload {
  subject: string;
  body: string;
  group_ids: string[];
  user_ids: string[];
}

export interface ManualSendResult {
  recipientCount: number;
  status: 'SUCCESS' | 'PARTIAL' | 'FAILED';
}

export async function sendManualNotification(payload: ManualSendPayload): Promise<ManualSendResult> {
  const response = await authorizedFetch('/api/notifications/send', { method: 'POST', body: JSON.stringify(payload) });
  return parseResponse<ManualSendResult>(response);
}

export async function fetchNotificationLog(): Promise<NotificationLogEntry[]> {
  const response = await authorizedFetch('/api/notifications/log');
  return parseResponse<NotificationLogEntry[]>(response);
}
