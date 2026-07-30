# Kinene

Sito e sistema di prenotazione per **Kinene** — allevamento di Cane Corso e servizi di pensione, asilo diurno/notturno e dog sitting a Guiglia (MO).

## Stack

| | |
|---|---|
| Framework | Astro 7 (statico + SSR sulle sole rotte dinamiche) |
| UI | Tailwind v4, Preact (una sola isola: il calendario) |
| Database | SQLite via libSQL + Drizzle ORM |
| Deploy | Docker su una singola macchina Render, con disco persistente |
| Test | Vitest (unit) + Playwright & axe-core (E2E, a11y, responsive) |

Le pagine di marketing sono prerenderizzate e non spediscono JavaScript. Solo `/prenota` e `/admin/*` sono server-rendered.

## Sviluppo

```bash
npm install
cp .env.example .env
npm run auth:hash -- "la-tua-password"   # incolla i due valori in .env
npm run db:migrate
npm run dev
```

Il sito è su `http://localhost:4321`, la gestione su `/admin`.

## Comandi

| Comando | Cosa fa |
|---|---|
| `npm run dev` | server di sviluppo |
| `npm run build` | verifica i contrasti del tema, poi compila |
| `npm test` | 145 test unitari (disponibilità, regolamento, prezzi, date, auth, upload) |
| `npm run test:e2e` | 60 test end-to-end, accessibilità, responsive, CSRF e galleria |
| `npm run tokens:verify` | verifica WCAG AA su tutte le coppie di colore |
| `npm run db:migrate` | applica le migrazioni |
| `npm run db:generate` | genera una migrazione dopo aver modificato lo schema |
| `npm run auth:hash -- "pw"` | genera `ADMIN_PASSWORD_HASH` e `SESSION_SECRET` |
| `npm run lock:refresh` | rigenera il lockfile includendo le dipendenze linux — **da lanciare ogni volta che aggiungi un pacchetto**, altrimenti la build Docker fallisce |

## Deploy su Render

`render.yaml` è già pronto: servizio Docker, piano **starter** (serve un disco persistente, il piano free non lo supporta), disco da 2 GB montato su `/data` (database **e** foto della galleria).

1. Collega il repository su Render → "New Blueprint Instance"
2. Imposta le variabili non sincronizzate:
   - `ADMIN_PASSWORD_HASH` — da `npm run auth:hash`
   - `NOTIFY_EMAIL`, `SMTP_USER`, `SMTP_PASS` — vedi *Notifiche email* più sotto
   - `SESSION_SECRET` viene generato da Render
3. Deploy. Le migrazioni girano automaticamente all'avvio del container.

Health check su `/api/health`. Sul disco vivono sia il database (`/data/kinene.db`) sia le foto caricate (`/data/uploads`): fai il backup del disco.

Test locale dell'immagine:

```bash
docker build -t kinene . && docker run -p 8080:4321 -e SESSION_SECRET=$(openssl rand -hex 32) -e ADMIN_PASSWORD_HASH="..." -v kinene-data:/data kinene
```

## Struttura

```
src/
  config/business.ts     ← TUTTI i dati aziendali: prezzi, orari, capienza, contatti
  lib/
    dates.ts             numerazione dei giorni (giorni dall'epoch, niente fusi orari)
    availability.ts      griglia di occupazione (Int16Array, SoA)
    rules.ts             il regolamento come predicati puri
    pricing.ts           preventivi in centesimi interi
    season.ts            alta stagione, con calcolo della Pasqua
    booking.ts           validazione della richiesta lato server
    auth.ts              scrypt + cookie di sessione firmato HMAC
    media.ts             validazione degli upload sui magic byte
    storage.ts           derivate WebP su disco, via sharp
    notify.ts            email di notifica, degradano se SMTP manca
  db/                    schema Drizzle e query
  components/            componenti Astro + il calendario Preact
  pages/                 rotte
```

**Tutto ciò che riguarda l'attività sta in `src/config/business.ts`.** Prezzi, orari di apertura, finestre di consegna e ritiro, capienza, penali, contatti: si cambiano lì e si propagano a tutto il sito, ai preventivi e alla validazione.

## Note tecniche

- **Occupazione**: `Int16Array` indicizzato per giorno, non un array di oggetti. Il riempimento è O(prenotazioni × notti), ogni interrogazione successiva è O(1) per giorno.
- **Date**: tutto è un numero intero di giorni dall'epoch UTC. Nessun `Date` nella logica, nessun bug di fuso orario o di ora legale.
- **Le prenotazioni sono richieste**, non conferme. Solo lo stato `confirmed` consuma capienza, quindi l'overbooking è strutturalmente impossibile.
- **Le regole si applicano sul server.** La validazione nel browser è solo cortesia.
- **L'hash della password usa `.` come separatore, non `$`** — `dotenv-expand` interpreta `$nome` come variabile e troncherebbe silenziosamente il valore. C'è un test che lo verifica.
- **Nessun tracciamento**: font self-hosted, nessuna CDN, nessuna analytics. Per questo non serve il banner cookie.

## Notifiche email

Le richieste di prenotazione inviano due email: una a Valeria e una di riepilogo al
proprietario. Servono le credenziali SMTP in `.env` (o nelle variabili di Render):

```
SMTP_HOST=smtp.mail.me.com
SMTP_PORT=587
SMTP_USER=valeria.borda@icloud.com
SMTP_PASS=<password per app>
NOTIFY_EMAIL=valeria.borda@icloud.com
```

Per iCloud serve una **password per app** generata su appleid.apple.com, non la
password dell'account.

Senza credenziali il sito continua a funzionare: la prenotazione viene salvata e
resta visibile in `/admin`, ma nessuna email parte e il server scrive un avviso nei
log. In quel caso bisogna controllare l'area di gestione a mano.

## Cosa manca

- **Foto**: la galleria è pronta e si gestisce da `/admin/galleria`, ma finché non
  vengono caricate immagini le pagine mostrano segnaposto.
- **P.IVA**: non ancora presente. Footer, informativa privacy e dati strutturati la
  omettono automaticamente finché `vatNumber` resta vuoto in `src/config/business.ts`.
- **Affiliazione ENCI**: da inserire quando la sezione allevamento andrà online.
- **Sezione allevamento**: `/allevamento` è una pagina "presto disponibile", in
  noindex e fuori dalla navigazione.
