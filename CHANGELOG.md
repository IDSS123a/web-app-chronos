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
