# SPRINT_07 — Calendar, Print & UX Polish
# Chronos
# Date: 2026-07-09

## Goal
Zatvoriti preostale UX praznine prije Sprint 08 (Deployment): uskladiti
izvještaj za štampu sa stvarnim Dashboard filterima, potvrditi da su
Kalendar/Dashboard/AuditLogs/Forma upotrebljivi na mobilnom uređaju, i
dodati loading/error povratnu informaciju svugdje gdje je nedostajala.

## Scope — IN
- `PrintTemplate` prima tačno ono što je trenutno vidljivo na Dashboardu
  (institucija + status/datum filteri), umjesto uvijek svih obaveza
- Provjera Dashboard/CalendarView/AuditLogsView/ObligationForm na mobilnom
  viewport-u (375px) — uživo testirano kroz Preview alat
- Loading stanje na `ObligationForm` submit dugmetu — forma se više ne
  zatvara instant prije nego što se spremanje (i eventualni upload priloga)
  stvarno završi
- Loading (spinner + disabled) na Dashboard red-akcijama (Završi/Obriši) —
  sprječava dvostruki klik na sporoj vezi
- Loading na "Isprazni logove" dugmetu u AuditLogsView
- Ispravka zastarjelog teksta "Postojeći dokument na Google Drive-u" u
  `ObligationForm` (ostatak iz mock faze prije Sprint 04) + pretvaranje
  statičnog "DRIVE LINK" badge-a u stvaran link ka signed URL-u
- Ispravka netačne tvrdnje na Login ekranu ("Zapamti me... 30 dana" nije
  nikad bilo stvarno ožičeno ni na jedan toggle ili session-config)

## Scope — OUT
- Code-splitting / bundle veličina (Vite upozorenje o 500kB chunku — nije
  UX regresija, ostaje za Sprint 08 ili kasnije ako postane problem)
- Loading indikator na pojedinačnim checklist checkbox-ovima (niskorizična,
  idempotentna akcija — nije prioritet)

## Acceptance Criteria
- [x] `npx tsc --noEmit` → 0 grešaka
- [x] `npm run build` → uspješan
- [x] Print filter sync — **testirano uživo**: kreirane 2 test obaveze
      (IDSS + IMH), filter "Samo IDSS Škola" → print-section sadrži samo
      IDSS red; filter "Samo IMH Vrtić" → samo IMH red; institution label
      i datumski raspon u zaglavlju izvještaja prate isti filter
- [x] Mobilni prikaz (375×812) — **testirano uživo**: Dashboard (statistički
      kartoni, filteri, prazno stanje), hamburger meni, Kalendar (7-kolonski
      grid, detalj dana), AuditLogs (tabela sa `overflow-x-auto`, potvrđeno
      scrollWidth > clientWidth), ObligationForm (puna forma uključujući
      watcher listu i file-drop zonu) — sve čitljivo i upotrebljivo
- [x] ObligationForm loading stanje — **testirano uživo**: klik na "Zavedi
      obavezu" odmah onemogućava dugme i prikazuje spinner + "Čuvanje...",
      forma se zatvara tek nakon uspješnog spremanja
- [x] Dashboard red-akcije loading stanje — **testirano uživo**: "Završi
      obavezu" i "Obriši" dugmad se onemogućavaju i prikazuju spinner odmah
      po kliku, do završetka API poziva
- [x] Test podaci (2 privremene obaveze korištene za provjeru) uspješno
      obrisani nakon testiranja — baza vraćena u prazno stanje

## Technical Notes
- `Dashboard.tsx` — novi `onVisibleObligationsChange` callback prop javlja
  App.tsx-u tačno filtrirunu/sortiranu listu + aktivne filtere kad god se
  promijene (`useEffect` na `[sortedObligations, institutionFilter,
  startDate, endDate]`)
- `Dashboard.tsx` — novi `processingIds: Set<string>` state + `runWithProcessing()`
  helper omotava `onToggleStatus`/`onDeleteClick` (sada `Promise<void>`
  umjesto `void`) da prikaže spinner po redu dok traje poziv
- `ObligationForm.tsx` — `onSubmit` prop sada `Promise<void>`; `isSubmitting`
  state blokira dupli submit i zatvara formu samo nakon uspjeha; App.tsx-ov
  `handleFormSubmit` sada re-throws grešku (nakon `alert()`) da forma zna
  da ostane otvorena
- `AuditLogsView.tsx` — `onClearLogs` prop sada `Promise<void>`; `isClearing`
  state prati isti obrazac
- Testiranje delete/toggle dugmadi uživo zahtijevalo privremeno
  `window.confirm = () => true` override u test eval kontekstu (native
  `confirm()` dijalog blokira headless eval poziv — vidi memoriju o
  dev-environment quirks za Commander)

## Files Expected to Change
- `src/components/Dashboard.tsx` (izmjena — print sync callback, processing state)
- `src/App.tsx` (izmjena — printView state, rethrow u handleFormSubmit)
- `src/components/PrintTemplate.tsx` (bez izmjena koda — sada prima ispravne propse)
- `src/components/ObligationForm.tsx` (izmjena — isSubmitting, Google Drive tekst ispravka)
- `src/components/AuditLogsView.tsx` (izmjena — isClearing)
- `src/components/Login.tsx` (izmjena — netačna "30 dana" tvrdnja uklonjena)

---

## HANDOFF NOTE — Sprint 07

**Completed:** Print-Dashboard filter sinhronizacija, mobilni UX pregled
svih ekrana (bez pronađenih blokirajućih problema), loading stanja za sve
async akcije koje su prethodno bile bez povratne informacije, dvije
zastarjele/netačne UI tvrdnje ispravljene (Google Drive tekst, "30 dana"
remember-me).

**Not completed:** Ništa iz planiranog opsega. Bundle-size upozorenje
(Vite "chunks larger than 500kB") svjesno ostavljeno van opsega — nije UX
regresija, razmotriti u Sprint 08 ako performanse postanu problem.

**Open risks:** Nema novih.

**Next sprint:** Sprint 08 — Deployment
