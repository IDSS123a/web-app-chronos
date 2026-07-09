# SPRINT_05 — Real Time
# Chronos
# Date: 2026-07-09

## Goal
Ukloniti svaki hardkodovani "danas" (`2026-07-02`) kroz aplikaciju i zamijeniti
stvarnim sistemskim vremenom. Datum i vrijeme moraju biti uvijek precizni i
sistemski usklađeni — eksplicitan zahtjev direktora nakon što je primijetio
da se kalendar ne ažurira.

## Scope — IN
- Nova `src/lib/date-utils.ts` — jedinstveni izvor istine (Commander M-7) za "danas" kao lokalni YYYY-MM-DD string
- `Dashboard.tsx`: `todayStr`/`today`, date preset dugmad (Ova sedmica/Ovaj mjesec/Školska godina), "Ovaj mjesec" stat kartica — sve računato iz stvarnog datuma
- `CalendarView.tsx`: default mjesec/godina, "Danas" oznaka, week-view anchor, day-detail panel — sve iz stvarnog datuma
- `ObligationForm.tsx`: default rok dospijeća pri kreiranju = stvarno danas
- `App.tsx`: header prikazuje živi datum/sat (ažurira se svake sekunde), cron simulator koristi stvarno "danas" umjesto fiksnog
- **Usput otkriven i ispravljen bug**: `toLocaleDateString('bs-BA', {weekday:'long', month:'long', ...})` ne radi ispravno u nekim browser/ICU okruženjima (vraćalo je npr. "M07 Thu" umjesto "juli Četvrtak") — zamijenjeno ručnim bosanskim formatiranjem (`formatDateBosnianLong`) koje ne zavisi od Intl locale podataka
- `PrintTemplate.tsx`: datum izvještaja ispravljen na dd.mm.yyyy format (isti razlog)

## Scope — OUT
- Server-side vremenska zona za Sprint 06 cron/email (Europe/Sarajevo) — to je zaseban zahtjev za `node-cron` konfiguraciju, ne dotiče frontend prikaz datuma

## Acceptance Criteria
- [x] `npx tsc --noEmit` → 0 grešaka
- [x] `npm run build` → uspješan
- [x] Header prikazuje stvarni datum/dan u sedmici i sat koji se pomjera uživo — **testirano uživo**: "Četvrtak, 9. juli 2026." + sat koji tiče
- [x] Dashboard "Ovaj mjesec" kartica i label ispravno prikazuju stvarni mjesec ("JULI") — **testirano uživo**
- [x] Kalendar podrazumijevano otvara stvarni tekući mjesec/godinu, tekući dan je označen — **testirano uživo**
- [x] "Školska godina" dugme prikazuje ispravan raspon za stvarni datum (2025/2026 za juli 2026) — **testirano uživo**
- [x] Cron simulator računa "+3 dana" iz stvarnog datuma (9.7 → 12.7) — **testirano uživo**
- [x] Bosanski format datuma (dan u sedmici, naziv mjeseca) ispravan na svim mjestima, ne oslanja se na browser ICU podršku

## Technical Notes
Baza je bila zaprljana jednim probnim unosom ("Pravilnik o radu") koji je
direktor lično kreirao dok se testirala aplikacija — obrisan po eksplicitnom
zahtjevu prije početka ovog sprinta.

## Files Expected to Change
- `src/lib/date-utils.ts` (novo)
- `src/App.tsx`, `src/components/Dashboard.tsx`, `src/components/CalendarView.tsx`, `src/components/ObligationForm.tsx`, `src/components/PrintTemplate.tsx` (izmjena)

---

## HANDOFF NOTE — Sprint 05

**Completed:** Svi hardkodovani datumi uklonjeni, testirano uživo sa stvarnim sistemskim datumom (9.7.2026). Usput otkriven i ispravljen `bs-BA` Intl locale bug koji je postojao od samog početka projekta (originalni AI Studio kod).

**Not completed:** Server-side timezone za cron (Sprint 06 — Real Email Reminders).

**Open risks:** Nema novih. `formatDateBosnianLong` sada je jedini ispravan način za bosanski prikaz datuma u projektu — svaki budući kod NE smije koristiti `toLocaleDateString('bs-BA', {weekday/month: 'long'})` direktno.

**Next sprint:** Sprint 06 — Real Email Reminders (Resend + node-cron)
