# CONSTITUTION.md — Chronos
# Project Constitution — inherits Commander (IDSS123a)
# Version 1.0 — Juli 2026

---

> Ovaj dokument je specifičan za projekat **Chronos**. Nasljeđuje sva pravila iz:
> - `Commander/CONSTITUTION.md` (univerzalni mindset)
> - `Commander/ENGINEERING_RULES.md` (univerzalni standardi koda)
> - `Commander/ARCHITECTURE_PATTERNS.md` (univerzalni strukturni obrasci)
>
> Gdje se ovaj dokument razlikuje od Commander default obrazaca (npr. stack),
> **ovaj dokument pobjeđuje za Chronos projekat** jer predstavlja svjesnu,
> dokumentovanu odluku (vidi `DECISION_LOG.md`), ne odstupanje bez razloga.

---

## 1. VISION — Institucionalna svrha

Chronos je jedinstveni sistem za praćenje i upravljanje rokovima, ugovorima i
administrativnim obavezama za **Internationale Deutsche Schule Sarajevo (IDSS)**
i **International Montessori House Sarajevo (IMH)**.

Cilj: nijedan zakonski, ugovorni ili administrativni rok se ne smije propustiti.
Sistem mora:
- Voditi centralni registar svih obaveza (ko, šta, do kada, za koju ustanovu).
- Automatski podsjećati odgovorne osobe prije isteka roka (email).
- Voditi nepromjenjiv trag svake izmjene (audit log) radi institucionalne odgovornosti.
- Raditi pouzdano bez potrebe da neko ručno prati kalendar.

## 2. TEHNOLOŠKI STACK — Projektna odluka (odstupanje od Commander default-a)

Commander-ov default (Next.js + Supabase, po uzoru na IDSS Handbook) **ne
primjenjuje se doslovno ovdje**. Chronos je nastao kao Vite + React SPA
(Google AI Studio prototip) i ta osnova se zadržava da bi se izbjegao
nepotreban potpuni rewrite postojećeg, funkcionalnog UI sloja.

| Sloj | Tehnologija | Napomena |
|---|---|---|
| Frontend | Vite + React 19 + TypeScript + Tailwind CSS v4 | Postojeći UI se zadržava i refaktoriše u feature foldere |
| Backend | Express (Node.js) + TypeScript | Novi sloj — zamjenjuje Next.js Server Actions/API routes iz Commander default-a |
| Baza podataka | Supabase (Postgres) | Prati Commander DECISION_LOG DL-001 |
| Autentikacija | Supabase Auth (email + lozinka) | Zamjenjuje trenutni mock login |
| File storage | Supabase Storage | Zamjenjuje mock Google Drive linkove |
| Email | Resend | Zamjenjuje "cron simulator" dugme sa stvarnim slanjem |
| Scheduled job (08:00 podsjetnik) | `node-cron` unutar Express servera | Express je persistent proces (ne serverless), pa cron radi nativno bez vanjskog schedulera |
| Deployment | Jedan Node servis: Express servira i build-ovan Vite frontend i `/api/*` rute | Jedan deployment target radi jednostavnosti za non-coder operatera (vidi `ACA_MANAGEMENT_GUIDE.md` §2) |

Ova odluka je zapisana u `DECISION_LOG.md` (CD-001).

## 3. ARHITEKTURA — Slojevi (Commander A-1, prilagođeno na Express)

```
PRESENTATION      React komponente, stranice, forme        (src/)
      ↓
APPLICATION       Express rute, middleware, orkestracija    (server/routes/)
      ↓
DOMAIN            Poslovna pravila, validacija, permisije   (server/features/*/domain.ts)
      ↓
INFRASTRUCTURE    Supabase repository funkcije, storage     (server/features/*/repository.ts)
      ↓
EXTERNAL          Supabase, Resend                          (server/lib/)
```

**Konkretno pravilo:** React komponenta nikad direktno ne poziva Supabase.
React komponenta poziva `fetch('/api/...')` → Express ruta → domain sloj
provjerava pravila → repository sloj čita/piše u Supabase.

Servisni ključ (`SUPABASE_SERVICE_ROLE_KEY`) postoji samo na serveru
(Express procesu), nikad u frontend bundle-u.

## 4. FOLDER STRUKTURA

