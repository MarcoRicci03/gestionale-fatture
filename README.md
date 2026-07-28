# Gestionale Fatture

Gestionale fatture per uno studio professionale (single-tenant per utente: ogni
account vede solo i propri paganti, pazienti e fatture). Next.js 16 (App
Router, Turbopack) + PostgreSQL via Prisma, autenticazione custom via JWT in
cookie (nessun provider esterno).

Per l'architettura in dettaglio vedi [`CLAUDE.md`](./CLAUDE.md) e
[`AGENTS.md`](./AGENTS.md) — pensati per un assistente AI, ma sono la
documentazione più aggiornata anche per chi sviluppa.

## Prerequisiti

- Node.js 20+
- Docker e Docker Compose (per Postgres in sviluppo e per lo stack di
  produzione)

## Sviluppo locale

1. Installa le dipendenze:

   ```sh
   npm install
   ```

2. Avvia Postgres locale (container `postgres-dev`, db `gestionale`, utente
   `admin`):

   ```sh
   docker compose -f docker-compose.dev.yml up -d
   ```

3. Crea un file `.env` nella root con almeno:

   ```sh
   DATABASE_URL="postgresql://admin:password_dev@localhost:5432/gestionale?schema=public"
   JWT_SECRET="genera-un-valore-casuale-di-almeno-32-byte"  # es. openssl rand -base64 48
   JWT_EXPIRES_IN="7d"
   ```

   Opzionali: `TRUSTED_PROXY` e `DEV_ALLOWED_ORIGINS` — vedi `CLAUDE.md` per
   quando servono.

4. Applica le migration:

   ```sh
   npx prisma migrate dev
   ```

5. Crea il primo amministratore (su un DB appena migrato la tabella utenti è
   vuota: nessuno può accedere, perché creare nuovi utenti richiede già una
   sessione admin):

   ```sh
   SEED_ADMIN_USERNAME=admin SEED_ADMIN_PASSWORD='una-password-di-almeno-12-caratteri' npm run seed
   ```

   Lo script è idempotente (non fa nulla se un admin esiste già). La password
   è temporanea: l'app segnala di cambiarla al primo accesso, da `/account`.

6. Avvia il dev server:

   ```sh
   npm run dev
   ```

   Apri [http://localhost:3000](http://localhost:3000).

## Comandi utili

- `npm run build` / `npm run start` — build di produzione e avvio.
- `npm run lint` — ESLint.
- `npx tsc --noEmit` — type-check.
- `npm test` — suite Vitest (unit + regressioni di sicurezza/logica in
  `scripts/verify-*.test.ts`). `npm run test:watch` per la modalità watch.
- `npm run test:e2e` — suite Playwright (`e2e/`).
- `npx prisma studio` — esplora il database.

## Deploy in produzione

Lo stack di produzione (`docker-compose.prod.yml`) comprende l'app, Postgres,
un servizio di backup automatico cifrato e un servizio di retention
dell'audit log.

1. Copia `.env.prod.example` in `.env.prod` e valorizza tutte le variabili
   (credenziali Postgres, `DATABASE_URL`, `JWT_SECRET`, chiave di cifratura
   dei backup, ecc. — ogni variabile è commentata nel file stesso).

2. Costruisci e avvia lo stack:

   ```sh
   docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
   ```

3. Applica le migration e crea il primo amministratore nel container `app`:

   ```sh
   docker compose -f docker-compose.prod.yml exec app npx prisma migrate deploy
   docker compose -f docker-compose.prod.yml exec app node prisma/seed.mjs
   ```

   Le credenziali del primo admin sono lette da `SEED_ADMIN_USERNAME` /
   `SEED_ADMIN_PASSWORD` in `.env.prod`.

**TLS obbligatorio prima di esporre il servizio pubblicamente.** L'app
imposta il cookie di sessione come `Secure` in produzione: senza HTTPS il
browser lo scarta silenziosamente e il login sembra riuscire ma torna sempre
a `/login`, senza alcun errore visibile. Lo stack pubblica l'app in chiaro
sulla porta `APP_PORT` (default 3000): metti davanti un reverse proxy con
terminazione TLS (es. Caddy, nginx + certbot) prima di renderlo raggiungibile
da fuori la macchina.

Backup e ripristino del database sono documentati in
[`README-BACKUP.md`](./README-BACKUP.md).
