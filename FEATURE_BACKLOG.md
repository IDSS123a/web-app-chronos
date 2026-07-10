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
| 07 | Calendar, Print & UX Polish | Kalendar/print prema real API-ju, mobile provjera | DONE |
| 08 | Deployment | Render/hosting, env varijable, RLS hardening, Sentry | DONE |
| 09 | Interni notifikacioni sistem | Grupe primalaca, zakazani izvještaji, ručno slanje, evidencija | DONE |
| 10+ | Backlog / Nice-to-have | Vidi ispod | TODO |

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

## SPRINT 07 — Calendar, Print & UX Polish — DONE

- `PrintTemplate` sada prima Dashboard-ove aktivne filtere (institucija,
  status, datumski raspon) umjesto da uvijek printa sve obaveze;
  `CalendarView` je real-API već bio od Sprint 05
- Provjera svih ekrana na mobilnom viewport-u (Commander FEATURE_LIFECYCLE
  Step 5) — bez blokirajućih problema
- Loading/empty/error stanja za sve async akcije (Commander DONE_CHECKLIST)
  — ObligationForm submit, Dashboard toggle-status/delete, AuditLogs clear
- Usput: ispravljen zastarjeli "Google Drive" tekst i netačna "30 dana"
  remember-me tvrdnja, oboje ostaci iz mock faze — vidi `sprints/SPRINT_07.md`

## SPRINT 08 — Deployment — DONE

- Render Blueprint (`render.yaml`) za jednog Node servisa (CD-006 potvrđen)
- `DEPLOYMENT.md` — vodič za produkcijske env varijable i Resend domain
  verifikaciju (korisnikovi ručni koraci)
- RLS hardening review (security-review prompt iz Commander PROMPT_LIBRARY)
  — vidi `sprints/SPRINT_08.md` za detalje šta je ispravljeno vs. potvrđeno
  kao već bezbjedno
- Sentry error tracking — **odloženo**, vidi DECISION_LOG CD-009

---

## SPRINT 09 — Interni notifikacioni sistem — DONE

- 5 novih tabela: grupe primalaca, članstvo, rasporedi, evidencija slanja,
  evidencija po primaocu (vidi CONSTITUTION.md §5.8)
- Grupe primalaca (many-to-many, isti obrazac kao watchers §5.7)
- Zakazani dnevni izvještaji preko `node-cron` (15 min tick, self-healing,
  data-driven — novi raspored je izmjena podataka, ne koda)
- Ručno slanje sa potvrdom prije slanja i tvrdom granicom od 200 primalaca
- Evidencija po primaocu (odvojena od `audit_logs`)
- SUPER_ADMIN-only u v1; koristi isti Resend transport kao podsjetnici
  (CD-011 — cPanel SMTP razmotren i odbačen u korist dovršavanja Resend
  domain verifikacije)
- Testirano uživo end-to-end, uključujući stvarnu isporuku (Resend
  `delivered`) i RBAC provjeru (STANDARD_USER blokiran na svih 5 ruta)

---

## Backlog — van trenutnog opsega (ne implementirati bez eksplicitnog zahtjeva)

- AI/Gemini funkcionalnosti (npr. pametno kreiranje obaveza iz prirodnog jezika, OCR priloga)
- Google Drive OAuth integracija umjesto Supabase Storage (vidi DECISION_LOG CD-005)
- Višejezičnost (engleski/njemački pored bosanskog)
- Push notifikacije / mobilna aplikacija
- Izvještaji i napredna analitika
- Personalizovan sadržaj zakazanih izvještaja po primaocu (Sprint 09 v1 je sistemski nivo)
- Više grupa po jednom rasporedu (Sprint 09 v1: jedan raspored = jedna grupa)
- Dozvola slanja notifikacija za STANDARD_USER korisnike (Sprint 09 v1: SUPER_ADMIN-only)

---

*Chronos v1.0 — IDSS123a Organisation*
