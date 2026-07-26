# Roadmap — problematiche aperte

**Data:** 2026-07-26
**Branch:** master (`615f7b7`)
**Ambito:** analisi indipendente file-per-file dell'intero repository (~17.000 righe, 202 file tracciati) su sicurezza, logica/correttezza, deploy, qualità e documentazione.
**Contesto:** progetto **non ancora deployato**, uso locale/personale. I rilievi di deploy sono quindi trattati come "da risolvere prima del primo deploy", non come incidenti in corso.

Questo documento è un'analisi fresca: non eredita né presuppone i rilievi di audit precedenti.

## Legenda

| Simbolo | Stato |
|---|---|
| 🔴 | Da sistemare — impatto reale su sicurezza, dati o capacità di andare in produzione |
| 🟡 | Da valutare — rilievo valido, non urgente o con una decisione da prendere |
| 🟢 | Cosmetico — nessun impatto funzionale |
| ✅ | Risolta — fix applicato e verificato (nota "Fix applicato" nella sezione linkata) |

Il codice di ogni rilievo, nella tabella qui sotto e nel testo, è un link diretto alla sua spiegazione completa.

---

## Baseline verificata

Eseguita all'inizio dell'analisi, tutto verde:

| Comando | Esito |
|---|---|
| `npx tsc --noEmit` | **0 errori** |
| `npm test` | **233 test, 40 file, tutti passati** |
| `npm run lint` | **0 errori, 2 warning** (cosmetici, vedi QUA-01) |
| `npm audit --omit=dev` | ⚠️ **18 vulnerabilità (13 high, 5 moderate)** → vedi SEC-01 |

**Cosa è risultato solido** (controllato, nessun rilievo): isolamento multi-tenant — ogni funzione in `lib/data/*.ts` e `lib/actions/*.ts` filtra per `id_Utente`, senza eccezioni; auth JWT con `tokenVersion` che revoca le sessioni al cambio password; rate limit login a doppio contatore (username+IP e solo-username) resistente a `X-Forwarded-For` falsificato; hash bcrypt cost 12 con dummy-hash contro il timing attack; guard su hard-delete di pagante/paziente; snapshot immutabili di anagrafica e layout PDF sulle fatture emesse; sanitizzazione contro formula injection nell'export Excel; `Cache-Control: private, no-store` su PDF ed export; nessun `dangerouslySetInnerHTML`/`innerHTML`/`eval`; nessun `console.log` con dati sensibili; nessun `.env` tracciato in git; container Docker che gira come utente non privilegiato.

---

## Sintesi per priorità

