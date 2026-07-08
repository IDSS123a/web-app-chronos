# FEATURE_BACKLOG.md — Chronos
# Kompletan backlog i sprint mapa

---

> Status vrijednosti: `TODO`, `IN_PROGRESS`, `DONE`.
> Ovaj dokument se ažurira na kraju svakog sprinta (Commander FEATURE_LIFECYCLE Step 6).

---

## Sprint mapa (pregled)

| Sprint | Naziv | Fokus | Status |
|---|---|---|---|
| 01 | Backend & Database Foundation | Supabase projekat, šema, Express scaffold, real Auth | DONE |
| 02 | Obligations API & Server-side Audit | CRUD kroz pravi backend, server-side audit log, RBAC enforcement | TODO |
| 03 | File Attachments | Supabase Storage upload/download, validacija | TODO |
| 04 | Recurring Engine & Real Time | Ukloniti hardkodovani "danas", server-side recurring logika | TODO |
| 05 | Real Email Reminders | Resend integracija, `node-cron` 08:00 job | TODO |
| 06 | Calendar, Print & UX Polish | Kalendar/print prema real API-ju, mobile provjera | TODO |
| 07 | Deployment | Render/hosting, env varijable, RLS hardening, Sentry | TODO |
| 08+ | Backlog / Nice-to-have | Vidi ispod | TODO |

Svaki sprint = jedan fokusiran razgovor sa ACA (Commander M-13). Detaljan
opseg svakog sprinta piše se u `sprints/SPRINT_XX.md` neposredno prije
početka tog sprinta (ne unaprijed za sve sprintove — opseg se precizira na
osnovu onoga što je stvarno završeno u prethodnom).

---

## SPRINT 01 — Backend & Database Foundation

**Cilj:** Postaviti stvarni backend i bazu; zamijeniti mock login pravim.

- Kreirati novi Supabase projekat (organizacija IDSS123a)
- SQL migracija: `profiles`, `obligations`, `audit_logs` tabele + RLS politike
- Express + TypeScript server scaffold (`server/`) prema folder strukturi iz CONSTITUTION.md
- Supabase Auth: registracija/login sa email+lozinka, zamjena `Login.tsx` mock logike
- `server/lib/permissions.ts` — RBAC single source of truth
- Seed skripta koja ubacuje 3 postojeća korisnika (direktor, sekretar, računovodstvo) kao stvarne Supabase Auth naloge

## SPRINT 02 — Obligations API & Server-side Audit

- REST rute: `GET/POST/PATCH/DELETE /api/obligations`, toggle status, toggle checklist item
- `server/features/obligations/repository.ts` + `domain.ts`
- Audit log se piše isključivo server-side (uklanja se client-side `handleFormSubmit` logika za log)
- Frontend: `Dashboard`, `ObligationForm` prebačeni sa `localStorage` na `/api/obligations`
- Undo toast ostaje, ali radi nad stvarnim API pozivima

## SPRINT 03 — File Attachments

- Supabase Storage bucket `obligation-attachments` + RLS
- Upload endpoint sa MIME/veličina validacijom (server-side, ne samo client-side kao sada)
- `ObligationForm` drag&drop povezan na stvarni upload
- Uklanjanje mock `drive.google.com` linkova

## SPRINT 04 — Recurring Engine & Real Time

- Uklanjanje hardkodovanog `'2026-07-02'` kao "danas" kroz cijelu aplikaciju
- Recurring cycle kreiranje logika premještena u `server/features/obligations/domain.ts`
- Provjera vremenske zone (Europe/Sarajevo)

## SPRINT 05 — Real Email Reminders

- Resend integracija (`server/lib/resend.ts`)
- `node-cron` job u 08:00 (Europe/Sarajevo) koji poziva reminder domain logiku
- HTML email template (zadržati postojeći dizajn iz `App.tsx` cron simulatora kao osnovu)
- SUPER_ADMIN ruta za ručno okidanje (test) koja poziva istu logiku kao cron

## SPRINT 06 — Calendar, Print & UX Polish

- `CalendarView` i `PrintTemplate` povezani na real API podatke
- Provjera svih ekrana na mobilnom viewport-u (Commander FEATURE_LIFECYCLE Step 5)
- Loading/empty/error stanja za sve async akcije (Commander DONE_CHECKLIST)

## SPRINT 07 — Deployment

- Render (ili odabrani host) deployment jednog Node servisa
- `.env` production varijable, Resend domain verifikacija
- RLS hardening review (security-review prompt iz Commander PROMPT_LIBRARY)
- Sentry error tracking (Commander E-8)

---

## Backlog — van trenutnog opsega (ne implementirati bez eksplicitnog zahtjeva)

- AI/Gemini funkcionalnosti (npr. pametno kreiranje obaveza iz prirodnog jezika, OCR priloga)
- Google Drive OAuth integracija umjesto Supabase Storage (vidi DECISION_LOG CD-005)
- Višejezičnost (engleski/njemački pored bosanskog)
- Push notifikacije / mobilna aplikacija
- Izvještaji i napredna analitika

---

*Chronos v1.0 — IDSS123a Organisation*
