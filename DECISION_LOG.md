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
**Potvrđeno testom uživo 2026-07-09 (Sprint 06):** dok se domena ne
verificira, Resend sandbox nalog dozvoljava slanje isključivo na email
vlasnika Resend naloga (u ovom slučaju `idsssarajevo@gmail.com`) — svaki
drugi primalac (npr. `direktor@idss.ba`) vraća grešku "You can only send
testing emails to your own email address". Ovo NIJE greška u Chronos kodu —
kod je ispravno pozvao Resend API i ispravno obradio grešku.

**RIJEŠENO 2026-07-10:** domena `idss.ba` je verifikovana na Resend-u
(DKIM/SPF zapisi dodani preko hosting providera Optima Hosting, na
izolovanoj poddomeni `send.idss.ba` — postojeći mail sistem škole
nedirnut, vidi memoriju `reference-idss123a-shared-resend-domain` za
tačne zapise i obrazac za buduće IDSS123a projekte). Status potvrđen
`verified` preko Resend API-ja, i potvrđen stvarnom test porukom
(`last_event: delivered`) na `info@idss.ba` i
`info-mejtas@montessorihouse.ba`. `RESEND_FROM_EMAIL` promijenjen sa
sandbox defaulta (`onboarding@resend.dev`) na `direktor@idss.ba`.
Sandbox ograničenje više ne postoji — svi @idss.ba i
@montessorihouse.ba primaoci sada stvarno primaju podsjetnike.

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
**Status:** Potvrđeno (2026-07-09, prije Sprint 08). Render besplatna
poddomena (npr. `chronos-idss.onrender.com`) za sada — prilagođena domena
(npr. `chronos.idss.ba`) ostaje otvorena backlog stavka bez izmjene koda
kad institucija to zatraži. Implementacija: `server/index.ts` servira
`dist/` statički kad je `NODE_ENV=production`, port dolazi iz Renderovog
`PORT` u produkciji (lokalni dev nastavlja koristiti `API_PORT`, vidi
[[feedback-chronos-dev-environment-quirks]]). Vidi `render.yaml` i
`DEPLOYMENT.md` za tačne korake.

---

## CD-007 — File upload parsing: `multer`

**Datum:** 2026-07-09
**Odluka:** Koristiti `multer` middleware za parsiranje multipart/form-data upload zahtjeva na Express backend-u.
**Razlog:** Express nema ugrađenu podršku za multipart parsing (Commander M-12 stepenica 3: "genuinely impossible without a new library"). `multer` je de-facto standard za Express, malog footprinta, održavan.
**Napomena:** Fajlovi se drže u memoriji (`multer.memoryStorage()`) i odmah streamuju u Supabase Storage — nema privremenih fajlova na disku Express servera.

---

## CD-008 — Reminder email primaoci: kreator + watchers + SUPER_ADMIN (ne fiksni "direktor+sekretar")

**Datum:** 2026-07-09
**Odluka:** Email podsjetnik za obavezu koja dospijeva za 3 dana šalje se
kreatoru obaveze, svim njenim watchers-ima i svim SUPER_ADMIN nalozima —
umjesto originalne mock logike koja je uvijek slala na fiksan par
`direktor@idss.ba, sekretar@idss.ba` bez obzira ko je obaveza.
**Razlog:** Nakon Sprint 03 (vidljivost/watchers, CONSTITUTION.md §5.7), fiksni
par primalaca više nema smisla — obaveza koju STANDARD_USER kreira i namjerno
ne dijeli ni sa kim (npr. finansijski osjetljiva) i dalje bi slala email
sekretaru koji je uopšte ne smije ni vidjeti u aplikaciji. Novo pravilo je
koherentno sa vidljivost modelom: ko smije vidjeti obavezu, taj i dobija
podsjetnik o njoj.
**Upgrade path:** Ako se pokaže da neki watchers ne žele email (samo žele
vidjeti u aplikaciji), razmotriti odvojenu "email preference" postavku po
korisniku — nije zatraženo, ne implementirati unaprijed.

---

## CD-009 — Sentry error tracking odloženo (nije implementirano u Sprint 08)

