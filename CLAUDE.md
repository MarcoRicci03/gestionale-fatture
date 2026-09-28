# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 1. Panoramica

Gestionale fatture per studio professionale sanitario (logopedia) con invio al **Sistema Tessera Sanitaria** (Sogei). Codice, commenti, messaggi UI e nomi di dominio sono **in italiano**.

- **Stack:** Next.js 16 (App Router, Turbopack, `output: "standalone"`), React 19, TypeScript strict, Tailwind v4 + shadcn (`@base-ui/react`), Prisma 7 + PostgreSQL 16, Zod 4, Vitest, Playwright.
- **Prisma 7 con driver adapter:** client singleton in `lib/prisma.ts` (`PrismaPg` su un `pg.Pool` con limiti espliciti). L'URL del DB sta in `prisma.config.ts`, non in `schema.prisma`. Il client si importa da `@prisma/client`.
- **Multi-tenant applicativo:** ogni utente vede solo i propri dati. Ogni query filtra per `id_Utente: userId` (non c'è RLS nel DB).
- **Auth custom:** JWT (`jose`) nel cookie `session_token`. `getSession()` (`lib/auth/session.ts`) controlla `abilitato` e `tokenVersion` a ogni richiesta, deduplicato con `React.cache`.
- **Fuso orario fisso `Europe/Rome`:** impostato dagli script npm (`cross-env TZ=...`) e dal Dockerfile.

## 2. Comandi

### Sviluppo e Docker
```sh
docker compose -f docker-compose.dev.yml up -d   # Postgres dev (container postgres-dev, 127.0.0.1:5432, admin/password_dev, db gestionale)
npm run dev                                      # dev server su :3000
```
`.env` minimo: `DATABASE_URL`, `JWT_SECRET` (≥32 byte), `JWT_EXPIRES_IN`. Opzionali:
- `TRUSTED_PROXY=true`: solo dietro un reverse proxy che imposta lui stesso `X-Forwarded-*`/`cf-connecting-ip`. Senza, gli IP collassano su "unknown" (vale per rate limit e same-origin).
- `DEV_ALLOWED_ORIGINS`: origini LAN separate da virgola, passate a `allowedDevOrigins`.
- `TS_ENCRYPTION_SECRET`: cifratura delle credenziali Sistema TS. È obbligatorio in produzione.
- `SISTEMATS_*`: vedi la sezione Sistema TS.

### Database e Prisma
```sh
npx prisma migrate dev --name <nome>   # crea e applica una migration dopo una modifica a schema.prisma
npx prisma generate                    # rigenera il client (gira anche in postinstall)
npx prisma studio
npx prisma migrate deploy              # produzione: il container app lo esegue già all'avvio (CMD del Dockerfile)
SEED_ADMIN_USERNAME=admin SEED_ADMIN_PASSWORD='...(≥12 caratteri)' npm run seed   # primo admin, idempotente
npm run seed:dev   # dataset di prova Sistema TS (casi limite bollo/CF)
npm run seed:ui    # ~100 fatture per testare paginazione e filtri
```

### Test, lint, typecheck
```sh
npx tsc --noEmit                               # typecheck (non esiste uno script npm "typecheck")
npm run lint                                   # ESLint 9 flat config (next core-web-vitals + typescript)
npm test                                       # Vitest (jsdom): unit + scripts/verify-*.test.ts
npx vitest run lib/fiscal/bollo.test.ts        # singolo file
npx vitest run -t "nome del test"              # singolo test per nome
npm run test:db                                # integrazione su Postgres reale (DB gestionale_test creato e distrutto); richiede il container dev
npm run test:e2e                               # Playwright (chromium, 1 worker; avvia o riusa npm run dev su :3000)
npx playwright test e2e/login.spec.ts          # singolo spec
```
La CI (`.github/workflows/ci.yml`) esegue `prisma generate`, `tsc --noEmit`, `lint` e `npm test`. Non esegue `test:db` né `test:e2e`.
Il global setup e2e si rifiuta di partire se `NODE_ENV=production` o se `DATABASE_URL` non punta a localhost (`e2e/safe-test-environment.ts`).

### Build e produzione
```sh
npm run build && npm run start
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build   # app + db + backup cifrato + retention audit log
```
Le variabili di produzione sono documentate in `.env.prod.example`, backup e restore in `README-BACKUP.md`. In produzione il cookie è `Secure`: senza TLS davanti il login fallisce in silenzio.

## 3. Architettura e convenzioni

### Flusso di una richiesta
- **`proxy.ts`** (in Next 16 sostituisce `middleware.ts`): sulle richieste GET/HEAD reindirizza a `/login` se manca la sessione e, **solo in produzione**, genera il nonce CSP per richiesta (`lib/security/csp.ts`). Esclude `/api/*` e tutte le richieste non-GET: **Server Actions e route API si autenticano da sole.**
- **Pagine** `app/(protected)/<area>/page.tsx`: sono Server Component async.
  1. Leggono `searchParams` con `parseXxxListQuery` (`lib/validations/*-list-query.ts`).
  2. Caricano i dati da `lib/data/*`.
  3. Passano tutto a un `XxxManager` client in `components/<area>/`.

  Il layout `(protected)` chiama `requireSession()`.
- **`lib/data/*`** (lettura): ogni funzione chiama `requireUserId()` e filtra per `id_Utente`. Per i campi utente si usano select esplicite (`SAFE_USER_SELECT`, `INVOICE_MITTENTE_SELECT`), così `passwordHash` non arriva mai al client. Per la paginazione si usa `lib/utils/pagination.ts` (`calculatePagination`/`clampPage`).
- **`lib/actions/*`** (mutazioni, file `"use server"`). Pattern fisso (vedi `lib/actions/payers.ts`):
  1. `requireUserId()` / `requireAdmin()`
  2. `schema.safeParse()` (Zod)
  3. Prisma (`$transaction` se sono coinvolte più righe), con mappatura degli errori tramite `lib/prisma-errors.ts`
  4. `await logAudit({ azione: AUDIT_ACTIONS.X, ... })`
  5. `revalidatePath(...)`
  6. ritorno di un `ActionResult` (`lib/types/actions.ts`: `{ success, error?, fieldErrors?, data? }`)

  La logica complessa sta nei service (es. `lib/sistemats/services/*.service.ts`) e l'action resta sottile.
- **`app/api/**/route.ts`**: solo per risposte binarie (PDF fattura, export Excel, ricevuta TS). Pattern:
  1. `getUserIdOrNull()`, che risponde 401 invece di reindirizzare
  2. rate limiter (`lib/auth/rate-limiter.ts`)
  3. validazione dell'id
  4. `Cache-Control: private, no-store`
- **Form client**: `react-hook-form` + `zodResolver` con **lo stesso schema** di `lib/validations/`, poi chiamata diretta all'action e gestione di `ActionResult`.

### Invarianti verificate da `npm test` (`scripts/verify-*.test.ts`)
Sono test statici sul sorgente e falliscono se violi:
- Ogni `export async function` in un file `"use server"` è un endpoint RPC pubblico e deve chiamare `requireUserId(`, `requireSession(` o `requireAdmin(`. Le eccezioni vanno in `PUBLIC_ACTIONS`. **Non esportare helper da file `"use server"`.**
- Ogni action mutante chiama `logAudit(` o `logAuditOrThrow(`. Le eccezioni vanno in `READ_ONLY_ACTIONS`. `logAuditOrThrow` si usa solo dentro una transazione, quando l'audit è l'unica traccia rimasta.
- Il `meta` dell'audit **non contiene mai PII** (nome, CF, P.IVA, indirizzo) né segreti. Si usano solo id e conteggi.
- Ogni handler in `app/api/**/route.ts` verifica la sessione. Le eccezioni vanno in `PUBLIC_ROUTES` (oggi solo `/api/health`).
- Altri test controllano security header, limiti di input, arrotondamento valuta, bollo, rate limit e configurazione Docker. Se uno fallisce, leggi il commento del test prima di "correggerlo".

### Dominio (modelli Prisma in italiano, tabelle con `@@map`)
- `Utente`, `Pagante` (chi paga), `Paziente`, `Pagamento` (= **fattura**), `FatturaMese`, `AuditLog`, `ImpostazioniPdf`, `ImpostazioniSistemaTs`, `TrasmissioneTs` (relazione m:n con le fatture).
- **Archiviazione, non cancellazione:**
  - `archiviato` ha `@map("eliminato")`.
  - Archiviare un pagante archivia a cascata i suoi pazienti con `archiviatoInCascata=true`. Il flag serve al ripristino.
  - Le guardie stanno in `lib/archive/guards.ts`.
- **Snapshot immutabili sulla fattura:** `snapshotAnagrafica` e `pdfLayoutSnapshot`. Leggi l'anagrafica sempre tramite `resolveAnagrafica()` (`lib/invoices/anagrafica-snapshot.ts`), che ricade sulle relazioni live se lo snapshot è NULL.
- Numerazione univoca su `(id_Utente, n_fattura, anno)`. Il bollo segue `lib/fiscal/bollo.ts`.
- **Date:** usa `parseDateInput`/helper di `lib/utils/date.ts`, che costruiscono le date a mezzogiorno in ora locale. Mai `new Date("yyyy-mm-dd")`.

### Sistema TS (`lib/sistemats/`)
- **Componenti:**
  - client SOAP/MTOM con retry in `client.ts`
  - XML conforme a `schemas/730_precompilata.xsd` in `xml-builder.ts`
  - cifratura RSA dei CF con il certificato `certs/SanitelCF.cer` in `crypto.ts`
  - credenziali utente in AES-256-GCM in `vault.ts`
  - parser CSV degli esiti in `csv-parser.ts`
  - orchestrazione in `services/`
- **Stato della fattura:** enum `StatoTs` su `Pagamento`, con i valori `DA_INVIARE`, `IN_TRASMISSIONE`, `INVIATA`, `DA_CANCELLARE_SU_TS`, `ANNULLATA_TS`.
- **Endpoint:** per default puntano all'ambiente **di test** Sogei. Un endpoint non di test viene bloccato se manca `SISTEMATS_ALLOW_PRODUCTION=true`.

### Struttura cartelle
- `app/`: route (`(protected)/`, `login/`, `api/`).
- `components/<area>/`: UI client per dominio. `components/ui/` contiene i primitivi shadcn.
- `lib/`: `actions/` (scrittura), `data/` (lettura), `validations/` (schemi Zod), `auth/`, `audit/`, `security/`, `pdf/` (`@react-pdf/renderer`), `excel/` (exceljs, con sanitizzazione contro formula injection), `sistemats/`, `constants/`, `utils/`, `hooks/`.
- `schemas/`: **non** contiene schemi Zod, solo l'XSD ministeriale del Sistema TS. Gli schemi Zod stanno in `lib/validations/`.
- `scripts/`: test di invarianti `verify-*`, `db-integration/`, script operativi `.mjs` (retention audit, backup, fix legacy).
- `e2e/`: spec Playwright con fixtures.

### TypeScript
- `strict: true`, alias `@/*` verso la root.
- I tipi dei form si derivano da Zod (`z.input`/`z.output<typeof schema>`) e i tipi DB da `@prisma/client`. Non duplicare interfacce a mano.
- I test stanno accanto al file (`*.test.ts(x)`), con `globals: true` e i matcher `jest-dom`.

## 4. Regole per l'agente

- **Dopo modifiche non banali esegui `npx tsc --noEmit`**, poi `npm run lint` e `npm test`. È la stessa sequenza della CI.
- **Non modificare a mano `prisma/migrations/**` né il client generato.** Modifica `schema.prisma` e usa `npx prisma migrate dev --name ...` / `npx prisma generate`.
- **Indici parziali su `paganti.cf`/`piva`:** stanno nell'SQL della migration `init`. **Non** aggiungere `@@unique([id_Utente, cf/piva])` allo schema. Il drift segnalato da `migrate dev` su questi indici è atteso. Non usare `prisma db push`.
- Ogni nuova query deve filtrare per `id_Utente`. Ogni nuova action deve verificare la sessione e chiamare `logAudit`, come richiesto dai test di invarianti.
- I commenti citano ID di audit. I rilievi aperti sono in `CODE_REVIEW_ARCHITECT.md` (`SEC-`, `ARCH-`, `ERR-`...) e in `CODERABBIT_REVIEW.md` (`CR-`). Quando risolvi un rilievo, aggiorna il suo stato in quel file e aggiungi una nota sul fix. Gli ID più vecchi citati nel codice vengono da report di audit ormai rimossi.
- Non toccare `certs/`, `.env*` né i segreti. Non puntare mai e2e o seed a un DB non locale.
