/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { HttpError } from '../../lib/errors';
import { canManageUsers } from '../../lib/permissions';
import { CreateUserSchema, UpdateUserSchema, CalendarImportSchema, type CreateUserInput, type UpdateUserInput, type CalendarImportInput } from './schemas';
import * as domain from './domain';
import { getAllUserSummaries } from '../users/repository';

export const adminRouter = Router();
adminRouter.use(requireAuth);

adminRouter.use((req, res, next) => {
  if (!canManageUsers(req.profile!.role)) {
    res.status(403).json({ success: false, error: 'Samo Super Admin ima pristup administratorskom panelu.' });
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

// --- Users ---

adminRouter.get('/users', async (_req, res) => {
  try {
    res.json({ success: true, data: await domain.listUsers() });
  } catch (err) {
    handleError(err, res, 'Greška pri učitavanju korisnika.');
  }
});

adminRouter.post('/users', async (req, res) => {
  const parsed = CreateUserSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ success: false, error: parsed.error.issues[0]?.message ?? 'Neispravan unos.' });
    return;
  }
  try {
    const result = await domain.createUser(parsed.data as CreateUserInput, req.profile!);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    handleError(err, res, 'Greška pri kreiranju korisnika.');
  }
});

adminRouter.patch('/users/:id', async (req, res) => {
  const parsed = UpdateUserSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ success: false, error: parsed.error.issues[0]?.message ?? 'Neispravan unos.' });
    return;
  }
  try {
    await domain.updateUser(req.params.id, parsed.data as UpdateUserInput, req.profile!);
    res.json({ success: true, data: null });
  } catch (err) {
    handleError(err, res, 'Greška pri izmjeni korisnika.');
  }
});

adminRouter.post('/users/:id/ban', async (req, res) => {
  try {
    await domain.setUserBanned(req.params.id, true, req.profile!);
    res.json({ success: true, data: null });
  } catch (err) {
    handleError(err, res, 'Greška pri blokiranju korisnika.');
  }
});

adminRouter.post('/users/:id/unban', async (req, res) => {
  try {
    await domain.setUserBanned(req.params.id, false, req.profile!);
    res.json({ success: true, data: null });
  } catch (err) {
    handleError(err, res, 'Greška pri deblokiranju korisnika.');
  }
});

adminRouter.delete('/users/:id', async (req, res) => {
  try {
    const result = await domain.deleteUser(req.params.id, req.profile!);
    if (!result.deleted) {
      res.status(409).json({
        success: false,
        error: 'Nalog se ne može trajno obrisati jer ima institucionalni trag (obaveze/dnevnik aktivnosti). Blokirajte nalog umjesto brisanja.',
        blockers: result.blockers,
      });
      return;
    }
    res.json({ success: true, data: null });
  } catch (err) {
    handleError(err, res, 'Greška pri brisanju korisnika.');
  }
});

adminRouter.get('/users/:id/activity', async (req, res) => {
  try {
    res.json({ success: true, data: await domain.getUserActivity(req.params.id) });
  } catch (err) {
    handleError(err, res, 'Greška pri učitavanju aktivnosti korisnika.');
  }
});

// --- Stats ---

adminRouter.get('/stats', async (_req, res) => {
  try {
    res.json({ success: true, data: await domain.getSystemStats() });
  } catch (err) {
    handleError(err, res, 'Greška pri učitavanju statistike.');
  }
});

// --- Bulk calendar import ---

adminRouter.post('/calendar-import', async (req, res) => {
  const parsed = CalendarImportSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ success: false, error: parsed.error.issues[0]?.message ?? 'Neispravan unos.' });
    return;
  }
  try {
    const allStaff = await getAllUserSummaries();
    const allStaffIds = allStaff.filter((u) => u.role !== 'SUPER_ADMIN').map((u) => u.id);
    const result = await domain.importCalendar(parsed.data as CalendarImportInput, req.profile!, allStaffIds);
    res.json({ success: true, data: result });
  } catch (err) {
    handleError(err, res, 'Greška pri uvozu kalendara.');
  }
});