| Codice | Titolo | Stato |
|---|---|---|
| [SEC-01](#sec-01) | Next.js 16.2.10: 13 advisory high, incluso un bypass del proxy | ✅ |
| [SEC-02](#sec-02) | Array `columns` dell'export Excel senza tetto: DoS autenticato | ✅ |
| [SEC-03](#sec-03) | `getInvoiceById` carica l'intera riga `Utente`, `passwordHash` incluso | ✅ |
| [SEC-04](#sec-04) | `fontFamily` accetta una stringa arbitraria e può rompere tutti i PDF | ✅ |
| [SEC-05](#sec-05) | Nessuna protezione "ultimo admin": lockout permanente possibile | ✅ |
| [SEC-06](#sec-06) | `proxy.ts` lascia passare anche le richieste HEAD | ✅ |
| [SEC-07](#sec-07) | Header `X-Powered-By: Next.js` esposto | 🟡 |
| [SEC-08](#sec-08) | CSP con `script-src 'unsafe-inline'` | 🟡 |
| [SEC-09](#sec-09) | Postgres di sviluppo esposto su tutte le interfacce | 🟡 |
| [SEC-10](#sec-10) | Il setup e2e crea un utente con password nota nel DB puntato da `DATABASE_URL` | ✅ |
| [SEC-11](#sec-11) | La password tentata può finire nell'audit log | ✅ |
| [SEC-12](#sec-12) | Nessuna retention sull'audit log, e dati sanitari senza policy | 🟡 |
| [LOG-01](#log-01) | `BACKUP_RETENTION_DAYS` è ignorato: la retention è fissa a 14 giorni | 🔴 |
| [LOG-02](#log-02) | Hard-delete della fattura + numerazione `max+1`: numeri riusati e buchi | 🔴 |
| [LOG-03](#log-03) | La fattura emessa resta interamente modificabile, senza storico dei valori | 🟡 |
| [LOG-04](#log-04) | Un nuovo `Pool` di connessioni a ogni hot-reload in sviluppo | 🟡 |
| [LOG-05](#log-05) | `getInvoices()` senza paginazione: tutto l'archivio finisce nel browser | 🟡 |
| [LOG-06](#log-06) | `nome` e `cognome` dell'utente senza limite di lunghezza | 🟡 |
| [LOG-07](#log-07) | Nessun vincolo sull'anno della fattura | 🟡 |
| [LOG-08](#log-08) | `/api/invoices/[id]/pdf`: id non finito → 500 invece di 400 | 🟡 |
| [LOG-09](#log-09) | `restorePayer` riporta attivi anche i pazienti archiviati singolarmente | 🟡 |
| [LOG-10](#log-10) | `export-invoices-dialog.tsx` gestisce un 413 che il server non emette mai | 🟢 |
| [LOG-11](#log-11) | `archivePatient` non verifica lo stato di partenza | 🟢 |
| [DEP-01](#dep-01) | Nessun modo di creare il primo utente: l'app è inutilizzabile su un DB vuoto | ✅ |
| [DEP-02](#dep-02) | `prisma` è una devDependency ma il container la invoca a runtime | 🔴 |
| [DEP-03](#dep-03) | Nessun TLS: con `secure: true` il cookie di sessione non viene salvato | 🔴 |
| [DEP-04](#dep-04) | Il container di backup installa `gnupg` a ogni avvio | 🟡 |
| [DEP-05](#dep-05) | Nessun healthcheck sul servizio `app` | 🟡 |
| [DEP-06](#dep-06) | Backup mai verificati, chiave e copie sulla stessa macchina | 🟡 |
| [DEP-07](#dep-07) | Nessuna CI | 🟡 |
| [DEP-08](#dep-08) | Nessun logging strutturato né rotazione | 🟡 |
| [DEP-09](#dep-09) | Indirizzo LAN cablato in `next.config.ts` | 🟡 |
| [DEP-10](#dep-10) | Nessun limite di risorse sui container | 🟢 |
| [DOC-01](#doc-01) | `README.md` è ancora il boilerplate di `create-next-app` | 🔴 |
| [DOC-02](#doc-02) | Riferimenti a documenti che non esistono | 🟡 |
| [DOC-03](#doc-03) | `.gitignore` esclude `docs/` e i file di roadmap | 🟡 |
| [QUA-01](#qua-01) | 2 warning ESLint su `mesiValues` | 🟢 |
| [QUA-02](#qua-02) | `any` espliciti in `user-form.tsx` | ✅ |
| [QUA-03](#qua-03) | `pdf-editor.tsx` a 1848 righe | 🟡 |
| [QUA-04](#qua-04) | Copertura e2e limitata al login | 🟡 |
| [QUA-05](#qua-05) | `isBolloCodiceTaken` rilegge la sessione a ogni chiamata | 🟢 |

---

# Sicurezza

<a id="sec-01"></a>
## SEC-01 — Next.js 16.2.10: 13 advisory high, incluso un bypass del proxy ✅ risolta

**Severità:** alta
**File:** `package.json`

`npm audit --omit=dev` riportava **18 vulnerabilità sulle sole dipendenze di produzione**. La catena `next@16.2.10` era la più rilevante, e una in particolare colpiva esattamente il meccanismo su cui questo progetto fonda la route protection:

- **[GHSA-6gpp-xcg3-4w24](https://github.com/advisories/GHSA-6gpp-xcg3-4w24)** — *Middleware / Proxy bypass in App Router applications using Turbopack*. Il progetto usa `proxy.ts` come unico gate per le richieste GET alle pagine protette, e Turbopack è attivo (`npm run dev`).
- **[GHSA-955p-x3mx-jcvp](https://github.com/advisories/GHSA-955p-x3mx-jcvp)** — disclosure non autenticata degli endpoint delle Server Function.
- **[GHSA-m99w-x7hq-7vfj](https://github.com/advisories/GHSA-m99w-x7hq-7vfj)** — DoS in App Router via Server Actions.
- **[GHSA-4c39-4ccg-62r3](https://github.com/advisories/GHSA-4c39-4ccg-62r3)** — payload Server Action non limitato.

**Attenuante che restava valida:** il bypass del proxy da solo non esponeva dati. `app/(protected)/layout.tsx` chiama `requireSession()` e ogni funzione in `lib/data/*.ts` chiama `requireUserId()`, quindi la difesa in profondità reggeva comunque. Ma il proxy è documentato in `CLAUDE.md` come il livello di protezione delle GET, e non doveva restare l'anello rotto.

**Fix applicato:**
```sh
npm install next@16.2.12 eslint-config-next@16.2.12
```
Aggiornamento di patch nella stessa minor (16.2.10 → 16.2.12, `latest` al momento del fix). `npm install <pacchetto>@<versione>` aggiunge di default un range caret (`^16.2.12`): corretto a mano in `package.json` per preservare il pin esatto che il progetto usava già per la coppia `next`/`eslint-config-next` (devono restare sulla stessa versione per convenzione Next.js — un range avrebbe permesso ai due di disallinearsi a un futuro `npm install`).

Verificato con `npm audit --omit=dev --json`: le 4 advisory sopra sono sparite dall'elenco delle dipendenze di `next` dopo l'aggiornamento. Restano, invariate, solo `postcss`/`sharp` — dipendenze **bundle interne** di Next (stesso range vulnerabile su tutta la serie 16.x, incluso 16.2.12: nessuna versione patchata disponibile a monte, `npm audit fix --force` proporrebbe un downgrade a `next@9.3.3`, non applicabile) — e le due `moderate` già note (`uuid` dentro `exceljs`, `valibot` dentro `@prisma/dev`, nessun fix non-breaking disponibile). Il totale di `npm audit --omit=dev` resta quindi "18 vulnerabilità" per come npm aggrega i path, ma le 4 advisory dirette e sfruttabili di Next.js sono risolte.

`npx tsc --noEmit`, `npm run lint`, `npm test` (279 test) e `npm run build` (Turbopack, tutte le route compilate) verificati dopo l'aggiornamento: nessuna regressione.

---

<a id="sec-02"></a>
## SEC-02 — Array `columns` dell'export Excel senza tetto: DoS autenticato ✅ risolta

**Severità:** media
**File:** `lib/validations/invoice-export.ts` (riga 12), `lib/excel/invoices-export.ts` (righe 9-20)

Lo schema limita correttamente `ids` a `MAX_EXPORT_INVOICES = 2000`, ma su `columns` mancava sia il `.max()` sia la deduplica:

```ts
columns: z.array(z.enum(EXPORT_COLUMN_KEYS)).min(1),
```

Ogni elemento doveva essere una chiave valida, ma **nulla vietava di ripeterla**. Una POST a `/api/invoices/export` con `{"ids":[1], "columns":["n_fattura", ... × 200.000]}` superava la validazione e arrivava a `buildInvoicesWorkbook`, che costruisce `sheet.columns` con 200.000 colonne (oltre il limite di 16.384 di OOXML) e le itera per ogni riga. Il workbook veniva generato interamente in memoria prima di essere restituito: event loop bloccato e memoria satura. Il rate limit di 10 richieste/minuto non protegge, perché è il costo della singola richiesta a essere illimitato.

**Fix applicato:**
```ts
columns: z
  .array(z.enum(EXPORT_COLUMN_KEYS))
  .min(1)
  .max(EXPORT_COLUMN_KEYS.length)
  .transform((cols) => Array.from(new Set(cols))),
```
Aggiunto `scripts/verify-export-columns-bounds.test.ts` (6 test: tetto superato/rispettato esattamente, deduplica, chiave non valida, array vuoto, intero catalogo senza duplicati).

---

<a id="sec-03"></a>
## SEC-03 — `getInvoiceById` carica l'intera riga `Utente`, `passwordHash` incluso ✅ risolta

**Severità:** bassa (latente, non sfruttabile oggi)
**File:** `lib/data/invoices.ts` (riga 31), `lib/pdf/types.ts` (riga 87)

```ts
include: { pagante: true, paziente: true, mesi: true, utente: true },
```

`utente: true` senza `select` portava in memoria **tutti** i campi di `Utente`, compresi `passwordHash` e `tokenVersion`. Il tipo `InvoiceWithRelations` li dichiarava esplicitamente (`utente: Utente`).

Non c'era leak attivo: l'unico consumatore era `app/api/invoices/[id]/pdf/route.ts`, che resta lato server. Ma il progetto ha già una disciplina esplicita opposta — `SAFE_USER_SELECT` in `lib/data/user-select.ts`, con tanto di `verify-safe-user-select.test.ts` — e qui veniva aggirata. Sarebbe bastato un futuro `<QualcosaClient invoice={invoice} />` perché l'hash finisse nel payload RSC inviato al browser.

**Fix applicato:** nuovo `lib/data/invoice-mittente-select.ts` (`INVOICE_MITTENTE_SELECT`), select esplicito dei soli campi letti da `lib/pdf/placeholders.ts` (`nome`, `cognome`, `titolo`, `specializzazione`, `pIva`, `cf`, `via`, `cap`, `citta`, `provincia`) — più stretto di `SAFE_USER_SELECT`, pensato apposta per questo unico consumatore. `getInvoiceById` usa `utente: { select: INVOICE_MITTENTE_SELECT }` invece di `utente: true`; `InvoiceWithRelations.utente` (`lib/pdf/types.ts`) è ora tipizzato `InvoiceMittente` invece di `Utente`. Esteso `scripts/verify-safe-user-select.test.ts` con due test: assenza di `passwordHash` (stesso pattern di `SAFE_USER_SELECT`) e corrispondenza esatta con i campi effettivamente usati dai placeholder.

---

<a id="sec-04"></a>
## SEC-04 — `fontFamily` accetta una stringa arbitraria e può rompere tutti i PDF ✅ risolta

**Severità:** bassa
**File:** `lib/validations/pdf-settings.ts` (riga 85), `components/invoices/invoice-pdf-document.tsx` (righe 36-39)

Lo schema validava `fontFamily: z.string().min(1).max(100)`. `getFontFamily` gestisce esplicitamente solo `Helvetica`, `Times-Roman` e `Courier`; per qualunque altro valore ricadeva su `${base}-Bold` / `${base}-Italic`, e `@react-pdf/renderer` lanciava su un font non registrato.

L'editor non espone il campo (nessun controllo in `pdf-editor.tsx`, confermato per l'intero file), quindi era raggiungibile solo chiamando direttamente la Server Action `updatePdfSettings` — cosa che, essendo un endpoint RPC, un client autenticato può fare. L'effetto sarebbe stato persistente e non ovvio da diagnosticare: la generazione PDF sarebbe andata in 500 per quell'utente, e il valore rotto si sarebbe **congelato in `pdfLayoutSnapshot`** su ogni fattura creata da quel momento (`lib/actions/invoices.ts` riga 170), restando anche dopo aver corretto le impostazioni.

**Fix applicato:** `fontFamily: z.enum(["Helvetica", "Times-Roman", "Courier"]).default("Helvetica")`. Nessun altro punto del codebase richiedeva modifiche: `PdfLayout.fontFamily`/`PdfSettingsInput.fontFamily` restano tipizzati `string` (più ampio dell'enum, quindi compatibile senza cast) e nessun `buildMockInvoice`/chiamante imposta un valore diverso dai tre ammessi. Nuovo `scripts/verify-pdf-font-family-enum.test.ts` (5 test: rifiuto di un valore arbitrario, accettazione dei tre valori validi, default).

---

<a id="sec-05"></a>
## SEC-05 — Nessuna protezione "ultimo admin": lockout permanente possibile ✅ risolta

**Severità:** media
**File:** `lib/actions/users.ts` (`updateUser`, `toggleUserEnabled`)

`updateUser`, `resetUserPassword` e `toggleUserEnabled` impediscono correttamente all'admin di agire **su sé stesso**, ma nulla impediva a due admin di neutralizzarsi a vicenda in una race condition tra due richieste concorrenti (ciascuna vede l'altro admin ancora attivo al momento del proprio `requireAdmin()`, quindi entrambe superano il controllo ed entrambe scrivono): A toglie `isAdmin` a B mentre, quasi simultaneamente, B (o un terzo admin) fa lo stesso ad A. Si arriva a zero admin abilitati.

A quel punto `/users` e `/audit-log` sono irraggiungibili (`requireAdmin` fa redirect a `/dashboard`) e **non esiste alcun percorso applicativo di recupero**: nessun seed, nessuna CLI, nessun account di servizio. L'unica via è un `UPDATE` a mano su Postgres.

**Fix applicato:** prima di togliere `isAdmin` o disabilitare un utente, si contano gli admin abilitati rimanenti (esclusi dal conteggio l'utente target) e si rifiuta l'operazione se scenderebbero a zero:
```ts
const adminAttivi = await prisma.utente.count({
  where: { isAdmin: true, abilitato: true, NOT: { id } },
});
if (adminAttivi === 0) return { error: "Deve restare almeno un amministratore abilitato" };
```
Applicato a `updateUser` (quando il submit porterebbe `isAdmin`/`abilitato` a `false`) e a `toggleUserEnabled` (quando si disabilita). **Non** applicato a `resetUserPassword`: non tocca né `isAdmin` né `abilitato`, quindi non incide sul conteggio degli admin attivi — il suo self-check esistente (`session.id === id`) resta l'unica protezione pertinente lì. Il controllo non blocca mai la disabilitazione di un utente non-admin: `id !== session.id` è già garantito dai self-check esistenti, quindi l'admin che sta agendo (se ancora attivo) viene sempre conteggiato in `adminAttivi`, che scende a zero solo nel caso genuino "ultimo admin" (o nella race condition che questo fix restringe).

Nota: la finestra di race non è eliminata del tutto (Postgres non serializza le due richieste senza una transazione/lock esplicito), solo ristretta al minimo — accettabile per il modello di minaccia di questo gestionale mono-studio; una vera eliminazione richiederebbe un vincolo a livello di database, non aggiunto qui perché sproporzionato rispetto al rischio residuo.

Nuovo `scripts/verify-last-admin-guard.test.ts` (analisi statica, stesso approccio di `verify-invoice-lifecycle.test.ts`: le Server Action toccano `requireAdmin()`/Prisma, non eseguibili in un test Vitest puro senza un contesto di richiesta reale).

---

<a id="sec-06"></a>
## SEC-06 — `proxy.ts` lascia passare anche le richieste HEAD ✅ risolta

**Severità:** bassa
**File:** `proxy.ts` (righe 31-33)

```ts
if (request.method !== "GET") {
  return NextResponse.next();
}
```

La deroga esiste per le Server Actions (POST), che si autenticano da sole — scelta corretta e documentata. Ma la condizione includeva anche **HEAD**, che Next.js instrada come una GET: una HEAD su una pagina protetta saltava il controllo di sessione del proxy. Il corpo non veniva restituito, e `requireSession()` nel layout protetto bloccava comunque l'accesso reale, quindi non c'era leak di dati; restava però un buco nell'invariante che il file dichiara di garantire.

**Fix applicato:** `if (request.method !== "GET" && request.method !== "HEAD")`.

Nuovo `scripts/verify-proxy-head-method.test.ts` — a differenza di `verify-proxy-matcher.test.ts` (che testa il matcher come RegExp standard senza invocare la funzione), qui serve il comportamento vero: `proxy()` chiamata con una `NextRequest` reale (costruibile senza un server Next.js in esecuzione), verificando che HEAD non autenticata venga reindirizzata a `/login` come una GET, che GET resti invariata, e che POST continui a passare senza reindirizzamento.

---

<a id="sec-07"></a>
## SEC-07 — Header `X-Powered-By: Next.js` esposto 🟡

**Severità:** bassa
**File:** `next.config.ts`

Manca `poweredByHeader: false`. L'header rivela framework e, indirettamente, la superficie di advisory applicabili (cfr. SEC-01). Fix di una riga.

---

<a id="sec-08"></a>
## SEC-08 — CSP con `script-src 'unsafe-inline'` 🟡

**Severità:** bassa (limite noto e documentato)
**File:** `next.config.ts` (riga 18)

La CSP attuale è già un guadagno netto (blocca il caricamento da domini esterni), e il commento nel file spiega correttamente perché `'unsafe-inline'` serve per lo script di bootstrap dell'hydration. Resta però il fatto che, con `'unsafe-inline'` su `script-src`, la CSP **non protegge da un XSS**: uno script iniettato inline verrebbe eseguito.

**Fix (quando ci sarà tempo):** CSP con nonce per-richiesta generato in `proxy.ts` e propagato ai Server Component. Non è banale in App Router; da pianificare come lavoro a sé.

---

<a id="sec-09"></a>
## SEC-09 — Postgres di sviluppo esposto su tutte le interfacce 🟡

**Severità:** bassa
**File:** `docker-compose.dev.yml` (righe 9-11)

```yaml
ports:
  - "5432:5432"
```

Senza indirizzo, Docker pubblica su `0.0.0.0`: il DB di sviluppo — credenziali `admin` / `password_dev`, in chiaro nel file versionato — è raggiungibile da chiunque sia sulla stessa rete (wifi di un bar, rete d'ufficio). Se il DB locale contiene dati reali di pazienti anche solo per prova, il problema è concreto.

**Fix:** `- "127.0.0.1:5432:5432"`.

---

<a id="sec-10"></a>
## SEC-10 — Il setup e2e crea un utente con password nota nel DB puntato da `DATABASE_URL` ✅ risolta

**Severità:** bassa
**File:** `e2e/global-setup.ts`, `e2e/fixtures/test-user.ts`

`globalSetup` fa `prisma.utente.upsert` di `e2e_test` / `E2ePassw0rd!` con `abilitato: true` sul database indicato da `DATABASE_URL`, qualunque esso sia. Un `npm run test:e2e` lanciato per errore con l'ambiente di produzione caricato creava un account funzionante con credenziali pubbliche (sono in un file versionato) sul database reale.

**Fix applicato:** nuovo `e2e/safe-test-environment.ts` (`assertSafeTestEnvironment`), funzione pura e parametrizzata (non legge `process.env` direttamente, per essere testabile senza manipolare lo stato globale del processo) che rifiuta di procedere se `NODE_ENV === "production"` o se l'host di `DATABASE_URL` non è `localhost`/`127.0.0.1`. Chiamata in cima a `globalSetup`, **prima** di importare `lib/prisma`/`hashPassword`: verificato con un probe reale (`npx tsx`, `NODE_ENV=production`) che la guardia lancia immediatamente, senza alcun tentativo di connessione al database.

Nuovo `scripts/verify-e2e-safe-environment.test.ts` (7 test: `NODE_ENV=production` rifiutato anche con DB locale, `DATABASE_URL` assente/non parsabile, host remoto rifiutato, `localhost`/`127.0.0.1` accettati, `NODE_ENV` assente accettato). Vive in `scripts/`, non accanto al modulo in `e2e/`, perché `vitest.config.ts` esclude `**/e2e/**` dalla raccolta test (quella cartella è di Playwright).

---

<a id="sec-11"></a>
## SEC-11 — La password tentata può finire nell'audit log ✅ risolta

**Severità:** bassa
**File:** `lib/actions/auth.ts` (riga 66)

Sul login fallito per utente inesistente veniva scritto `meta: { motivo: "utente_inesistente", usernameTentato: username }`. È un dato utile, ma il campo username è quello che raccoglie l'errore di digitazione più comune in assoluto: password digitata nel campo username. In quel caso la password in chiaro finiva in `audit_logs.meta` e restava lì, visibile nella UI `/audit-log` a ogni admin.

Il commento in `lib/audit/log.ts` (righe 23-24) dice esplicitamente "Non passare MAI in `meta` password (nemmeno tentate)" — l'intento c'è, ma il caso non era coperto.

**Fix applicato:** nuovo `lib/audit/redact-username.ts` (`redactUsernameForAudit`), che tronca a 3 caratteri con ellissi (`username.slice(0, 3) + "…"`) — scelto invece di rimuovere del tutto il campo, per non perdere la capacità di riconoscere pattern ripetuti (stesso username tentato più volte, varianti simili). Sotto i 3 caratteri non tronca affatto: una password valida ha sempre almeno 12 caratteri (`lib/validations/user.ts`), quindi una stringa più corta della soglia non può comunque essere una password. `lib/actions/auth.ts` applica la funzione prima di scrivere `usernameTentato`.

Nuovo `lib/audit/redact-username.test.ts` (4 test, incluso un caso esplicito con una password realistica digitata per errore nel campo username, per verificare che il valore troncato non la contenga più).

---

<a id="sec-12"></a>
## SEC-12 — Nessuna retention sull'audit log, e dati sanitari senza policy 🟡

**Severità:** media (compliance, non tecnica)
**File:** `prisma/schema.prisma` (model `AuditLog`), `lib/data/audit-log.ts`

`audit_logs` conserva `ip` e `meta` (che per `payer.delete` include nome, cognome, CF e P.IVA in chiaro — `lib/actions/payers.ts` righe 322-330) **senza alcuna scadenza**: la tabella cresce indefinitamente e nessuna procedura la ripulisce. `getAuditLog()` legge solo le ultime 200 righe, quindi il resto diventa peso morto invisibile.

Il contesto conta: si tratta di un gestionale per uno studio di logopedia. Il collegamento paziente ↔ prestazione sanitaria è dato particolare ai sensi dell'art. 9 GDPR. Andrebbero definiti, come minimo: un periodo di conservazione dell'audit log, un periodo per i backup (cfr. LOG-01), e la nota su chi ha accesso.

**Fix tecnico:** job periodico di `deleteMany` su `createdAt` più vecchio di N mesi, con N documentato in `.env.prod.example`.
**Fix organizzativo:** fuori dal codice, ma da mettere per iscritto prima di trattare dati reali.

---

# Logica / Correttezza

<a id="log-01"></a>
## LOG-01 — `BACKUP_RETENTION_DAYS` è ignorato: la retention è fissa a 14 giorni 🔴

**Severità:** media — perdita di dati silenziosa
**File:** `scripts/backup-db.sh` (righe 10 e 34)

La variabile viene dichiarata con un default…

```sh
: "${BACKUP_RETENTION_DAYS:=14}"
```

…ma non viene **mai usata**. La cancellazione ha il numero cablato:

```sh
find /backups -type f -name "*.gpg" -mtime +14 -exec rm {} \;
```

`.env.prod.example` (riga 53) documenta la variabile come se funzionasse: *"Per quanti giorni conservare i dump in ./backups (default: 14)"*. Chi imposta `BACKUP_RETENTION_DAYS=90` per tenere un trimestre di storico continua a perdere i backup dopo 14 giorni, e se ne accorge il giorno in cui serve un ripristino vecchio. Anche `README-BACKUP.md` ripete il "14 giorni" come se fosse un dato di fatto.

**Fix:**
```sh
find "$BACKUP_DIR" -type f -name "*.gpg" -mtime +"$BACKUP_RETENTION_DAYS" -exec rm {} \;
```
(usare anche `$BACKUP_DIR` invece di `/backups` cablato, per coerenza con la riga 9) e aggiornare `README-BACKUP.md` in modo che rimandi alla variabile invece di ripetere il numero.

---

<a id="log-02"></a>
## LOG-02 — Hard-delete della fattura + numerazione `max+1`: numeri riusati e buchi 🔴

**Severità:** media — integrità di un documento fiscale
**File:** `lib/actions/invoices.ts` (righe 363-400), `lib/data/invoices.ts` (righe 41-55)

`deleteInvoice` cancella fisicamente la riga (conservando solo un record nell'audit log). Il numero successivo viene calcolato così:

```ts
const last = await prisma.pagamento.findFirst({ where: { id_Utente, anno }, orderBy: { n_fattura: "desc" } });
return (last?.n_fattura ?? 0) + 1;
```

Due conseguenze concrete:

1. **Numero riusato.** Si emette e si consegna la fattura n. 7. La si cancella. La fattura successiva riceve di nuovo il numero 7, con data, importo e intestatario diversi. Esistono due documenti distinti con lo stesso numero nello stesso anno, uno dei quali è già nelle mani del cliente o del commercialista. Il vincolo `@@unique([id_Utente, n_fattura, anno])` non lo intercetta, perché la prima riga non esiste più.
2. **Buco permanente.** Cancellando una fattura intermedia (la 5 su 10), la numerazione resta 1-4, 6-10 senza traccia recuperabile nel gestionale: la numerazione progressiva delle fatture non ammette salti non giustificati.

**Fix — due strade, da scegliere:**
- *(consigliata)* Non permettere la cancellazione di una fattura emessa. Sostituirla con un annullamento logico che mantiene il numero occupato e la esclude dai totali. Nota: un campo `annullata` esisteva ed è stato rimosso (`20260722171949_add_pagamento_annullata` poi `20260723153854_drop_pagamento_annullata`) — vale la pena capire perché prima di reintrodurlo.
- *(minima)* Tenere l'hard-delete ma persistere i numeri "bruciati" per `(utente, anno)` e farli saltare a `getNextInvoiceNumberForUserYear`.

In entrambi i casi la scelta va scritta nel README: è una decisione di dominio, non un dettaglio implementativo.

---

<a id="log-03"></a>
## LOG-03 — La fattura emessa resta interamente modificabile, senza storico dei valori 🟡

**Severità:** media
**File:** `lib/actions/invoices.ts` (righe 222-361)

`updateInvoice` blocca correttamente `n_fattura` e `anno`, e vincola la data all'ordine cronologico dei vicini (`lib/invoices/chronology.ts`) — entrambi ottimi controlli. Restano però modificabili **senza limiti di tempo**: importi dei mesi, pagante, paziente, modalità di pagamento, codice bollo, città/CAP.

Il problema non è la modificabilità in sé (serve per correggere errori), ma che **non resta traccia di cosa è cambiato**: l'audit log registra `INVOICE_UPDATE` con `meta: { n_fattura, anno }`, cioè gli unici due campi che non possono cambiare. Se una fattura consegnata viene modificata, ricostruire cosa diceva l'originale è impossibile — e lo snapshot anagrafica, che è il meccanismo pensato proprio per congelare i dati, viene sovrascritto quando cambia pagante o paziente (riga 328).

**Fix minimo, alto valore:** includere nel `meta` di `INVOICE_UPDATE` i campi cambiati con valore precedente e nuovo. L'oggetto `existing` è già letto alla riga 236, basta estenderne il `select`.

---

<a id="log-04"></a>
## LOG-04 — Un nuovo `Pool` di connessioni a ogni hot-reload in sviluppo 🟡

**Severità:** bassa (solo sviluppo)
**File:** `lib/prisma.ts` (righe 14-30)

Il singleton su `globalThis` protegge `PrismaClient`, ma **non il `Pool`**, che viene costruito a livello di modulo:

```ts
const pool = new Pool({ connectionString, max: 10, ... });   // ← nuovo a ogni valutazione del modulo
const adapter = new PrismaPg(pool);
export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });  // ← riusa il vecchio
```

Ogni ricompilazione del modulo in dev crea un pool nuovo (fino a 10 connessioni) che non viene mai chiuso, mentre il client riusato continua a puntare al primo. Su una sessione di sviluppo lunga si arriva a saturare `max_connections` di Postgres, con errori apparentemente casuali. È esattamente il problema che il commento nel file dice di voler evitare, applicato solo a metà.

**Fix:** memoizzare anche il pool su `globalThis`, con la stessa guardia.

---

<a id="log-05"></a>
## LOG-05 — `getInvoices()` senza paginazione: tutto l'archivio finisce nel browser 🟡

**Severità:** media (prestazioni + esposizione dati)
**File:** `lib/data/invoices.ts` (righe 4-22), `app/(protected)/invoices/page.tsx`, `components/invoices/invoices-manager.tsx`

`getInvoices()` fa `findMany` **senza `take`**, con `include` di pagante, paziente e mesi, e passa il risultato intero a `InvoicesManager`, che è un componente `"use client"`. Tutti i filtri (data, persona, modalità, anno) sono applicati lato client in `useMemo` (righe 114-138).

Due effetti che peggiorano nel tempo:

- **Prestazioni.** Il payload RSC cresce linearmente con gli anni di attività. Con qualche migliaio di fatture la pagina `/invoices` diventa lenta a caricare e pesante in memoria, su un filtro che di default mostra solo il mese corrente.
- **Esposizione.** L'archivio completo — nomi di pazienti, importi, codici fiscali dei paganti — viene serializzato nell'HTML/payload a ogni visita, anche quando l'utente ne vede una manciata di righe. Su un gestionale sanitario è materiale che è meglio non far uscire dal server senza motivo.

Lo stesso schema, in scala minore, vale per `getPatients()`, `getPayers()` e `getAuditLog()` (quest'ultimo almeno ha `take: 200`).

**Fix:** spostare i filtri sul server (search params → `where` di Prisma) e paginare. È il refactor più corposo di questa lista; ha senso pianificarlo, non improvvisarlo.

---

<a id="log-06"></a>
## LOG-06 — `nome` e `cognome` dell'utente senza limite di lunghezza 🟡

**Severità:** bassa
**File:** `lib/validations/user.ts` (righe 9-10)

```ts
nome: z.string().optional(),
cognome: z.string().optional(),
```

Nessun `.max()`, a differenza di ogni altro schema del progetto (`patientSchema`, `payerSchema`, `profileUpdateSchema` limitano tutti a 100). Un admin — o chiunque chiami direttamente la Server Action `createUser`/`updateUser` — può salvare stringhe di lunghezza arbitraria, e ripeterlo.

La svista si spiega guardando `scripts/verify-input-length-limits.test.ts`: copre `invoiceSchema`, `patientSchema`, `payerSchema`, `profileUpdateSchema` e `bloccoSchema`, ma **non `userCreateSchema`/`userUpdateSchema`**. Il test che avrebbe intercettato il caso non lo guarda.

**Fix:** `.max(100)` su entrambi i campi e un blocco `describe("userCreateSchema")` nel test esistente.

---

<a id="log-07"></a>
## LOG-07 — Nessun vincolo sull'anno della fattura 🟡

**Severità:** bassa
**File:** `lib/validations/invoice.ts` (righe 16-22)

`data` accetta qualunque stringa `yyyy-MM-dd` sintatticamente valida, e `anno` ne deriva (`invoiceDate.getFullYear()`, `lib/actions/invoices.ts` riga 141). È possibile creare una fattura datata 1850 o 4000: la numerazione per anno resta coerente, ma il dato è insensato e sporca gli aggregati e il filtro anni della UI (`invoices-manager.tsx` riga 108).

**Fix:** `.refine` sull'anno in una finestra ragionevole (es. 2000 → anno corrente + 1).

---

<a id="log-08"></a>
## LOG-08 — `/api/invoices/[id]/pdf`: id non finito → 500 invece di 400 🟡

**Severità:** bassa
**File:** `app/api/invoices/[id]/pdf/route.ts` (righe 36-40)

```ts
const invoiceId = Number(id);
if (Number.isNaN(invoiceId)) return new Response("ID fattura non valido", { status: 400 });
```

`Number.isNaN` non copre tutto: `Number("Infinity")` → `Infinity`, `Number("1e12")` → un intero fuori dal range `int4` di Postgres. In entrambi i casi Prisma lancia, l'eccezione non è catturata e il client riceve un 500 generico invece del 400 corretto.

**Fix:** `if (!Number.isInteger(invoiceId) || invoiceId <= 0 || invoiceId > 2_147_483_647)`.

---

<a id="log-09"></a>
## LOG-09 — `restorePayer` riporta attivi anche i pazienti archiviati singolarmente 🟡

**Severità:** bassa (comportamento voluto, ma con perdita di informazione)
**File:** `lib/actions/payers.ts` (righe 240-243)

Il ripristino di un pagante riattiva **tutti** i suoi pazienti archiviati, senza distinguere quelli archiviati dalla cascata (`archivePayer`) da quelli che l'utente aveva archiviato singolarmente prima. Il commento lo dichiara intenzionale ("Ripristino simmetrico"), ma per l'utente è una sorpresa: un paziente che aveva deliberatamente archiviato ricompare tra gli attivi.

**Fix:** o si registra nello stato quali pazienti sono stati archiviati in cascata (campo o meta), oppure — soluzione più economica — si avvisa nella `ConfirmDialog` di ripristino quanti pazienti torneranno attivi.

---

<a id="log-10"></a>
## LOG-10 — `export-invoices-dialog.tsx` gestisce un 413 che il server non emette mai 🟢

**File:** `components/invoices/export-invoices-dialog.tsx` (righe 80-84)

Ramo morto: `app/api/invoices/export/route.ts` restituisce 400, 401, 404 e 429, mai 413. Da rimuovere o da rendere reale lato server.

---

<a id="log-11"></a>
## LOG-11 — `archivePatient` non verifica lo stato di partenza 🟢

**File:** `lib/actions/patients.ts` (righe 122-133)

A differenza di `restorePatient` (che filtra su `archiviato: true` e controlla `updated.count`), `archivePatient` fa `update` senza condizione sullo stato: archiviare un paziente già archiviato riesce e scrive comunque un evento di audit. Idempotente, nessun danno, solo rumore nel log.

---

# Deploy

> Il progetto non è ancora in produzione. **DEP-01, DEP-02 e DEP-03 impediscono che un primo deploy funzioni**: vanno affrontati per primi.

<a id="dep-01"></a>
## DEP-01 — Nessun modo di creare il primo utente: l'app è inutilizzabile su un DB vuoto ✅ risolta

**Severità:** bloccante
**File:** `lib/actions/users.ts` (riga 32), `prisma/` (nessun seed), `package.json`

Ogni percorso di creazione utente passa da `requireAdmin()`. Su un database appena migrato la tabella `utenti` è vuota, quindi:

- nessuno può fare login (`login` cerca l'utente e non lo trova);
- `/users` non è raggiungibile perché richiede una sessione admin;
- non esiste `prisma/seed.ts`, non c'è una chiave `prisma.seed` in `package.json`, non c'è uno script CLI.

**L'applicazione appena deployata non è utilizzabile da nessuno.** L'unico modo di uscirne oggi è generare a mano un hash bcrypt e fare un `INSERT` via `psql` — un percorso non documentato che invita a scorciatoie (password deboli, hash copiati da esempi online).

**Fix applicato:** `prisma/seed.mjs` (ESM puro, non `prisma/seed.ts`: deve poter girare anche dentro l'immagine di produzione, dove `npm prune --omit=dev` ha già rimosso `tsx` e la CLI Prisma — importa solo `@prisma/client`, `@prisma/adapter-pg`, `pg` e `bcryptjs`, tutte dipendenze di produzione). Legge `SEED_ADMIN_USERNAME`/`SEED_ADMIN_PASSWORD` dall'ambiente, verifica la lunghezza minima (allineata a `passwordSchema` da `scripts/verify-seed-password-policy.test.ts`), è idempotente (`prisma.utente.count({ where: { isAdmin: true } })`), usa lo stesso cost factor bcrypt di `lib/auth/password.ts` e imposta `mustChangePassword: true` sull'admin creato. Esposto come `npm run seed`; documentato in `README.md` (sezione "Primo avvio") e in `.env.prod.example`. Contestualmente implementata anche la password temporanea per `createUser`/`resetUserPassword` (vedi `PIANO_CREAZIONE_UTENTI.md`).

---

<a id="dep-02"></a>
## DEP-02 — `prisma` è una devDependency ma il container la invoca a runtime 🔴

**Severità:** alta
**File:** `Dockerfile` (righe 26, 53, 71), `package.json` (`devDependencies`)

Lo stage builder rimuove le dipendenze di sviluppo…

```dockerfile
RUN npm prune --omit=dev
```

…e lo stage runner copia proprio quel `node_modules` già potato:

```dockerfile
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
```

Ma il comando di avvio invoca la CLI Prisma, che è in `devDependencies` e quindi **non è più presente**:

```dockerfile
CMD ["sh", "-c", "npx prisma migrate deploy && node server.js"]
```

Non trovandola in locale, `npx` prova a **scaricarla dal registry npm a ogni avvio del container**. Le conseguenze:

- su un host senza accesso a internet (o con il registry bloccato) il container non parte affatto;
- quando funziona, scarica l'ultima `prisma` pubblicata, che può non coincidere con la `7.8.0` con cui il client è stato generato — migrazioni eseguite da una versione diversa da quella attesa;
- ogni riavvio dipende dalla disponibilità di npmjs.com, cosa che un deploy in produzione non dovrebbe mai fare.

**Fix — tre opzioni, in ordine di preferenza:**
1. Spostare `prisma` in `dependencies` (pesa poco e serve davvero al runtime).
2. Estrarre le migrazioni in un servizio one-shot del compose che gira prima di `app` (`depends_on` + `condition: service_completed_successfully`), lasciando `CMD ["node", "server.js"]`.
3. Pin esplicito: `npx prisma@7.8.0 migrate deploy` — risolve il mismatch di versione ma non la dipendenza dalla rete.

---

<a id="dep-03"></a>
## DEP-03 — Nessun TLS: con `secure: true` il cookie di sessione non viene salvato 🔴

**Severità:** alta
**File:** `docker-compose.prod.yml` (righe 42-43), `lib/auth/session.ts` (righe 103-111), `next.config.ts` (righe 47-50)

Lo stack di produzione pubblica l'app direttamente sull'host in HTTP:

```yaml
ports:
  - "${APP_PORT:-3000}:3000"
```

Non c'è reverse proxy, non c'è terminazione TLS, non ci sono certificati. Ma il codice **presuppone HTTPS**:

- `setSessionCookie` imposta `secure: isProduction` — un cookie `Secure` servito su HTTP semplice **viene scartato dal browser**. Risultato concreto: al primo deploy, il login sembra riuscire (redirect a `/dashboard`) ma la sessione non si stabilisce e si torna a `/login` in un loop, senza alcun messaggio d'errore utile. È il tipo di bug che costa un pomeriggio.
- `Strict-Transport-Security` viene inviato ma è ignorato dai browser su HTTP.
- Dati sanitari e fiscali (PDF, export Excel, form dei pazienti) e le credenziali di login viaggerebbero in chiaro.

**Fix:** mettere davanti un reverse proxy con certificato Let's Encrypt — Caddy è la strada più corta (due righe di `Caddyfile`, certificati automatici) — e cambiare la pubblicazione dell'app in `127.0.0.1:3000:3000` così che sia raggiungibile solo dal proxy.

---

<a id="dep-04"></a>
## DEP-04 — Il container di backup installa `gnupg` a ogni avvio 🟡

**Severità:** media
**File:** `docker-compose.prod.yml` (riga 62)

```yaml
entrypoint: ["sh", "-c", "apk add --no-cache gnupg && sh /backup-db.sh"]
```

Stesso vizio di DEP-02: dipendenza dalla rete a ogni riavvio. Se `apk` fallisce (registry Alpine irraggiungibile, DNS, rete assente), il servizio esce e `restart: unless-stopped` lo rimette in loop di fallimento — **e i backup semplicemente non vengono più fatti**, senza che nulla lo segnali.

**Fix:** un `Dockerfile.backup` di tre righe (`FROM postgres:16-alpine` + `RUN apk add --no-cache gnupg` + `ENTRYPOINT`), buildato una volta.

---

<a id="dep-05"></a>
## DEP-05 — Nessun healthcheck sul servizio `app` 🟡

**Severità:** media
**File:** `docker-compose.prod.yml` (righe 31-45)

Il servizio `db` ha un healthcheck corretto (`pg_isready`); `app` no. Docker considera quindi il container sano finché il processo è vivo, anche se Node è bloccato o se le migrazioni sono fallite lasciandolo in uno stato inutilizzabile. `restart: unless-stopped` non può reagire a un blocco, solo a un crash. Serve anche per il reverse proxy di DEP-03, che ha bisogno di un segnale di readiness.

**Fix:** una route `app/api/health/route.ts` che fa un `SELECT 1` su Prisma e restituisce 200/503 (pubblica, senza dati — va aggiunta al matcher di esclusione in `proxy.ts` o gestita con `getUserIdOrNull`), più il blocco `healthcheck` nel compose.

---

<a id="dep-06"></a>
## DEP-06 — Backup mai verificati, chiave e copie sulla stessa macchina 🟡

**Severità:** media
**File:** `scripts/backup-db.sh`, `docker-compose.prod.yml` (righe 59-61), `README-BACKUP.md`

Il backup cifrato con GPG è ben fatto (AES256, `umask 077`, chiave obbligatoria), ma la catena ha tre punti deboli:

1. **Nessuna verifica.** Nulla prova mai che i dump siano ripristinabili. Una passphrase sbagliata in `.env.prod` o un dump troncato si scoprono il giorno del disastro. Il messaggio `[backup] completato` conferma solo che la pipeline è uscita con 0.
2. **Nessuna copia off-site.** `./backups` è un bind mount sulla stessa macchina del database: un guasto al disco, un ransomware o un `rm` sbagliato portano via dati **e** backup insieme.
3. **Chiave co-locata.** `BACKUP_ENCRYPTION_KEY` sta in `.env.prod`, sullo stesso host dei backup cifrati. Chi accede alla macchina ha entrambi; chi perde la macchina perde entrambi. Il commento in `.env.prod.example` (righe 56-58) dice giustamente di conservarla altrove, ma è solo un'esortazione.

**Fix:** sincronizzazione periodica di `./backups` su una destinazione esterna (`rclone`/`restic` verso storage remoto, o anche solo un disco che non sia quello del server); prova di ripristino documentata su un DB usa-e-getta, da rifare almeno una volta l'anno; passphrase salvata in un password manager, non solo in `.env.prod`.

---

<a id="dep-07"></a>
## DEP-07 — Nessuna CI 🟡

**Severità:** media
**File:** nessuno (`.github/workflows/` non esiste)

Il progetto ha **233 test**, di cui una trentina di regressione su sicurezza scritti apposta per non far rientrare bug già risolti (`scripts/verify-*.test.ts`), più un type-check e un lint puliti. Tutto questo gira solo se qualcuno se lo ricorda. Una pipeline che esegue `npx tsc --noEmit`, `npm run lint`, `npm test` e `npm audit --omit=dev` a ogni push è, in rapporto valore/sforzo, l'intervento migliore di tutta questa lista.

---

<a id="dep-08"></a>
## DEP-08 — Nessun logging strutturato né rotazione 🟡

**Severità:** media
**File:** trasversale (`console.error` nelle Server Actions), `docker-compose.prod.yml`

Gli errori finiscono su `console.error` → stdout del container → driver di log di Docker, senza limiti di dimensione (`json-file` di default cresce senza tetto e può riempire il disco) e senza alcun alerting: un errore ricorrente in produzione resta invisibile finché non se ne accorge l'utente.

**Fix minimo:** blocco `logging` con `max-size`/`max-file` su ogni servizio del compose.

---

<a id="dep-09"></a>
## DEP-09 — Indirizzo LAN cablato in `next.config.ts` 🟡

**Severità:** bassa
**File:** `next.config.ts` (riga 57)

```ts
allowedDevOrigins: ['192.168.0.56'],
```

Valore d'ambiente specifico di una macchina in un file versionato. Innocuo (vale solo in dev) ma è configurazione nel posto sbagliato, e smetterà di funzionare al primo cambio di rete.

**Fix:** leggerlo da una env var, o rimuoverlo.

---

<a id="dep-10"></a>
## DEP-10 — Nessun limite di risorse sui container 🟢

**File:** `docker-compose.prod.yml`

Nessun `mem_limit`/`cpus`. Su una VPS piccola, un picco di generazione PDF o un export pesante può far intervenire l'OOM killer sul processo sbagliato (tipicamente Postgres). Da considerare quando si sceglierà la macchina.

---

# Documentazione

<a id="doc-01"></a>
## DOC-01 — `README.md` è ancora il boilerplate di `create-next-app` 🔴

**Severità:** alta per un progetto self-hosted
**File:** `README.md`

Il README parla di `yarn dev`, di `next/font` e di come deployare su Vercel — nulla che riguardi questo progetto. Mancano proprio le informazioni senza le quali il deploy non riesce:

- prerequisiti (Docker, Node, Postgres) e setup di sviluppo;
- variabili d'ambiente richieste (esistono in `.env.prod.example`, ma il README non ci rimanda);
- procedura di primo deploy con `docker-compose.prod.yml`;
- **come si crea il primo utente** (cfr. DEP-01);
- rimando a `README-BACKUP.md` per backup e ripristino;
- comandi utili (`npm test`, `npx prisma migrate dev`).

`CLAUDE.md` e `AGENTS.md` contengono già ottima documentazione architetturale, ma sono rivolti a un assistente, non a chi deve rimettere in piedi il servizio tra sei mesi.

---

<a id="doc-02"></a>
## DOC-02 — Riferimenti a documenti che non esistono 🟡

**File:** tre punti nel codice

| File | Riga | Rimanda a | Stato del file |
|---|---|---|---|
| `Dockerfile` | 36 | `SECURITY_AUDIT.md` | cancellato |
| `lib/excel/sanitize.ts` | 5 | `AUDIT_2026-07-24.md` | cancellato dal working tree |
| `scripts/verify-rate-limit-ip-scope.test.ts` | 15 | `ROADMAP_FIX.md` | mai versionato (è in `.gitignore`) |

In tutti e tre i casi il commento contiene già la spiegazione sostanziale: basta togliere il rimando, non serve ripristinare i documenti.

---

<a id="doc-03"></a>
## DOC-03 — `.gitignore` esclude `docs/` e i file di roadmap 🟡

**File:** `.gitignore` (righe 55 e 57)

```
docs/
ROADMAP_FIX.md
```

Qualunque documento di design o piano scritto sotto `docs/` è invisibile a git — `docs/superpowers/plans/2026-07-24-excel-formula-injection.md` esiste su disco e non è tracciato. È una scelta legittima (tenere fuori gli artefatti degli assistenti), ma vale la pena distinguere: `docs/superpowers/` da ignorare, `docs/` in generale no, se un domani ci si vuole mettere documentazione vera.

Per lo stesso motivo questo file si chiama `ROADMAP.md` e non `ROADMAP_FIX.md`: quest'ultimo nome sarebbe stato silenziosamente ignorato da git.

---

# Qualità / Manutenzione

<a id="qua-01"></a>
## QUA-01 — 2 warning ESLint su `mesiValues` 🟢

**File:** `components/invoices/invoice-form.tsx` (riga 121)

`react-hooks/exhaustive-deps`: `useWatch(...) ?? []` è un'espressione che produce un riferimento nuovo a ogni render, usata come dipendenza di due `useMemo` (righe 126 e 134), che quindi non memoizzano nulla. Cosmetico e a costo quasi nullo: avvolgere `mesiValues` in un proprio `useMemo`.

<a id="qua-02"></a>
## QUA-02 — `any` espliciti in `user-form.tsx` ✅ risolta

**File:** `components/users/user-form.tsx` (righe 108-113)

Due `eslint-disable-next-line @typescript-eslint/no-explicit-any` per tipizzare `register` ed `errors` del componente condiviso `UserFields`. Si risolve rendendolo generico su `UseFormRegister<T>` / `FieldErrors<T>`, o duplicando i campi nei due form (sono pochi). Era l'unico punto del codebase che disattivava una regola del linter.

**Fix applicato:** il componente `UserFields` condiviso è stato rimosso; i campi comuni (`username`, `nome`, `cognome`, `isAdmin`, `abilitato`) sono ora duplicati direttamente in `UserCreateForm` e `UserEditForm`, ciascuno tipizzato sul proprio `UserCreateFormData`/`UserUpdateFormData` senza cast. Effetto collaterale del lavoro su `PIANO_CREAZIONE_UTENTI.md` (il campo password, ora estratto in `TemporaryPasswordField`, era l'unico motivo per cui `UserFields` doveva restare generico/`any`).

<a id="qua-03"></a>
## QUA-03 — `pdf-editor.tsx` a 1848 righe 🟡

**File:** `components/settings/pdf-editor.tsx`

Il file più grande del progetto, il triplo del secondo (`invoices-manager.tsx`, 854). Parte dell'estrazione è già stata fatta (`pdf-editor-mesi-panel`, `pdf-editor-rich-*`, `use-rich-block-editor`), il resto — gestione della history undo/redo, drag-and-drop con snap, pannello proprietà, anteprima — è ancora tutto insieme. Non è un bug, ma è il punto in cui una modifica futura ha più probabilità di rompere qualcosa di non correlato.

<a id="qua-04"></a>
## QUA-04 — Copertura e2e limitata al login 🟡

**File:** `e2e/login.spec.ts` (unico spec)

La logica pura è molto ben coperta a livello unitario, ma i flussi che attraversano davvero lo stack — creare una fattura, scaricarne il PDF, esportare in Excel, archiviare un pagante con cascata — non hanno alcun test end-to-end. Sono proprio i flussi in cui un aggiornamento di Next.js o Prisma (cfr. SEC-01) può rompere qualcosa che nessun unit test vede.

<a id="qua-05"></a>
## QUA-05 — `isBolloCodiceTaken` rilegge la sessione a ogni chiamata 🟢

**File:** `lib/actions/invoices.ts` (righe 54-58)

La funzione chiama `requireUserId()` al proprio interno invece di ricevere `userId` come parametro, come fanno tutte le sorelle (`isInvoiceNumberTaken`, `validateInvoiceRelations`). Una query in più su `utenti` per ogni create/update con bollo. Trascurabile, ma è un'incoerenza rispetto al resto del file.

---

# Ordine di lavoro suggerito

**Prima di qualsiasi deploy** — senza questi, il deploy non funziona o non è recuperabile:
DEP-01 (primo admin) → DEP-02 (prisma nel container) → DEP-03 (TLS + reverse proxy) → SEC-01 (`next@16.2.12`) → LOG-01 (retention backup) → DOC-01 (README).

**Subito dopo, prima di inserire dati reali:**
LOG-02 (numerazione fatture — è una decisione di dominio, meglio prenderla prima che esistano fatture emesse) → SEC-05 (ultimo admin) → SEC-02 (tetto colonne export) → DEP-04, DEP-05, DEP-06 (backup e healthcheck) → DEP-07 (CI).

**Poi, con calma:**
SEC-03, SEC-04, SEC-06, SEC-07, SEC-09, SEC-10, SEC-11, SEC-12 · LOG-03, LOG-04, LOG-06, LOG-07, LOG-08, LOG-09 · DEP-08, DEP-09 · DOC-02, DOC-03 · QUA-01…05.

**Da pianificare a parte** (interventi strutturali, non fix):
LOG-05 (paginazione e filtri server-side) · SEC-08 (CSP con nonce) · QUA-03 (scomposizione dell'editor PDF) · QUA-04 (suite e2e sui flussi critici).
