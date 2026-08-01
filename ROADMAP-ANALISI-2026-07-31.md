# Roadmap — problematiche aperte

**Data analisi:** 2026-07-31
**Branch / commit:** `master` @ `2b5b29b`
**Ambito:** analisi indipendente dell'intero repository (297 file tracciati, ~17.000 righe di sorgenti) su sicurezza, correttezza/logica, prestazioni, database, deploy, qualità del codice e documentazione.
**Contesto:** applicazione **non ancora deployata**, uso previsto locale/singolo studio. I rilievi di deploy sono quindi "da risolvere prima del primo deploy", non incidenti in corso.

---

## Come usare questo documento

Ogni voce dell'indice ha una casella di spunta: quando un problema è risolto, sostituisci `- [ ]` con `- [x]` nella riga dell'indice e aggiungi una nota **Fix applicato** nella sezione corrispondente. Il codice di ogni rilievo è un link diretto alla sua spiegazione completa.

| Simbolo | Severità |
|---|---|
| 🔴 | Alta — blocca il deploy, o impatta dati/sicurezza in modo concreto |
| 🟠 | Media — problema reale, da pianificare |
| 🟡 | Bassa — miglioramento o difesa in profondità |
| ⚪ | Informativo — da monitorare, nessuna azione immediata possibile |

---

## Baseline verificata

Eseguita all'inizio dell'analisi:

