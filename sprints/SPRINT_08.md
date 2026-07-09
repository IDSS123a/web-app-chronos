# SPRINT_08 — Deployment
# Chronos
# Date: 2026-07-09

## Goal
Pripremiti Chronos za produkcijski rad na pravom, javno dostupnom URL-u:
jedan Node servis (CD-006) koji servira i frontend i API, sigurnosni
pregled baze, i jasan vodič za korake koje samo korisnik (Davor) može
uraditi (kreiranje naloga, unos tajnih ključeva, DNS).

## Scope — IN
- Potvrda CD-006 sa korisnikom (Render.com, bez Sentry-a za v1, Render
  poddomena umjesto prilagođene domene za sada) — AskUserQuestion
- `server/index.ts` — produkcijski mod servira `dist/` statički fajlove +
  SPA fallback kad je `NODE_ENV=production`; port dolazi iz Renderovog
  `PORT` u produkciji (lokalni dev nastavlja `API_PORT`, bez kolizije)
- `package.json` — novi `start` skript za produkciju
- `render.yaml` — Render Blueprint za jednoklik deploy (env varijable sa
  `sync: false` da Render traži ručni unos umjesto da tajne budu u git-u)
- Sigurnosni/performance pregled Supabase baze (`get_advisors`):
  - Potvrđeno bezbjedno: `obligations`/`audit_logs`/`obligation_watchers`
    imaju RLS uključen bez politika = deny-all za direktan pristup preko
    anon ključa (sav stvarni pristup ide kroz Express service-role
    backend) — namjeravano, nije propust
  - Ispravljeno: dodani indeksi na 3 neindeksirana foreign key-a,
    `profiles_select_own` politika optimizovana da ne re-evaluira
    `auth.uid()` po svakom redu
  - Otkriveno i dokumentovano (ne može se riješiti kodom): "Leaked
    Password Protection" isključen u Supabase Auth — ručni dashboard toggle
- `DEPLOYMENT.md` — vodič korak-po-korak za Davora (Render nalog, env
  varijable, Resend domain verifikacija, Supabase toggle)
- `DECISION_LOG.md` — CD-006 potvrđen, novi CD-009 (Sentry odloženo)

## Scope — OUT
- Sentry error tracking — vidi CD-009, korisnik eksplicitno odabrao da
  preskoči za v1 (zahtijeva vanjski nalog koji asistent ne smije kreirati)
- Prilagođena domena (chronos.idss.ba) — Render poddomena za sada,
  korisnik eksplicitno odabrao
- Stvaran Render deploy izvršen od strane asistenta — kreiranje Render
  naloga i unos tajnih ključeva je iz sigurnosnih razloga isključivo
  korisnikova radnja (vidi DEPLOYMENT.md)
- Bundle code-splitting (Vite 500kB upozorenje) — nije blokirajuće,
  ostaje otvorena stavka ako performanse postanu problem

## Acceptance Criteria
- [x] `npx tsc --noEmit` → 0 grešaka
- [x] `npm run build` → uspješan
- [x] Produkcijski servis testiran lokalno — **testirano uživo**: `npm run
      build` + `NODE_ENV=production PORT=3055 npm run start` na test portu;
      `curl` potvrdio: `/` vraća 200 sa build-ovanim `index.html`,
      `/api/users` vraća 401 (očekivano bez auth headera, potvrđuje da API
      ruta radi), nepostojeća putanja vraća 200 sa `index.html` (SPA
      fallback), statički JS asset vraća 200; log potvrđuje "(production,
      serving built frontend)" i cron registraciju; test proces zaustavljen
      nakon provjere
- [x] Dev okruženje i dalje radi nakon izmjena — **testirano uživo**: Preview
      alat, `fetch('/api/users')` vraća 401 (ne ECONNREFUSED) kroz Vite
      proxy → Express, potvrđuje da je dev-mod (bez static serving grane)
      neizmijenjen
- [x] Supabase security/performance advisors pregledani i primijenjeni gdje
      je bezbjedno (migracija `sprint08_perf_hardening`); WARN o leaked
      password protection dokumentovan kao ručni korak — korisnik potvrdio
      da toggle u dashboard-u vraća grešku "available on Pro Plans and up"
      (Supabase besplatni plan ne podržava ovu funkciju); `DEPLOYMENT.md`
      ažuriran da to jasno navede kao opcionalnu buduću nadogradnju, ne
      blokadu za pokretanje
- [x] `render.yaml` referencira tačne env varijable koje app stvarno čita
      (provjereno grep-om — `GEMINI_API_KEY`/`APP_URL` namjerno izostavljeni
      jer ih kod trenutno ne koristi)

## Technical Notes
- Vidi `DECISION_LOG.md` CD-006 (potvrđeno) i CD-009 (Sentry odloženo)
- Vidi `DEPLOYMENT.md` za kompletan operativni vodič
- Port rezolucija u `server/index.ts`: `NODE_ENV=production` je jedini
  signal koji odlučuje čita li se `PORT` (Render) ili `API_PORT` (lokalni
  dev sandbox) — izbjegava koliziju sa Preview alatom koji globalno
  postavlja `PORT` za Vite proces (vidi
  [[feedback-chronos-dev-environment-quirks]] stavka 1)

## Files Expected to Change
- `server/index.ts` (izmjena — produkcijski static serving + port rezolucija)
- `package.json` (izmjena — `start` skript)
- `render.yaml` (novo)
- `DEPLOYMENT.md` (novo)
- `.env.example` (izmjena — napomena o produkcijskom PORT-u)
- `DECISION_LOG.md` (izmjena — CD-006 potvrđen, novi CD-009)
- Supabase migracija `sprint08_perf_hardening` (indeksi + RLS initplan fix)

---

## HANDOFF NOTE — Sprint 08

**Completed:** Kompletna produkcijska konfiguracija koda (jedan servis,
Render Blueprint), sigurnosni pregled baze sa primijenjenim bezbjednim
ispravkama, potpun operativni vodič za korisnikove ručne korake.

**Not completed (namjerno, korisnikova radnja):** Stvaran Render deploy
(kreiranje naloga, unos ključeva), Resend domain DNS verifikacija — vidi
`DEPLOYMENT.md` sa objašnjenjem zašto asistent ne smije te korake uraditi
umjesto korisnika. Supabase "leaked password protection" toggle se
ispostavio kao **nedostupan** na trenutnom besplatnom Supabase planu
("available on Pro Plans and up") — korisnik je ovo potvrdio uživo;
`DEPLOYMENT.md` ažuriran da ovo opiše kao opcionalnu buduću Pro-plan
nadogradnju, ne kao korak koji treba odraditi sada.

**Open risks:** Render besplatni tier "uspava" servis nakon neaktivnosti
(prvi zahtjev nakon pauze 10-30s sporiji, a jutarnji 08:00 cron zahtijeva
da servis bude budan) — dokumentovano u `DEPLOYMENT.md` sa preporukom
plaćenog "Starter" plana ako ovo postane problem u praksi.

**Next sprint:** Nema planiranih sprintova u `FEATURE_BACKLOG.md` van
"Backlog / Nice-to-have" stavki — Chronos v1.0 opseg je zaokružen nakon
što korisnik izvrši korake iz `DEPLOYMENT.md`.