**Datum:** 2026-07-09
**Odluka:** Ne dodavati Sentry (ili sličan error-tracking servis) u v1
deployment, iako je bio naveden u originalnom Sprint 08 opsegu.
**Razlog:** Zahtijeva kreiranje vanjskog naloga koji AI asistent ne smije
raditi u korisnikovo ime (sigurnosno pravilo), a za instituciju sa 7
korisnika server-side console logovi (vidljivi u Render "Logs" tabu) i
postojeći AuditLogs mehanizam su dovoljni za v1. Korisnik je eksplicitno
potvrdio ovaj izbor (AskUserQuestion, 2026-07-09).
**Upgrade path:** Ostaje u backlogu. Ako se doda kasnije, korisnik prvo
kreira besplatan Sentry nalog i unosi DSN ključ u `.env`/Render env vars —
kod integracije (par linija u `server/index.ts` i `src/App.tsx`) je tada
trivijalan dodatak, ne zahtijeva arhitekturnu promjenu.

---

## CD-010 — Interni notifikacioni sistem: Express + node-cron, ne Supabase Edge Function

**Datum:** 2026-07-10
**Odluka:** Interni notifikacioni sistem (grupe/rasporedi/ručno slanje,
Sprint 09) implementiran u postojećem Express backend-u
(`server/features/notifications/`), zakazano slanje preko `node-cron` tick-a
svakih 15 min — isti obrazac kao CD-004 (reminder cron), ne novi Supabase
Edge Function.
**Razlog:** Detaljna analiza (Backend vs API Route vs Supabase Edge Function
vs Cron Job vs Background Worker) prije implementacije — Edge Function bi
uveo drugi deployment cilj, druge env varijable, drugi pipeline, direktno u
suprotnosti sa CD-006 principom "jedan servis, jedan URL" za non-coder
operatera. Deno edge runtime je i tehnički lošije uklopljen za bilo šta van
kratkih HTTP zahtjeva. Background Worker (queue/Redis) bi bio prekomjeran
za trenutni obim (7-20 korisnika, par slanja dnevno).
**Upgrade path:** Ako obim naraste do tačke gdje Express event loop postane
usko grlo (vidi CD-011 za razmatranje skalabilnosti transporta), Background
Worker ostaje razumna sljedeća stepenica — ne implementirati unaprijed.

---

## CD-011 — Email transport za notifikacije: Resend (isti kao podsjetnici), ne cPanel SMTP

**Datum:** 2026-07-10
**Odluka:** Interni notifikacioni sistem koristi isti Resend transport kao
postojeći reminder engine (§5.5), ne cPanel SMTP preko `direktor@idss.ba`
mailbox-a (razmatrana alternativa).
**Razlog:** Detaljna tehnička analiza (9 pitanja: uklanjanje Resend-a,
cPanel SMTP kompatibilnost/sigurnost, mjesto implementacije, arhitektura
zakazanih izvještaja, ručno slanje, audit log, sigurnost, skalabilnost,
preporuka) je zaključila da je pravi problem (Resend sandbox ograničenje,
CD-003) rješiv jednokratnom DNS verifikacijom domene, ne zamjenom cijelog
transporta. cPanel SMTP nosi veći rizik (SMTP lozinka = puni pristup
mailbox-u, nema delivery analitike, nepoznati rate limiti hostinga,
neizvjesnost oko Render-ovog dozvoljavanja odlaznih SMTP portova) za istu
funkcionalnu korist.
**Izvršeno:** `idss.ba` Resend domena verifikovana 2026-07-10 (DKIM/SPF na
izolovanoj poddomeni `send.idss.ba`, vidi memoriju
`reference-idss123a-shared-resend-domain`) — sandbox ograničenje riješeno
bez potrebe za alternativnim transportom.
**Upgrade path:** Ako institucija ikad zatraži cPanel SMTP iz
institucionalnih razloga (ne tehničkih), arhitektura je već pripremljena da
to bude lokalizovana zamjena `server/lib/resend.ts` (ili ekvivalenta) —
`sendEmail()` interfejs ostaje isti, poziva ga i reminder engine i
notifikacioni sistem.

---

*Chronos v1.0 — IDSS123a Organisation*
