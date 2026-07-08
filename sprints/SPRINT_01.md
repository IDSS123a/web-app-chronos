# SPRINT_01 — Backend & Database Foundation
# Chronos
# Date: 2026-07-08

## Goal
Postaviti stvarnu bazu podataka i backend sloj, i zamijeniti mock login (bilo koja lozinka ≥6 karaktera) pravom Supabase autentikacijom, bez rewrite-a postojećeg UI-ja.

## Scope — IN
- Novi Supabase projekat (organizacija IDSS123a), region eu-central-1
- SQL migracija `001_initial_schema.sql`: `profiles`, `obligations`, `audit_logs` tabele + RLS politike
- Express + TypeScript server scaffold u `server/` prema `CONSTITUTION.md` folder strukturi
- `server/lib/supabase-server.ts` (service role klijent, server-only)
- `server/lib/permissions.ts` — `canDeleteObligation()`, `canClearAuditLogs()` (SUPER_ADMIN only)
- `server/middleware/auth.ts` — provjera Supabase sesije na svakoj zaštićenoj ruti
- Supabase Auth: email+lozinka login/logout, zamjena `src/components/Login.tsx` mock logike (UI izgled se zadržava, mijenja se samo submit handler)
- Seed skripta: kreira 3 postojeća korisnika (`direktor@idss.ba`, `sekretar@idss.ba`, `racunovodstvo@idss.ba`) kao stvarne Supabase Auth naloge sa odgovarajućim `profiles` zapisima
- `.env.example` ažuriran sa `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- Vite dev proxy konfigurisan da prosljeđuje `/api/*` na Express dev server

## Scope — OUT (ne gradi se u ovom sprintu)
- CRUD obaveza kroz API (Sprint 02) — `obligations` state ostaje privremeno u `localStorage` na frontendu, samo se auth mijenja
- File upload (Sprint 03)
- Email podsjetnici (Sprint 05)
- Deployment (Sprint 07)

## Acceptance Criteria
Sprint je završen kada:
- [ ] `npx tsc --noEmit` prolazi bez grešaka (frontend i server)
- [ ] Supabase projekat postoji, migracija primijenjena, RLS uključen na sve tabele
- [ ] `npm run dev` pokreće i frontend i backend bez grešaka
- [ ] Login sa `direktor@idss.ba` / stvarnom lozinkom radi kroz Supabase Auth (ne kroz mock)
- [ ] Pogrešna lozinka vraća jasnu grešku, ne ruši aplikaciju
- [ ] Sesija se održava nakon refresh-a stranice
- [ ] Logout stvarno invalidira Supabase sesiju
- [ ] `server/lib/permissions.ts` postoji i koristi se (još nigdje u rutama dok CRUD ne postoji u Sprint 02, ali funkcije su definisane i testirane)

## Technical Notes
- Vidi `CONSTITUTION.md` §2 (stack), §3 (arhitektura), §6 (data model) i `DECISION_LOG.md` CD-001, CD-002.
- Postojeći `MOCK_USERS` iz `src/data/initialData.ts` se koristi kao referenca za seed podatke, zatim se briše iz koda kad login prelazi na Supabase.
- `obligations` i `audit_logs` tabele se kreiraju u ovom sprintu (šema), ali se frontend na njih povezuje tek u Sprint 02 — u ovom sprintu ostaju prazne/nekorišćene od strane frontenda.

## Files Expected to Change
- `server/index.ts` (novo)
- `server/lib/supabase-server.ts` (novo)
- `server/lib/permissions.ts` (novo)
- `server/middleware/auth.ts` (novo)
- `server/features/auth/routes.ts` (novo)
- `migrations/001_initial_schema.sql` (novo)
- `scripts/seed-users.ts` (novo)
- `src/components/Login.tsx` (izmjena — real Supabase Auth poziv)
- `src/lib/supabase-browser.ts` (novo)
- `src/App.tsx` (izmjena — auth state iz Supabase sesije umjesto `localStorage.chronos_user`)
- `.env.example` (izmjena)
- `vite.config.ts` (izmjena — dev proxy)
- `package.json` (izmjena — nove zavisnosti: `@supabase/supabase-js`, `@supabase/ssr` ili ekvivalent, `cors`, `concurrently` za dev)

---

## HANDOFF NOTE — Sprint 01

**Completed:**
- Supabase projekat `web-app-chronos` (ref `qdsuvzkptdtrfspgqdma`, eu-central-1) kreiran u IDSS123 organizaciji
- Migracije `001`–`004`: `profiles`/`obligations`/`audit_logs` + enumi + RLS (uključeno, bez permisivnih politika za `obligations`/`audit_logs` do Sprint 02 — sve ide kroz service role backend)
- Express backend scaffold: `server/index.ts`, `server/lib/{supabase-server,permissions}.ts`, `server/middleware/auth.ts`, `server/features/auth/{routes,repository}.ts`
- Frontend: `src/lib/{supabase-browser,api-client}.ts`, `Login.tsx` i `App.tsx` prebačeni na pravi Supabase Auth (session persistencija, `onAuthStateChange`, loading gate)
- `npm run seed` kreira 3 stvarna naloga (direktor/sekretar/računovodstvo) sa profilima
- Svi acceptance kriteriji iz opsega ovog sprinta provjereni uživo u pregledniku: login (sva 3 naloga), pogrešna lozinka, session persist nakon restart-a servera, logout, RBAC (STANDARD_USER ne vidi dugme za brisanje)
- `npx tsc --noEmit` → 0 grešaka; `npm run build` → uspješan

**Not completed (namjerno, van opsega):**
- Obligations/AuditLogs CRUD kroz API — i dalje u `localStorage` (Sprint 02)
- File upload (Sprint 03), real "danas" (Sprint 04), email podsjetnici (Sprint 05), deployment (Sprint 07)

**Open risks:**
- Supabase MCP alat namjerno ne izlaže `service_role` ključ — korisnik ga je ručno unio u `.env`. Za produkciju (Sprint 07) treba definisati siguran proces za postavljanje ovog ključa na hosting servisu.
- Lokalno razvojno okruženje zahtijeva `NODE_OPTIONS=--use-system-ca` (vidi Technical Notes) zbog TLS presretanja na nekim mrežama/sandboxima — ako se pojavi `UNABLE_TO_VERIFY_LEAF_SIGNATURE` na drugoj mašini, isti fix se primjenjuje.
- `dist/assets/index-*.js` je 513 kB (iznad Vite-ovog 500 kB upozorenja) — nije blokirajuće, ali razmotriti code-splitting u kasnijem sprintu.

**Technical Notes (novo otkriveno tokom implementacije, dodati u Commander budući update):**
- Environment varijabla za Express port NE smije se zvati `PORT` — neka dev/hosting okruženja globalno postavljaju `PORT` za primarni web proces, što se kosi sa Vite-om. Koristi se `API_PORT`.
- Windows npm scripts u ovom repou izvršavaju se kroz `cmd.exe`, ne bash, unatoč postojećem `rm -rf` u `clean` skripti (taj `clean` script je vjerovatno neispitan naslijeđeni kod). Za cross-platform env varijable u npm skriptama koristiti `cross-env`.
- Enum vrijednosti u Postgresu moraju se doslovno poklapati sa string literalima iz `src/types.ts` (uključujući dijakritike poput Š) da bi se izbjegao mapping sloj.

**Next sprint:** Sprint 02 — Obligations API & Server-side Audit
