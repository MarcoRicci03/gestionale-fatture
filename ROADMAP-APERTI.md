# Roadmap — problemi ancora aperti

**Data:** 2026-08-03
**Sostituisce:** `ROADMAP.md` (analisi 2026-07-26) e `ROADMAP-ANALISI-2026-07-31.md` (analisi 2026-07-31).

Le due analisi precedenti hanno coperto insieme decine di rilievi tra sicurezza, correttezza, prestazioni, database, deploy, qualità del codice e documentazione. La quasi totalità è stata risolta con un fix di codice verificabile nella cronologia git, o chiusa con una decisione esplicita documentata (in `CLAUDE.md` o nei documenti stessi). Questo file elenca **solo** ciò che resta davvero aperto oggi — verificato leggendo lo stato attuale del codice, non solo le caselle di spunta dei due documenti precedenti. In un caso il riscontro è cambiato: il file duplicato `.env.prod copy.example`, segnalato come aperto nell'analisi di luglio, non esiste più sul disco.

## Legenda

| Simbolo | Severità |
|---|---|
| 🟠 | Media |
| 🟡 | Bassa |
| ⚪ | Informativo |

---

## Da fare o in sospeso

### SEC-03 — Lockout dell'account provocabile con 5 tentativi falliti quando l'IP non è distinguibile
🟠 media · `lib/auth/rate-limit.ts`, `lib/auth/client-ip.ts`

Fix parziale già applicato: `resolveClientIp()` preferisce ora l'header `CF-Connecting-IP` (impostato da Cloudflare sull'edge, non falsificabile dal client) su `X-Forwarded-For`/`X-Real-IP`.

**Perché resta aperto:** manca un passo puramente operativo, non di codice — impostare esplicitamente `TRUSTED_PROXY=true` in `.env.prod` sul server di produzione reale. Senza quella variabile, `resolveClientIp()` continua a restituire `"unknown"` a prescindere dagli header ricevuti, e il lockout più stretto (5 tentativi) resta di fatto globale invece che per-IP. Non verificabile da questo repository se sia già stato impostato sul server reale.

### SEC-05 — 18 vulnerabilità npm nelle dipendenze di produzione
⚪ informativo · `package.json`

**Perché resta aperto:** nessuna ha un fix non-breaking disponibile a monte. `postcss`/`sharp` sono dipendenze interne di `next` (nessuna versione 16.x patchata), `uuid` è dentro `exceljs` (un fix richiederebbe un downgrade breaking dell'intero pacchetto), `valibot` è dentro la CLI Prisma (usata solo in dev/deploy, mai a runtime). Nessuna è sfruttabile nel flusso reale dell'app — la CI ha `continue-on-error` su questo controllo con un commento che lo spiega. Si risolverà da sé quando Next.js aggiornerà `postcss`/`sharp` a monte; nel frattempo vale la pena solo un controllo periodico per accorgersi di eventuali vulnerabilità *nuove*.

### SEC-06 — Rate limit e lockout in memoria di processo: azzerati a ogni riavvio
🟡 bassa · `lib/auth/rate-limit.ts`, `lib/auth/rate-limiter.ts`

**Perché resta aperto:** nessun fix applicato, per scelta — non urgente finché l'app non è esposta su internet (oggi raggiungibile solo in LAN, con NPM+Cloudflare Tunnel davanti). La soluzione (una tabella `login_attempts` su Postgres, il database c'è già) resta pianificata solo per quando servirà davvero.

### PERF-04 — Ricerche `contains`/`insensitive`: seq scan su tutte le anagrafiche
🟡 bassa · `lib/invoices/list-query.ts`, `lib/patients/list-query.ts`, `lib/payers/list-query.ts`