```
chronos/
├── src/                        Frontend (Vite/React) — Presentation layer
│   ├── features/
│   │   ├── auth/
│   │   ├── obligations/
│   │   ├── calendar/
│   │   ├── audit-logs/
│   │   └── reminders/
│   ├── lib/
│   │   └── api-client.ts       Jedini mjesto koje zna za /api/* rute
│   └── ...
├── server/                     Backend (Express) — Application/Domain/Infra
│   ├── features/
│   │   ├── auth/                {routes.ts, domain.ts}
│   │   ├── obligations/         {routes.ts, domain.ts, repository.ts, schemas.ts}
│   │   ├── audit-logs/          {routes.ts, repository.ts}
│   │   └── reminders/           {cron.ts, email-templates.ts, repository.ts}
│   ├── lib/
│   │   ├── supabase-server.ts   Server-side Supabase klijent (service role)
│   │   ├── resend.ts
│   │   └── permissions.ts       RBAC — single source of truth
│   ├── middleware/
│   │   └── auth.ts              Provjera sesije + role
│   └── index.ts                 Express app entry, servira i frontend build
├── migrations/                  Numerisane SQL migracije (Commander A-6)
├── sprints/                     SPRINT_01.md, SPRINT_02.md, ...
├── CONSTITUTION.md              (ovaj dokument)
├── DECISION_LOG.md
├── FEATURE_BACKLOG.md
└── CHANGELOG.md
```

## 5. DOMAIN — Poslovna pravila

### 5.1 Uloge (RBAC) — potvrđeno 2026-07-08, vidljivost dopunjena 2026-07-09

- `SUPER_ADMIN` (Davor Mulalić, direktor@idss.ba) — potpuna kontrola nad svim
  procesima; potpun uvid u **apsolutno sve** obaveze koje su unijeli svi
  korisnici, bez izuzetka; jedini koji smije brisati obaveze i prazniti audit
  logove; smije uređivati bilo čiji unos.
- `STANDARD_USER` ("User" — 6 korisnika, vidi §5.1.1) — smije kreirati nove
  obaveze; smije uređivati i završavati **samo obaveze koje je sâm kreirao**
  (`obligation.created_by === currentUser.id`); ne smije brisati obaveze niti
  prazniti audit logove; **vidi samo obaveze koje je sâm kreirao ILI na kojima
  je eksplicitno označen kao watcher** (vidi §5.7 — izmijenjeno pravilo,
  zamjenjuje raniju verziju gdje su svi vidjeli sve).

Institution filter (IDSS/IMH/Oboje) je isključivo UI filter za pregled —
nikad kontrola pristupa vidljivosti. Vidljivost obaveze je isključivo
kontrolisana kroz watchers mehanizam (§5.7), ne kroz instituciju.

Enforced isključivo server-side u `server/lib/permissions.ts` (uključujući
provjeru vlasništva `created_by` za izmjene STANDARD_USER korisnika — ovo se
implementira u Sprint 02 zajedno sa Obligations API-jem, pošto Sprint 01 ne
dotiče CRUD obaveza). Frontend samo sakriva dugmad — ne smatra se
sigurnosnom kontrolom.

#### 5.1.1 Stvarni korisnici (zamjenjuje raniju placeholder listu od 3 mock korisnika)

| Ime | Funkcija | Email | RBAC uloga | Ustanova (informativno) |
|---|---|---|---|---|
| Davor Mulalić | Direktor | direktor@idss.ba | SUPER_ADMIN | BOTH |
| Azra Morić | Office Manager | info-mejtas@montessorihouse.ba | STANDARD_USER | MONTESSORI |
| Adnana Agić | Pedagog IDSS | pedagog@idss.ba | STANDARD_USER | IDSS |
| Anesa Karaman | Sekretar | info@idss.ba | STANDARD_USER | BOTH |
| Azra Rahmanović | Financijsko-administrativni saradnik | financije@idss.ba | STANDARD_USER | BOTH |
| Amina Habul | Pedagog IMH | amina.habul@outlook.com | STANDARD_USER | MONTESSORI |
| Armina Huremović | Pedagog/Odgajatelj IMH | arminah98@hotmail.com | STANDARD_USER | MONTESSORI |

