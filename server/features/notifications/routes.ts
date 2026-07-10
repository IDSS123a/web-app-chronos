/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { HttpError } from '../../lib/errors';
import { canManageNotifications } from '../../lib/permissions';
import {
  NotificationGroupSchema,
  NotificationScheduleSchema,
  NotificationScheduleUpdateSchema,
  ManualSendSchema,
  type NotificationGroupInput,
  type NotificationScheduleInput,
  type NotificationScheduleUpdateInput,
  type ManualSendInput,
} from './schemas';
import * as repo from './repository';
import * as domain from './domain';

export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);

// Every route in this feature is SUPER_ADMIN-only in v1 (CONSTITUTION.md §5.8).
notificationsRouter.use((req, res, next) => {
  if (!canManageNotifications(req.profile!.role)) {
    res.status(403).json({ success: false, error: 'Samo Super Admin može upravljati notifikacijama.' });
    return;
  }
  next();
});

function handleError(err: unknown, res: import('express').Response, fallbackMessage: string): void {
  if (err instanceof HttpError) {
    res.status(err.statusCode).json({ success: false, error: err.message });
    return;
  }
  console.error(fallbackMessage, err);
  res.status(500).json({ success: false, error: fallbackMessage });
}

// --- Groups ---

notificationsRouter.get('/groups', async (_req, res) => {
  try {
    res.json({ success: true, data: await repo.getAllGroups() });
  } catch (err) {
    handleError(err, res, 'Greška pri učitavanju grupa.');
  }
});

notificationsRouter.post('/groups', async (req, res) => {
  const parsed = NotificationGroupSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ success: false, error: parsed.error.issues[0]?.message ?? 'Neispravan unos.' });
    return;
  }
  try {
    const group = await domain.createGroup(parsed.data as NotificationGroupInput, req.profile!);
    res.status(201).json({ success: true, data: group });
  } catch (err) {
    handleError(err, res, 'Greška pri kreiranju grupe.');
  }
});

notificationsRouter.patch('/groups/:id', async (req, res) => {
  const parsed = NotificationGroupSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ success: false, error: parsed.error.issues[0]?.message ?? 'Neispravan unos.' });
    return;
  }
  try {
    const group = await domain.updateGroup(req.params.id, parsed.data as Partial<NotificationGroupInput>, req.profile!);
    res.json({ success: true, data: group });
  } catch (err) {
    handleError(err, res, 'Greška pri izmjeni grupe.');
  }
});

notificationsRouter.delete('/groups/:id', async (req, res) => {
  try {
    await domain.deleteGroup(req.params.id, req.profile!);
    res.json({ success: true, data: null });
  } catch (err) {
    handleError(err, res, 'Greška pri brisanju grupe.');
  }
});

// --- Schedules ---

notificationsRouter.get('/schedules', async (_req, res) => {
  try {
    res.json({ success: true, data: await repo.getAllSchedules() });
  } catch (err) {
    handleError(err, res, 'Greška pri učitavanju rasporeda.');
  }
});

notificationsRouter.post('/schedules', async (req, res) => {
  const parsed = NotificationScheduleSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ success: false, error: parsed.error.issues[0]?.message ?? 'Neispravan unos.' });
    return;
  }
  try {
    const schedule = await domain.createSchedule(parsed.data as NotificationScheduleInput, req.profile!);
    res.status(201).json({ success: true, data: schedule });
  } catch (err) {
    handleError(err, res, 'Greška pri kreiranju rasporeda.');
  }
});

notificationsRouter.patch('/schedules/:id', async (req, res) => {
  const parsed = NotificationScheduleUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ success: false, error: parsed.error.issues[0]?.message ?? 'Neispravan unos.' });
    return;
  }
  try {
    const schedule = await domain.updateSchedule(req.params.id, parsed.data as NotificationScheduleUpdateInput, req.profile!);
    res.json({ success: true, data: schedule });
  } catch (err) {
    handleError(err, res, 'Greška pri izmjeni rasporeda.');
  }
});

notificationsRouter.delete('/schedules/:id', async (req, res) => {
  try {
    await domain.deleteSchedule(req.params.id, req.profile!);
    res.json({ success: true, data: null });
  } catch (err) {
    handleError(err, res, 'Greška pri brisanju rasporeda.');
  }
});

// --- Manual send ---

notificationsRouter.post('/send', async (req, res) => {
  const parsed = ManualSendSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ success: false, error: parsed.error.issues[0]?.message ?? 'Neispravan unos.' });
    return;
  }
  try {
    const result = await domain.sendManualNotification(parsed.data as ManualSendInput, req.profile!);
    res.json({ success: true, data: result });
  } catch (err) {
    handleError(err, res, 'Greška pri slanju obavijesti.');
  }
});

// --- Log ---

notificationsRouter.get('/log', async (_req, res) => {
  try {
    res.json({ success: true, data: await repo.getAllNotificationLogs() });
  } catch (err) {
    handleError(err, res, 'Greška pri učitavanju evidencije.');
  }
});
