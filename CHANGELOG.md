# CHANGELOG.md — Chronos

---

> Jedan red po završenoj funkcionalnosti: `[DATUM] [SPRINT/FEATURE] Opis`

---

[2026-07-08] [GOVERNANCE] Uspostavljen Commander governance sloj: CONSTITUTION.md, DECISION_LOG.md, FEATURE_BACKLOG.md za Chronos projekat.
[2026-07-08] [SPRINT_01] Kreiran Supabase projekat `web-app-chronos` (eu-central-1), primijenjena inicijalna šema (profiles/obligations/audit_logs + RLS).
[2026-07-08] [SPRINT_01] Dodat Express + TypeScript backend (`server/`) sa slojevima Application/Domain/Infrastructure prema CONSTITUTION.md.
[2026-07-08] [SPRINT_01] Mock login zamijenjen pravim Supabase Auth-om (email+lozinka); 3 postojeća korisnika seed-ovana kao stvarni nalozi (`npm run seed`).
[2026-07-08] [SPRINT_01] Ispravljen pre-postojeći React "key" prop bug u Dashboard.tsx (usput, nezavisno od Sprint 01 opsega).
[2026-07-08] [SPRINT_01] Korigovan korisnički roster na stvarnih 7 osoba (CONSTITUTION.md §5.1.1); uklonjena 2 placeholder test naloga; uklonjen quick-fill panel sa login stranice (izlagao je email adrese cijelog osoblja na javnoj stranici).
[2026-07-08] [SPRINT_01] Precizirano RBAC pravilo: STANDARD_USER smije uređivati samo vlastite unose (created_by), ali vidi sve obaveze obje ustanove — implementacija enforcement-a ide u Sprint 02.
[2026-07-08] [SPRINT_02] Obligations i AuditLogs prebačeni sa localStorage na pravi Express API (server/features/obligations, server/features/audit-logs) — puni CRUD, recurring engine, checklist toggle.
[2026-07-08] [SPRINT_02] Server-side RBAC: STANDARD_USER može uređivati/završavati samo obaveze koje je sam kreirao (403 inače); brisanje ostaje SUPER_ADMIN-only. Dashboard UI sakriva dugmad u skladu s tim.
[2026-07-08] [SPRINT_02] Audit log se sada piše isključivo server-side pri svakoj mutaciji, uključujući login/logout (novi POST /api/audit-logs, ograničen na Users/IZMJENA da se spriječi zloupotreba).
[2026-07-08] [SPRINT_02] Undo funkcionalnost pojednostavljena da poštuje novo RBAC pravilo: opoziv je moguć samo za završavanje/reaktivaciju obaveze (nema DELETE poziva za STANDARD_USER); kreiranje/brisanje ostaju bez opozivanja.
[2026-07-08] [SPRINT_02] Uklonjen INITIAL_OBLIGATIONS demo seed — baza kreće prazna kao prava institucionalna baza.
[2026-07-09] [SPRINT_03] Dodat watchers mehanizam (nova `obligation_watchers` tabela): kreator obaveze bira ko je smije vidjeti, van sebe i Super Admina. Default: privatno. Zamjenjuje raniju "svi vide sve" politiku iz Sprint 02.
[2026-07-09] [SPRINT_03] Novi `GET /api/users` endpoint (id/ime/uloga) za watcher picker u formi.
[2026-07-09] [SPRINT_03] Dodani zvanični IDSS i IMH logotipi na Login stranicu i sidebar (zamjena "C" placeholder monograma).
[2026-07-09] [SPRINT_04] Stvarni upload/download priloga preko privatnog Supabase Storage bucket-a (obligation-attachments, 10MB limit, MIME whitelist). Zamjenjuje mock drive.google.com linkove.
[2026-07-09] [SPRINT_04] Prilozi se čitaju preko kratkotrajnih (1h) signed URL-ova generisanih server-side — poštuju watchers vidljivost (§5.7), nikad javno dostupni.
[2026-07-09] [SPRINT_04] Brisanje obaveze sada uklanja i pripadajući fajl iz Storage-a (nema orphaned fajlova).
[2026-07-09] [SPRINT_05] Uklonjen hardkodovani "danas" (2026-07-02) kroz cijelu aplikaciju — nova src/lib/date-utils.ts, header sa živim satom, dinamički date preseti, kalendar otvara stvarni tekući mjesec.
[2026-07-09] [SPRINT_05] Ispravljen bs-BA Intl locale bug (postojao od originalnog AI Studio koda) — toLocaleDateString('bs-BA', {weekday/month:'long'}) je vraćao pogrešan format u nekim browser okruženjima; zamijenjeno ručnim bosanskim formatiranjem.
[2026-07-09] [SPRINT_06] Pravi email podsjetnici preko Resend-a: node-cron job 08:00 Europe/Sarajevo, ručni SUPER_ADMIN trigger, primaoci = kreator+watchers+SUPER_ADMIN (CD-008, zamjenjuje mock "direktor+sekretar").
[2026-07-09] [SPRINT_06] Testirano uživo — scan/detekcija ispravno radi; stvarna dostava blokirana Resend sandbox ograničenjem (samo vlasnik naloga dok se ne verificira domena) — CD-003 ažuriran.
[2026-07-09] [SPRINT_06] UX ispravka: "Školska godina" brzi filter sada ima strelice za navigaciju kroz školske godine (prije: samo tekuća, bez mogućnosti odabira naredne/prethodne).
[2026-07-09] [SPRINT_07] "Printaj izvještaj" sada prati stvarne Dashboard filtere (institucija, status, datumski raspon) umjesto da uvijek printa sve obaveze — testirano uživo sa IDSS/IMH filterima.
[2026-07-09] [SPRINT_07] Dodano loading stanje na ObligationForm submit dugme — forma se ne zatvara dok se spremanje/upload priloga stvarno ne završi; greška ostavlja formu otvorenom umjesto da nestane bez traga.
[2026-07-09] [SPRINT_07] Dodano loading stanje (spinner + disable) na Dashboard red-akcije (Završi/Obriši) i AuditLogs "Isprazni logove" dugme — sprječava dvostruki klik.
[2026-07-09] [SPRINT_07] Ispravljen zastarjeli "Postojeći dokument na Google Drive-u" tekst u ObligationForm (ostatak iz mock faze prije Sprint 04) — sada pokazuje stvaran link ka Supabase Storage prilogu.
[2026-07-09] [SPRINT_07] Uklonjena netačna tvrdnja "Zapamti me na ovom računaru (30 dana)" sa Login ekrana — nikad nije bila stvarno ožičena ni na jednu funkcionalnost.
[2026-07-09] [SPRINT_07] Potvrđeno uživo: Dashboard, Kalendar, AuditLogs i ObligationForm ispravno rade na mobilnom viewport-u (375px).
[2026-07-09] [SPRINT_08] Produkcijski mod: `server/index.ts` sada servira build-ovan frontend + `/api/*` iz jednog procesa (CD-006), sa `render.yaml` za jednoklik Render deploy — testirano uživo na lokalnom test portu.
[2026-07-09] [SPRINT_08] Sigurnosni/performance pregled Supabase baze: dodani indeksi na neindeksirane foreign key-eve, optimizovana `profiles` RLS politika; potvrđeno da `obligations`/`audit_logs`/`obligation_watchers` bez RLS politika je namjeravano bezbjedno (deny-all za anon pristup).
[2026-07-09] [SPRINT_08] Novi `DEPLOYMENT.md` vodič za korisnikove ručne korake (Render nalog, env varijable, Resend domain, Supabase leaked-password-protection toggle).
