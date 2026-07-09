# SPRINT_04 — File Attachments
# Chronos
# Date: 2026-07-09

## Goal
Zamijeniti mock `drive.google.com` linkove stvarnim upload/download prilogâ
(ugovori, licence, rješenja) preko Supabase Storage.

## Scope — IN
- Privatni Storage bucket `obligation-attachments` (kreiran u ovom sprintu, 10MB limit, whitelist MIME tipova — vidi migraciju `006`)
- `POST /api/obligations/:id/attachment` — multipart upload (`multer`), ownership provjera (isto pravilo kao izmjena obaveze), MIME/veličina validacija server-side
- `DELETE /api/obligations/:id/attachment` — uklanjanje priloga
- Repository: `attachment_path` čuva Storage path (ne URL); pri čitanju obaveza server generiše kratkotrajni signed URL (1h) i vraća ga kao `attachment_url` — poštuje watchers vidljivost jer se generiše samo za obaveze koje korisnik uopšte smije vidjeti (§5.7)
- `ObligationForm.tsx` — stvarni upload umjesto mock `Date.now()_drive_mock` linka
- Brisanje obaveze briše i pripadajući Storage fajl (cleanup, sprječava orphaned fajlove)

## Scope — OUT
- Verzionisanje priloga (samo jedan trenutni prilog po obavezi, kao i do sada)
- Pregled priloga unutar aplikacije (i dalje se otvara u novom tabu/download)

## Acceptance Criteria
- [x] `npx tsc --noEmit` → 0 grešaka
- [x] `npm run build` → uspješan
- [x] Upload uspijeva i fajl je stvarno dostupan za download — **testirano uživo**: PNG upload preko forme, provjeren signed URL (status 200, tačan content-type `image/png`, tačna veličina fajla)
- [x] Brisanje obaveze uklanja i fajl iz Storage-a — **testirano uživo**: nakon brisanja, `obligation_count=0` i `storage_object_count=0` u bazi
- [x] STANDARD_USER ne može uploadovati/brisati prilog na tuđoj obavezi — enforced preko istog `requireEditable` koda već potvrđenog u Sprint 02/03 (nije posebno re-testirano uživo ovaj put, isti kod path)
- [ ] Zamjena postojećeg priloga (upload preko postojećeg) — implementirano (`setObligationAttachment` briše stari fajl), nije posebno testirano uživo ovaj put

## Napomena o testiranju
Tokom testiranja otkriven je pravi (ne test) unos "Pravilnik o radu" koji je direktor kreirao uživo u aplikaciji dok je ACA radio na ovom sprintu — potvrđeno kroz audit log (KREIRANJE, direktor@idss.ba, 2026-07-09 09:56 UTC) i ostavljeno netaknuto. Aplikacija je u praktičnoj upotrebi paralelno sa razvojem.

## Technical Notes
- `multer` dodat kao nova zavisnost (Commander M-12 — Express nema built-in multipart parsing, ovo je "genuinely impossible without a new library")
- `attachment_path` format: `${obligationId}/${timestamp}_${originalFilename}`

## Files Expected to Change
- `migrations/006_obligation_attachments_bucket.sql` (novo, već primijenjeno)
- `server/features/obligations/{repository,routes,domain,schemas}.ts` (izmjena)
- `server/lib/storage.ts` (novo — Supabase Storage helper funkcije)
- `src/App.tsx`, `src/lib/api-client.ts` (izmjena — dvokoračni create/update+upload tok)
- `package.json` (izmjena — `multer`, `@types/multer`)

---

## HANDOFF NOTE — Sprint 04

**Completed:** Vidi Acceptance Criteria gore. Attachment upload/download/delete-cleanup potpuno funkcioniše, testirano uživo sa stvarnim fajlom kroz kompletan API poziv (ne mock).

**Not completed (namjerno, van opsega):** Vidi "Scope — OUT" gore (verzionisanje priloga, in-app pregled).

**Open risks:**
- Zamjena postojećeg priloga (upload preko već postojećeg) nije posebno testirana uživo ovaj put — logika postoji (`setObligationAttachment` briše stari fajl prije/poslije uploada novog), ali vrijedi provjeriti u sljedećem sprintu koji dotiče ObligationForm.
- STANDARD_USER ownership provjera na attachment rutama nije re-testirana uživo ovaj put (isti `requireEditable` kod već potvrđen u Sprint 02/03).

**Next sprint:** Sprint 05 — Real Time (uklanjanje hardkodovanog "danas")
