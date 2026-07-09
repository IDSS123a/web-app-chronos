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
| 02 | Obligations API & Server-side Audit | CRUD kroz pravi backend, server-side audit log, RBAC enforcement | DONE |
| 03 | Vidljivost obaveza (Watchers) | Kreator bira ko vidi obavezu; zaštita finansijski osjetljivih podataka; IDSS/IMH logotipi | DONE |
| 04 | File Attachments | Supabase Storage upload/download, validacija | DONE |
| 05 | Real Time | Ukloniti hardkodovani "danas", ispravka bs-BA Intl locale bug-a | DONE |
| 06 | Real Email Reminders | Resend integracija, `node-cron` 08:00 job | DONE |
| 07 | Calendar, Print & UX Polish | Kalendar/print prema real API-ju, mobile provjera | TODO |
| 08 | Deployment | Render/hosting, env varijable, RLS hardening, Sentry | TODO |
| 09+ | Backlog / Nice-to-have | Vidi ispod | TODO |

**Napomena o renumeraciji (2026-07-09):** Sprint 03 je originalno bio planiran
kao "File Attachments", ali je zamijenjen hitnijim sigurnosnim zahtjevom
(vidljivost finansijski osjetljivih obaveza) po Commander Decision Hierarchy
(Security/Data Integrity > UI). File Attachments je pomjeren na Sprint 04, a
svi naredni sprintovi pomjereni za jedno mjesto.

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
- `server/features/obligations/repository.ts` + `domain.ts` — uključuje kompletnu poslovnu logiku prenesenu 1:1 iz `App.tsx` (uključujući recurring cycle kreiranje pri završetku ponavljajuće obaveze — Commander M-11 Refactoring Boundary: isto ponašanje, bolja struktura)
- RBAC vlasništvo: `STANDARD_USER` smije uređivati/završavati/brisati-checklist-stavku samo na obavezama gdje je `created_by === currentUser.id`; `SUPER_ADMIN` bez ograničenja (CONSTITUTION.md §5.1)
- Zod validacija na svakoj ruti (`server/features/obligations/schemas.ts`)
- Audit log se piše isključivo server-side (uklanja se client-side audit-log logika iz `App.tsx`)
- Frontend: `Dashboard`, `ObligationForm` prebačeni sa `localStorage` na `/api/obligations`
- Undo toast ostaje, ali radi nad stvarnim API pozivima

## SPRINT 03 — Vidljivost obaveza (Watchers)

- `obligation_watchers` tabela (many-to-many `obligation_id` ↔ `user_id`)
- `server/features/obligations/repository.ts` — `getVisibleObligations()` filtrira po ulozi (SUPER_ADMIN=sve, STANDARD_USER=svoje+watcher)
- `server/features/users` — novi `GET /api/users` endpoint (id/ime/uloga, za watcher picker)
- `ObligationForm` — multi-select "Ko može vidjeti ovu obavezu" (default: prazno, samo kreator+admin)
- Recurring ciklus nasljeđuje watchers listu originalne obaveze
- IDSS i IMH logotipi dodani na Login stranicu i bočnu traku (zamjena "C" placeholder monograma)

## SPRINT 04 — File Attachments

- Supabase Storage bucket `obligation-attachments` + RLS
- Upload endpoint sa MIME/veličina validacijom (server-side, ne samo client-side kao sada)
- `ObligationForm` drag&drop povezan na stvarni upload
- Uklanjanje mock `drive.google.com` linkova

## SPRINT 05 — Real Time (uklanjanje hardkodovanog "danas") — DONE

- Uklanjanje hardkodovanog `'2026-07-02'` kao "danas" kroz cijelu aplikaciju (Dashboard filteri/statistika, CalendarView, cron simulator)
- Nova `src/lib/date-utils.ts` — jedinstveni izvor istine za "danas" i bosansko formatiranje datuma
- Usput ispravljen bs-BA Intl locale bug (postojao od originalnog koda)
- Server-side vremenska zona (Europe/Sarajevo) za pravi cron ostaje za Sprint 06

## SPRINT 06 — Real Email Reminders

- Resend integracija (`server/lib/resend.ts`)
- `node-cron` job u 08:00 (Europe/Sarajevo) koji poziva reminder domain logiku
- HTML email template (zadržati postojeći dizajn iz `App.tsx` cron simulatora kao osnovu)
- SUPER_ADMIN ruta za ručno okidanje (test) koja poziva istu logiku kao cron

## SPRINT 07 — Calendar, Print & UX Polish

- `CalendarView` i `PrintTemplate` povezani na real API podatke
- Provjera svih ekrana na mobilnom viewport-u (Commander FEATURE_LIFECYCLE Step 5)
- Loading/empty/error stanja za sve async akcije (Commander DONE_CHECKLIST)

## SPRINT 08 — Deployment

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
