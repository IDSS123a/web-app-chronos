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
