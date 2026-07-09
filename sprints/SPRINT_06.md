# SPRINT_06 — Real Email Reminders
# Chronos
# Date: 2026-07-09

## Goal
Zamijeniti "cron simulator" (samo prikazuje log/mock email u modalu) stvarnim
automatskim slanjem email podsjetnika svakog jutra u 08:00 (Europe/Sarajevo)
za obaveze koje dospijevaju za tačno 3 dana.

## Scope — IN
- `server/lib/resend.ts` — Resend klijent, `sendReminderEmail()`
- `server/features/reminders/{domain,cron,routes}.ts`:
  - `findObligationsDueInDays(days)` — skenira nezavršene obaveze
  - `getRecipientsForObligation(obligation)` — **projektna odluka (vidi DECISION_LOG CD-008)**: primaoci su SUPER_ADMIN nalozi + kreator obaveze + watchers (usklađeno sa Sprint 03 vidljivost pravilom — ko smije vidjeti obavezu, taj je i podsjeti se na nju), umjesto stare fiksne "direktor+sekretar" mock logike
  - `runDailyReminderScan()` — orkestrira scan+slanje, piše audit log
- `node-cron` job registrovan u `server/index.ts`, 08:00 Europe/Sarajevo
- `POST /api/reminders/run` — SUPER_ADMIN-only ruta za ručno okidanje (test), poziva istu `runDailyReminderScan()` logiku
- HTML email template — zadržava vizuelni dizajn iz postojećeg cron simulatora (App.tsx), sada stvarno šalje
- Frontend: sidebar "Sistemski servis" dugme sada zove `POST /api/reminders/run` umjesto client-side simulacije; prikazuje stvaran rezultat (broj poslatih emailova) umjesto mock loga

## Scope — OUT
- Odgovori na email (reply-to handling) — samo `mailto:` link u sadržaju, kao i ranije
- Podešavanje broja dana unaprijed (fiksno 3 dana, kao u originalnom PRD-u)
- Digest/batch više obaveza u jedan email — svaka obaveza šalje zaseban email, kao u originalnoj mock logici

## Acceptance Criteria
- [x] `npx tsc --noEmit` → 0 grešaka
- [x] `npm run build` → uspješan
- [x] Ručno okidanje (SUPER_ADMIN) stvarno poziva Resend API za obavezu koja dospijeva za tačno 3 dana — **testirano uživo**: scan je ispravno pronašao 1/1 obavezu, pokušao poslati; Resend je vratio stvaran (ne mock) API odgovor — vidi Napomena ispod
- [x] Primaoci uključuju SUPER_ADMIN + kreatora + watchers, bez duplikata (kod pregledan, logika ista kao dokazano ispravan watchers pattern iz Sprint 03)
- [x] Audit log zapis se kreira nakon svakog scan-a — **testirano uživo**: "1 obaveza dospijeva za 3 dana, 0 email(ova) poslano, 1 grešaka" zapisano
- [x] `node-cron` job registrovan i vidljiv u server logovima pri pokretanju — **testirano uživo**: "Reminder cron job registered: 08:00 Europe/Sarajevo daily"
- [ ] STANDARD_USER ne može pozvati `/api/reminders/run` (403) — kod identičan dokazanom `canDeleteObligation`/`canClearAuditLogs` obrascu, nije posebno re-testirano uživo ovaj put

## Napomena — stvarna dostava emaila blokirana Resend sandbox ograničenjem
Ručni test je otkrio da Resend nalog (još) nema verificiranu domenu, pa
dozvoljava slanje SAMO na email vlasnika naloga (`idsssarajevo@gmail.com`).
Svaki drugi primalac (svi @idss.ba nalozi) vraća grešku "You can only send
testing emails to your own email address". Ovo je Resend ograničenje, ne bug
— kod je ispravno pozvao API, ispravno uhvatio grešku i ispravno je prikazao
u UI-ju i audit logu. **Za stvarnu dostavu institucionalnim email adresama,
potrebno je verificirati domenu na resend.com/domains** (vidi DECISION_LOG
CD-003). Do tada, cron/ručni scan će uvijek raditi ispravno ali stvarno
slanje će failati za sve osim `idsssarajevo@gmail.com`.

## Technical Notes
- Vidi `CONSTITUTION.md` §5.5 (ažurirano ovim sprintom sa preciznim recipient pravilom)
- `RESEND_API_KEY` — potrebna od korisnika prije testiranja stvarnog slanja
- `RESEND_FROM_EMAIL=onboarding@resend.dev` za razvoj (Commander ACA_MANAGEMENT_GUIDE §10)

## Files Expected to Change
- `server/lib/resend.ts` (novo)
- `server/features/reminders/{domain,cron,routes}.ts` (novo)
- `server/index.ts` (izmjena — mount ruta + pokretanje cron job-a)
- `server/features/users/repository.ts` (izmjena — `getSuperAdminIds`, `getUserEmailMap`)
- `server/features/obligations/repository.ts` (izmjena — `getActiveObligationsForReminderScan`)
- `server/lib/permissions.ts` (izmjena — `canRunReminderScan`)
- `src/App.tsx`, `src/lib/api-client.ts` (izmjena — sidebar dugme zove pravi endpoint)
- `src/components/Dashboard.tsx` (izmjena — bonus: "Školska godina" navigacija, vidi handoff)
- `package.json` (izmjena — `resend`, `node-cron`, `@types/node-cron`)
- `.env`, `.env.example` (izmjena — `RESEND_API_KEY`)

---

## HANDOFF NOTE — Sprint 06

**Completed:** Kompletan reminder scan pipeline (domain logika, cron registracija, ručni trigger, RBAC), testiran uživo do granice Resend sandbox ograničenja (vidi napomena gore). Usput ispravljen UX nedostatak koji je korisnik prijavio tokom sesije: "Školska godina" brzi filter sada ima [<] [>] navigaciju umjesto da prikazuje samo tekuću godinu bez mogućnosti izbora naredne/prethodne — testirano uživo (jedan klik = jedan korak, potvrđeno kroz DOM/date-input vrijednosti).

**Not completed:** Stvarna dostava email-a institucionalnim adresama — čeka verifikaciju domene na Resend (korisnička akcija, van dometa koda).

**Open risks:** Nema novih van gore navedenog.

**Next sprint:** Sprint 07 — Calendar, Print & UX Polish