| Comando | Esito |
|---|---|
| `npx tsc --noEmit` | ✅ **0 errori** |
| `npm test` | ✅ **529 test su 86 file, tutti passati** |
| `npm run lint` | ✅ **0 errori, 0 warning** |
| `npm audit --omit=dev` | ⚠️ **18 vulnerabilità (13 high, 5 moderate)** → vedi [SEC-05](#sec-05) |

**Cosa è risultato solido** (verificato esplicitamente, nessun rilievo): l'isolamento multi-tenant applicativo — ogni funzione in `lib/data/*.ts` e `lib/actions/*.ts` filtra per `id_Utente` senza eccezioni; la revoca delle sessioni al cambio password via `tokenVersion`; il dummy-hash con lo stesso cost factor contro il timing attack sul login; bcrypt cost 12; la whitelist `SAFE_USER_SELECT`/`INVOICE_MITTENTE_SELECT` che tiene `passwordHash` fuori dai payload RSC; gli snapshot immutabili di anagrafica e layout PDF sulle fatture emesse; le guardie su hard-delete di pagante/paziente e la cascata `archiviatoInCascata`; la guardia "ultimo admin"; la sanitizzazione contro formula injection nell'export Excel; `Cache-Control: private, no-store` su PDF ed export; la validazione Zod su ogni Server Action e route API; l'assenza di `dangerouslySetInnerHTML` non controllato, `innerHTML`, `eval`; nessun `.env` tracciato in git; container che gira come utente non privilegiato; CI su GitHub Actions con type-check, lint e test.

---

## Indice

### Sicurezza

- [x] [SEC-01](#sec-01) 🟠 — `JWT_SECRET` reale committato nel `Dockerfile` come default di build
- [x] [SEC-02](#sec-02) 🔴 — Nessun TLS in produzione: il cookie di sessione `Secure` non verrà mai salvato
- [ ] [SEC-03](#sec-03) 🟠 — Lockout dell'account provocabile da chiunque con 5 tentativi falliti — fix parziale, vedi nota
- [x] [SEC-04](#sec-04) 🟠 — L'audit log espone a ogni admin i dati anagrafici dei pazienti di altri utenti
- [ ] [SEC-05](#sec-05) ⚪ — 18 vulnerabilità note nelle dipendenze di produzione, senza fix non-breaking
- [ ] [SEC-06](#sec-06) 🟡 — Rate limit e lockout in memoria di processo: azzerati a ogni riavvio
- [x] [SEC-07](#sec-07) 🟡 — `/api/health` pubblico interroga il DB senza alcun limite
- [x] [SEC-08](#sec-08) 🟡 — Nessun controllo di `Origin` sulle route API POST (oggi solo `SameSite=Lax`)
- [ ] [SEC-09](#sec-09) 🟡 — CSP con `style-src 'unsafe-inline'`

### Correttezza e logica

- [x] [LOG-01](#log-01) ⚪ — Hard-delete della fattura + numerazione `max+1`: numeri riusati e buchi — decisione presa, nessun fix
- [x] [LOG-02](#log-02) 🟠 — Il form fattura sovrascrive città/CAP salvati con quelli attuali del pagante
- [x] [LOG-03](#log-03) 🟠 — L'audit log carica 200 righe e filtra lato client: i filtri "non trovano" il passato
- [x] [LOG-04](#log-04) 🟡 — `archivePayer` non verifica lo stato di partenza, a differenza delle altre azioni
- [x] [LOG-05](#log-05) 🟡 — `getNextInvoiceNumberForYear` chiamata senza `.catch()` nel form
- [x] [LOG-06](#log-06) 🟡 — `logAudit` è best-effort: una mutazione può restare senza traccia

### Prestazioni

- [x] [PERF-01](#perf-01) 🟠 — `getSession()` non memoizzata: 4-5 query identiche su `utenti` per pagina
- [x] [PERF-02](#perf-02) 🟠 — `/invoices` serializza tutta l'anagrafica attiva nel payload di ogni caricamento
- [x] [PERF-03](#perf-03) 🟡 — `buildReplacements()` ricostruito per ogni blocco del PDF
- [ ] [PERF-04](#perf-04) 🟡 — Ricerche `contains`/`insensitive`: seq scan su tutte le anagrafiche — rimandato, vedi nota
- [x] [PERF-05](#perf-05) 🟡 — `getInvoiceYears()` fa un `DISTINCT` su tutte le fatture a ogni caricamento
- [x] [PERF-06](#perf-06) 🟡 — Un nuovo `Pool` `pg` a ogni valutazione del modulo, e nessuna chiusura su `SIGTERM`
- [x] [PERF-07](#perf-07) ⚪ — Paginazione a `OFFSET`: degrada linearmente sulle pagine finali

### Database

- [x] [DB-01](#db-01) 🟠 — Nessun indice sulle chiavi esterne `id_Pagante` / `id_Paziente`
- [x] [DB-02](#db-02) 🟡 — `audit_logs` senza indice su `createdAt` da solo: la retention fa seq scan
- [x] [DB-03](#db-03) 🟡 — Gli indici unique parziali non sono introspettabili: rischio di drift silenzioso

### Deploy e infrastruttura

- [x] [DEP-01](#dep-01) 🔴 — Nessun reverse proxy né terminazione TLS nello stack di produzione
- [x] [DEP-02](#dep-02) 🟠 — L'app viene pubblicata su tutte le interfacce della macchina
- [ ] [DEP-03](#dep-03) 🟡 — Il `Dockerfile` copia l'intero `node_modules` sopra l'output `standalone` (tentato e poi ANNULLATO, vedi nota)
- [x] [DEP-04](#dep-04) 🟡 — `rclone.conf` montato come obbligatorio ma non versionato
- [x] [DEP-05](#dep-05) 🟡 — `audit-log-retention` riusa l'immagine di `app` senza dichiarare `build`
- [x] [DEP-06](#dep-06) 🟡 — Nessun allarme sui fallimenti di backup e retention

### Qualità del codice

- [x] [QUA-01](#qua-01) ✅ — `lib/data/settings.ts` butta via il tipo di Prisma e rimappa a mano
- [ ] [QUA-02](#qua-02) 🟡 — `invoices-manager.tsx` a 899 righe con 11 `useState`
- [ ] [QUA-03](#qua-03) 🟡 — `getPdfSettings()` restituisce `id: 0` come valore sentinella
- [x] [QUA-04](#qua-04) ✅ — Nessun test che eserciti davvero le Server Action contro un database

### Documentazione

- [ ] [DOC-01](#doc-01) 🟡 — Rimandi a documenti che non esistono nel repository
- [ ] [DOC-02](#doc-02) 🟡 — `.gitignore` esclude `docs/`: la documentazione di progetto non è versionata
- [ ] [DOC-03](#doc-03) ⚪ — `.env.prod copy.example`: file duplicato residuo

---

# Sicurezza

<a id="sec-01"></a>
## SEC-01 — `JWT_SECRET` reale committato nel `Dockerfile` come default di build

**Severità:** 🟠 media
**File:** `Dockerfile:24`

```dockerfile
ARG JWT_SECRET="RhIUTB46Yj1J0viBQyyWDhoDXWu3cPpH3hA2TQD9R/591IEDQdp3go1ao50qCwAE"
ENV JWT_SECRET=$JWT_SECRET
```

Serve perché `lib/auth/jwt.ts` valida il segreto al caricamento del modulo e farebbe fallire `npm run build`. Il valore però è **un segreto casuale a 64 byte dall'aspetto perfettamente legittimo, pubblicato in git** e cotto nei layer dell'immagine `builder`.

Due problemi distinti:

1. È l'unico valore "valido" di `JWT_SECRET` presente nel repository. È molto plausibile che finisca copiato in `.env.prod` al momento del deploy, per fretta o perché "funziona". A quel punto chiunque abbia accesso al repository può forgiare un JWT HS256 valido per qualunque `sub`, cioè autenticarsi come qualsiasi utente, admin compreso.
2. Anche non copiandolo, resta un segreto committato: se in futuro si aggiungesse `ENV JWT_SECRET` anche allo stage `runner`, il fallback silenzioso sarebbe questo valore pubblico.

**Attenuante:** lo stage `runner` **non** eredita l'`ENV` del builder, quindi oggi un container avviato senza `JWT_SECRET` in `.env.prod` non parte affatto (`lib/auth/jwt.ts` lancia). Il comportamento fail-safe regge, il rischio è l'errore umano.

**Fix suggerito:** usare un valore palesemente non utilizzabile, es. `ARG JWT_SECRET="build-only-placeholder-not-a-real-secret-do-not-copy-0000000000"` (rispetta comunque i 32 byte minimi), e aggiungere un commento che spieghi che serve solo a far passare la build. In alternativa, isolare la validazione del segreto dietro un `if (process.env.NEXT_PHASE !== 'phase-production-build')`.

**Fix applicato:** sostituito il segreto reale con `ARG JWT_SECRET="build-only-placeholder-not-a-real-secret-do-not-copy-0000000000"` (63 byte, supera comunque il minimo di 32 richiesto da `assertStrongJwtSecret` e non compare tra i placeholder noti bloccati), con un commento che spiega perché quel `ARG` esiste e perché non deve mai finire in produzione. Verificato con `scripts/verify-jwt-secret-strength.test.ts` (5 test) e build dello stage `builder` non impattata (lo stage `runner` continua a non ereditare l'`ENV`).

---

<a id="sec-02"></a>
## SEC-02 — Nessun TLS in produzione: il cookie di sessione `Secure` non verrà mai salvato

**Severità:** 🔴 alta — blocca il primo deploy
**File:** `lib/auth/session.ts:105-113`, `docker-compose.prod.yml:52-53`

```ts
const isProduction = process.env.NODE_ENV === "production";
cookieStore.set(COOKIE_NAME, token, {
  httpOnly: true,
  secure: isProduction,   // ← in produzione: true
  ...
});
```

Lo stack di `docker-compose.prod.yml` pubblica l'app direttamente su `${APP_PORT:-3000}` in HTTP puro: non c'è né un servizio di reverse proxy né alcuna terminazione TLS (vedi [DEP-01](#dep-01)). Un browser **scarta silenziosamente** un cookie con l'attributo `Secure` ricevuto su una connessione `http://` (unica eccezione: `localhost`).

Conseguenza pratica: al primo deploy su un indirizzo che non sia `localhost`, il login sembrerà "riuscire" (la Server Action fa `redirect("/dashboard")`) ma il cookie non verrà salvato, il proxy non troverà sessione e rimanderà a `/login`. Un loop di redirect senza alcun messaggio d'errore utile.

Il secondo problema, non risolvibile abbassando `secure`, è che senza TLS username, password e cookie di sessione viaggiano in chiaro.

**Fix suggerito:** aggiungere allo stack un reverse proxy con TLS (Caddy è il più immediato: certificati Let's Encrypt automatici, tre righe di `Caddyfile`), togliere la pubblicazione diretta della porta di `app` e impostare `TRUSTED_PROXY=true` solo dopo che il proxy sovrascrive lui stesso `X-Forwarded-For`. Non abbassare `secure` come workaround.

**Fix applicato (infrastruttura, non codice):** il deployment reale usa Nginx Proxy Manager su un home server, raggiunto in produzione tramite Cloudflare Tunnel (Public Hostname route verso `http://192.168.0.101:80`) per il dominio `gestionale.marcor.it`/`*.marcor.it` — un secondo dominio DuckDNS che bypassava il Tunnel (raggiungeva NPM direttamente) è stato rimosso per restare con un solo percorso pubblico verificabile. In NPM: certificato Let's Encrypt valido per il dominio pubblicato, **Force SSL** attivato (niente più round-trip in HTTP puro), **Default Site = Congratulations Page** (chi colpisce NPM con un `Host` sconosciuto non arriva all'app). `secure: isProduction` in `lib/auth/session.ts` non richiedeva modifiche: il blocco era solo l'assenza di terminazione TLS a monte, ora coperta da NPM. Resta da impostare `TRUSTED_PROXY=true` in `.env.prod` al momento del deploy — vedi [SEC-03](#sec-03).

---

<a id="sec-03"></a>
## SEC-03 — Lockout dell'account provocabile da chiunque con 5 tentativi falliti

**Severità:** 🟠 media
**File:** `lib/auth/rate-limit.ts:38-44`, `lib/auth/client-ip.ts:37-45`

Il rate limit del login usa due contatori: uno sulla chiave `(username, ip)` con `MAX_ATTEMPTS = 5` e lockout di 15 minuti, e uno sul solo `username` con `USERNAME_MAX_ATTEMPTS = 20`. Il commento nel codice spiega la scelta:

> Con l'IP nella chiave, il lockout resta isolato alla coppia (username, IP) dell'attaccante: l'utente legittimo, connesso da un IP diverso, ha un contatore separato e non viene bloccato.

Questa garanzia **non vale nella configurazione attuale**. `resolveClientIp()` restituisce la costante `"unknown"` ogni volta che `TRUSTED_PROXY` non è `true` — che è il default documentato, e resta il default finché non c'è un reverse proxy davanti ([DEP-01](#dep-01)). Con `ip` costante, la chiave `(username, "unknown")` collassa sulla sola username, e il contatore più stretto — 5 tentativi, non 20 — diventa di fatto globale.

Risultato: chiunque conosca (o indovini) uno username può bloccare quell'account per 15 minuti con 5 richieste, e mantenerlo bloccato indefinitamente ripetendo l'operazione. Su un gestionale mono-utente per studio, significa negare l'accesso alla titolare a costo zero.

**Attenuante:** l'app non è ancora esposta su internet, e lo username non è pubblico. Ma è esattamente il tipo di scenario che il commento dichiara di aver escluso, e non lo esclude.

**Fix suggerito:** quando `resolveClientIp()` non riesce a distinguere gli IP, il contatore per-IP non porta informazione e non dovrebbe imporre il lockout più stretto. Due strade: (a) applicare `MAX_ATTEMPTS` solo se `ip !== "unknown"`, lasciando che sia `USERNAME_MAX_ATTEMPTS = 20` a proteggere in quella modalità; (b) risolvere alla radice con [DEP-01](#dep-01) + `TRUSTED_PROXY=true`. La (b) è la vera soluzione, la (a) evita che il problema resti latente nel frattempo.

**Fix parziale applicato — via (b), manca un passo operativo:** con il reverse proxy ormai in campo ([SEC-02](#sec-02)), `lib/auth/client-ip.ts` è stato esteso per preferire l'header `CF-Connecting-IP` (impostato da Cloudflare sull'edge, non falsificabile dal client) e ricadere su `X-Forwarded-For`/`X-Real-IP` solo in sua assenza — necessario perché Cloudflare e il template nginx di default di Nginx Proxy Manager *accodano* un eventuale `X-Forwarded-For` inviato dal client invece di sovrascriverlo, quindi il solo primo valore della catena non era comunque affidabile. Verificato con un nuovo test in `scripts/verify-rate-limit-ip-scope.test.ts` (precedenza di `CF-Connecting-IP` anche con un `X-Forwarded-For` falsificato in prima posizione).

Resta da fare, in produzione: impostare esplicitamente `TRUSTED_PROXY=true` in `.env.prod` al momento del deploy — senza quella variabile `resolveClientIp()` continua a restituire `"unknown"` a prescindere dagli header ricevuti, e il problema descritto sopra resta aperto. Non ancora confermato come fatto.

---

<a id="sec-04"></a>
## SEC-04 — L'audit log espone a ogni admin i dati anagrafici dei pazienti di altri utenti

**Severità:** 🟠 media
**File:** `lib/data/audit-log.ts:10-17`, `lib/actions/invoices.ts:444-452`, `lib/actions/payers.ts:337-344`

`getAuditLog()` non applica alcuno scoping per `id_Utente` — scelta deliberata e documentata: un admin deve vedere gli eventi di tutti. Il problema è **cosa** contengono quegli eventi. Il `meta` di alcune azioni porta dati anagrafici in chiaro:

```ts
// deleteInvoice
meta: {
  ...
  pagante: `${invoice.pagante.cognome} ${invoice.pagante.nome}`,
  paziente: `${invoice.paziente.cognome} ${invoice.paziente.nome}`,
}
// hardDeletePayer
meta: { nome, cognome, cf: payer.cf, piva: payer.piva, ... }
```

`AuditLogManager` li rende con `JSON.stringify(meta)` in una colonna della tabella, senza filtri.

L'architettura è multi-tenant: `Utente` è il professionista, e `CLAUDE.md` descrive esplicitamente il modello come "multi-tenancy per utente singolo studio". Tutto il codice difende quell'isolamento con cura — tranne qui. Un admin che sia anche un professionista distinto dagli altri vede nome, cognome, codice fiscale e partita IVA dei pazienti e dei paganti dei colleghi. Per dati sanitari (l'associazione paziente↔logopedista è un dato relativo alla salute ai sensi dell'art. 9 GDPR) è una divulgazione che il consenso non copre.

**Attenuante:** se il deployment resta a utente unico, o se tutti gli admin sono già titolari del trattamento su tutti i dati, il problema non si manifesta.

**Fix suggerito:** una delle due, a seconda di come si intende usare il prodotto:
- se resta mono-studio: nessun codice da cambiare, ma documentarlo esplicitamente in `README.md` come vincolo di deployment ("non aggiungere un secondo professionista sulla stessa istanza");
- se si prevede multi-studio: togliere i campi anagrafici dal `meta` (l'`entitaId` è già sufficiente a identificare la riga, e per le hard-delete si può conservare un riferimento non identificante), oppure filtrare in `getAuditLog()` gli eventi di altri `id_Utente` mostrando solo azione/data/attore senza `meta`.

**Fix applicato (strada multi-studio, confermata dall'utente: ogni logopedista avrà un proprio account):** rimossi i campi anagrafici identificanti dal `meta`, `getAuditLog()` resta non scoped per `id_Utente` (l'admin deve continuare a vedere tutti gli eventi).
- `deleteInvoice` (`lib/actions/invoices.ts`): tolti `pagante`/`paziente` (stringhe nome+cognome), sostituiti con `id_Pagante`/`id_Paziente` (già colonne scalari su `Pagamento`, tolto anche l'`include` che non serve più).
- `hardDeletePayer` (`lib/actions/payers.ts`): tolti `nome`/`cognome`/`cf`/`piva`; la lista di pazienti in cascata (che portava anch'essa nome/cognome via `findMany`) è ora un `count()`, stesso pattern già usato da `archivePayer`/`restorePayer`.
- `hardDeletePatient` (`lib/actions/patients.ts`): tolti `nome`/`cognome`, resta solo `id_Pagante`.
- `lib/audit/log.ts`: esteso il commento esistente ("mai password/token in meta") con il divieto esplicito di dati anagrafici identificanti.
- Nuovo `scripts/verify-audit-log-no-pii.test.ts` (stesso pattern statico di `verify-actions-auth.test.ts`): scansiona ogni `logAudit({...})` in `lib/actions/*.ts` e fallisce se un blocco `meta` contiene chiavi come `nome`, `cognome`, `cf`, `piva`, `indirizzo`, ecc. — l'invariante resta verificabile anche per le action future.

Verificato con `npx tsc --noEmit` pulito e `npm test` (531 test, tutti passati).

---

<a id="sec-05"></a>
## SEC-05 — 18 vulnerabilità note nelle dipendenze di produzione, senza fix non-breaking

**Severità:** ⚪ informativo — nessuna azione risolutiva disponibile oggi
**File:** `package.json`

`npm audit --omit=dev` riporta 18 vulnerabilità (13 high, 5 moderate). Analizzandole una per una:

| Pacchetto | Advisory | Da dove arriva | Fix disponibile |
|---|---|---|---|
| `postcss` ≤8.5.17 | XSS via `</style>`, path traversal e file read via `sourceMappingURL` | bundle interno di `next` (`node_modules/next/node_modules/postcss`) | ❌ nessuna versione di `next` 16.x è patchata; `npm audit fix --force` proporrebbe `next@9.3.3` |
| `sharp` <0.35.0 | CVE libvips (4 CVE) | dipendenza di `next` per l'ottimizzazione immagini | ❌ stesso discorso |
| `uuid` <11.1.1 | mancato bounds check in v3/v5/v6 | dentro `exceljs` | ❌ `exceljs@3.4.0` sarebbe un downgrade breaking |
| `valibot` ≤1.4.1 | `flatten()` può lanciare su nomi ereditati | dentro `@prisma/dev`, tirato da `prisma` (dipendenza di **produzione** perché il container invoca `prisma migrate deploy` a runtime) | ✅ `npm audit fix` |

Nessuna di queste è sfruttabile nel flusso dell'app: `postcss` gira solo a build time, `sharp` solo se si usa `next/image` con sorgenti remote (l'app non lo fa), `uuid` è usato da `exceljs` internamente su input non attaccabili, `valibot` solo dalla CLI Prisma.

La CI ha già `continue-on-error: true` su questo passo, con un commento che dice la stessa cosa.

**Azione:** nessuna oggi. Da rivalutare a ogni minor di Next.js: quando `postcss`/`sharp` verranno aggiornati a monte, il conteggio scenderà da solo. Vale la pena tenere `npm audit --omit=dev --json` come controllo periodico, per accorgersi se compare qualcosa di *nuovo* invece che di già noto.

---

<a id="sec-06"></a>
## SEC-06 — Rate limit e lockout in memoria di processo: azzerati a ogni riavvio

**Severità:** 🟡 bassa
**File:** `lib/auth/rate-limit.ts:44-47`, `lib/auth/rate-limiter.ts:27`

Tutti i contatori (login, `changePassword`, `resetUserPassword`, generazione PDF, export Excel) vivono in `Map` in memoria di processo. Il commento nel codice accetta esplicitamente il limite "l'app resta a singola istanza".

Il caso non considerato non è la scalabilità orizzontale ma il **riavvio**. `docker-compose.prod.yml` imposta `restart: unless-stopped` su tutti i servizi, e l'healthcheck su `app` con `retries: 5` può farlo riavviare. Ogni riavvio azzera i lockout: un attaccante che riesca a far riavviare il container (o che semplicemente aspetti un deploy) riparte da zero.

**Attenuante:** l'attaccante non controlla i riavvii, quindi non è un bypass su richiesta. E il rallentamento resta comunque significativo rispetto al non averlo.

**Fix suggerito:** se e quando ci sarà bisogno di persistenza, la strada più semplice qui è una tabella `login_attempts` su Postgres (il DB c'è già, non serve introdurre Redis per questo volume). Non urgente: da fare solo se l'app viene esposta su internet.

---

<a id="sec-07"></a>
## SEC-07 — `/api/health` pubblico interroga il DB senza alcun limite

**Severità:** 🟡 bassa
**File:** `app/api/health/route.ts:9-16`

```ts
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({ status: "ok" }, { status: 200 });
  } catch { ... }
}
```

La route è intenzionalmente pubblica (serve all'healthcheck Docker e al futuro reverse proxy) e non restituisce dati applicativi — corretto. Ma ogni richiesta apre/usa una connessione dal pool (`max: 10`, `lib/prisma.ts:20-25`) per fare una query. Un client anonimo che la martella in loop può esaurire il pool e far degradare tutta l'app, senza autenticarsi e senza incontrare alcun rate limit.

**Attenuante:** oggi la porta 3000 non è esposta su internet. Il costo per richiesta è minimo. Ma è l'unico endpoint non autenticato dell'applicazione, quindi vale la pena trattarlo con attenzione.

**Fix suggerito:** o (a) un `createRateLimiter` sull'IP anche qui (coerente con quanto già fatto su PDF ed export), oppure (b) più semplice e più corretto: distinguere liveness da readiness — restituire `ok` senza toccare il DB, e riservare la verifica su Postgres a un endpoint separato non pubblicato dal reverse proxy. L'healthcheck Docker gira su `127.0.0.1` dentro il container e non ha bisogno di essere raggiungibile da fuori.

**Fix applicato — via (a):** aggiunto un `createRateLimiter` (stesso helper già usato da PDF/export) chiavato su `getClientIp()` — 30 richieste/minuto, verificato **prima** di toccare Prisma, così un client anonimo che martella la route non arriva più a consumare connessioni dal pool. Scartata la (b): avrebbe richiesto una regola aggiuntiva in Nginx Proxy Manager per bloccare dall'esterno un path specifico mantenendolo raggiungibile solo da `127.0.0.1` dentro il container — una dipendenza da configurazione infra fuori dal repo, più fragile a un drift futuro rispetto a un limite autocontenuto nel codice. Senza `TRUSTED_PROXY=true` ([SEC-03](#sec-03)) tutte le richieste anonime (incluso l'healthcheck Docker interno) ricadono sulla stessa chiave `"unknown"` — un budget condiviso invece che per-IP, ma comunque un tetto, tenuto ben sopra la cadenza dell'healthcheck (`interval: 10s` in `docker-compose.prod.yml`, ~6 richieste/minuto). Verificato con `npx tsc --noEmit`, `npm run lint` e `npm test` (531 test) tutti puliti.

---

<a id="sec-08"></a>
## SEC-08 — Nessun controllo di `Origin` sulle route API POST

**Severità:** 🟡 bassa — difesa in profondità
**File:** `app/api/invoices/export/route.ts:18`

`POST /api/invoices/export` accetta un corpo JSON e restituisce un file con i dati fiscali e sanitari di fino a 2000 fatture. L'autenticazione avviene tramite il cookie di sessione, e non c'è alcun controllo dell'header `Origin` o `Referer`.

La protezione CSRF oggi poggia interamente su due strati impliciti:
1. `sameSite: "lax"` sul cookie (`lib/auth/session.ts:110`), che impedisce al browser di allegarlo a una POST cross-site;
2. `Content-Type: application/json`, che impedisce di costruire la richiesta con un `<form>` HTML semplice.

Entrambi reggono. Ma sono garanzie che dipendono dal comportamento del browser e da un attributo del cookie che potrebbe essere allentato in futuro senza che nessuno colleghi la cosa a questa route.

**Fix suggerito:** un controllo esplicito in cima all'handler (`request.headers.get("origin")` confrontato con l'host della richiesta, rifiuto con 403 se non coincide) rende la garanzia locale e verificabile. Le Server Action non ne hanno bisogno: Next.js applica già il proprio controllo di origine.

**Fix applicato:** nuovo `lib/security/same-origin.ts` (`isSameOriginRequest(request)`), stesso confronto usato internamente da Next.js per le Server Action (`Origin` vs `Host`/`X-Forwarded-Host`, documentato in `node_modules/next/dist/docs/01-app/02-guides/server-actions.md`, sezione "CSRF check"). `app/api/invoices/export/route.ts` lo chiama in cima al `POST`, prima ancora del controllo di sessione, rispondendo `403` se non coincide. Nessun'altra route API in scope: SEC-08 identifica solo questo endpoint (`/api/invoices/[id]/pdf` è una `GET`, un vettore CSRF diverso e non menzionato dal rilievo). Nuovo `lib/security/same-origin.test.ts` (6 casi: match, mismatch cross-site, Origin assente, Host assente, `X-Forwarded-Host` preferito su `Host` dietro il reverse proxy, Origin sintatticamente non valido) più un caso aggiunto al test statico esistente della route. Verificato con `npx tsc --noEmit`, `npm run lint` e `npm test` (552 test) tutti puliti.

---

<a id="sec-09"></a>
## SEC-09 — CSP con `style-src 'unsafe-inline'`

**Severità:** 🟡 bassa — limite noto e documentato
**File:** `lib/security/csp.ts:10`

```ts
"style-src 'self' 'unsafe-inline'",
```

`script-src` è già stato irrigidito con nonce + `strict-dynamic` (il lavoro difficile è fatto). `style-src` resta permissivo perché `components/settings/pdf-editor*.tsx` posiziona i blocchi del canvas con `style={{ left, top, width, height }}` calcolati a runtime, e un nonce copre i tag `<style>` ma non l'attributo HTML `style`.

L'impatto residuo è limitato: senza `script-src 'unsafe-inline'`, un'iniezione di solo CSS non porta a esecuzione di codice. Resta la possibilità teorica di exfiltration via selettori CSS su un attaccante che riesca comunque a iniettare markup — scenario che richiede già una XSS, che `script-src` blocca.

**Fix suggerito:** non prioritario. Se un giorno si vuole chiudere: CSP Level 3 supporta `'unsafe-hashes'` per gli attributi `style`, ma con valori calcolati a runtime non è praticabile; la strada realistica è spostare il posizionamento su CSS custom properties impostate via un unico `<style nonce>` generato per pagina. Costo alto, beneficio marginale.

**Revisionato (2026-07-31):** confermato di lasciarlo com'è, su decisione esplicita — coerente con la severità bassa e il costo/beneficio già segnalato sopra (sfruttarlo richiede comunque una XSS che `script-src` blocca già). Nessun codice cambiato.

---

# Correttezza e logica

<a id="log-01"></a>
## LOG-01 — Hard-delete della fattura + numerazione `max+1`: numeri riusati e buchi

**Severità:** 🔴 alta — problema fiscale, non solo tecnico
**File:** `lib/actions/invoices.ts:421-458`, `lib/data/invoices.ts:103-117`

`deleteInvoice` cancella fisicamente la riga:

```ts
await prisma.pagamento.delete({ where: { id, id_Utente: userId } });
```

e il numero della fattura successiva è calcolato come "il massimo esistente + 1":

```ts
const last = await prisma.pagamento.findFirst({
  where: { id_Utente: userId, anno: year, ... },
  orderBy: { n_fattura: "desc" },
});
return (last?.n_fattura ?? 0) + 1;
```

Due conseguenze, entrambe reali:

1. **Numeri riusati.** Si emette la fattura #7, la si scarica e la si consegna al cliente, poi la si cancella. La successiva riceve di nuovo il numero 7. Esistono ora due documenti diversi con lo stesso numero nello stesso anno, uno solo dei quali è in archivio. Il vincolo `@@unique([id_Utente, n_fattura, anno])` non aiuta: la riga vecchia non c'è più.
2. **Buchi nella numerazione.** Cancellare la #5 quando esiste già la #9 lascia un buco che nessuna funzione sa più riempire. La numerazione progressiva senza salti è un requisito dell'art. 21 DPR 633/72.

L'audit log conserva i dati identificativi della fattura cancellata (`meta` in `deleteInvoice`), il che è una buona mitigazione per la ricostruzione a posteriori — ma è un log tecnico consultabile solo dagli admin, non un registro fiscale, e la retention lo cancella dopo 12 mesi (`scripts/audit-log-retention.mjs`).

**Fix suggerito:** sostituire l'hard-delete con un annullamento. Serve un campo `annullata: Boolean @default(false)` su `Pagamento` (nota: esisteva, è stato aggiunto e poi rimosso — vedi le migration `20260722171949_add_pagamento_annullata` e `20260723153854_drop_pagamento_annullata`; varrebbe la pena capire perché è stato tolto prima di reintrodurlo). La riga annullata:
- resta in archivio e continua a occupare il suo numero, quindi `max+1` non lo riassegna;
- viene mostrata barrata nell'elenco e esclusa dagli aggregati di fatturato;
- non è più modificabile né scaricabile come PDF valido.

Se il requisito è invece "poter cancellare davvero una bozza mai consegnata", allora la cancellazione va permessa **solo** sull'ultima fattura dell'anno (`n_fattura === max`), il che rende impossibile sia il buco sia il riuso ambiguo. È la soluzione più piccola, se accettabile funzionalmente.

**Decisione presa (2026-08-01):** comportamento attuale confermato corretto, nessuna delle correzioni proposte viene implementata. Hard-delete e numerazione `max+1` restano invariati; il rischio di riuso/buco di numerazione è accettato per questo gestionale (uso a singolo professionista, cancellazioni previste solo su errori pre-consegna). Stessa chiusura in [ROADMAP.md](./ROADMAP.md#log-02); decisione documentata in `CLAUDE.md` accanto alla nota sul soft-delete di `Pagante`/`Paziente`.

---

<a id="log-02"></a>
## LOG-02 — Il form fattura sovrascrive città/CAP salvati con quelli attuali del pagante

**Severità:** 🟠 media
**File:** `components/invoices/invoice-form.tsx:168-174`

```ts
useEffect(() => {
  if (!selectedPayerId) return;
  const payer = effectivePayers.find((p) => p.id === Number(selectedPayerId));
  if (!payer) return;
  setValue("citta", payer.citta);
  setValue("cap", payer.cap);
}, [selectedPayerId, effectivePayers, setValue]);
```

L'intento è chiaro e corretto in creazione: scegli il pagante, città e CAP si precompilano. Ma l'effect non distingue creazione da modifica — a differenza di quello subito sotto, che ha `if (invoice) return;` per `n_fattura`.

In modifica, al mount `selectedPayerId` vale già `inv.id_Pagante` (è il `defaultValue`), l'effect scatta immediatamente e **sostituisce i valori salvati sulla fattura con l'indirizzo attuale del pagante**. Se l'utente apre una fattura del 2024 solo per correggere un commento e salva, città e CAP di quel documento diventano quelli di oggi, senza alcun avviso.

Il danno è tanto più concreto quanto più il progetto ha investito nell'idea opposta: `snapshotAnagrafica` esiste apposta per congelare i dati del pagante al momento dell'emissione, e `updateInvoice` ricattura lo snapshot **solo** se cambia il destinatario (`anagraficaCambiata`, `lib/actions/invoices.ts:317-318`). `Pagamento.citta`/`cap` sono campi separati, con i propri placeholder `{{fattura.citta}}` / `{{fattura.cap}}`, e sfuggono a quella protezione.

**Fix suggerito:** far scattare l'auto-compilazione solo quando il pagante viene effettivamente cambiato dall'utente, non al mount. Il modo più pulito è tenere traccia del valore precedente:

```ts
const prevPayerIdRef = useRef(selectedPayerId);
useEffect(() => {
  if (selectedPayerId === prevPayerIdRef.current) return;  // mount o nessun cambio
  prevPayerIdRef.current = selectedPayerId;
  const payer = effectivePayers.find((p) => p.id === Number(selectedPayerId));
  if (!payer) return;
  setValue("citta", payer.citta);
  setValue("cap", payer.cap);
}, [selectedPayerId, effectivePayers, setValue]);
```

Vale la pena aggiungere un test di regressione in `scripts/`, sulla falsariga di quelli già presenti.

**Fix applicato:** esattamente come suggerito — `prevPayerIdRef` (`useRef`) in `components/invoices/invoice-form.tsx` distingue "il pagante è stato scelto/cambiato ora" dal semplice mount, così l'auto-compilazione di città/CAP scatta solo sul cambio effettivo. In creazione (dove `selectedPayerId` parte da `""`) continua a scattare alla prima selezione, invariato.

Il test di regressione non è statico (il bug è un'interazione tra `useEffect` e mount/update, che un'analisi a regex non intercetterebbe in modo significativo): nuovo `components/invoices/invoice-form.test.tsx` con React Testing Library, stesso approccio di `invoices-manager.test.tsx` (Server Action e `next/navigation` mockati). Tre casi: in modifica, città/CAP salvati (deliberatamente diversi dall'indirizzo attuale del pagante) restano intatti al mount; in modifica, cambiare esplicitamente il pagante autocompila comunque col nuovo indirizzo; in creazione, la prima selezione di un pagante autocompila come prima. Verificato che il primo caso fallisse davvero senza il fix (stash temporaneo del file, poi ripristinato) prima di considerarlo un test valido.

Verificato con `npx tsc --noEmit`, `npm run lint` e `npm test` (538 test) tutti puliti.

---

<a id="log-03"></a>
## LOG-03 — L'audit log carica 200 righe e filtra lato client: i filtri "non trovano" il passato

**Severità:** 🟠 media
**File:** `lib/data/audit-log.ts:10-17`, `components/audit-log/audit-log-manager.tsx:52-59`, `lib/audit/filter-audit-log.ts:34-59`

Il server restituisce sempre e solo gli ultimi 200 eventi:

```ts
return prisma.auditLog.findMany({
  select: AUDIT_LOG_SELECT,
  orderBy: { createdAt: "desc" },
  take: 200,
});
```

e la filter bar (data da/a, utente, azione, ricerca libera) opera **su quell'array già troncato**, dentro il browser.

Conseguenza: se cerco "tutti i login falliti di marzo" e nel frattempo sono stati registrati 200 eventi più recenti, la pagina risponde "0 di 200 eventi" — indistinguibile da "non è successo nulla a marzo". Su un'installazione attiva, 200 eventi si accumulano in pochi giorni: ogni login, logout, creazione, modifica, archiviazione ed export ne genera uno.

È un problema specifico dell'audit log perché la sua unica ragione d'essere è rispondere a domande sul passato — e la retention lo conserva per 12 mesi (`AUDIT_LOG_RETENTION_MONTHS`), quindi il dato *c'è*, semplicemente non è raggiungibile dalla UI.

**Fix suggerito:** spostare filtri e paginazione lato server, come è già stato fatto per fatture, pazienti e paganti. L'infrastruttura c'è tutta: `lib/utils/pagination.ts` (`pageSchema`, `lastValidPage`), il componente `ListPagination`, e il pattern `parse*ListQuery` → `build*Where` → `find*Page`. `filterAuditLogEntries` diventerebbe un `buildAuditLogWhere` con la stessa forma di `buildInvoiceWhere`, e i test in `lib/audit/filter-audit-log.test.ts` si adatterebbero al nuovo shape. Gli indici `(id_Utente, createdAt)` e `(azione, createdAt)` sono già in schema e coprono i filtri principali (vedi anche [DB-02](#db-02) per il filtro su sola data).

**Fix applicato:** esattamente il pattern suggerito, riusando l'infrastruttura esistente.
- `lib/audit/list-query.ts` (rinomina di `filter-audit-log.ts`): `buildAuditLogWhere(filters)` sostituisce `filterAuditLogEntries`. `dataDa`/`dataA` → `createdAt: { gte/lte }` (stessi helper `startOfDay`/`endOfDay`); `utente` → `utente: { is: { username } }`; `azione` → match esatto; `ricerca` → `OR` con `contains`/insensitive su `entita`/`ip`, più match **esatto** su `entitaId` quando `ricerca` è un intero valido. Cambio di comportamento intenzionale: prima "ricerca" faceva un substring-match JS sulla stringificazione di `entitaId` (cercare "4" poteva incidentalmente matchare l'id 42) — non esprimibile in un `where` Prisma portabile senza SQL raw, e non valeva la complessità per un campo di ricerca libera.
- `lib/validations/audit-log-list-query.ts` (nuovo): `parseAuditLogListQuery`, stesso stile di `invoice-list-query.ts` ma senza flag `f`/default "intelligente" (qui il default naturale è "nessun filtro").
- `lib/data/audit-log.ts`: `getAuditLog(filters, page)` ora paginato con lo stesso clamp-all'ultima-pagina-valida di `getInvoices`/`getPatients`. Nuova `getAuditLogUsernames()` (select dedicato e minimale su `Utente`, non `getUsers()`/`SAFE_USER_SELECT` che porterebbe 16 campi inutili) per popolare la tendina "Utente" con **tutti** gli utenti esistenti, non solo quelli comparsi nella pagina corrente di eventi.
- `app/(protected)/audit-log/page.tsx`, `components/audit-log/audit-log-manager.tsx`: da "filtro client su prop statica" a "guidato dall'URL", stesso pattern di `PatientsManager` (`navigate()` + ref per lo stato più recente, `router.replace` con `URLSearchParams`, `ListPagination`).
- `components/audit-log/audit-log-filter-bar.tsx`: il campo "ricerca" ora usa `SearchField` (debounce 300ms) invece di un `<Input>` semplice — necessario perché ogni cambio filtro ora innesca un vero round-trip server, non più un filtro client istantaneo.
- Test: `lib/audit/list-query.test.ts` (rinomina + riscrittura) testa la forma del `where` invece del filtro su array; `components/audit-log/audit-log-manager.test.tsx` riscritto per testare la navigazione URL (mock `next/navigation`), stesso approccio di `invoices-manager.test.tsx`.

Nessuna migration: gli indici esistenti restano sufficienti per i filtri che li usano (utente, azione). Resta valida la nota di [DB-02](#db-02): un filtro per **sola data**, senza utente/azione selezionati, non è coperto da nessuno dei due indici compositi esistenti (`createdAt` è in seconda posizione su entrambi) e fa comunque seq scan — l'`@@index([createdAt])` suggerito lì resta il fix per quel caso specifico, volutamente non incluso qui.

Verificato con `npx tsc --noEmit`, `npm run lint` e `npm test` (543 test) tutti puliti. Non verificato contro un server/DB reale in questo ambiente (Docker non disponibile in questa sessione).

---

<a id="log-04"></a>
## LOG-04 — `archivePayer` non verifica lo stato di partenza, a differenza delle altre azioni

**Severità:** 🟡 bassa
**File:** `lib/actions/payers.ts:169-185`

```ts
await tx.pagante.update({
  where: { id, id_Utente: userId },       // ← nessun archiviato: false
  data: { archiviato: true },
});
```

`archivePatient`, `restorePatient` e `restorePayer` verificano tutte lo stato di partenza e restituiscono un errore esplicito se non corrisponde (`"Paziente non trovato tra gli attivi"`, `"Pagante non trovato tra gli archiviati"`). `archivePayer` no.

Effetti concreti, tutti minori ma tutti evitabili:
- archiviare un pagante già archiviato "riesce" e scrive un evento `PAYER_ARCHIVE` nell'audit log che non corrisponde ad alcun cambiamento di stato;
- la cascata sui pazienti in quel caso non tocca nulla (`where: { ..., archiviato: false }` non trova righe), quindi `pazientiArchiviatiInCascata: 0` finisce nel `meta` — corretto ma fuorviante;
- una doppia sottomissione dalla UI produce due eventi identici.

Il commento su `Paziente.archiviatoInCascata` in `schema.prisma` insiste giustamente sull'importanza che quel flag sia sempre coerente. Questa asimmetria è l'unico punto in cui una transizione non è verificata.

**Fix suggerito:** allineare a `archivePatient`, usando `updateMany` con `archiviato: false` nel `where` e controllando `count === 0`:

```ts
const updated = await tx.pagante.updateMany({
  where: { id, id_Utente: userId, archiviato: false },
  data: { archiviato: true },
});
if (updated.count === 0) throw new Error("PAGANTE_NON_ATTIVO");
```

C'è già `scripts/verify-patient-archive-idempotency.test.ts` per il caso paziente: il gemello per il pagante sarebbe naturale.

**Fix applicato:** aggiunto un controllo dello stato di partenza in `archivePayer` (`lib/actions/payers.ts`) — `pagante.findFirst` con `archiviato: false` **prima** di avviare la transazione, con `return { error: "Pagante non trovato tra gli attivi" }` se non trovato (nessuna archiviazione, nessun audit scritto). Non è stata usata la forma letterale `updateMany` + `count === 0` suggerita sopra: si è invece rispecchiato lo stesso pattern di pre-check già usato dal sibling `restorePayer` nello stesso file, più coerente col resto del modulo. Aggiunto il "gemello" di test menzionato qui sopra: tre nuovi casi in `scripts/verify-payer-archive-cascade.test.ts` (stesso approccio statico di `verify-patient-archive-idempotency.test.ts`) che verificano il pre-check, il messaggio d'errore esplicito e che `logAudit` non venga chiamato se il controllo fallisce. Verificato con `npx tsc --noEmit`, `npm run lint` e `npm test` (534 test) tutti puliti.

---

<a id="log-05"></a>
## LOG-05 — `getNextInvoiceNumberForYear` chiamata senza `.catch()` nel form

**Severità:** 🟡 bassa
**File:** `components/invoices/invoice-form.tsx:176-184`

```ts
getNextInvoiceNumberForYear(year).then((nextNumber) => {
  setValue("n_fattura", nextNumber);
});
```

Nessun `.catch()`. Se la Server Action fallisce (rete assente, sessione scaduta nel frattempo — `requireUserId()` fa `redirect("/login")`, che in una chiamata diretta si manifesta come errore), la promise viene rifiutata senza gestione: unhandled rejection in console e campo "N. Fattura" che resta silenziosamente al valore precedente. L'utente può salvare una fattura con un numero non aggiornato e ricevere l'errore generico `"Il numero fattura N è già stato utilizzato nell'anno YYYY"` senza capirne il motivo.

Secondariamente: l'effect scatta a ogni battuta sul campo data, quindi una round-trip al server per ogni carattere digitato in un `<input type="date">`.

**Fix suggerito:** aggiungere un `.catch()` che imposti un errore visibile (c'è già lo stato `serverError` nel componente), e proteggere dalle risposte fuori ordine con un flag di annullamento nel cleanup dell'effect — due richieste ravvicinate possono tornare in ordine invertito e scrivere il numero sbagliato.

**Fix applicato:** aggiunto un flag `cancelled` con cleanup nell'effect (`components/invoices/invoice-form.tsx`) — ignora sia il `.then()` sia il `.catch()` se l'effect è stato rieseguito nel frattempo (data cambiata di nuovo prima che la risposta precedente tornasse), risolvendo il problema delle risposte fuori ordine. Aggiunto `.catch()` che imposta `serverError` con un messaggio visibile invece di lasciare una unhandled rejection silenziosa. Non toccato il problema secondario del round-trip per ogni carattere digitato (debounce): non richiesto dal fix suggerito qui, resta un miglioramento di prestazioni separato. Verificato con `npx tsc --noEmit`, `npm run lint` e `npm test` (534 test) tutti puliti — nessun test dedicato esisteva per questo componente.

---

<a id="log-06"></a>
## LOG-06 — `logAudit` è best-effort: una mutazione può restare senza traccia

**Severità:** 🟡 bassa — scelta deliberata, ma con una conseguenza da conoscere
**File:** `lib/audit/log.ts:25-42`

```ts
export async function logAudit(params: LogAuditParams): Promise<void> {
  try {
    await prisma.auditLog.create({ ... });
  } catch (error) {
    console.error("logAudit error", params.azione, error);
  }
}
```

La scelta è motivata bene nel commento: la mutazione è già committata quando `logAudit` viene chiamata, quindi far fallire l'operazione a valle sarebbe peggio del non tracciarla. È l'ordinamento corretto delle priorità per un gestionale.

La conseguenza da mettere per iscritto è però che **l'audit log non è completo per costruzione**: se Postgres è momentaneamente sotto pressione, o se un `meta` non è serializzabile in JSON, l'evento sparisce e l'unica traccia è una riga su `stderr` del container. Con `max-size: 10m, max-file: 5` nel logging driver, anche quella ha vita finita.

Rilevante perché l'audit log è la sola difesa contro [LOG-01](#log-01) (dati della fattura cancellata) e uno degli strumenti di accountability GDPR.

**Fix suggerito:** nessuna riscrittura. Due interventi piccoli e utili:
- includere la scrittura del log nella stessa transazione **solo** dove la mutazione è già transazionale e l'evento è critico — cioè `deleteInvoice`, dove il `meta` è l'unica copia superstite dei dati;
- distinguere il messaggio di errore in modo che sia grep-abile (es. prefisso `AUDIT_WRITE_FAILED`), così da poterci agganciare un allarme quando arriverà il monitoraggio ([DEP-06](#dep-06)).

**Fix applicato:** entrambi gli interventi, in `lib/audit/log.ts`:
- `logAudit()` ora logga con prefisso `AUDIT_WRITE_FAILED` invece di `logAudit error`, grep-abile per un futuro allarme ([DEP-06](#dep-06)).
- Estratta `logAuditOrThrow(params, client?)`: stessa scrittura di `logAudit`, ma propaga l'errore invece di inghiottirlo, e accetta opzionalmente un client di transazione (`Prisma.TransactionClient`) al posto del `prisma` globale. `deleteInvoice` (`lib/actions/invoices.ts`) ora usa questa variante dentro un `prisma.$transaction`, insieme a `tx.pagamento.delete`: se la scrittura di audit fallisce, l'intera transazione va in rollback — la fattura non sparisce senza lasciare traccia. Nessun'altra action è stata toccata: per le mutazioni non transazionali resta corretto il comportamento best-effort di `logAudit`.
- Aggiornati due test statici esistenti per riflettere il nuovo nome di funzione: `scripts/verify-invoice-lifecycle.test.ts` (nuovo caso che verifica transazione + `tx.pagamento.delete` + `logAuditOrThrow` insieme) e `scripts/verify-audit-log-coverage.test.ts` (la whitelist di chiamate valide ora include anche `logAuditOrThrow(`).

Verificato con `npx tsc --noEmit`, `npm run lint` e `npm test` (535 test) tutti puliti.

---

# Prestazioni

<a id="perf-01"></a>
## PERF-01 — `getSession()` non memoizzata: 4-5 query identiche su `utenti` per pagina

**Severità:** 🟠 media
**File:** `lib/auth/session.ts:21-64`

`getSession()` fa sempre un `prisma.utente.findUnique({ where: { id: userId } })`, e non è avvolta in `cache()` di React. Ogni chiamata a `requireSession()` / `requireUserId()` / `requireAdmin()` / `getUserIdOrNull()` è quindi una query in più — e queste funzioni sono chiamate una volta per *ciascuna* funzione del data layer, per design.

Conteggio effettivo per un caricamento di `/invoices` (`app/(protected)/invoices/page.tsx:24-30`):

| Chiamante | Query su `utenti` |
|---|---|
| `ProtectedLayout` → `requireSession()` | 1 |
| `getInvoices()` → `requireUserId()` | 1 |
| `getInvoiceYears()` → `requireUserId()` | 1 |
| `getPayersAndPatients()` → `requireUserId()` | 1 |
| `getNextInvoiceNumber()` → `requireUserId()` | 1 |
| **Totale** | **5 `SELECT * FROM utenti WHERE id = $1` identiche** |

`/patients` ne fa 4, `/payers` 3, `/settings/pdf` 3. Nessuna di queste query è lenta di per sé, ma sono cinque round-trip seriali (non parallelizzabili: ognuna precede la query di dati della sua funzione) su ogni navigazione, più il costo di occupare una connessione del pool `max: 10`.

Nota: la ricerca conferma che `cache()` non è usata **da nessuna parte** nel progetto. Non è una svista su una singola funzione, è un pattern non ancora adottato.

**Fix suggerito:** una riga.

```ts
import { cache } from "react";

export const getSession = cache(async (): Promise<Session | null> => {
  // corpo invariato
});
```

`cache()` deduplica per durata della richiesta: la prima chiamata esegue la query, le successive nella stessa render pass restituiscono lo stesso risultato. Non introduce caching tra richieste, quindi non indebolisce né il controllo su `abilitato` né quello su `tokenVersion` — entrambi continuano a essere verificati una volta per richiesta, che è esattamente la garanzia voluta.

Vale anche per `getPdfSettingsForUser()`, chiamata sia da `createInvoice` sia da `generateInvoicePdf`.

**Fix applicato:** `cache()` da `"react"` su entrambe, esattamente come suggerito — `getSession()` in `lib/auth/session.ts` e `getPdfSettingsForUser()` in `lib/data/settings.ts` (da `export async function` a `export const ... = cache(async (...) => {...})`, corpo invariato). Pattern confermato anche dalla documentazione Next.js di questa versione (`node_modules/next/dist/docs/01-app/02-guides/authentication.md`), che raccomanda esattamente `cache()` di React per una funzione di verifica sessione richiamata da data request, Server Action e Route Handler. Verificato con `npx tsc --noEmit`, `npm run lint` e `npm test` (535 test) tutti puliti; non verificato contro un server reale in questo ambiente (nessun Postgres di sviluppo in esecuzione al momento del fix).

---

<a id="perf-02"></a>
## PERF-02 — `/invoices` serializza tutta l'anagrafica attiva nel payload di ogni caricamento

**Severità:** 🟠 media
**File:** `lib/data/invoices.ts:160-174`, `app/(protected)/invoices/page.tsx:24-42`

```ts
export async function getPayersAndPatients() {
  const [payers, patients] = await Promise.all([
    prisma.pagante.findMany({ where: { id_Utente: userId, archiviato: false }, ... }),
    prisma.paziente.findMany({
      where: { id_Utente: userId, archiviato: false },
      include: { pagante: true },   // ← ogni paziente porta con sé il pagante completo
      ...
    }),
  ]);
  return { payers, patients };
}
```

Nessun `take`, nessun `select`. Il risultato viene passato come prop a `InvoicesManager`, che è un componente client: finisce quindi **serializzato per intero nel payload RSC inviato al browser** a ogni caricamento della pagina fatture e a ogni cambio di filtro o pagina.

Serve solo a popolare le due tendine del form di creazione/modifica — che nella maggior parte dei caricamenti non viene mai aperto.

Ordine di grandezza: un pagante completo (nome, cognome, via, città, CAP, CF, P.IVA) è ~150 byte serializzati; un paziente con il suo pagante `include`-ato ne pesa ~200. Con 300 pazienti e 200 paganti si superano i 90 KB di JSON, ricaricati a ogni interazione con i filtri. Su una connessione mobile è la differenza tra una tabella che appare subito e una che appare dopo un secondo.

C'è anche una duplicazione: se 50 pazienti condividono lo stesso pagante, quel pagante viene serializzato 50 volte.

**Fix suggerito, in ordine di rapporto beneficio/costo:**
1. Ridurre i campi: le tendine mostrano solo `cognome nome`, e il filtro paziente→pagante usa `id_Pagante`. Un `select: { id, nome, cognome, citta, cap }` sui paganti (città e CAP servono all'auto-compilazione) e `{ id, nome, cognome, id_Pagante }` sui pazienti — senza `include: { pagante: true }` — taglia il payload di oltre metà, in due righe.
2. Caricare le liste solo quando il form viene aperto, con una Server Action dedicata. Più lavoro, ma elimina il costo dal percorso comune.

**Fix applicato — via (1):** nuovo `lib/data/invoice-contact-options-select.ts` (stesso pattern di `lib/data/invoice-mittente-select.ts`) con `PAYER_OPTION_SELECT` (`id, nome, cognome, citta, cap, archiviato`) e `PATIENT_OPTION_SELECT` (`id, nome, cognome, id_Pagante, archiviato`, **senza** `include: { pagante: true }`) e i tipi derivati `PayerOption`/`PatientOption`. `getPayersAndPatients()` (`lib/data/invoices.ts`) ora usa questi `select` invece delle entità Prisma complete. La ricognizione dei campi effettivamente letti dalla UI (tendine, autocompilazione città/CAP, filtro paziente→pagante, suffisso "(archiviato)") ha confermato che nessun consumatore leggeva `via`/`cf`/`piva`/`id_Utente`/`archiviatoInCascata` né il `pagante` annidato dei pazienti in elenco: quel campo serviva solo a `withCurrentPatient` (`lib/invoices/contact-options.ts`) per reinserire il singolo paziente della fattura in modifica se archiviato, con l'oggetto pagante già disponibile a parte — ora è tipizzato opzionale su `PatientOption` invece che pre-caricato per tutti.

Propagati i nuovi tipi ai componenti che ricevevano `Pagante[]`/`Paziente[]` completi per queste due tendine: `components/invoices/invoice-form.tsx`, `components/invoices/invoices-manager.tsx` (solo le prop `payers`/`patients`; `viewingPayer`/`viewingPatient`, che vengono dalla relazione piena della singola fattura visualizzata, non sono stati toccati), `components/invoices/invoices-filter-bar.tsx`. `withCurrentPayer`/`withCurrentPatient` resi generici su un vincolo minimo (`{ id: number }` / `{ id: number; pagante?: ... }`) inferito solo dall'elenco (mai da `current`/`currentPayer`, che restano il tipo Prisma pieno passato dal form), per accettare sia il tipo ristretto delle tendine sia le relazioni complete della fattura in modifica.

Non implementata la (2) (caricamento lazy delle liste all'apertura del form): riduzione di campi già mitiga la parte più costosa del payload con una modifica localizzata; il caricamento lazy resterebbe un miglioramento ulteriore ma più invasivo (nuova Server Action, stato di loading nel dialog), non fatto in questo passaggio.

Verificato con `npx tsc --noEmit`, `npm run lint` e `npm test` (535 test, inclusi `contact-options.test.ts`, `invoice-filters.test.ts`, `invoices-manager.test.tsx`) tutti puliti.

---

<a id="perf-03"></a>
## PERF-03 — `buildReplacements()` ricostruito per ogni blocco del PDF

**Severità:** 🟡 bassa
**File:** `lib/pdf/placeholders.ts:191-198`, `components/invoices/invoice-pdf-document.tsx:86-190`

```ts
export function resolvePlaceholders(template: string, invoice: InvoiceWithRelations): string {
  const expanded = expandEachLoops(template, invoice);
  return applyReplacements(expanded, buildReplacements(invoice));  // ← ricostruito ogni volta
}
```

`buildReplacements()` costruisce un oggetto di ~45 chiavi con formattazioni di valuta (`toLocaleString`, non economico), concatenazioni e join. `InvoicePDFDocument` chiama `resolvePlaceholders` una volta per ogni blocco visibile, e `pdfSettingsSchema` ammette fino a 500 blocchi (`lib/validations/pdf-settings.ts:101`). Su un layout tipico da 8-10 blocchi il costo è trascurabile; su un layout costruito con l'editor drag-and-drop e molti blocchi di testo diventa misurabile — ed è tutto sull'event loop di Node, che nel frattempo non serve altre richieste.

`renderMesiRows()` fa già la cosa giusta (calcola `base` una volta e la riusa per tutte le righe): è il pattern da estendere.

Nello stesso file, `StyleSheet.create()` viene chiamato due volte **dentro** il `.map()` sui blocchi (`invoice-pdf-document.tsx:89` e `:102`), quindi 2N stylesheet per documento invece di riusare un oggetto stile con i valori variabili applicati inline.

**Fix suggerito:** calcolare `buildReplacements(invoice)` una volta in `InvoicePDFDocument` e passarlo giù, aggiungendo un overload `resolvePlaceholders(template, invoice, replacements?)` che riusa quello passato. Retro-compatibile con i chiamanti esistenti.

**Fix applicato:** esattamente come suggerito, più il problema secondario dello `StyleSheet.create()`.
- `resolvePlaceholders`/`renderMesiRows` (`lib/pdf/placeholders.ts`) hanno ora un terzo parametro opzionale `replacements`/`base` con default `buildReplacements(invoice)` — retro-compatibili con chi non lo passa (nessun altro chiamante nel repo lo passava già).
- `InvoicePDFDocument` (`components/invoices/invoice-pdf-document.tsx`) calcola `buildReplacements(invoice)` una sola volta prima del `.map()` sui blocchi e lo passa a entrambe le chiamate (`resolvePlaceholders` e `renderMesiRows`), invece di farlo ricostruire una volta per blocco.
- I due `StyleSheet.create()` dentro il `.map()` (righe 89 e 102 originali) sono stati sostituiti con oggetti stile inline: `StyleSheet.create<T>(styles: T): T` è un'identità pura a runtime in `@react-pdf/renderer` (verificato in `node_modules/@react-pdf/renderer/index.d.ts`), quindi con un valore diverso per ogni blocco (posizione, colore, dimensione) non c'era alcun riuso da ottenere, solo una chiamata sprecata per blocco (fino a 500 per documento) — stesso pattern già usato altrove nello stesso file per gli style inline di `Text`/`View`. Il `pageStyle` a livello di documento (calcolato una sola volta, fuori dal `.map()`) non è stato toccato: non è nell'ambito di questo rilievo.

Verificato con `npx tsc --noEmit`, `npm run lint` e `npm test` (535 test) tutti puliti, più uno smoke test manuale (script temporaneo, poi rimosso) che genera un PDF reale con `generateInvoicePdf`/`buildMockInvoice` sul layout di default (che include sia blocchi `testo` sia un blocco `mesi`): render riuscito, PDF non vuoto, nessuna eccezione.

---

<a id="perf-04"></a>
## PERF-04 — Ricerche `contains`/`insensitive`: seq scan su tutte le anagrafiche

**Severità:** 🟡 bassa — oggi non percepibile, cresce con l'archivio
**File:** `lib/invoices/list-query.ts:19-48`, `lib/patients/list-query.ts:6-17`, `lib/payers/list-query.ts:8-21`

Tutte e tre le ricerche usano lo stesso pattern:

```ts
{ cognome: { contains: token, mode: "insensitive" } }
```

che Prisma traduce in `cognome ILIKE '%token%'`. Un `LIKE` con wildcard iniziale non può usare un B-tree: Postgres esegue una scansione sequenziale della tabella, per ogni token della ricerca.

Il caso più costoso è il filtro "persona" delle fatture (`personaWhere`), che per ogni token genera quattro `ILIKE` distribuiti su due sottoquery correlate (`pagante.is` e `paziente.is`). Con due parole di ricerca sono otto condizioni valutate su ogni riga di `pagamenti` — e senza gli indici di [DB-01](#db-01), i join stessi sono già seq scan.

**Attenuante:** con qualche centinaio di righe per tabella, Postgres legge tutto da un paio di pagine in cache e risponde in millisecondi. Il problema si presenta a qualche decina di migliaia di fatture, cioè dopo anni di uso.

**Fix suggerito:** quando servirà, `pg_trgm` è la risposta standard e richiede una sola migration:

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX pazienti_nome_trgm_idx ON pazienti USING gin (lower(nome) gin_trgm_ops);
CREATE INDEX pazienti_cognome_trgm_idx ON pazienti USING gin (lower(cognome) gin_trgm_ops);
-- idem per paganti(nome, cognome, cf, piva)
```

Gli indici GIN trigram rendono indicizzabile anche `ILIKE '%x%'`. Non c'è nulla da cambiare nel codice applicativo. Va scritto in una migration SQL a mano, come già fatto per gli indici unique parziali.

**Rimandato (2026-07-31):** in questo ambiente non è disponibile un Postgres/Docker per verificare una migration scritta a mano — un errore in una migration non testata romperebbe `prisma migrate deploy` al prossimo deploy, un rischio che qui non si può mitigare con un test reale. Su richiesta esplicita, rimandato a una sessione con un Postgres di sviluppo raggiungibile per scrivere e verificare la migration. Nessun codice applicativo da cambiare nel frattempo (coerente con "Fix suggerito" sopra): resta un problema latente, non peggiorato dall'attesa.

---

<a id="perf-05"></a>
## PERF-05 — `getInvoiceYears()` fa un `DISTINCT` su tutte le fatture a ogni caricamento

**Severità:** 🟡 bassa
**File:** `lib/data/invoices.ts:66-75`

```ts
const rows = await prisma.pagamento.findMany({
  where: { id_Utente: userId },
  select: { anno: true },
  distinct: ["anno"],
  orderBy: { anno: "desc" },
});
```

Serve a popolare la tendina "Anno" del filtro, e il commento spiega correttamente perché deve considerare tutte le fatture e non solo quelle filtrate. Il problema è che `distinct` in Prisma **non** viene tradotto in `SELECT DISTINCT`: Prisma esegue la query completa e deduplica in memoria nel client. Quindi ogni caricamento di `/invoices` legge la colonna `anno` di *ogni* fattura dell'utente per restituire una manciata di valori distinti.

Non esiste un indice su `(id_Utente, anno)` che permetta un index-only scan — l'unique è `(id_Utente, n_fattura, anno)`, con `anno` in terza posizione.

**Fix suggerito:** una `groupBy`, che Prisma traduce in un vero `GROUP BY` lato database:

```ts
const rows = await prisma.pagamento.groupBy({
  by: ["anno"],
  where: { id_Utente: userId },
  orderBy: { anno: "desc" },
});
```

Oppure, dato che il valore cambia al massimo una volta l'anno, memoizzarlo con `cache()` insieme a [PERF-01](#perf-01).

**Fix applicato:** `groupBy` come suggerito, in `getInvoiceYears()` (`lib/data/invoices.ts`). Non la memoizzazione con `cache()`: qui il problema non è la ripetizione della chiamata (già una sola per caricamento di `/invoices`), ma il fatto che ogni singola chiamata leggesse la colonna `anno` di *ogni* fattura — `cache()` avrebbe solo memoizzato lo stesso over-fetching, non l'avrebbe eliminato. Verificato con `npx tsc --noEmit`, `npm run lint` e `npm test` (545 test) tutti puliti. Nessun test statico esistente referenziava l'implementazione precedente.

---

<a id="perf-06"></a>
## PERF-06 — Un nuovo `Pool` `pg` a ogni valutazione del modulo, e nessuna chiusura su `SIGTERM`

**Severità:** 🟡 bassa
**File:** `lib/prisma.ts:20-34`

```ts
const pool = new Pool({ connectionString, max: 10, ... });   // ← sempre eseguito
const adapter = new PrismaPg(pool);

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.pool = pool;
}
```

La guardia su `globalThis` protegge il `PrismaClient` dall'hot-reload, ma il `new Pool(...)` è **fuori** dalla guardia e viene eseguito a ogni valutazione del modulo. In sviluppo, ogni ricompilazione crea un `Pool` nuovo che nessuno userà (il client cachato continua a usare il primo) e che viene poi riassegnato a `globalForPrisma.pool`, perdendo il riferimento al precedente.

L'impatto reale è contenuto: `pg` apre le connessioni pigramente, quindi un pool mai interrogato non ne apre nessuna. Ma tiene in vita un oggetto con i suoi timer, e rende il valore di `globalForPrisma.pool` inaffidabile — cioè inutilizzabile per lo scopo per cui presumibilmente esiste, chiudere il pool.

Il secondo punto, questo sì rilevante in produzione: **non c'è alcun handler di shutdown**. Alla `docker compose down` o a un redeploy, il container riceve `SIGTERM` e il processo termina lasciando fino a 10 connessioni a Postgres da chiudere per timeout lato server.

**Fix suggerito:**

```ts
const pool = globalForPrisma.pool ?? new Pool({ connectionString, max: 10, ... });

// una sola volta, in produzione
if (process.env.NODE_ENV === "production" && !globalForPrisma.shutdownRegistered) {
  globalForPrisma.shutdownRegistered = true;
  for (const signal of ["SIGTERM", "SIGINT"] as const) {
    process.once(signal, async () => {
      await prisma.$disconnect();
      await pool.end();
      process.exit(0);
    });
  }
}
```

C'è già `scripts/verify-prisma-pool-limits.test.ts` che presidia i limiti del pool: l'invariante sulla singola istanza starebbe bene lì accanto.

**Fix applicato:** esattamente come suggerito, in `lib/prisma.ts`. Il `Pool` ora è `globalForPrisma.pool ?? new Pool(...)` (riusato invece di ricreato a ogni valutazione del modulo); handler `process.once("SIGTERM"|"SIGINT", ...)` registrato solo in produzione (in sviluppo il dev server gestisce il proprio ciclo di vita, e non c'è comunque hot-reload a rieseguire questo blocco), con una guardia `globalForPrisma.shutdownRegistered` contro listener duplicati. Aggiunti due test in `scripts/verify-prisma-pool-limits.test.ts` (analisi statica, stesso approccio del test già presente in quel file): riuso del Pool via `??`, e presenza dell'handler di shutdown con `prisma.$disconnect()`/`pool.end()`. Verificato con `npx tsc --noEmit`, `npm run lint` e `npm test` (545 test) tutti puliti.

---

<a id="perf-07"></a>
## PERF-07 — Paginazione a `OFFSET`: degrada linearmente sulle pagine finali

**Severità:** ⚪ informativo
**File:** `lib/data/invoices.ts:9-23`, `lib/data/patients.ts:8-18`, `lib/data/payers.ts:9-24`

Tutte le liste paginano con `skip: (page - 1) * PAGE_SIZE`, che Postgres implementa come `OFFSET n`: il database produce e scarta le prime `n` righe prima di restituire quelle richieste. Il costo cresce linearmente con il numero di pagina.

Con qualche migliaio di righe e pagine da 20-50 elementi, la differenza tra pagina 1 e pagina 50 è di pochi millisecondi. È il compromesso corretto: la paginazione a cursore, che non ha questo problema, non permette il salto diretto a una pagina arbitraria — funzionalità che `ListPagination` offre e che qui ha senso.

**Azione:** nessuna. Segnalato perché sia una scelta consapevole e non una sorpresa se un giorno l'archivio crescerà di un ordine di grandezza. Il clamping già presente (`lastValidPage`) è la parte importante ed è fatta bene.

**Revisionato (2026-07-31):** confermato che nessuna azione è necessaria — è già la scelta corretta per come `ListPagination` è usata (salto diretto a una pagina arbitraria), non un difetto da correggere. Nessun codice cambiato.

---

# Database

<a id="db-01"></a>
## DB-01 — Nessun indice sulle chiavi esterne `id_Pagante` / `id_Paziente`

**Severità:** 🟠 media
**File:** `prisma/schema.prisma`, `prisma/migrations/20260720000000_init/migration.sql:119-148`

Postgres, a differenza di MySQL, **non crea automaticamente un indice sulle colonne di una foreign key**, e Prisma non lo fa per lui. Ispezionando tutte le migration, gli indici esistenti sono:

```
paganti      (id_Utente, eliminato) + unique parziali su cf, piva
pazienti     (id_Utente, eliminato)
pagamenti    (id_Utente, data), unique (id_Utente, n_fattura, anno), unique (id_Utente, bolloCodice)
fattura_mesi unique (id_Pagamento, mese)          ← copre id_Pagamento come prefisso: ok
audit_logs   (id_Utente, createdAt), (azione, createdAt)
```

Mancano quindi: **`pazienti(id_Pagante)`**, **`pagamenti(id_Pagante)`**, **`pagamenti(id_Paziente)`**.

Sono colonne interrogate spesso, e in alcuni casi dal database stesso:

| Operazione | File | Cosa fa senza indice |
|---|---|---|
| `archivePayer` / `restorePayer` — cascata sui pazienti | `lib/actions/payers.ts:180`, `:250` | seq scan su `pazienti` |
| `getArchivedPayers` — `groupBy(["id_Pagante"])` su fatture e pazienti | `lib/data/payers.ts:89-103` | due seq scan |
| `getArchivedPatients` — `groupBy(["id_Paziente"])` | `lib/data/patients.ts:103-110` | seq scan su `pagamenti` |
| `hardDeletePayer` — `count` con `OR [{id_Pagante}, {paziente: {id_Pagante}}]` | `lib/actions/payers.ts:297-302` | seq scan + subquery |
| `hardDeletePatient` — `count` per `id_Paziente` | `lib/actions/patients.ts:199-201` | seq scan |
| `ON DELETE CASCADE` da `paganti` a `pazienti` | migration `20260722000000` | Postgres scansiona `pazienti` a ogni delete |
| `ON DELETE RESTRICT` da `pazienti`/`paganti` a `pagamenti` | migration init | Postgres scansiona `pagamenti` a ogni delete |

Le ultime due righe sono le più insidiose: sono verifiche che il database esegue da solo, invisibili nel codice applicativo, e sono note per essere una causa classica di lock prolungati su tabelle grandi.

**Fix suggerito:** aggiungerli allo schema Prisma e generare la migration.

```prisma
model Paziente {
  // ...
  @@index([id_Utente, archiviato])
  @@index([id_Pagante])          // ← nuovo
}

model Pagamento {
  // ...
  @@index([id_Utente, data])
  @@index([id_Pagante])          // ← nuovo
  @@index([id_Paziente])         // ← nuovo
}
```

Attenzione, per [DB-03](#db-03): `prisma migrate dev` su questo schema tenterà anche di "correggere" gli indici unique parziali di `paganti`, che non sono introspettabili. Conviene generare la migration con `--create-only` e ripulire l'SQL a mano prima di applicarla.

**Fix applicato:** aggiunti `@@index([id_Pagante])` su `Paziente` e `@@index([id_Pagante])`/`@@index([id_Paziente])` su `Pagamento` in `prisma/schema.prisma`. Nessun Postgres disponibile in questo ambiente per un `prisma migrate dev` reale (stesso limite già incontrato per [PERF-04](#perf-04)), ma qui il rischio è molto più basso: sono indici B-tree semplici su colonne esistenti, senza estensioni né espressioni — non il caso più delicato di PERF-04 (GIN trigram). L'SQL della migration non è stato scritto a mano da zero: generato con `npx prisma migrate diff --from-schema <schema-prima> --to-schema prisma/schema.prisma --script`, che confronta due file di schema senza bisogno di una connessione a un database reale, poi copiato in `prisma/migrations/20260731181420_add_foreign_key_and_audit_log_indexes/migration.sql`. Verificato che il diff rieseguito sullo schema finale produca esattamente lo stesso SQL già scritto. `npx prisma validate`/`generate` (anch'essi senza bisogno di un DB reale) confermano che lo schema è valido e il client si rigenera senza errori. Resta da eseguire `prisma migrate deploy` con un Postgres reale raggiungibile prima di un deploy in produzione, per la conferma finale che l'ambiente reale non abbia altro drift.

---

<a id="db-02"></a>
## DB-02 — `audit_logs` senza indice su `createdAt` da solo: la retention fa seq scan

**Severità:** 🟡 bassa
**File:** `prisma/schema.prisma` (model `AuditLog`), `scripts/audit-log-retention.mjs:38-40`

Il job settimanale di retention esegue:

```js
await prisma.auditLog.deleteMany({ where: { createdAt: { lt: cutoff } } });
```

Gli indici su `audit_logs` sono `(id_Utente, createdAt)` e `(azione, createdAt)`: entrambi hanno `createdAt` in **seconda** posizione, quindi nessuno dei due è utilizzabile per un predicato che filtra solo su `createdAt`. Il `DELETE` fa una scansione sequenziale dell'intera tabella.

Con retention a 12 mesi e un'installazione attiva, `audit_logs` è la tabella che cresce di più (un evento per ogni login, logout e mutazione). Il job gira di domenica alle 3 di notte e non ha vincoli di latenza, quindi il costo è tollerabile — ma il `DELETE` prende lock sulle righe man mano che scansiona, e la stessa mancanza di indice penalizzerà anche il filtro per data della UI quando verrà spostato lato server ([LOG-03](#log-03)).

**Fix suggerito:** `@@index([createdAt])` sul model `AuditLog`. Serve sia alla retention sia al futuro filtro server-side.

**Fix applicato:** `@@index([createdAt])` aggiunto su `AuditLog`, nella stessa migration di [DB-01](#db-01) (`prisma/migrations/20260731181420_add_foreign_key_and_audit_log_indexes`). Serve sia al `DELETE` settimanale di retention sia al filtro data-only lato server introdotto da [LOG-03](#log-03), esattamente come previsto qui.

---

<a id="db-03"></a>
## DB-03 — Gli indici unique parziali non sono introspettabili: rischio di drift silenzioso

**Severità:** 🟡 bassa — rischio operativo, non un difetto attuale
**File:** `prisma/schema.prisma` (model `Pagante`, commento alle righe sui vincoli), `prisma/migrations/20260720000000_init/migration.sql:129-130`

```sql
CREATE UNIQUE INDEX "paganti_id_Utente_cf_key"   ON "paganti"("id_Utente", "cf")   WHERE "eliminato" = false;
CREATE UNIQUE INDEX "paganti_id_Utente_piva_key" ON "paganti"("id_Utente", "piva") WHERE "eliminato" = false;
```

L'unicità di CF e P.IVA vale solo tra i paganti **attivi** — comportamento corretto, che permette di archiviare un pagante e ricrearlo, e che il DSL di Prisma non sa esprimere. Il commento nello schema documenta bene il vincolo e avverte di non reintrodurre `@@unique`.

Il rischio è procedurale e vale la pena tenerlo in evidenza:
- un `prisma migrate dev` futuro segnalerà questi indici come drift non dichiarato (atteso, documentato);
- ma se qualcuno accettasse la migration proposta, Prisma li sostituirebbe con vincoli **pieni**, riaprendo il bug: a quel punto archiviare un pagante e ricrearne uno con lo stesso CF fallirebbe, e ripristinarlo dopo averlo ricreato pure;
- `prisma db push` non replica affatto l'SQL custom, quindi userebbe uno schema privo di questi indici — silenziosamente.

`findRestoreConflict` (`lib/archive/guards.ts:14-27`) implementa la stessa regola lato applicativo e la mantiene come rete, ma dipende dal fatto che `activePayers` contenga solo paganti attivi.

**Fix suggerito:** aggiungere un test in `scripts/` che verifichi la presenza della clausola `WHERE "eliminato" = false` nell'SQL delle migration — nello spirito degli altri `verify-*.test.ts`, che presidiano proprio invarianti di questo tipo. È un controllo puramente testuale sul file di migration, non richiede un database.

**Fix applicato:** nuovo `scripts/verify-partial-unique-indexes.test.ts`, esattamente come suggerito — analisi testuale su tutti i `migration.sql` sotto `prisma/migrations/`, senza bisogno di un database. Due casi: la clausola `WHERE "eliminato" = false` è presente su entrambi gli indici parziali; nessuna migration reintroduce lo stesso vincolo come unique PIENO (senza `WHERE`), il segnale che tradirebbe un `prisma migrate dev` futuro accettato senza controllare l'SQL generato.

---

# Deploy e infrastruttura

<a id="dep-01"></a>
## DEP-01 — Nessun reverse proxy né terminazione TLS nello stack di produzione

**Severità:** 🔴 alta — blocca il primo deploy
**File:** `docker-compose.prod.yml`

Lo stack definisce quattro servizi (`db`, `app`, `backup`, `audit-log-retention`) e nessun reverse proxy. `app` pubblica direttamente la porta 3000 in HTTP.

È la causa radice di tre rilievi già elencati, che si risolvono insieme:
- [SEC-02](#sec-02) — il cookie `Secure` non viene salvato dal browser su HTTP: **il login non funziona**;
- [SEC-03](#sec-03) — senza un proxy che imposti `X-Forwarded-For`, `TRUSTED_PROXY` resta `false` e il rate limit per IP collassa;
- [DEP-02](#dep-02) — la porta 3000 è pubblicata su tutte le interfacce.

Anche `next.config.ts` è già predisposto: l'header `Strict-Transport-Security` viene emesso solo in produzione, ed è inutile finché le risposte non arrivano su HTTPS.

**Fix suggerito:** Caddy è la scelta con meno attrito — ottiene e rinnova i certificati Let's Encrypt da solo, e la configurazione è minima:

```yaml
  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    ports: ["80:80", "443:443"]
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
    depends_on: [app]
    networks: [internal]
```

```
# Caddyfile
gestionale.esempio.it {
  reverse_proxy app:3000
}
```

Caddy imposta `X-Forwarded-For` sovrascrivendo quello del client, quindi `TRUSTED_PROXY=true` diventa sicuro. Dopo di che va rimossa la sezione `ports` dal servizio `app` ([DEP-02](#dep-02)).

**Fix applicato (infrastruttura, non codice — topologia diversa da quella ipotizzata sopra):** stessa nota già scritta sotto [SEC-02](#sec-02). Il reverse proxy non è un Caddy nello stesso `docker-compose.prod.yml`, ma Nginx Proxy Manager su un host fisico separato (il home server), raggiunto in produzione tramite Cloudflare Tunnel — con certificato Let's Encrypt valido, Force SSL attivo, Default Site = Congratulations Page. La causa radice ("nessun reverse proxy né terminazione TLS") è quindi risolta; per il dettaglio di [SEC-02](#sec-02) e [SEC-03](#sec-03) (che dipendono dalla stessa causa) vedi le rispettive sezioni.

Una differenza pratica rispetto al fix suggerito: essendo NPM su una macchina diversa dall'app (non nello stesso stack/rete Docker), la porta dell'app **non può** sparire del tutto come in uno scenario Caddy-nello-stesso-compose — deve restare raggiungibile sulla LAN perché NPM la raggiunge da un altro host. Vedi [DEP-02](#dep-02) per come questo vincolo è stato gestito.

---

<a id="dep-02"></a>
## DEP-02 — L'app viene pubblicata su tutte le interfacce della macchina

**Severità:** 🟠 media
**File:** `docker-compose.prod.yml:52-53`

```yaml
    ports:
      - "${APP_PORT:-3000}:3000"
```

Senza indirizzo di bind, Docker pubblica su `0.0.0.0`: l'app è raggiungibile da qualunque interfaccia della macchina host. Con un firewall assente o permissivo (il default su molte VPS), l'applicazione — in HTTP, senza TLS — è esposta su internet.

Da notare che `db` fa la cosa giusta: nessuna sezione `ports`, comunica solo sulla rete `internal`. Il servizio `app` è l'unica eccezione, ed è comprensibile finché non c'è un reverse proxy davanti.

**Fix suggerito:** dopo aver introdotto il proxy ([DEP-01](#dep-01)), rimuovere del tutto la sezione `ports` da `app` — Caddy lo raggiunge sulla rete `internal` come `app:3000`. Se serve un accesso diretto per debug, `"127.0.0.1:${APP_PORT:-3000}:3000"` lo limita al loopback dell'host, accessibile solo via tunnel SSH.

**Fix applicato (mitigazione infrastrutturale, non rimozione della sezione `ports`):** come notato in [DEP-01](#dep-01), il reverse proxy (Nginx Proxy Manager) gira su un host fisico diverso dalla VM che ospita l'app, quindi la porta non può sparire del tutto sostituendola con una rete Docker `internal` — NPM deve raggiungere l'app sulla LAN. `docker-compose.prod.yml:52-53` pubblica ancora `${APP_PORT:-3000}:3000` su `0.0.0.0` della VM, invariato.

La mitigazione verificata è a livello di router: **nessun port-forward pubblico verso la porta 3000** (confermato dall'utente). L'esposizione resta quindi limitata alla LAN domestica, non a internet — il rischio residuo è che un altro dispositivo sulla stessa LAN (o un router compromesso) potrebbe comunque raggiungere l'app in HTTP diretto, bypassando TLS/NPM. Se in futuro si volesse restringere ulteriormente, senza toccare la topologia: bindare la pubblicazione all'IP LAN della VM invece di lasciarla su tutte le interfacce (es. `"192.168.0.x:3000:3000"` invece di `"3000:3000"`), così un'eventuale seconda interfaccia di rete sulla VM non esporrebbe comunque la porta.

---

<a id="dep-03"></a>
## DEP-03 — Il `Dockerfile` copia l'intero `node_modules` sopra l'output `standalone`

**Severità:** 🟡 bassa
**File:** `Dockerfile:57-58`

```dockerfile
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
```

`next.config.ts` imposta `output: "standalone"`, il cui scopo è precisamente produrre un bundle con **solo** i moduli effettivamente raggiungibili dal codice server — tipicamente una frazione di `node_modules`. Copiare l'intero `node_modules` sopra quell'output annulla gran parte del beneficio.

La ragione c'è ed è legittima: il `CMD` esegue `npx prisma migrate deploy`, e la CLI di Prisma non è inclusa nel bundle standalone. Anche `prisma/seed.mjs` e `scripts/audit-log-retention.mjs` importano `@prisma/client`, `@prisma/adapter-pg` e `pg`.

Il costo è però più alto del necessario: `@react-pdf/renderer`, `exceljs`, `@tiptap/*` e l'intera catena di `next` (con `sharp`, decine di MB) vengono copiati due volte — una nel bundle standalone, una qui. L'immagine finale è nell'ordine delle centinaia di MB in più, il che significa build più lente, push/pull più lenti e più superficie da patchare.

**Fix suggerito:** copiare selettivamente solo ciò che serve al di fuori del bundle standalone:

```dockerfile
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.bin/prisma ./node_modules/.bin/prisma
```

Da verificare con un `docker run` che sia `prisma migrate deploy` sia `node prisma/seed.mjs` sia `node scripts/audit-log-retention.mjs` funzionino: `@prisma/adapter-pg` trascina `pg`, che potrebbe già essere nel bundle standalone o meno.

**Fix applicato, poi ANNULLATO dopo due crash reali in produzione:** applicata prima la copia selettiva esattamente come suggerito sopra. Non essendoci Docker disponibile in questo ambiente di sviluppo per il `docker run` di verifica raccomandato, il primo test reale è stato un deploy in produzione, che ha rivelato due problemi in sequenza non riproducibili senza Docker:

1. **ENOENT su `node_modules/.bin/prisma_schema_build_bg.wasm`** — `node_modules/.bin/prisma` è un symlink; `COPY` nominandolo esplicitamente come sorgente lo dereferenzia (copia il contenuto del target come file semplice invece di preservare il link), rompendo la risoluzione del percorso relativo dello script CLI verso il proprio file WASM sibling. Corretto sostituendo quel `COPY` con `RUN mkdir -p node_modules/.bin && ln -sf ../prisma/build/index.js node_modules/.bin/prisma` (ricrea il symlink direttamente nell'immagine invece di copiarlo).

2. **`Cannot find module 'effect'`** — con il symlink risolto, la CLI Prisma partiva ma falliva su una dipendenza transitiva di `@prisma/config` (`effect`) non inclusa dalla copia selettiva di `node_modules/prisma`+`node_modules/@prisma`. L'albero di dipendenze della CLI è quindi più profondo e meno prevedibile di quanto stimato nel fix originale.

Invece di continuare a inseguire dipendenze mancanti una alla volta direttamente in produzione (rischioso, senza modo di verificare in anticipo in questo ambiente), si è deciso di **annullare interamente l'ottimizzazione**: tornato a `COPY --from=builder .../app/node_modules ./node_modules` per intero, il comportamento noto-funzionante pre-DEP-03. I 5 test in `scripts/verify-docker-build-config.test.ts` che verificavano la copia selettiva sono stati rimossi (non più applicabili). Da riprendere in futuro **solo** con un ambiente Docker reale disponibile per verificare l'elenco completo delle dipendenze della CLI Prisma prima di riprovare la selettività — per questo il checkbox sopra resta non spuntato.

---

<a id="dep-04"></a>
## DEP-04 — `rclone.conf` montato come obbligatorio ma non versionato

**Severità:** 🟡 bassa
**File:** `docker-compose.prod.yml:86-88`, `.gitignore:57`

```yaml
    volumes:
      - ./scripts/backup-db.sh:/backup-db.sh:ro
      - ./backups:/backups
      - ./rclone.conf:/rclone.conf:ro
```

`rclone.conf` è correttamente in `.gitignore` (contiene token OAuth) e il repository fornisce `rclone.conf.example`. Ma il bind mount lo tratta come obbligatorio, e la copia off-site è documentata come **opzionale** ("resta inerte finché `RCLONE_REMOTE` non è configurata", `Dockerfile.backup`).

Se il file non esiste al primo `docker compose up`, Docker non fallisce: crea una **directory vuota** `./rclone.conf` sull'host e la monta. Da lì in avanti il file non verrà mai creato correttamente senza prima rimuovere a mano quella directory, e il sintomo (`rclone: can't open config file: is a directory`) comparirà solo nei log del container di backup, che nessuno guarda ([DEP-06](#dep-06)).

**Fix suggerito:** rendere il mount opzionale con la sintassi lunga, che non crea nulla se la sorgente manca:

```yaml
      - type: bind
        source: ./rclone.conf
        target: /rclone.conf
        read_only: true
        bind: { create_host_path: false }
```

In alternativa, documentare esplicitamente in `README-BACKUP.md` che `cp rclone.conf.example rclone.conf` è un passo obbligatorio del setup anche quando non si usa la copia off-site.

**Fix applicato:** sintassi lunga con `create_host_path: false` come suggerito, in `docker-compose.prod.yml`. Verificato che lo YAML resti valido (parsing con PyYAML, dato che `docker compose config` non è disponibile senza Docker in questo ambiente) e aggiornato `scripts/verify-backup-integrity.test.ts` (il test esistente cercava ancora la vecchia sintassi breve `rclone.conf:/rclone.conf:ro`) con un nuovo caso che verifica esplicitamente `create_host_path: false`.

---

<a id="dep-05"></a>
## DEP-05 — `audit-log-retention` riusa l'immagine di `app` senza dichiarare `build`

**Severità:** 🟡 bassa
**File:** `docker-compose.prod.yml:99-101`

```yaml
  audit-log-retention:
    image: gestionale-fatture-app
    container_name: gestionale-audit-log-retention
```

Il servizio riusa l'immagine costruita da `app` — scelta sensata, evita di duplicare un `Dockerfile` per uno script che vive nella stessa codebase. Ma senza una sezione `build:`, Compose considera questa immagine come "da registry".

Conseguenze:
- `docker compose pull` fallisce, perché `gestionale-fatture-app` non esiste su nessun registry;
- `docker compose up -d` senza `--build`, su una macchina pulita, fallisce per lo stesso motivo;
- `docker compose build` da solo non ricostruisce questo servizio, quindi dopo una modifica a `scripts/audit-log-retention.mjs` può restare su un'immagine vecchia se l'immagine di `app` non è stata ricostruita nello stesso passaggio.

Il comando documentato in cima al file (`up -d --build`) funziona perché `app` viene costruita prima, ma la dipendenza è implicita e fragile.

**Fix suggerito:** duplicare la stanza `build` con lo stesso contesto, oppure usare `extends`/YAML anchor per condividerla. Due righe:

```yaml
  audit-log-retention:
    image: gestionale-fatture-app
    build:
      context: .
      dockerfile: Dockerfile
```

Compose riconosce che è la stessa immagine e non la ricostruisce due volte.

**Fix applicato:** stanza `build` aggiunta al servizio `audit-log-retention` in `docker-compose.prod.yml`, stesso `context`/`dockerfile` di `app`. Nuovo caso in `scripts/verify-docker-build-config.test.ts`.

---

<a id="dep-06"></a>
## DEP-06 — Nessun allarme sui fallimenti di backup e retention

**Severità:** 🟡 bassa
**File:** `scripts/backup-db.sh`, `scripts/audit-log-retention.mjs:60-70`, `docker-compose.prod.yml` (sezioni `logging`)

Entrambi i servizi di manutenzione riportano esclusivamente su stdout/stderr, catturati dal driver `json-file` con `max-size: 10m, max-file: 5`. Il loop di retention è esplicitamente progettato per non morire su errore:

```js
await purgeOnce().catch((error) => {
  console.error("[audit-log-retention] errore durante la pulizia:", error);
});
```

È la scelta giusta — un errore transitorio non deve fermare il loop settimanale. Ma significa che un fallimento **persistente** (credenziali cambiate, disco pieno, `BACKUP_ENCRYPTION_KEY` errata) produce solo una riga di log a settimana, in un container che nessuno apre.

Un backup che fallisce in silenzio è, in pratica, l'assenza di backup — con in più la convinzione di averne uno. È il rischio più serio di questo gruppo, anche se il fix è semplice.

`scripts/verify-backup-integrity.test.ts` e `verify-backup-retention.test.ts` verificano la *logica* dello script, il che è già più di quanto la maggior parte dei progetti faccia. Manca il segnale quando l'esecuzione reale va male.

**Fix suggerito:** la soluzione minima e sufficiente per un'installazione singola è una notifica push su esito negativo — un `curl` a un webhook (ntfy.sh, Telegram, Healthchecks.io) nel ramo di errore di entrambi gli script. Healthchecks.io in particolare risolve anche il caso peggiore, quello che un allarme sull'errore non copre: il container **non è più partito affatto**, quindi non c'è nessun errore da segnalare. Il modello "dead man's switch" (ping a ogni esecuzione riuscita, allarme se il ping non arriva) è quello corretto qui.

**Fix applicato:** modello "dead man's switch" con convenzione Healthchecks.io (ping sull'URL base per successo, `/fail` in coda per fallimento — compatibile anche con altri webhook che ignorano un suffisso extra), non solo un allarme sull'errore.
- `scripts/backup-db.sh`: nuova `ping_healthcheck()`, opzionale via `BACKUP_HEALTHCHECK_PING_URL` (resta inerte se non impostata, stesso pattern di `RCLONE_REMOTE`). Il ping riflette l'esito del dump E della prova di ripristino automatica (`verify_backup`): un backup che non supera il ripristino non è, in pratica, un backup utilizzabile. `Dockerfile.backup` estesa con `curl`.
- `scripts/audit-log-retention.mjs`: stessa logica via `AUDIT_LOG_RETENTION_HEALTHCHECK_PING_URL`, con `fetch` nativo di Node (nessuna dipendenza aggiuntiva nell'immagine di produzione).
- `docker-compose.prod.yml`/`​.env.prod.example`/`README-BACKUP.md` aggiornati con le due variabili opzionali e una sezione dedicata.
- Nuovi test statici: `scripts/verify-audit-log-retention-healthcheck.test.ts` e casi aggiunti a `scripts/verify-backup-integrity.test.ts` (nessuno esegue realmente `curl`/`fetch`, entrambi gli script girano in un loop infinito non eseguibile end-to-end in Vitest).

Verificato con `npx tsc --noEmit`, `npm run lint`, `npm test` (563 test) e `sh -n scripts/backup-db.sh` (sintassi shell) tutti puliti. Non verificato con una build Docker reale in questo ambiente (nessun Docker disponibile) — da fare prima del prossimo deploy, insieme alla verifica già segnalata sotto [DEP-03](#dep-03).

---

# Qualità del codice

<a id="qua-01"></a>
## QUA-01 — `lib/data/settings.ts` butta via il tipo di Prisma e rimappa a mano

**Severità:** 🟡 bassa
**File:** `lib/data/settings.ts:11-29`, `:48`, `:83`, `:95`

```ts
function rowToImpostazioniPdf(row: Record<string, unknown>): ImpostazioniPdf {
  return {
    id: row.id as number,
    id_Utente: row.id_Utente as number,
    pageWidth: row.pageWidth as number,
    // ... 12 cast espliciti
  };
}
// e a ogni chiamata:
return rowToImpostazioniPdf(row as unknown as Record<string, unknown>);
```

Il valore restituito da `prisma.impostazioniPdf.findUnique()` è già completamente tipato. Il doppio cast `as unknown as Record<string, unknown>` lo azzera deliberatamente, e i 12 cast successivi lo ricostruiscono a mano.

Il risultato è che il compilatore non protegge più questo punto: se domani si aggiunge un campo a `ImpostazioniPdf` nello schema, o se ne rinomina uno, `tsc` non segnala nulla — la funzione restituirà semplicemente `undefined` per quel campo, con il tipo che dichiara il contrario. È l'unico punto del data layer dove questo accade.

La causa probabile è l'attrito tra il tipo `Json` di Prisma per `blocchi` e il tipo `PdfLayout["blocchi"]` dell'applicazione.

**Fix suggerito:** isolare il cast al solo campo che ne ha davvero bisogno e lasciare che il resto sia inferito:

```ts
function rowToImpostazioniPdf(row: PrismaImpostazioniPdf): ImpostazioniPdf {
  return { ...row, blocchi: row.blocchi as unknown as PdfLayout["blocchi"] };
}
```

Una riga invece di quindici, e un campo nuovo nello schema arriva automaticamente.

**Fix applicato:** `rowToImpostazioniPdf` ora prende in input il tipo generato da Prisma (`ImpostazioniPdf` da `@prisma/client`, rinominato `PrismaImpostazioniPdf` in fase di import per non collidere con l'omonimo tipo applicativo in `lib/pdf/types.ts`) e restituisce `{ ...row, blocchi: ... }`, con l'unico cast isolato sul campo `blocchi` (`Json` di Prisma → `PdfLayout["blocchi"]`). Rimossi i tre `as unknown as Record<string, unknown>` nei chiamanti (`getPdfSettings`, `upsertPdfSettings`, `getPdfSettingsForUser`). Verificato con `npx tsc --noEmit` (0 errori), `npm run lint` (0 errori/warning) e `npm test` (569 test, tutti passati).

---

<a id="qua-02"></a>
## QUA-02 — `invoices-manager.tsx` a 899 righe con 11 `useState`

**Severità:** 🟡 bassa
**File:** `components/invoices/invoices-manager.tsx`

È il file più grande del progetto e gestisce, in un singolo componente client, almeno sette responsabilità distinte: la tabella desktop, le card mobile, la selezione multipla per l'export, quattro dialog diversi (dettaglio fattura, dettaglio pagante, dettaglio paziente, form), due conferme di refresh (layout PDF e anagrafica) con relativi stati di errore, e la sincronizzazione dei filtri con l'URL.

Da notare che la parte più delicata — la sincronizzazione dei filtri — è scritta con notevole attenzione: `latestFiltersRef` risolve un problema reale di race tra debounce e prop RSC stale, e il commento alle righe 121-131 lo spiega meglio di quanto farebbe la maggior parte della documentazione. Non è codice trascurato, è codice cresciuto.

Il precedente c'è già ed è positivo: `pdf-editor.tsx` è stato scomposto in `pdf-editor-toolbar`, `-block`, `-block-properties-panel`, `-add-block-panel`, `-page-settings-panel`, più gli hook `use-block-dragging`, `use-canvas-zoom-pan`, `use-pdf-layout-history`, `use-pdf-editor-keyboard-shortcuts` — ognuno con il proprio file di test. Il risultato è che oggi `pdf-editor.tsx` sta in 537 righe pur essendo la parte più complessa del prodotto.

**Fix suggerito:** applicare lo stesso trattamento. I confini si vedono già bene: un hook `useInvoiceFilters` (navigazione, `latestFiltersRef`, reset della selezione), un hook `useInvoiceSelection` (`selectedIds`, `selectAllRef`, checkbox indeterminate), un componente `InvoiceDetailDialog` e un `InvoicesTable`. Nessuna urgenza — l'attuale funziona ed è testato — ma è il file su cui ogni modifica futura costerà di più.

---

<a id="qua-03"></a>
## QUA-03 — `getPdfSettings()` restituisce `id: 0` come valore sentinella

**Severità:** 🟡 bassa
**File:** `lib/data/settings.ts:38-46`

```ts
if (!row) {
  return { ...LAYOUT_DEFAULT, id: 0, id_Utente: userId, createdAt: now(), updatedAt: now() };
}
```

Quando l'utente non ha ancora salvato un layout, la funzione restituisce il default con `id: 0` — un id che non esiste in `impostazioni_pdf` (la sequenza parte da 1). Il tipo dichiara `ImpostazioniPdf`, indistinguibile da una riga reale.

Oggi non fa danni: `PdfEditor` usa solo i campi di layout, e `updatePdfSettings` fa `upsert` sulla chiave `id_Utente`, non su `id`. Ma è un valore che mente sul proprio significato, in un tipo che non ammette l'assenza. Basta un futuro `if (settings.id) { ... }` o un log che riporta l'id per introdurre un bug difficile da rintracciare.

Sintomo correlato nello stesso file: `createdAt`/`updatedAt` sono `new Date()` calcolate al volo, cioè un timestamp che cambia a ogni caricamento pur descrivendo una riga che non esiste.

**Fix suggerito:** far emergere l'assenza nel tipo di ritorno, per esempio `Promise<ImpostazioniPdf | null>` con il default applicato dal chiamante, oppure un tipo dedicato `{ salvato: false; layout: PdfLayout } | { salvato: true; impostazioni: ImpostazioniPdf }`. La seconda è più esplicita ma tocca più chiamanti; la prima è sufficiente.

---

<a id="qua-04"></a>
## QUA-04 — Nessun test che eserciti davvero le Server Action contro un database

**Severità:** 🟡 bassa
**File:** `scripts/verify-*.test.ts`, `e2e/`

La suite è ampia e ben congegnata: 529 test su 86 file, con i `verify-*.test.ts` che presidiano un'invariante ciascuno, spesso corrispondente a un rilievo di audit storico. È un pattern che vale la pena mantenere.

Guardando però *cosa* verificano, la copertura ha una forma precisa. La maggior parte dei `verify-*` sono controlli **statici**: leggono il sorgente e verificano che una certa chiamata sia presente (`verify-actions-auth.test.ts` cerca `requireUserId`/`requireSession`/`requireAdmin` nel testo dei file), oppure testano funzioni **pure** estratte apposta (`findChronologyConflict`, `canHardDeletePayer`, `findRestoreConflict`, `buildInvoiceWhere`, `sanitizeCellValue`).

Entrambe le categorie sono utili e veloci. Ma nessuna esegue una Server Action contro un Postgres reale. Le proprietà non coperte sono quelle che vivono nell'interazione con il database:

- la transazione di `archivePayer` fa davvero rollback della cascata se il secondo `updateMany` fallisce?
- il `deleteMany` + `create` dei mesi in `updateInvoice` è atomico rispetto a un errore di violazione unique su `bolloCodice`?
- l'indice unique parziale su `paganti(cf) WHERE eliminato = false` si comporta davvero come `findRestoreConflict` assume?
- `onDelete: Cascade` da `paganti` a `pazienti` cancella davvero solo record già archiviati, dato lo stato che le guardie garantiscono?

I test e2e Playwright coprono il flusso utente (login, fatture, export, archiviazione paganti) ma passano dalla UI, quindi non isolano questi casi né esercitano i rami di errore.

**Fix suggerito:** una manciata di test di integrazione contro il Postgres di `docker-compose.dev.yml`, su un database separato (`gestionale_test`) creato e distrutto dal setup. `e2e/fixtures/prisma-test-fixtures.ts` e `e2e/safe-test-environment.ts` esistono già e hanno risolto la parte difficile (le protezioni contro l'esecuzione accidentale sul DB di sviluppo). Cinque o sei test mirati sulle transazioni e sui vincoli DB coprirebbero le lacune più significative, e sarebbero il complemento naturale dei controlli statici già presenti.

**Fix applicato:** aggiunta una config Vitest dedicata (`vitest.integration.config.ts`, script `npm run test:db`, esclusa da `npm test`/CI dove nessun Postgres è disponibile) con `scripts/db-integration/`:

- `global-setup.ts` crea/distrugge un database `gestionale_test` dedicato (drop+create a ogni run) e vi applica le migration reali con `prisma migrate deploy` — a differenza di `db push`, applica anche l'SQL a mano degli indici unique parziali su `paganti(cf/piva)`. Riusa `assertSafeTestEnvironment` (`e2e/safe-test-environment.ts`) per rifiutarsi di girare contro un host non locale.
- `setup-env.ts` (setupFiles, dentro ogni worker) ripunta `process.env.DATABASE_URL` a `gestionale_test` prima che `@/lib/prisma` venga importato dai test.
- Le Server Action reali (`archivePayer`, `hardDeletePayer`, `createInvoice`, `deleteInvoice`) vengono chiamate per intero contro il database di test, con solo il confine verso `next/headers`/`next/cache` mockato (`requireUserId`, `getClientIp`, `revalidatePath`) — l'unica parte non eseguibile fuori da una richiesta Next.js reale.

Sei test in tre file coprono le proprietà indicate sopra:

- `transaction-rollback.test.ts`: (1) un errore lanciato dopo due scritture in `prisma.$transaction` (stessa forma di `archivePayer`) annulla entrambe; (2) un `update()` con scrittura nidificata `mesi: { deleteMany, create }` (stessa forma di `updateInvoice`) resta atomico quando il vincolo unique su `bolloCodice` fallisce — verificato chiamando Prisma direttamente con lo stesso payload, dato che il pre-check applicativo (`isBolloCodiceTaken`) intercetta il caso prima che raggiunga il DB in una singola richiesta non concorrente; il vincolo DB resta comunque l'unica rete di sicurezza sotto una race tra richieste concorrenti.
- `invoices-cascade.test.ts`: `deleteInvoice` (Server Action reale) cancella in cascata le righe `fattura_mesi` collegate (`onDelete: Cascade`).
- `payers-constraints.test.ts`: l'indice unique parziale su `paganti(cf)` rifiuta due paganti attivi con lo stesso cf e lo permette se l'altro è archiviato (con `archivePayer`, Server Action reale, a produrre lo stato archiviato — la stessa assunzione di `findRestoreConflict`); `hardDeletePayer` (Server Action reale) cancella in cascata solo il paziente già archiviato del pagante eliminato, lasciando intatti i pazienti di altri paganti.

Verificato con due run consecutivi di `npm run test:db` (6/6 test passati, creazione/distruzione del database confermata idempotente) e con `npx tsc --noEmit`/`npm run lint`/`npm test` invariati (569 test, la nuova cartella resta esclusa da `vitest.config.ts`).

---

# Documentazione

<a id="doc-01"></a>
## DOC-01 — Rimandi a documenti che non esistono nel repository

**Severità:** 🟡 bassa
**File:** `next.config.ts:9`, `lib/security/csp.ts:5`, `proxy.ts:28`, `lib/invoices/anagrafica-snapshot.test.ts:12`, `scripts/audit-log-retention.mjs:2`

Cinque commenti rimandano a documenti che non sono nel repository:

| Riferimento | Da |
|---|---|
| `PIANO_FIX_CSP_NONCE.md` | `next.config.ts`, `lib/security/csp.ts`, `proxy.ts` |
| `PIANO_FIX_AUDIT_LOG_RETENTION.md` | `scripts/audit-log-retention.mjs` |
| `docs/superpowers/specs/2026-07-22-invoice-snapshot-anagrafica-design.md` | `lib/invoices/anagrafica-snapshot.test.ts` |

Sono citati proprio nei punti in cui il codice fa qualcosa di non ovvio e rimanda altrove per la spiegazione: perché la CSP è generata nel proxy invece che in `next.config.ts`, perché il nonce va impostato sia sulla request sia sulla response, perché la retention apre e chiude la connessione a ogni esecuzione. Chi arriva su quel commento cercando il perché non trova nulla.

I commenti circostanti sono comunque sostanziosi e nella maggior parte dei casi bastano da soli — il rimando è ridondante più che indispensabile.

**Fix suggerito:** delle due l'una, a seconda di [DOC-02](#doc-02): versionare quei documenti sotto `docs/`, oppure rimuovere i rimandi lasciando i commenti (che si spiegano già da sé). Un precedente c'è: il commit `4ff3237` ("docs: rimuove i rimandi a documenti d'audit inesistenti") ha già fatto esattamente questa pulizia una volta, e i rimandi sono ricomparsi.

---

<a id="doc-02"></a>
## DOC-02 — `.gitignore` esclude `docs/`: la documentazione di progetto non è versionata

**Severità:** 🟡 bassa
**File:** `.gitignore:76-79`

```
.impeccable/
.claude/
docs/
.superpowers/
```

`docs/` è escluso insieme alle directory di tooling. È la causa diretta di [DOC-01](#doc-01): i piani di fix e le specifiche di design esistono (o sono esistiti) sul disco di chi sviluppa, ma non viaggiano con il repository.

Il problema si vede meglio dal punto di vista di un ripristino: se questa macchina si guasta, `git clone` restituisce tutto il codice, tutti i test, l'intera infrastruttura di deploy — e nessuna delle decisioni di design che li spiegano. La conoscenza sopravvive solo nei commenti in linea, che pure sono notevolmente curati in questo progetto, ma non coprono i "perché no" (le alternative valutate e scartate).

Distinzione utile: `.claude/`, `.impeccable/` e `.superpowers/` sono stato di strumenti, ed è giusto ignorarli. `docs/` contiene lavoro di progetto.

**Fix suggerito:** togliere `docs/` dal `.gitignore` e committare quello che c'è, anche se disordinato — un documento di design imperfetto e versionato vale più di uno perfetto e perduto. Se alcuni file contengono appunti personali o dati sensibili, spostarli in `docs/scratch/` e ignorare solo quella sottodirectory.

Stesso ragionamento per `ROADMAP_FIX.md` (ultima riga del `.gitignore`): questo documento non è ignorato, il suo eventuale gemello sì.

---

<a id="doc-03"></a>
## DOC-03 — `.env.prod copy.example`: file duplicato residuo

**Severità:** ⚪ informativo
**File:** `.env.prod copy.example` (5160 byte), `.env.prod.example` (5068 byte)

Due file di esempio quasi identici nella root, di cui uno con "copy" nel nome e uno spazio nel path. È chiaramente un residuo di un salvataggio ("Duplica" del file manager) rimasto indietro.

Il rischio è modesto ma non nullo: le due copie differiscono di 92 byte, quindi hanno contenuti diversi, e chi fa il deploy potrebbe partire da quella sbagliata — cioè da una configurazione di produzione incompleta o superata. Va anche detto che nessuno dei due è tracciato da git (`.gitignore` ha `.env*` con un'eccezione solo per `.env.prod.example`, che *è* tracciato), quindi la copia esiste solo su questa macchina.

**Fix suggerito:** verificare quale delle due è aggiornata (`diff ".env.prod copy.example" .env.prod.example`), tenere quella e cancellare l'altra.
