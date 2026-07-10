/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../../middleware/auth';
import { HttpError } from '../../lib/errors';
import { validateAttachmentFile } from '../../lib/storage';
import { ObligationCreateSchema, ObligationUpdateSchema, type ObligationCreateInput, type ObligationUpdateInput } from './schemas';
import * as repo from './repository';
import * as domain from './domain';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

export const obligationsRouter = Router();
obligationsRouter.use(requireAuth);

function handleDomainError(err: unknown, res: import('express').Response, fallbackMessage: string): void {
  if (err instanceof HttpError) {
    res.status(err.statusCode).json({ success: false, error: err.message });
    return;
  }
  console.error(fallbackMessage, err);
  res.status(500).json({ success: false, error: fallbackMessage });
}

/**
 * GET /api/obligations
 * Role required: any authenticated user
 * Response: { success: true, data: Obligation[] }
 * SUPER_ADMIN sees everything; STANDARD_USER sees obligations they created
 * plus ones they're an explicit watcher on (CONSTITUTION.md §5.7).
 */
obligationsRouter.get('/', async (req, res) => {
  try {
    const obligations = await repo.getVisibleObligations(req.profile!);
    res.json({ success: true, data: obligations });
  } catch (err) {
    handleDomainError(err, res, 'Greška pri učitavanju obaveza.');
  }
});

/**
 * POST /api/obligations
 * Role required: any authenticated user
 * Body: ObligationCreateSchema
 * Response: { success: true, data: Obligation }
 * Errors: 401, 422 (validation), 500
 */
obligationsRouter.post('/', async (req, res) => {
  const parsed = ObligationCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ success: false, error: parsed.error.issues[0]?.message ?? 'Neispravan unos.' });
    return;
  }

  try {
    // Cast bridges a Zod type-inference quirk — see schemas.ts note. The
    // shape is already runtime-validated by safeParse above.
    const obligation = await domain.createObligation(parsed.data as ObligationCreateInput, req.profile!);
    res.status(201).json({ success: true, data: obligation });
  } catch (err) {
    handleDomainError(err, res, 'Greška pri kreiranju obaveze.');
  }
});

/**
 * PATCH /api/obligations/:id
 * Role required: SUPER_ADMIN (any), STANDARD_USER (own obligations only)
 * Body: ObligationUpdateSchema
 * Response: { success: true, data: Obligation }
 * Errors: 401, 403 (not owner), 404, 422 (validation), 500
 */
obligationsRouter.patch('/:id', async (req, res) => {
  const parsed = ObligationUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ success: false, error: parsed.error.issues[0]?.message ?? 'Neispravan unos.' });
    return;
  }

  try {
    // Cast bridges a Zod type-inference quirk — see schemas.ts note. The
    // shape is already runtime-validated by safeParse above.
    const updated = await domain.updateObligationWithAudit(
      req.params.id,
      parsed.data as ObligationUpdateInput,
      req.profile!
    );
    res.json({ success: true, data: updated });
  } catch (err) {
    handleDomainError(err, res, 'Greška pri izmjeni obaveze.');
  }
});

/**
 * DELETE /api/obligations/:id
 * Role required: SUPER_ADMIN
 * Response: { success: true, data: null }
 * Errors: 401, 403, 404, 500
 */
obligationsRouter.delete('/:id', async (req, res) => {
  try {
    await domain.deleteObligationWithAudit(req.params.id, req.profile!);
    res.json({ success: true, data: null });
  } catch (err) {
    handleDomainError(err, res, 'Greška pri brisanju obaveze.');
  }
});

/**
 * POST /api/obligations/:id/toggle-status
 * Role required: SUPER_ADMIN (any), STANDARD_USER (own obligations only)
 * Response: { success: true, data: { obligation: Obligation, nextCycle: Obligation | null } }
 * Errors: 401, 403, 404, 500
 */
obligationsRouter.post('/:id/toggle-status', async (req, res) => {
  try {
    const result = await domain.toggleObligationStatus(req.params.id, req.profile!);
    res.json({ success: true, data: result });
  } catch (err) {
    handleDomainError(err, res, 'Greška pri promjeni statusa.');
  }
});

/**
 * PATCH /api/obligations/:id/checklist/:itemIndex
 * Role required: SUPER_ADMIN (any), STANDARD_USER (own obligations only)
 * Response: { success: true, data: Obligation }
 * Errors: 401, 403, 404, 422 (bad index), 500
 */
obligationsRouter.patch('/:id/checklist/:itemIndex', async (req, res) => {
  const itemIndex = Number(req.params.itemIndex);
  if (!Number.isInteger(itemIndex) || itemIndex < 0) {
    res.status(422).json({ success: false, error: 'Neispravan indeks stavke.' });
    return;
  }

  try {
    const updated = await domain.toggleChecklistItem(req.params.id, itemIndex, req.profile!);
    res.json({ success: true, data: updated });
  } catch (err) {
    handleDomainError(err, res, 'Greška pri izmjeni kontrolne liste.');
  }
});

/**
 * POST /api/obligations/:id/attachment
 * Role required: SUPER_ADMIN (any), STANDARD_USER (own obligations only)
 * Body: multipart/form-data, field name "file" (PDF/DOC/DOCX/JPEG/PNG, max 10MB)
 * Response: { success: true, data: Obligation }
 * Errors: 401, 403, 404, 413 (too large), 422 (bad file), 500
 */
function handleUploadMiddleware(req: import('express').Request, res: import('express').Response, next: import('express').NextFunction): void {
  upload.single('file')(req, res, (err: unknown) => {
    if (!err) {
      next();
      return;
    }
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({ success: false, error: 'Priložena datoteka premašuje maksimalni limit od 10MB.' });
      return;
    }
    console.error('[POST /:id/attachment] upload middleware error:', err);
    res.status(422).json({ success: false, error: 'Greška pri obradi priloga.' });
  });
}

obligationsRouter.post('/:id/attachment', handleUploadMiddleware, async (req, res) => {
  if (!req.file) {
    res.status(422).json({ success: false, error: 'Fajl nije priložen.' });
    return;
  }

  const validationError = validateAttachmentFile(req.file.mimetype, req.file.size, req.file.buffer);
  if (validationError) {
    res.status(422).json({ success: false, error: validationError });
    return;
  }

  try {
    const updated = await domain.setObligationAttachment(
      req.params.id,
      { originalname: req.file.originalname, buffer: req.file.buffer, mimetype: req.file.mimetype },
      req.profile!
    );
    res.json({ success: true, data: updated });
  } catch (err) {
    handleDomainError(err, res, 'Greška pri otpremanju priloga.');
  }
});

/**
 * DELETE /api/obligations/:id/attachment
 * Role required: SUPER_ADMIN (any), STANDARD_USER (own obligations only)
 * Response: { success: true, data: Obligation }
 * Errors: 401, 403, 404, 500
 */
obligationsRouter.delete('/:id/attachment', async (req, res) => {
  try {
    const updated = await domain.removeObligationAttachment(req.params.id, req.profile!);
    res.json({ success: true, data: updated });
  } catch (err) {
    handleDomainError(err, res, 'Greška pri brisanju priloga.');
  }
});