**Perché resta aperto:** la soluzione (indici GIN trigram via l'estensione `pg_trgm`) richiede scrivere una migration SQL a mano, e non c'è un Postgres/Docker reale disponibile in questo ambiente per verificarla prima di applicarla — un errore in una migration non testata romperebbe `prisma migrate deploy` al prossimo deploy. Rimandato esplicitamente a una sessione con un Postgres di sviluppo raggiungibile. Non peggiora nel frattempo: nessun codice applicativo da cambiare, e il problema cresce solo con le dimensioni dell'archivio (oggi non percepibile con poche centinaia di righe per tabella).

### DEP-03 — Il `Dockerfile` copia l'intero `node_modules` sopra l'output `standalone`
🟡 bassa · `Dockerfile`

**Perché resta aperto:** un fix (copia selettiva dei soli moduli necessari alla CLI Prisma) è stato applicato e poi **annullato** dopo due crash reali in produzione — prima un symlink della CLI Prisma rotto dalla copia esplicita (`node_modules/.bin/prisma`), poi, risolto quello, una dipendenza transitiva (`effect`) mancante. L'albero di dipendenze della CLI Prisma è più profondo e meno prevedibile di quanto stimato inizialmente. Da riprendere solo con un ambiente Docker reale disponibile, per poter verificare l'elenco completo delle dipendenze prima di riprovare — troppo rischioso da rifare "alla cieca" contro la produzione.

### QUA-03 — `getPdfSettings()` restituisce `id: 0` come valore sentinella
🟡 bassa · `lib/data/settings.ts:38-46` (verificato: ancora presente nel codice)

**Perché resta aperto:** nessun tentativo di fix ancora fatto. Non prioritario perché oggi non causa danni concreti (nessun chiamante controlla `id`), ma resta un valore che mente sul proprio significato in un tipo che non ammette l'assenza — un rischio latente per un futuro `if (settings.id) { ... }` o un log che riporta l'id.

### DOC-01 — Rimandi a documenti che non esistono nel repository
🟡 bassa · `next.config.ts`, `lib/security/csp.ts`, `proxy.ts`, `lib/invoices/anagrafica-snapshot.test.ts`, `scripts/audit-log-retention.mjs`, `scripts/verify-csp-nonce.test.ts`, `scripts/lib/retention-schedule.mjs` (verificato: 7 riferimenti ancora presenti a `PIANO_FIX_CSP_NONCE.md`, `PIANO_FIX_AUDIT_LOG_RETENTION.md` e a uno spec doc sotto `docs/superpowers/specs/`)

**Perché resta aperto:** dipende dalla decisione su DOC-02 qui sotto — se si comincia a versionare `docs/`, questi rimandi diventano validi; altrimenti vanno rimossi (i commenti circostanti si spiegano comunque da soli anche senza il rimando).

### DOC-02 — `.gitignore` esclude `docs/`: la documentazione di progetto non è versionata
🟡 bassa · `.gitignore:60` (verificato: ancora presente)

**Perché resta aperto:** richiede una decisione dell'utente su cosa versionare (piani di design, specifiche) e cosa tenere fuori (stato di strumenti come `.claude/`/`.superpowers/`, che è giusto ignorare) — non ancora presa. Stesso rilievo segnalato in entrambe le analisi precedenti (`ROADMAP.md` lo chiamava DOC-03).

---

## Rischio accettato per decisione esplicita

Non sono difetti dimenticati: sono stati valutati e si è deciso consapevolmente di non intervenire. Li elenco comunque perché la condizione descritta è ancora vera nel codice oggi, e perché è quello che hai chiesto di sapere ("perché non l'abbiamo fixato").

### Numerazione fatture: hard-delete + `max(n_fattura)+1`
`lib/actions/invoices.ts`, `lib/data/invoices.ts` — cancellare una fattura può lasciare un buco nella numerazione o far riassegnare lo stesso numero a un documento diverso. **Decisione presa (2026-08-01):** comportamento confermato corretto per questo gestionale a uso singolo professionista, dove le cancellazioni sono previste solo su errori pre-consegna. Documentato in `CLAUDE.md`.

### CSP con `style-src 'unsafe-inline'`
`lib/security/csp.ts` — l'editor PDF posiziona i blocchi del canvas con l'attributo HTML `style` calcolato a runtime, che un nonce CSP non copre (copre solo i tag `<style>`). **Revisionato (2026-07-31):** lasciato com'è per decisione esplicita — sfruttarlo richiederebbe comunque una XSS che `script-src` (già irrigidito con nonce + `strict-dynamic`) blocca prima.

---

## Verificato e non più un problema

### Duplicato `.env.prod copy.example`
Segnalato come aperto in `ROADMAP-ANALISI-2026-07-31.md` (DOC-03). Il file non esiste più sul disco — verificato ora, prima di scrivere questo documento. Nessuna azione necessaria.