Seed-ovano putem `scripts/seed-users.ts` (`npm run seed`). Institucija je
informativna oznaka (ne ograničava vidljivost — vidi gore), dodijeljena po
najboljem nahođenju iz naziva funkcije/email domene; ispravlja se direktno u
`profiles` tabeli ako je pogrešna.

### 5.2 Obligation lifecycle
`NOVO → U_TOKU → ZAVRŠENO`, sa mogućnošću vraćanja iz `ZAVRŠENO` u `U_TOKU`.

### 5.3 Ponavljajuće obaveze (Recurring engine)
Kad se ponavljajuća obaveza (`MONTHLY`/`HALF_YEARLY`/`YEARLY`) označi završenom,
sistem automatski kreira novi ciklus: novi `due_date` po intervalu, resetovana
checklista, prazan prilog. Logika živi u `server/features/obligations/domain.ts`,
nikad u UI.

### 5.4 Audit log
Svaka mutacija (kreiranje, izmjena, brisanje, završetak, undo, login/logout)
piše zapis u `audit_logs` tabelu **na serveru**, ne na klijentu (trenutni
prototip piše log client-side — ovo je bezbjednosni propust koji se ispravlja).

### 5.5 Podsjetnici (reminder engine) — implementirano Sprint 06

Svakog dana u 08:00 (Europe/Sarajevo), pozadinski `node-cron` job skenira
nezavršene obaveze. Za svaku sa `due_date` tačno 3 dana unaprijed, šalje se
stvaran HTML email preko Resend-a.

**Primaoci (usklađeno sa §5.7 vidljivost pravilom, zamjenjuje raniju
"direktor+sekretar" mock logiku):** svi SUPER_ADMIN nalozi + kreator obaveze
(`created_by`) + svi watchers — dakle isti skup ljudi koji obavezu uopšte
smiju vidjeti. Ovo je namjerno: ko ne smije vidjeti obavezu, ne treba ni
dobijati email o njoj (posebno bitno za finansijski osjetljive obaveze).

Administratorska ruta `POST /api/reminders/run` (ručno okidanje, isti scan
kao cron) dostupna je isključivo SUPER_ADMIN roli — potvrđeno testom uživo.

**Poznato ograničenje (Resend sandbox, nije bug u kodu):** dok se ne
verificira sopstvena domena na resend.com/domains, Resend dozvoljava slanje
samo na email vlasnika Resend naloga — svaki drugi primalac vraća grešku
"You can only send testing emails to your own email address". Vidi
DECISION_LOG CD-003.

### 5.6 Institucije
Obaveza pripada `IDSS` ili `MONTESSORI`. Filter "obje" postoji samo na UI
nivou (agregacija), nikad kao vrijednost u bazi.

### 5.7 Vidljivost obaveza / Watchers — dodano 2026-07-09

Motivacija: obaveze finansijske prirode (i druge osjetljive) ne smiju biti
vidljive svim korisnicima po defaultu.

Pravilo:
- Kreator obaveze (`created_by`) bira, u trenutku kreiranja ili izmjene, koje
  kolege ("watchers") smiju vidjeti tu konkretnu obavezu, preko
  `obligation_watchers` tabele (many-to-many, `obligation_id` ↔ `user_id`).
- Default pri kreiranju: **prazna lista** (niko osim kreatora i SUPER_ADMIN-a)
  — princip najmanje privilegije, posebno bitno za finansijske stavke.
- `SUPER_ADMIN` uvijek vidi sve obaveze, neovisno o watchers listi.
- Kreator uvijek vidi svoju obavezu, neovisno o tome da li je sebe dodao u
  watchers (implicitno).
- Watcher status daje **samo vidljivost** (read), ne i pravo izmjene — pravo
  izmjene ostaje isključivo na `created_by === currentUser.id` (§5.1). Dakle
  moguće je da neko vidi obavezu kao watcher, ali ne može je uređivati.
- Kad se ponavljajuća obaveza završi i sistem kreira novi ciklus (§5.3), novi
  ciklus nasljeđuje istu watchers listu kao originalna obaveza.
- UI (`ObligationForm.tsx`) sakriva SUPER_ADMIN naloge iz watcher picker-a
  (uvijek vide sve, nepotrebno ih birati) i samog kreatora (uvijek vidi svoje).

Server-side enforced u `server/features/obligations/repository.ts`
(`getVisibleObligations`) — frontend ne filtrira ništa samostalno, prima
samo ono što server odluči da smije vidjeti.

