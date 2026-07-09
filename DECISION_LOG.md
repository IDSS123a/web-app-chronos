# DECISION_LOG.md — Chronos
# Projektne tehnološke odluke (nadograđuje Commander DECISION_LOG.md)

---

> Ovaj dokument bilježi ZAŠTO su donesene projektno-specifične odluke za Chronos,
> posebno tamo gdje Chronos odstupa od Commander default obrazaca. Ništa se ne
> briše. Zastarjele odluke se označavaju [SUPERSEDED].

---

## CD-001 — Stack: Vite SPA + Express (ne Next.js)

**Datum:** 2026-07-08
**Odluka:** Zadržati postojeći Vite + React frontend. Dodati Express +
TypeScript backend sloj umjesto migracije na Next.js.
**Razlog:** Chronos već ima funkcionalan, kompletan UI (Dashboard, Calendar,
AuditLogs, ObligationForm, PrintTemplate) napisan kao Vite SPA. Potpuni
rewrite na Next.js App Router bi bacio taj rad bez funkcionalne dobiti —
slojevita arhitektura iz Commander-a (Presentation → Application → Domain →
Infrastructure → External) se jednako dobro implementira sa Express rutama
kao sa Next.js Server Actions. `express` i `dotenv` su već bili prisutni u
`package.json` prije ove odluke, što ukazuje da je backend faza bila
predviđena od početka.
**Upgrade path:** Ako projekat naraste do potrebe za SSR/SEO ili Server
Components, migracija na Next.js se razmatra kao nova odluka, ne prije.

---

## CD-002 — Baza i Auth: Supabase

**Datum:** 2026-07-08
**Odluka:** Supabase (Postgres + Auth + Storage) zamjenjuje trenutni
localStorage + mock login.
**Razlog:** Usklađeno sa Commander DECISION_LOG DL-001. Institucija (IDSS123a)
već ima Supabase organizaciju sa aktivnim projektima (npr.
`web-app-idss-handbook`), pa je operativni trošak učenja/upravljanja nula.
Real RLS omogućava server-side enforced RBAC (SUPER_ADMIN / STANDARD_USER).
**Napomena:** Za Chronos se kreira **poseban** Supabase projekat (ne dijeli
se baza sa IDSS Handbook projektom) radi izolacije podataka i Commander
principa "jedan feature/projekat = jedna jasna granica".

---

## CD-003 — Email: Resend

**Datum:** 2026-07-08
**Odluka:** Resend zamjenjuje "cron simulator" dugme; stvarni email se šalje
za podsjetnike 3 dana prije roka.
**Razlog:** Usklađeno sa Commander default-om. U razvoju se koristi
`onboarding@resend.dev` (Commander ACA_MANAGEMENT_GUIDE §10); za produkciju
je potrebna verifikacija domene (npr. `chronos@idss.ba` ili slično) na
resend.com/domains.

---

## CD-004 — Scheduled job: `node-cron` unutar Express-a (ne Supabase Edge Function/pg_cron)

**Datum:** 2026-07-08
**Odluka:** Jutarnji 08:00 podsjetnik se implementira kao `node-cron` job
unutar samog Express procesa, ne kao Supabase Edge Function sa pg_cron.
**Razlog:** Pošto backend NIJE serverless (Express je persistent proces —
vidi CD-001), `node-cron` je najjednostavnije rješenje bez dodatne
infrastrukture. Ako se backend ikad migrira na serverless platformu, ova
odluka se mora revidirati (serverless funkcije se gase između poziva i ne
mogu držati cron u memoriji).

---

## CD-005 — File storage: Supabase Storage (ne stvarni Google Drive OAuth)

**Datum:** 2026-07-08
**Odluka:** Prilozi (ugovori, licence, rješenja) se čuvaju u Supabase Storage
bucket-u, ne kroz Google Drive OAuth integraciju.
**Razlog:** Supabase Storage je već dio odabranog stacka (CD-002), dijeli
autentikaciju i RLS pravila sa ostatkom baze, i ne zahtijeva Google Cloud
OAuth consent screen setup/verifikaciju koja bi usporila prve sprintove.
**Upgrade path:** Google Drive integracija ostaje otvorena backlog stavka
ako institucija kasnije eksplicitno zatraži direktnu Drive sinhronizaciju.

---

## CD-006 — Deployment: jedan Node servis (Express servira i frontend i API)

**Datum:** 2026-07-08
**Odluka:** Produkcijski deployment je jedan Node proces: Express servira
build-ovan Vite frontend (statički fajlovi) i `/api/*` rute iz istog servisa.
Predloženi hosting: Render.com (besplatan tier, persistent proces — pogodno
za `node-cron`, jednostavan git-push deploy).
**Razlog:** Non-coder operater (vidi `ACA_MANAGEMENT_GUIDE.md`) upravlja
lakše sa jednim deployment ciljem i jednim URL-om nego sa odvojenim
frontend/backend hostingom. Persistent proces (za razliku od serverless)
prirodno podržava `node-cron` (vidi CD-004).
**Status:** Predloženo — čeka potvrdu prije Sprint 07 (Deployment).

---

## CD-007 — File upload parsing: `multer`

**Datum:** 2026-07-09
**Odluka:** Koristiti `multer` middleware za parsiranje multipart/form-data upload zahtjeva na Express backend-u.
**Razlog:** Express nema ugrađenu podršku za multipart parsing (Commander M-12 stepenica 3: "genuinely impossible without a new library"). `multer` je de-facto standard za Express, malog footprinta, održavan.
**Napomena:** Fajlovi se drže u memoriji (`multer.memoryStorage()`) i odmah streamuju u Supabase Storage — nema privremenih fajlova na disku Express servera.

---

*Chronos v1.0 — IDSS123a Organisation*
