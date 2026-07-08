# SPRINT_02 — Obligations API & Server-side Audit
# Chronos
# Date: 2026-07-08

## Goal
Zamijeniti `localStorage` za obaveze i audit logove pravim backend API-jem, uz
server-side RBAC (uključujući ownership pravilo za STANDARD_USER) i server-side
audit logging.

## Scope — IN
- `server/features/obligations/schemas.ts` — Zod šeme za create/update payload
- `server/features/obligations/repository.ts` — Supabase CRUD (service role)
- `server/features/obligations/domain.ts` — poslovna pravila prenesena 1:1 iz
  `App.tsx`: `calculateNextDueDate`, kompletna `toggleStatus` logika
  (uključujući recurring cycle kreiranje), ownership provjera za izmjene
- `server/features/audit-logs/repository.ts` — pisanje/čitanje audit zapisa
- REST rute (`server/features/obligations/routes.ts`):
  - `GET /api/obligations` — lista (svi korisnici vide sve)
  - `POST /api/obligations` — kreiranje
  - `PATCH /api/obligations/:id` — izmjena (ownership provjera za STANDARD_USER)
  - `DELETE /api/obligations/:id` — brisanje (SUPER_ADMIN only)
  - `POST /api/obligations/:id/toggle-status` — završi/reaktiviraj (ownership provjera)
  - `PATCH /api/obligations/:id/checklist/:itemIndex` — toggle checklist stavke (ownership provjera)
  - `GET /api/audit-logs` — lista (svi vide sve)
  - `DELETE /api/audit-logs` — pražnjenje (SUPER_ADMIN only)
- `server/lib/permissions.ts` — dodati `canEditObligation(role, createdBy, userId)`, `canDeleteObligation` ostaje SUPER_ADMIN-only
- Frontend: `src/lib/api-client.ts` proširen sa obligations/audit-log pozivima
- Frontend: `App.tsx`, `Dashboard.tsx`, `ObligationForm.tsx` prebačeni sa lokalnog state-a na API pozive (loading/error stanja dodana)
- Uklanjanje `INITIAL_OBLIGATIONS` seed podataka iz `localStorage` fallback-a — zamjena: prazna baza ili jednokratna DB seed skripta (odluka tokom implementacije)

## Scope — OUT
- File upload (Sprint 03) — attachment polja ostaju kao tekstualna polja, bez stvarnog uploada
- Uklanjanje hardkodovanog "danas" datuma (Sprint 04)
- Real email podsjetnici (Sprint 05)

## Acceptance Criteria
- [ ] `npx tsc --noEmit` → 0 grešaka
- [ ] `npm run build` → uspješan
- [ ] SUPER_ADMIN može kreirati/uređivati/brisati/završiti bilo čiju obavezu
- [ ] STANDARD_USER može kreirati novu obavezu; može uređivati/završiti SAMO svoje; pokušaj izmjene tuđe obaveze vraća 403 i ne mijenja podatke
- [ ] STANDARD_USER ne vidi/ne može pozvati brisanje (ni UI dugme ni direktan API poziv ne prolazi)
- [ ] Svi vide obaveze obje ustanove bez obzira na ulogu
- [ ] Svaka mutacija piše audit log zapis server-side sa ispravnim `user_id`/`username`
- [ ] Recurring obaveza pri završetku ispravno kreira novi ciklus (identično ponašanje kao stari client-side kod)
- [ ] Refresh stranice ne gubi podatke (učitavaju se iz baze, ne iz localStorage)
- [ ] Testirano uživo u pregledniku sa najmanje 2 različita naloga (SUPER_ADMIN + STANDARD_USER)

## Technical Notes
- Vidi `CONSTITUTION.md` §5.1 za precizno RBAC pravilo (ownership-based edit za STANDARD_USER, potvrđeno 2026-07-08)
- `zod` nije još u `package.json` — dodati kao novu zavisnost (Commander E-2 zahtijeva Zod na svakoj granici)
- Slijediti Commander `FEATURE_LIFECYCLE.md` Implementation Order: migracija (nije potrebna, šema već postoji) → tipovi → Zod → repository → domain → rute → UI → integracija

## Files Expected to Change
- `server/features/obligations/{schemas,repository,domain,routes}.ts` (novo)
- `server/features/audit-logs/{repository,routes,schemas}.ts` (novo)
- `server/lib/{permissions,errors}.ts` (novo/izmjena)
- `server/index.ts` (izmjena — mount novih ruta)
- `src/lib/api-client.ts` (izmjena)
- `src/App.tsx`, `src/components/Dashboard.tsx`, `src/components/ObligationForm.tsx` (izmjena)
- `src/data/initialData.ts` (izmjena/brisanje `INITIAL_OBLIGATIONS`)
- `package.json` (izmjena — dodati `zod`)

---

## HANDOFF NOTE — Sprint 02

**Completed:**
- Puni REST API za obaveze (`GET/POST/PATCH/DELETE /api/obligations`, `POST .../toggle-status`, `PATCH .../checklist/:i`) i audit logove (`GET/POST/DELETE /api/audit-logs`)
- `server/features/obligations/domain.ts` — poslovna logika 1:1 prenesena iz starog `App.tsx` (calculateNextDueDate, recurring cycle kreiranje, kompletan toggle-status tok), uz ownership provjeru (`canEditObligation`)
- Zod validacija na svim POST/PATCH rutama (uz dokumentovan workaround za grešku u tip-inferenciji instalirane Zod verzije — vidi `schemas.ts`)
- Dashboard UI ažuriran da sakriva Uredi/Završi/checklist-toggle za STANDARD_USER na obavezama koje nisu njihove (mirror server pravila, ne zamjena za njega)
- Undo mehanizam pojednostavljen: radi pouzdano za završavanje/reaktivaciju (uključujući brisanje auto-kreiranog recurring ciklusa gdje je dozvoljeno); kreiranje/brisanje bez opozivanja jer bi to zahtijevalo DELETE dozvolu koju STANDARD_USER nema ni nad vlastitim unosom
- `INITIAL_OBLIGATIONS` demo podaci uklonjeni — baza kreće prazna
- Testirano uživo: kreiranje, završavanje (audit log), STANDARD_USER vidi tuđu obavezu bez dugmadi, STANDARD_USER dobija Uredi+Završi (ne i Obriši) na vlastitoj obavezi
- `npx tsc --noEmit` → 0 grešaka; `npm run build` → uspješan
- Test podaci obrisani iz produkcijske baze nakon verifikacije

**Not completed (namjerno, van opsega):**
- File upload (Sprint 03) — attachment i dalje mock string
- Real "danas" datum (Sprint 04) — Dashboard/Calendar/cron simulator i dalje koriste hardkodovani 2026-07-02
- Email podsjetnici (Sprint 05)

**Open risks:**
- Instalirana Zod verzija (3.25.x) netačno infere TS tipove za `.default()` polja — zaobiđeno ručnim tipovima u `schemas.ts` uz komentar. Ako se Zod ažurira, provjeriti da li je bug ispravljen i ukloniti workaround.
- Undo za "complete" akciju sa auto-kreiranim recurring ciklusom briše taj ciklus preko DELETE rute — ako to uradi STANDARD_USER nad svojom obavezom, DELETE zahtijeva SUPER_ADMIN pa bi undo tiho failao (samo se loguje u konzolu, korisnik ne dobija poruku). Razmotriti u Sprint 03/04 poseban "undo" endpoint koji zaobilazi ovo ograničenje za autora ciklusa.

**Technical debt:** Nema novog van gore navedenog Zod workaround-a.

**Next sprint:** Sprint 03 — File Attachments (Supabase Storage)