### 5.8 Interni notifikacioni sistem — dodano 2026-07-10 (Sprint 09)

Zaseban od §5.5 (podsjetnici o rokovima) — ovo je opšti komunikacijski
kanal za instituciju (uprava, administracija, nastavnici), ne vezan za
konkretnu obavezu.

Pravilo:
- **SUPER_ADMIN-only u v1** (`canManageNotifications`, jedini source of
  truth u `server/lib/permissions.ts`) — upravljanje grupama/rasporedima i
  ručno slanje. Nije vidljivo STANDARD_USER korisnicima ni u sidebar-u ni
  server-side.
- **Grupe primalaca** (`notification_groups` + `notification_group_members`,
  many-to-many, isti obrazac kao `obligation_watchers` §5.7) — proizvoljni
  skupovi korisnika, nezavisni od instituacije/uloge.
- **Rasporedi** (`notification_schedules`) — jedan raspored = jedan tip
  izvještaja + jedna grupa + vrijeme slanja + on/off. Novi raspored, novo
  vrijeme ili nova grupa je **izmjena podataka**, ne koda. Novi TIP
  izvještaja zahtijeva jednu novu funkciju u `REPORT_GENERATORS` registru
  (`server/features/notifications/domain.ts`) — namjerno minimalna dodatna
  arhitektura, ne generička plugin infrastruktura koja nije zatražena.
- **Cron** (`server/features/notifications/cron.ts`) — tick svakih 15 min,
  Europe/Sarajevo, zaseban od §5.5-ovog 08:00-only reminder cron-a jer
  rasporedi mogu biti u bilo koje vrijeme. Self-healing preko
  `last_run_date` (propušten tick se nadoknadi, bez duplog slanja istog dana).
- **Ručno slanje** — SUPER_ADMIN piše naslov/poruku, bira grupe i/ili
  pojedinačne korisnike, potvrđuje tačnu listu primalaca prije slanja.
  Tvrda granica od 200 primalaca po slanju (zaštita od slučajnog masovnog
  slanja).
- **Evidencija** (`notification_log` + `notification_log_recipients`) —
  ko/kome/kada/status/greška, po primaocu. Odvojeno od `audit_logs` (koji i
  dalje dobija jednu sažetu liniju po akciji za institucionalnu
  odgovornost), jer treba strukturiran uvid u pojedinačne primaoce koji
  `audit_logs`-ov slobodan tekst ne pruža.
- Sav slobodan tekst (naslov, poruka, naziv grupe/rasporeda) se HTML-escape-uje
  prije ubacivanja u odlazni email (ista pouka kao §5.5 sigurnosni nalaz,
  Sprint 08).

### 5.9 Super Admin panel — dodano 2026-07-11 (Sprint 10)

Zaseban administratorski ekran, vidljiv isključivo SUPER_ADMIN roli
(`canManageUsers`, `server/lib/permissions.ts`) — nije vidljiv
STANDARD_USER korisnicima ni u sidebar-u ni server-side (sve rute pod
`/api/admin/*` provjeravaju ulogu na svakom pozivu, ne samo u UI).

Pravilo:
- **Kreiranje korisnika je direktno, ne javna registracija** — SUPER_ADMIN
  unosi ime/email/ulogu/ustanovu, sistem generiše lozinku
  (`randomBytes(12).toString('base64url')`, isti obrazac kao
  `scripts/seed-users.ts`) i prikazuje je **jednom** u UI-ju. Nema
  reda čekanja za odobrenje, nema samostalnog signup-a — potvrđeno s
  direktorom pri specificiranju ovog sprinta.
- **Blokiranje** (Supabase Auth `ban_duration`) sprječava prijavu bez
  brisanja bilo kakvih podataka — reverzibilno, preferirano nad brisanjem
  za naloge sa institucionalnim tragom.
- **Trajno brisanje se provjerava unaprijed, nikad ne pada tiho.**
  `obligations.created_by`, `audit_logs.user_id`,
  `notification_groups/schedules.created_by`, `notification_log.sent_by`
  su svi `ON DELETE NO ACTION` prema `profiles(id)` — namjerno, ne
  CASCADE/SET NULL, jer audit trag mora ostati trajan i tačan (§5.4) i
  institucionalni podaci ne smiju nestati kad neko napusti instituciju.
  Brisanje zato prvo provjerava postojanje traga u sve četiri tabele; ako
  postoji, vraća jasnu poruku sa brojem blokera po tabeli i predlaže
  blokiranje umjesto brisanja, umjesto da pusti da FK ograničenje na bazi
  baci sirovu grešku.
