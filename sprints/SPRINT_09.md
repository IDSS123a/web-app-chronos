# SPRINT_09 — Interni notifikacioni sistem
# Chronos
# Date: 2026-07-10

## Goal
Interni komunikacijski sistem (ne newsletter) za slanje obavijesti
ograničenoj grupi korisnika: ručno slanje, automatski zakazani dnevni
izvještaji, grupe primalaca, i evidencija — na Resend transportu
verifikovanom istog dana.

## Scope — IN
- 5 novih tabela: `notification_groups`, `notification_group_members`,
  `notification_schedules`, `notification_log`, `notification_log_recipients`
- `server/features/notifications/` — puni CRUD za grupe i rasporede, ručno
  slanje, evidencija, sve iza `canManageNotifications` (SUPER_ADMIN-only)
- Report-type registar (`REPORT_GENERATORS` u `domain.ts`) — dodavanje novog
  rasporeda/vremena/grupe je izmjena podataka, ne koda; dodavanje novog TIPA
  izvještaja je jedna nova funkcija u registru
- Jedan ugrađen tip izvještaja: `DNEVNI_PREGLED` (pregled svih aktivnih
  obaveza, sistemski nivo — rasporede kreira samo SUPER_ADMIN pa je to i
  ispravan opseg sadržaja)
- `node-cron` tick svakih 15 min (`notifications/cron.ts`), self-healing
  preko `last_run_date` (propušten tick se nadoknadi na sljedećem, bez
  duplog slanja u istom danu)
- Ručno slanje: kompozicija → potvrda sa tačnom listom primalaca → slanje,
  tvrda gornja granica od 200 primalaca po slanju (zaštita od slučajnog
  masovnog slanja)
- HTML escaping svih slobodnog-teksta polja (naslov/poruka/grupa/raspored)
  prije ubacivanja u email — ista lekcija kao Sprint 08 sigurnosni nalaz
- Nova `NotificationsView.tsx` — 4 taba (Grupe/Rasporedi/Ručno slanje/
  Evidencija), vidljiva u sidebar-u isključivo SUPER_ADMIN korisnicima

## Scope — OUT
- Personalizovan sadržaj izvještaja po primaocu (svako vidi samo svoje
  obaveze) — sadašnji `DNEVNI_PREGLED` je sistemski pregled; personalizacija
  ostaje backlog stavka ako zatreba
- Više grupa po jednom rasporedu (v1: jedan raspored = jedna grupa; više
  grupa za isto vrijeme = više rasporeda, isti praktični efekat)
- Sentry/eksterno praćenje grešaka slanja — postojeći `notification_log` +
  `notification_log_recipients` dovoljni za v1 (vidi CD-009)
- Dozvola slanja za STANDARD_USER korisnike — cijela funkcionalnost je
  SUPER_ADMIN-only u v1, upgrade path ostaje otvoren (`can_send_notifications`
  flag na profilu) ako zatreba

## Acceptance Criteria
- [x] `npx tsc --noEmit` → 0 grešaka
- [x] `npm run build` → uspješan
- [x] Migracija primijenjena, `get_advisors` pregledan — isti obrazac kao
      postojeće tabele (RLS enabled bez politika, namjeravano), indeksi na
      svim foreign key kolonama
- [x] Grupe: kreiranje/izmjena/brisanje **testirano uživo** kroz UI (privremen
      izolovan SUPER_ADMIN test nalog, ne dira stvarne korisnike)
- [x] Rasporedi: kreiranje, uključivanje/isključivanje toggle-om **testirano
      uživo**
- [x] Cron logika (`runDueSchedules`) **testirano uživo** ručnim pokretanjem
      — generisao izvještaj, poslao na grupu, upisao u evidenciju; potvrđeno
      preko Resend API-ja: `last_event: delivered` na stvarne adrese
- [x] Ručno slanje **testirano uživo** — kompozicija → potvrda sa tačnim
      brojem/listom primalaca → slanje → potvrđeno preko Resend API-ja
      (`delivered`) i u evidenciji
- [x] **Pronađen i popravljen pravi bug uživo testiranjem**: poruka o
      uspjehu nakon ručnog slanja se nikad nije prikazivala — roditeljska
      komponenta je na svaki `onSent()` postavljala `loading=true`, što je
      demontiralo tab (i njegovo lokalno `result` stanje) prije nego što je
      korisnik stigao vidjeti potvrdu. Ispravljeno: puni loading spinner
      prikazuje se samo pri prvom učitavanju (`useRef` umjesto pri svakom
      osvježavanju); potvrđeno uživo da se poruka sada ispravno prikazuje
- [x] RBAC: STANDARD_USER blokiran na svih 5 ruta (`/groups`, `/schedules`,
      `/send`, `/log`) — **testirano uživo**, 5/5 provjera 403, izolovan
      privremeni STANDARD_USER test nalog
- [x] Svi test podaci (grupe, rasporedi, evidencija, privremeni nalozi)
      obrisani nakon testiranja — baza vraćena u prazno stanje

## Technical Notes
- Vidi `CONSTITUTION.md` §5.8 (novo) i `DECISION_LOG.md` CD-010/CD-011
- Cron self-healing logika: `send_time <= trenutno_vrijeme_Sarajevo AND
  last_run_date !== danas` — ne zahtijeva tačan match vremenskog prozora,
  pa propušten tick (npr. restart servera) i dalje pošalje kasnije istog
  dana, bez duplog slanja
- `resolveRecipientEmails` koristi `supabase.auth.admin.listUsers()`, isti
  obrazac kao `getUserEmailMap()` u reminders — cache-free, dovoljno za
  trenutni obim (7-20 naloga)

## Files Expected to Change
- Supabase migracija `007_notification_system` (novo)
- `server/features/notifications/{schemas,repository,domain,routes,cron}.ts` (novo)
- `server/index.ts` (izmjena — mount ruta + cron registracija)
- `server/lib/permissions.ts` (izmjena — `canManageNotifications`)
- `src/types.ts` (izmjena — `NotificationGroup/Schedule/LogEntry` tipovi)
- `src/lib/api-client.ts` (izmjena — notification API funkcije)
- `src/components/NotificationsView.tsx` (novo)
- `src/App.tsx` (izmjena — sidebar stavka + view routing, SUPER_ADMIN-only)

---

## HANDOFF NOTE — Sprint 09

**Completed:** Kompletan notifikacioni sistem — grupe, rasporedi, ručno
slanje, evidencija — testiran uživo end-to-end uključujući stvarnu isporuku
emaila (Resend `delivered` status). Jedan pravi bug pronađen i popravljen
tokom testiranja (nestajanje potvrde o uspjehu nakon ručnog slanja).

**Not completed:** Ništa iz planiranog opsega.

**Open risks:** Nema novih. `DNEVNI_PREGLED` izvještaj je sistemski nivo
(ne personalizovan po primaocu) — prihvatljivo za v1 jer rasporede kreira
samo SUPER_ADMIN, ali vrijedi imati na umu ako se kasnije doda mogućnost da
STANDARD_USER kreira rasporede.

**Next sprint:** Nema planiranih — `FEATURE_BACKLOG.md` je zaokružen van
eksplicitno-van-opsega stavki.
