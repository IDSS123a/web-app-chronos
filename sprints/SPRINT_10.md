# SPRINT_10 — Super Admin panel
# Chronos
# Date: 2026-07-11

## Goal
Poseban administratorski ekran, vidljiv isključivo SUPER_ADMIN roli, za
upravljanje korisnicima, uvid u korištenje sistema, i bulk uvoz kalendara
(automatizuje ono što je do sada rađeno ručno preko jednokratnih skripti).

## Scope — IN
- **Korisnici**: lista svih naloga (email, ime, uloga, ustanova, zadnja
  prijava, status). SUPER_ADMIN direktno kreira nalog (bez javne
  registracije — potvrđeno s korisnikom), sistem generiše lozinku i
  prikaže je JEDNOM (isti obrazac kao `scripts/seed-users.ts`). Promjena
  uloge/ustanove. **Blokiranje** (Supabase `ban_duration` — spriječava
  prijavu, ne dira podatke) i **trajno brisanje** — ali brisanje se
  **provjerava unaprijed** protiv stvarnih FK ograničenja (vidi Technical
  Notes) i blokira uz jasno objašnjenje ako bi obrisalo institucionalni
  trag (kreirane obaveze, audit log unosi); u tom slučaju predlaže
  blokiranje umjesto brisanja.
- **Uvid po korisniku**: broj kreiranih/završenih obaveza, zadnjih N unosa
  iz dnevnika aktivnosti za tu osobu.
- **Sistemske statistike**: korisnici po ulozi, obaveze po statusu/
  ustanovi/kategoriji, sažetak slanja notifikacija.
- **Bulk uvoz kalendara**: upload JSON fajla (ista šema kao IDSS/IMH
  kalendari ručno obrađeni ovaj mjesec), pregled prije potvrde, automatsko
  mapiranje na kategorije, kreiranje obaveza uz watchers i audit log —
  zamjenjuje ručne jednokratne skripte korištene do sada.

## Scope — OUT (eksplicitno potvrđeno s korisnikom)
- Javna registracija + red čekanja za odobrenje — SUPER_ADMIN kreira
  naloge direktno, nema javnog signup-a.
- "Potrošnja tokena" — ne postoji AI/LLM funkcionalnost u aplikaciji
  (CONSTITUTION §8), nema stvarne osnove za ovo, nije implementirano.
- Zaseban UI za izmjenu/brisanje pojedinačnih obaveza unutar admin panela
  — SUPER_ADMIN već ima punu kontrolu nad svim obavezama kroz postojeći
  Dashboard (vidljivost §5.7 svejedno pokazuje SUPER_ADMIN-u sve).

## Acceptance Criteria
- [x] `npx tsc --noEmit` → 0 grešaka
- [x] `npm run build` → uspješan
- [x] Kreiranje korisnika testirano uživo (nova lozinka generisana i
      prikazana, novi nalog se stvarno može prijaviti) — testirano kroz UI
      (modal "Novi korisnik" → "NALOG KREIRAN" ekran sa lozinkom) i
      potvrđeno prijavom novokreiranog naloga
- [x] Promjena uloge testirana uživo (STANDARD_USER → SUPER_ADMIN → nazad)
- [x] Blokiranje/deblokiranje testirano uživo (ban → `is_banned: true`,
      unban → `is_banned: false`, potvrđeno u odgovoru servera)
- [x] Brisanje: testirano uživo i pozitivan slučaj (nalog bez traga →
      obrisan, HTTP 200) i negativan slučaj (nalog sa audit log unosima →
      HTTP 409 blokirano sa jasnom porukom i detaljnim brojem blokera po
      tabeli, ne tiho propada)
- [x] Bulk uvoz kalendara testiran uživo sa stvarnim JSON fajlom (jedan
      testni unos kreiran preko `/api/admin/calendar-import`, provjeren u
      bazi sa tačnim poljima, zatim obrisan; nevažeći payload ispravno
      odbijen sa HTTP 422)
- [x] RBAC: STANDARD_USER blokiran na svim admin rutama (403), testirano
      uživo na izolovanom test nalogu (`/api/admin/users`,
      `/api/admin/stats`, `/api/admin/calendar-import` — sve 403)
- [x] Self-protection testirano uživo: SUPER_ADMIN ne može blokirati ni
      obrisati sam sebe (HTTP 400, oba slučaja)
- [x] Svi test podaci/nalozi obrisani nakon testiranja — potvrđeno upitom
      na bazu: tačno 7 stvarnih profila, 57 obaveza (isto stanje kao prije
      testiranja)

## Technical Notes
- **Kritičan nalaz prije implementacije**: `obligations.created_by`,
  `audit_logs.user_id`, `notification_groups/schedules.created_by`,
  `notification_log.sent_by` su svi `ON DELETE NO ACTION` (ne CASCADE, ne
  SET NULL) prema `profiles(id)`. Ovo znači: brisanje bilo kojeg naloga
  koji je ikad nešto uradio u sistemu (kreirao obavezu, imao ijedan audit
  log unos) **fizički ne uspijeva** na nivou baze, ne samo teoretski.
  Namjerno se NE mijenja delete_rule na CASCADE/SET NULL za `audit_logs`
  (audit trag mora ostati trajan i tačan — §5.4) niti za `obligations`
  (institucionalni podatak ne smije nestati zato što je neko napustio
  instituciju). Umjesto toga, brisanje se **provjerava unaprijed** i
  blokira sa objašnjenjem kad postoji trag.
- Generisanje lozinke: identičan obrazac kao `scripts/seed-users.ts`
  (`randomBytes(12).toString('base64url')`), prikazano samo jednom u UI-ju.
- Blokiranje koristi Supabase Auth admin API (`updateUserById` sa
  `ban_duration`), ne briše ništa.

## Files Expected to Change
- `server/features/admin/{schemas,repository,domain,routes}.ts` (novo)
- `server/lib/permissions.ts` (izmjena — `canManageUsers` ili reuse SUPER_ADMIN gate)
- `src/types.ts`, `src/lib/api-client.ts` (izmjena — admin tipovi/funkcije)
- `src/components/AdminPanelView.tsx` (novo)
- `src/App.tsx` (izmjena — sidebar stavka, SUPER_ADMIN-only)

---

## HANDOFF NOTE — Sprint 10

Sprint završen i testiran uživo (kroz kombinaciju UI klikova i direktnih
poziva na `/api/admin/*` sa stvarnim SUPER_ADMIN sesijama — brže i
podjednako pouzdano za CRUD/RBAC provjere kao klik-po-klik). Svi scenariji
iz Acceptance Criteria prošli bez izmjena koda.

Testiranje je otkrilo i potvrdilo namjerno ponašanje opisano u Technical
Notes: nalog koji je izvršio bilo koju akciju (kreirao korisnika, uradio
ban/unban, uvezao kalendar...) ostavlja `audit_logs` trag i ne može se
trajno obrisati dok se taj trag ne ukloni — API ispravno vraća HTTP 409 sa
detaljnim brojem blokera po tabeli umjesto tihog pada. Za test naloge
(nikad za stvarne korisnike) ovo se rješava direktnim SQL brisanjem
odgovarajućih `audit_logs`/`obligations` redova prije brisanja naloga —
isti princip kao ranije otkriven i dokumentiran u
`feedback_chronos_dev_environment_quirks.md` (lekcija #9: uvijek provjeriti
`error` povrat, nikad pretpostaviti uspjeh).

Nema otvorenih problema. Nema promjena delete_rule na bazi. Nema ostataka
test podataka — potvrđeno upitom: tačno 7 stvarnih profila, 57 obaveza.