- **Samozaštita** — SUPER_ADMIN ne može blokirati ni obrisati sam sebe
  (`server/features/admin/domain.ts`), bez obzira koliko SUPER_ADMIN naloga
  postoji.
- **Sistemske statistike** — korisnici po ulozi, obaveze po
  statusu/ustanovi/kategoriji, sažetak slanja notifikacija. "Potrošnja
  tokena" eksplicitno van opsega — nema AI/LLM funkcionalnosti u aplikaciji
  (§8), nema stvarne osnove za taj podatak.
- **Bulk uvoz kalendara** — normalizovana, Chronos-vlastita JSON šema
  (`{institution, entries: [{title, category, due_date,
  responsible_person?, priority?}]}`), namjerno, a ne pokušaj
  auto-parsiranja sirovih školskih kalendar-exporta (koji se razlikuju po
  imenima polja i mijenjaju oblik između verzija istog fajla — vidi
  `sprints/SPRINT_10.md`). Neko (SUPER_ADMIN, ili AI asistent koji pomaže
  pripremiti izvorni fajl) prvo normalizuje u ovaj oblik; aplikacija zatim
  samo validira + prikazuje pregled + uvozi, umjesto da nagađa. Zamjenjuje
  ručne jednokratne Node/SQL skripte korištene za IDSS/IMH kalendar
  2026/2027.

## 6. PODACI (Data model — sažetak, detalji u migracijama)

- `profiles` (prati `auth.users`): `id`, `full_name`, `role`, `institution`
- `obligations`: `id`, `title`, `institution`, `category`, `due_date`,
  `responsible_person`, `priority`, `status`, `checklist_items` (jsonb),
  `attachment_path`, `attachment_name`, `is_recurring`, `recurring_interval`,
  `created_by`, `created_at`, `updated_at`
- `obligation_watchers`: `obligation_id`, `user_id` (composite PK) — vidi §5.7
- `audit_logs`: `id`, `timestamp`, `user_id`, `username`, `action_type`,
  `target_table`, `target_id`, `changes`
- `notification_groups` / `notification_group_members`: proizvoljne grupe
  primalaca (§5.8)
- `notification_schedules`: zakazani izvještaji — grupa, vrijeme, tip,
  on/off (§5.8)
- `notification_log` / `notification_log_recipients`: evidencija slanja,
  po primaocu (§5.8)

RLS uključen na svim tabelama. Detaljna šema definiše se u migracijama
(`001_initial_schema.sql`, `005_obligation_watchers.sql`,
`007_notification_system.sql`).

## 7. VANJSKE INTEGRACIJE

| Servis | Svrha | Ključevi |
|---|---|---|
| Supabase | Baza, Auth, Storage | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| Resend | Email podsjetnici | `RESEND_API_KEY`, `RESEND_FROM_EMAIL` |

`.env.example` se ažurira pri svakom dodavanju nove varijable (Commander A-7).

## 8. VAN OPSEGA (za sada)

- AI/Gemini funkcionalnosti (`@google/genai` zavisnost postoji u `package.json`
  iz originalnog AI Studio scaffolda, ali nijedna AI funkcija nije
  specificirana niti zahtijevana — ne implementira se dok se eksplicitno ne
  zatraži, u skladu sa M-4 Anti-Hallucination Protocol). Kada se ova faza
  aktivira: institucija planira koristiti rotacioni sistem od 8 besplatnih
  (free tier) Gemini API ključeva iz 8 različitih Google Cloud projekata
  (isti obrazac kao Commander DECISION_LOG DL-005 "8 API keys × 15 RPM"), radi
  zaobilaženja free-tier rate limita. Implementacija te rotacije čeka
  konkretan AI feature zahtjev — ne graditi unaprijed.
- Višejezičnost (trenutno isključivo bosanski jezik).
- Mobilna native aplikacija.

---

*Chronos v1.0 — IDSS123a Organisation — nasljeđuje Commander v1.0*
