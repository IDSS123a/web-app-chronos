# DEPLOYMENT.md — Chronos u produkciji

Ovo je vodič korak-po-korak za postavljanje Chronos aplikacije na pravi,
javno dostupan URL. Namijenjen je Davoru (ne treba prethodno programersko
znanje) — svaki korak se radi klikanjem u web pregledniku.

Neke od ovih koraka (kreiranje naloga, unos tajnih ključeva) AI asistent ne
smije raditi umjesto tebe iz sigurnosnih razloga — zato su ovdje detaljno
opisani.

---

## Poznat problem — riješen 2026-07-10: "no-deploy" / 502 na prvom deploy-u

Ako je aplikacija bila deploy-ovana prije 10.07.2026. i nikad se nije
uspješno pokrenula (stranica vraća grešku, Render dashboard ne pokazuje
uspješan deploy), uzrok je bio: `tsx` i `cross-env` — alati koje
`npm run start` stvarno koristi u produkciji — bili su pogrešno
klasifikovani kao `devDependencies` umjesto `dependencies`, pa ih
produkcijska instalacija nije postavila. Popravljeno u `package.json`.

**Ako se ovo ikad ponovi**: u Render dashboard-u otvori servis → **Manual
Deploy** → **Deploy latest commit** da povučeš najnoviju ispravku, i prati
**Logs** tab da vidiš stvaran izlaz `npm install`/`npm run build`/
`npm run start` komandi — to je najbrži način da se vidi tačan uzrok ako se
nešto slično opet desi.

---

## Pregled arhitekture

Cijela aplikacija (i sajt koji vidiš i pozadinski servis koji šalje
podsjetnike) radi kao **jedan servis** na Render.com (CD-006 u
`DECISION_LOG.md`). Baza podataka ostaje na Supabase-u (već postavljeno).
Nema posebne domene za sada — koristi se besplatna Render poddomena (npr.
`chronos-idss.onrender.com`).

---

## Korak 1 — Kreiraj Render nalog

