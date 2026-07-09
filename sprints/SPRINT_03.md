# SPRINT_03 — Vidljivost obaveza (Watchers)
# Chronos
# Date: 2026-07-09

## Goal
Spriječiti da svi korisnici vide sve obaveze — posebno finansijski osjetljive.
Kreator obaveze bira ko je smije vidjeti; SUPER_ADMIN uvijek vidi sve. Dodati
i zvanične IDSS/IMH logotipe umjesto placeholder monograma.

## Kontekst / zašto ovaj sprint postoji van plana
Nakon Sprint 02 (gdje je pravilo bilo "svi vide sve, samo je uređivanje
ograničeno"), direktor je precizirao da finansijski podaci ne smiju biti
vidljivi svima. Ovo je sigurnosni/data-integrity zahtjev koji po Commander
Decision Hierarchy (CONSTITUTION.md M-3) ima prioritet nad UI poboljšanjima
poput file uploada — zato je ubačen ispred originalno planiranog Sprint 03
(File Attachments, sada Sprint 04).

## Scope — IN
- Migracija `005_obligation_watchers.sql`: nova `obligation_watchers` tabela
- `server/features/obligations/repository.ts`: `getVisibleObligations(profile)` — SUPER_ADMIN sve, STANDARD_USER (created_by OR watcher)
- `server/features/obligations/repository.ts`: `setObligationWatchers()`, watcher_ids uključen u insert/update/mapRow
- Novi `server/features/users/{repository,routes}.ts` — `GET /api/users` (id, fullName, role — za watcher picker)
- `ObligationForm.tsx` — multi-select checkbox lista kolega (isključuje SUPER_ADMIN naloge i samog kreatora), default prazno
- Recurring ciklus (Sprint 02 logika) nasljeđuje watchers listu originala
- `src/types.ts`: `Obligation.watcher_ids: string[]`, novi `UserSummary` tip
- IDSS logo (`logo_white.png`, tamna podloga) i IMH logo (`logo-header.png`) dodani u `Login.tsx` i `App.tsx` sidebar header

## Scope — OUT
- Watchers se ne prikazuju u Dashboard tabeli (samo u formi za uređivanje) — vizuelni indikator van opsega
- Email notifikacija watcherima kad se doda obaveza — van opsega (Sprint 06 email infra)
- `responsible_person` (slobodan tekst) se NE povezuje automatski sa watchers — kreator mora eksplicitno dodati ako želi da ta osoba vidi obavezu

## Acceptance Criteria
- [x] `npx tsc --noEmit` → 0 grešaka
- [x] `npm run build` → uspješan
- [x] Nova obaveza bez odabranih watchers vidljiva je samo kreatoru i SUPER_ADMIN-u — **testirano uživo** (Adnana kreira privatnu obavezu; Azra Rahmanović je NE vidi)
- [x] STANDARD_USER dodan kao watcher vidi obavezu u listi, ali bez Uredi/Završi dugmadi (nije vlasnik) — **testirano uživo** (Azra vidi "Dijeljena obaveza sa Azrom", nula akcijskih dugmadi)
- [x] SUPER_ADMIN i dalje vidi apsolutno sve, bez obzira na watchers — **testirano uživo** (Davor vidi obje obaveze, uključujući privatnu)
- [x] Recurring ciklus nasljeđuje watchers originalne obaveze (implementirano u domain.ts, provjereno kroz kod — recurring completion nije posebno testiran uživo ovaj put jer je pokriven u Sprint 02)
- [x] IDSS i IMH logotipi vidljivi i čitljivi (kontrast) na Login stranici i u sidebar-u — **ispravljeno tokom testiranja**: oba logotipa su bijele/svijetle boje (transparentna pozadina), zahtijevaju tamnu podlogu; originalni dizajn je stavio IMH na bijelu podlogu gdje je bio nevidljiv — ispravljeno na tamne chip-ove za oba na Login stranici, direktno na tamnu pozadinu u sidebar-u

## Technical Notes
- Vidi `CONSTITUTION.md` §5.7 za kompletno pravilo
- Watcher status = read-only vidljivost, NE pravo izmjene (to ostaje `created_by`-only, §5.1)
- `obligation_watchers` RLS uključen bez permisivnih politika (isti obrazac kao `obligations`/`audit_logs` — service role only)

## Files Expected to Change
- `migrations/005_obligation_watchers.sql` (novo, primijenjeno direktno preko Supabase MCP)
- `server/features/obligations/{repository,domain,schemas,routes}.ts` (izmjena)
- `server/features/users/{repository,routes}.ts` (novo)
- `server/index.ts` (izmjena — mount `/api/users`)
- `src/types.ts`, `src/lib/api-client.ts` (izmjena)
- `src/components/ObligationForm.tsx` (izmjena — watcher picker)
- `src/App.tsx`, `src/components/Login.tsx` (izmjena — logotipi)
- `src/assets/logos/{idss-logo.png,imh-logo.png}` (novo)

---

## HANDOFF NOTE — Sprint 03

**Completed:**
- Watchers mehanizam kompletno implementiran i testiran server-side + UI
- Zvanični logotipi ugrađeni (preuzeti sa idss.edu.ba i montessorihouse.ba)
- Sva dokumentacija ažurirana (CONSTITUTION.md §5.7, FEATURE_BACKLOG renumerisan)

**Not completed (namjerno, van opsega):** vidi "Scope — OUT" gore.

**Open risks:**
- `obligation_watchers` join na listi obaveza radi kroz dva odvojena upita (watchers, pa obligations) umjesto jednog — prihvatljivo za ~7 korisnika i skroman broj obaveza; revizitirati ako baza znatno naraste.
- Watcher picker UI učitava kompletnu listu korisnika pri svakom otvaranju forme (`GET /api/users`) — beznačajno opterećenje za instituciju ove veličine.

**Next sprint:** Sprint 04 — File Attachments (Supabase Storage)