1. Idi na [render.com](https://render.com) i klikni "Get Started".
2. Prijavi se preko svog GitHub naloga (istog onog gdje je `IDSS123a/web-app-chronos` repozitorij) — ovo automatski daje Renderu pristup da vidi kod.

## Korak 2 — Kreiraj novi servis preko Blueprint-a

1. U Render dashboard-u klikni **New +** → **Blueprint**.
2. Odaberi repozitorij `IDSS123a/web-app-chronos`.
3. Render će automatski pronaći `render.yaml` fajl iz repozitorija i
   predložiti tačno jedan servis: `chronos-idss`.
4. Klikni **Apply** / **Create**.

## Korak 3 — Unesi tajne ključeve (env varijable)

Render će za svaku od dolje navedenih varijabli tražiti da je ručno unesešs
(namjerno nisu u kodu, radi sigurnosti). Otvori svoj `.env` fajl na računaru
(ili pitaj AI asistenta da ti pokaže koje vrijednosti već postoje lokalno,
BEZ da ih ispisuje u razgovoru) i prekopiraj tačno iste vrijednosti:

| Varijabla | Odakle | Napomena |
|---|---|---|
| `SUPABASE_URL` | Supabase dashboard → Project Settings → API | Isto što i u lokalnom `.env` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase dashboard → Project Settings → API | **Tajno** — nikad ne dijeliti javno |
| `VITE_SUPABASE_URL` | Isto kao `SUPABASE_URL` | |
| `VITE_SUPABASE_ANON_KEY` | Supabase dashboard → Project Settings → API | Javni ključ, ali i dalje kopiraj tačno |
| `RESEND_API_KEY` | Resend dashboard → API Keys | Isto što i u lokalnom `.env` |
| `RESEND_FROM_EMAIL` | Tvoj odabrani "šalje od" email | Vidi Korak 5 ispod prije nego što ovo promijeniš |

`NODE_ENV=production` je već postavljen automatski preko `render.yaml`.

## Korak 4 — Sačekaj prvi deploy

Render će sada pokrenuti `npm install && npm run build`, zatim
`npm run start`. Prvi deploy traje 3-5 minuta. Prati napredak u "Logs" tabu.
Kada vidiš u logovima:

```
[chronos-server] Reminder cron job registered: 08:00 Europe/Sarajevo daily
[chronos-server] Express listening on http://localhost:XXXX (production, serving built frontend)
```

...aplikacija je uživo. Render ti daje URL na vrhu stranice (npr.
`https://chronos-idss.onrender.com`) — otvori ga i prijavi se kao i obično.

**Napomena o besplatnom tier-u:** Render-ov besplatni plan "uspava" servis
nakon perioda neaktivnosti, pa prvi zahtjev nakon pauze može potrajati
10-30 sekundi dok se probudi. Za instituciju koja koristi Chronos svakodnevno
ovo obično nije problem, ali ako smeta, razmisliti o plaćenom "Starter"
planu ($7/mjesec) koji ostaje uvijek aktivan — posebno važno jer i jutarnji
08:00 podsjetnik zahtijeva da servis bude budan u tom trenutku.

---

## Korak 5 — Verificiraj Resend domenu (za stvarnu dostavu emaila)

Ovo je odvojeno od deployment-a, ali blokira da podsjetnici stvarno stignu
zaposlenima (vidi `DECISION_LOG.md` CD-003 i `sprints/SPRINT_06.md`).

1. Idi na [resend.com/domains](https://resend.com/domains) i klikni "Add Domain".
2. Unesi domenu institucije (npr. `idss.ba` ili poddomenu poput `mail.idss.ba`).
3. Resend će dati 2-3 DNS zapisa (obično TXT i CNAME) koje treba dodati kod
   registrara domene (ko god upravlja DNS-om za idss.ba/idss.edu.ba).
4. Nakon što DNS zapisi budu vidljivi (obično do 24h, često brže), Resend
   automatski verificira domenu.
5. Tek tada promijeni `RESEND_FROM_EMAIL` u Render env varijablama na
   pravu institucionalnu adresu (npr. `podsjetnici@idss.ba`) i ponovo
   deploy-uj (Render → Manual Deploy).

Do tada, sistem radi ispravno, ali stvarno slanje uspijeva samo ka
`idsssarajevo@gmail.com` (vlasnik Resend naloga) — svi ostali primaoci
dobijaju grešku koja se ispravno bilježi u AuditLogs.

## Korak 6 — Zaštita od kompromitovanih lozinki (Supabase) — NIJE dostupno na trenutnom planu

Sigurnosni pregled (Sprint 08) je pronašao da ova opcija nije uključena, ali
pokušaj uključivanja vraća grešku:

> Failed to update auth configuration: Configuring leaked password
> protection via HaveIBeenPwned.org is available on Pro Plans and up.

Ovo je ograničenje Supabase **besplatnog** plana — funkcija postoji tek na
plaćenom "Pro" planu (trenutno od $25/mjesec). **Ovo nije blokada za
pokretanje Chronos-a** — samo znači da Supabase neće dodatno provjeravati
da li korisnik bira lozinku koja je poznata iz javno procurjelih baza.
Osnovna Auth sigurnost (hashovane lozinke, JWT sesije, RBAC) radi
normalno i bez ovoga.

Ako institucija kasnije odluči da nadogradi Supabase na Pro plan (zbog ove
ili neke druge Pro funkcije), toggle je isti kao gore: **Authentication**
→ **Policies**/**Providers** → "Leaked password protection". Do tada,
ostaje otvorena backlog stavka — ne treba ništa raditi.

---

## Šta AI asistent NIJE mogao uraditi umjesto tebe (i zašto)

- Kreiranje Render naloga i unos tajnih ključeva — sigurnosno pravilo:
  asistent nikad ne unosi lozinke/API ključeve niti kreira naloge u tvoje ime.
- DNS zapisi za Resend domenu — zahtijeva pristup registraru domene koji
  asistent nema (i ne bi smio imati).
- Leaked-password-protection toggle — pokazalo se da ovo uopšte nije
  dostupno na trenutnom (besplatnom) Supabase planu, van toga da je i
  inače dashboard-only podešavanje, van dometa dostupnih alata.

Sve ostalo (kod, konfiguracija, `render.yaml`, sigurnosni pregled baze) je
već pripremljeno i testirano.
