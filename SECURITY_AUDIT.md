# Audit Sicurezza & Logica — Gestionale Fatture

> **Documento vivo.** Ogni voce ha un ID stabile (`SEC-xx`, `LOG-xx`, `OPS-xx`) e uno stato.
> Quando sistemi qualcosa: cambia lo stato nella tabella di riepilogo **e** nella scheda di
> dettaglio, aggiungi una riga al [Changelog](#changelog). Non rinumerare gli ID: se una voce
> non è più valida marcala `✅ Risolto` o `🚫 Non applicabile`, non cancellarla.

- **Data audit iniziale:** 2026-07-20
- **Commit di riferimento:** `f9c9f94`
- **Scope:** tutto il repository (`app/`, `lib/`, `components/`, `prisma/`, `scripts/`, `proxy.ts`, Docker/deploy)

### Legenda stato

| Stato | Significato |
|---|---|
| 🔴 Aperto | Non ancora affrontato |
| 🟡 In corso | Fix parziale / in lavorazione |
| ✅ Risolto | Sistemato e verificato (indicare come è stato verificato) |
| 🚫 Non applicabile | Rischio accettato consapevolmente o non pertinente (motivare) |

### Legenda severità

| Severità | Criterio |
|---|---|
| **Alta** | Compromissione di autenticazione/dati, o errore che produce documenti fiscali sbagliati |
| **Media** | Sfruttabile con precondizioni, o incoerenza dati visibile all'utente |
| **Bassa** | Hardening, robustezza, manutenibilità |

---

## Riepilogo

### Sicurezza

| ID | Titolo | Severità | Stato |
|---|---|---|---|
| [SEC-01](#sec-01) | Rate limit del login aggirabile falsificando `X-Forwarded-For` | Alta | ✅ Risolto |
| [SEC-02](#sec-02) | Nessuna revoca delle sessioni: il cambio password non invalida i JWT esistenti | Alta | ✅ Risolto |
| [SEC-03](#sec-03) | `JWT_SECRET` accettato senza controllo di robustezza | Alta | ✅ Risolto |
| [SEC-04](#sec-04) | Rate limit in memoria di processo: perso al riavvio, non condiviso tra istanze | Media | ✅ Risolto |
| [SEC-05](#sec-05) | Enumerazione username via timing (`DUMMY_HASH` con cost 10 vs 12) | Media | ✅ Risolto |
| [SEC-06](#sec-06) | Nessun header di sicurezza HTTP (CSP, HSTS, X-Frame-Options, …) | Media | ✅ Risolto |
| [SEC-07](#sec-07) | PDF serviti senza `Cache-Control: private, no-store` | Media | ✅ Risolto |
| [SEC-08](#sec-08) | Nessun rate limit su cambio password, reset password e generazione PDF | Media | ✅ Risolto |
| [SEC-09](#sec-09) | Il container applicativo gira come `root` | Media | ✅ Risolto |
| [SEC-10](#sec-10) | Backup del DB in chiaro, non cifrati, senza copia offsite | Media | ✅ Risolto (cifratura locale; copia offsite non inclusa) |
| [SEC-11](#sec-11) | Input testuali senza limite di lunghezza → bloat/DoS applicativo | Media | ✅ Risolto |
| [SEC-12](#sec-12) | Matcher del `proxy.ts` basato su prefisso: fragile per route future | Bassa | ✅ Risolto |
| [SEC-13](#sec-13) | Le route API rispondono con redirect 307 invece di 401 | Bassa | ✅ Risolto |
| [SEC-14](#sec-14) | `DATABASE_URL` senza `sslmode`, pool `pg` senza limiti | Bassa | ✅ Risolto |
| [SEC-15](#sec-15) | Nessun audit log di accessi e operazioni sensibili | Bassa | ✅ Risolto |
| [SEC-16](#sec-16) | Policy password debole (solo lunghezza ≥ 8) | Bassa | ✅ Risolto |
| [SEC-17](#sec-17) | `getTokenMaxAgeSeconds` usa `decodeJwt` non verificato | Bassa | ✅ Risolto |

### Logica applicativa e correttezza fiscale

| ID | Titolo | Severità | Stato |
|---|---|---|---|
| [LOG-01](#log-01) | Marca da bollo non validata lato server | Alta | ✅ Risolto |
| [LOG-02](#log-02) | Fatture invisibili (elenco + PDF) se pagante/paziente viene eliminato | Alta | 🔴 Aperto |
| [LOG-03](#log-03) | Cancellazione fisica delle fatture e riuso del numero | Alta | 🔴 Aperto |
| [LOG-04](#log-04) | Numero/anno/data modificabili su fatture già emesse, senza traccia | Media | 🔴 Aperto |
| [LOG-05](#log-05) | Prezzo non parsabile convertito silenziosamente a 0 | Media | ✅ Risolto |
| [LOG-06](#log-06) | Importi trattati come `number` (float) fuori dal DB | Media | ✅ Risolto |
| [LOG-07](#log-07) | Mesi duplicati / array senza limite → errore opaco | Media | ✅ Risolto |
| [LOG-08](#log-08) | Dashboard e elenco fatture calcolano insiemi diversi | Media | 🔴 Aperto |
| [LOG-09](#log-09) | CF/P.IVA dei paganti senza validazione di formato | Bassa | ✅ Risolto |
| [LOG-10](#log-10) | `updateProfile` non invalida la cache | Bassa | ✅ Risolto |
| [LOG-11](#log-11) | Fallimento silenzioso dello snapshot layout PDF | Bassa | 🔴 Aperto |
| [LOG-12](#log-12) | Aggregati dashboard dipendenti dal fuso orario del server | Bassa | 🔴 Aperto |
| [LOG-13](#log-13) | Regex globale a livello di modulo in `parseInlineFormatting` | Bassa | 🔴 Aperto |
| [LOG-14](#log-14) | Commento nello schema Prisma cita una migration inesistente | Bassa | 🔴 Aperto |

### Deploy / conformità

| ID | Titolo | Severità | Stato |
|---|---|---|---|
| [OPS-01](#ops-01) | Nessuna gestione GDPR dei dati (categoria particolare) | Media | 🔴 Aperto |
| [OPS-02](#ops-02) | Nessun test automatico oltre agli script di verifica invarianti | Bassa | 🔴 Aperto |
| [OPS-03](#ops-03) | `prisma.config.ts` non copiato nello stage runner del Dockerfile: `migrate deploy` non poteva funzionare in produzione | Alta | ✅ Risolto |

---

## Sicurezza — dettaglio

<a id="sec-01"></a>
### SEC-01 — Rate limit del login aggirabile falsificando `X-Forwarded-For`
**Severità:** Alta · **Stato:** ✅ Risolto (2026-07-20) · **File:** `lib/auth/client-ip.ts`, `lib/auth/rate-limit.ts`, `lib/actions/auth.ts:35-37`, `scripts/verify-rate-limit-ip-scope.ts`

La chiave del rate limit è `(username, ip)` e l'IP viene letto da `x-forwarded-for` / `x-real-ip`.
Se davanti all'app non c'è un reverse proxy che **sovrascrive** quegli header, sono forniti dal
client: un attaccante che cambia `X-Forwarded-For` a ogni richiesta ottiene una chiave nuova ogni
volta e ha tentativi di login **illimitati**. Il commento nel file documenta la falsificabilità ma
tratta il caso come "non peggiora nulla": in realtà, con lo scoping per IP, la falsificabilità
diventa un bypass completo del lockout (prima, con la sola username, non lo era).

**Impatto:** brute force delle password senza limiti.

**Fix applicato:**
1. `lib/auth/client-ip.ts`: aggiunta `isTrustedProxyEnabled()` (legge `TRUSTED_PROXY=true` da env)
   e `resolveClientIp(headersList, trustedProxy)`. `getClientIp()` ora legge
   `X-Forwarded-For`/`X-Real-IP` **solo** se `TRUSTED_PROXY=true`; altrimenti degrada sempre a
   `"unknown"`, indipendentemente da cosa dichiara il client. Default `false` (documentato in
   `.env.prod.example` e `CLAUDE.md`).
2. `lib/auth/rate-limit.ts`: aggiunto un secondo contatore `usernameAttempts`, chiavato sulla sola
   username (`USERNAME_MAX_ATTEMPTS = 20`), che convive con quello esistente per `(username, ip)`.
   `checkLoginRateLimit` blocca se **uno dei due** risulta bloccato; `recordFailedLogin`/
   `recordSuccessfulLogin` aggiornano entrambi. Così, anche con `TRUSTED_PROXY` mal configurato o
   un proxy che non sovrascrive gli header, un attaccante che ruota IP a ogni tentativo viene
   comunque bloccato dopo 20 fallimenti complessivi sullo stesso username.
3. Backoff progressivo non implementato (fuori scope di questo fix, il lockout fisso è ritenuto
   sufficiente per ora).

**Verificato con:**
- `npm run verify:rate-limit-ip-scope` — esteso con due nuovi test:
  `testUsernameWideLockoutSurvivesIpRotation` (19 fallimenti da 19 IP diversi → ancora consentito;
  il 20° fallimento, da un ulteriore IP mai visto, blocca lo username indipendentemente dall'IP) e
  `testResolveClientIpTrustGating` (stessi header con `trustedProxy=false` → `"unknown"`, con
  `true` → IP letto normalmente).
- `npx tsc --noEmit` pulito, `npm run lint` solo warning preesistenti non correlati.
- `npm run verify:actions-auth` / `verify:api-routes-auth` / `verify:safe-user-select` /
  `verify:rich-text` tutti verdi (nessuna regressione sulle altre invarianti).

---

<a id="sec-02"></a>
### SEC-02 — Nessuna revoca delle sessioni
**Severità:** Alta · **Stato:** ✅ Risolto (2026-07-20) · **File:** `prisma/schema.prisma` (`Utente.tokenVersion`), `lib/auth/jwt.ts`, `lib/auth/session.ts`, `lib/actions/account.ts`, `lib/actions/users.ts`, `lib/actions/auth.ts`, `scripts/verify-session-token-version.ts`

Il JWT conteneva solo `sub` e durava 7 giorni. Non esisteva alcun meccanismo di invalidazione:
- il **cambio password** (`changePassword`) non invalidava i token già emessi;
- il **reset password da amministratore** (`resetUserPassword`) neppure;
- non esisteva un "logout da tutti i dispositivi".

Quindi se una sessione era stata compromessa (cookie rubato), cambiare la password **non chiudeva
l'accesso dell'attaccante**: il suo token restava valido fino alla scadenza naturale.

> Nota: la disabilitazione dell'account funzionava già correttamente, perché `getSession()` rilegge
> `abilitato` dal DB a ogni richiesta. Il buco riguardava solo il cambio password.

**Fix applicato:**
1. Aggiunto `Utente.tokenVersion Int @default(0)` allo schema (migration
   `20260720195939_add_token_version`).
2. `lib/auth/jwt.ts`: `SessionPayload` ora include `tokenVersion`; `signSession(userId, tokenVersion)`
   lo firma nel JWT; `verifySession` lo estrae e **rifiuta** i token privi del claim (es. token
   emessi da codice precedente al fix), invece di trattarlo come `undefined`.
3. `lib/auth/session.ts`: `getSession()` confronta `payload.tokenVersion` con
   `user.tokenVersion` letto dal DB — un mismatch invalida la sessione esattamente come un utente
   disabilitato. Aggiunto l'helper `createSessionCookie(userId, tokenVersion)` (firma + imposta il
   cookie in un solo posto), usato sia dal login sia dal cambio password.
4. `lib/actions/account.ts` (`changePassword`): incrementa `tokenVersion` insieme all'update della
   password, poi **riemette subito** il cookie della sessione corrente con il nuovo `tokenVersion` —
   così l'utente che ha appena cambiato la propria password resta loggato, mentre qualunque altro
   token firmato prima (incluso un cookie rubato) viene respinto al controllo successivo.
5. `lib/actions/users.ts` (`resetUserPassword`, reset da admin): incrementa il `tokenVersion`
   dell'utente target, revocando le sue sessioni aperte con la vecchia password.

**Verificato con:**
- Nuovo `npm run verify:session-token-version` — round-trip `signSession`/`verifySession` del
  claim `tokenVersion`, rilevabilità di un mismatch (token firmato con versione superata) e rifiuto
  esplicito di un token legacy privo del claim.
- Test end-to-end contro il DB Postgres di sviluppo (script temporaneo, non incluso nel repo):
  creato un utente, firmato un token con `tokenVersion=0`, poi simulato un cambio password
  (`tokenVersion` incrementato a 1 in DB) — confermato che il vecchio token risulta non più valido
  rispetto al nuovo `tokenVersion` e che un token firmato con `tokenVersion=1` è valido.
- `npx tsc --noEmit` pulito (incluso l'aggiornamento del mock `buildMockInvoice` in
  `lib/pdf/placeholders.ts` col nuovo campo), `npm run lint` solo warning preesistenti non
  correlati.
- `verify:actions-auth`, `verify:api-routes-auth`, `verify:safe-user-select`,
  `verify:rate-limit-ip-scope`, `verify:rich-text` tutti verdi (nessuna regressione).

**Non incluso in questo fix:** un "logout da tutti i dispositivi" esplicito lato utente è
comunque ora possibile in futuro riusando lo stesso incremento di `tokenVersion` da un'azione
dedicata, se richiesto.

---

<a id="sec-03"></a>
### SEC-03 — `JWT_SECRET` accettato senza controllo di robustezza
**Severità:** Alta · **Stato:** ✅ Risolto (2026-07-20) · **File:** `lib/auth/jwt.ts`, `.env.prod.example`, `scripts/verify-jwt-secret-strength.ts`

Veniva verificata solo la presenza della variabile. Un `JWT_SECRET="change-me"` (il valore
letterale presente nell'example, e di fatto anche nel `.env.prod` locale non tracciato) veniva
accettato: HS256 con un segreto corto e indovinabile permette a chiunque di **forgiare token di
sessione validi per qualunque `sub`**, cioè autenticarsi come qualsiasi utente, admin compreso.

**Fix applicato:**
1. `lib/auth/jwt.ts`: aggiunta `assertStrongJwtSecret(value)`, chiamata al caricamento del modulo
   subito dopo il controllo di presenza. Rifiuta (lanciando, quindi impedendo l'avvio dell'app):
   - segreti più corti di 32 byte;
   - un elenco di valori segnaposto noti confrontati case-insensitive (`change-me`, `changeme`,
     `secret`, `password`, `your-secret`, `your-secret-key`, `test`, `test-secret`, `jwt-secret`,
     `jwt_secret`).
2. `.env.prod.example`: aggiunto un commento sopra `JWT_SECRET` che spiega il controllo e indica
   `openssl rand -base64 48` per generarne uno valido.

**Verificato con:**
- Nuovo `npm run verify:jwt-secret-strength` — chiama `assertStrongJwtSecret` (esportata per
  questo) con segnaposto (case-insensitive), segreto corto, stringa vuota (deve lanciare) e un
  segreto lungo non segnaposto (non deve lanciare).
- Verifica realistica end-to-end (script temporaneo, non incluso nel repo): caricato un `.env` di
  prova con `JWT_SECRET=change-me` tramite `dotenv` (lo stesso meccanismo di `prisma.config.ts`) e
  confermato che l'import di `lib/auth/jwt.ts` fallisce con l'errore atteso — cioè che con
  `.env.prod.example`/`.env.prod` non modificati l'app si rifiuta effettivamente di avviarsi.
- `npx tsc --noEmit` pulito (richiesto anche un `export {}` in
  `verify-jwt-secret-strength.ts`/`verify-session-token-version.ts`: senza import/export statici,
  TypeScript li trattava come script globali e le loro dichiarazioni top-level collidevano tra
  loro), `npm run lint` solo warning preesistenti non correlati.
- Tutti gli altri `verify:*` verdi, nessuna regressione.

**Nota per chi deve deployare:** questo fix rende `docker-compose.prod.yml` **non avviabile** finché
`.env.prod` non viene aggiornato con un `JWT_SECRET` reale — è l'effetto voluto, ma va fatto prima
di un deploy o restart in produzione.

---

<a id="sec-04"></a>
### SEC-04 — Rate limit in memoria di processo
**Severità:** Media · **Stato:** ✅ Risolto (2026-07-21) · **File:** `lib/auth/rate-limit.ts`, `scripts/verify-rate-limit-bounds.ts` (nuovo)

La `Map` vive nel processo Node: si azzera a ogni riavvio/deploy del container e non è condivisa se
un giorno si scalasse a più repliche. Inoltre la pulizia era probabilistica
(`SWEEP_PROBABILITY = 0.01`): con traffico basso le voci scadute restavano in memoria a lungo, con
traffico alto e chiavi variabili (vedi SEC-01) la mappa cresceva senza tetto — uno username diverso
a ogni tentativo di login basta a farla crescere indefinitamente, dato che lo username non è
validato finché la query su Postgres non lo risolve.

**Decisione di scope:** l'app resta a singola istanza per ora (confermato esplicitamente), quindi
lo spostamento dello stato su Postgres/Redis proposto per lo scaling futuro **non è incluso in
questo fix** — resta la strada corretta se in futuro si scala a più repliche. Qui si applica solo
la parte del rimedio proposto valida a singola istanza: tetto massimo di voci + eviction + sweep
temporizzato.

**Fix applicato** (entrambe le Map, `attempts` e `usernameAttempts`):
1. `MAX_ENTRIES_PER_MAP = 10_000` (esportata): un tetto fisso per Map, con eviction della voce
   **meno recentemente scritta** una volta superato — non serve un LRU per lettura, dato che ogni
   tentativo fallito passa sempre da una scrittura (`recordFailedLogin`), quindi l'ordine di
   scrittura riflette già l'attività reale. Implementato con l'ordine di iterazione nativo di `Map`
   (`writeRecord` fa `delete`+`set` per spostare una chiave aggiornata in coda; `evictOldest` toglie
   dalla testa finché non si torna sotto il tetto).
2. Lo sweep probabilistico per-chiamata è sostituito da un `setInterval` (ogni 5 minuti,
   `.unref()`-ato per non impedire l'uscita del processo/degli script `verify:*`, con una guardia
   su `globalThis` — stesso pattern di `lib/prisma.ts` — per non accumulare timer a ogni hot-reload
   di Next in sviluppo) che richiama `sweepExpired`, ora esportata perché pura (dipende solo dal
   `now` passato, non dall'orologio reale) e quindi testabile direttamente.

**Verificato con:**
- Nuovo `npm run verify:rate-limit-bounds` — verifica il comportamento osservabile, non lo stato
  interno: (a) `sweepExpired` con un `now` nel futuro sblocca una coppia (username, ip) bloccata da
  5 fallimenti; (b) riempita la Map fino a `MAX_ENTRIES_PER_MAP` con chiavi distinte, la voce
  scritta per prima (bloccata) viene evitta quando arriva una nuova chiave oltre il tetto, mentre
  la voce scritta più di recente (bloccata anch'essa) sopravvive. ~10 000 iterazioni, <1s.
- `npx tsc --noEmit` pulito, `npm run lint` solo warning preesistenti non correlati, tutti gli
  altri `verify:*` (incluso il nuovo) verdi — in particolare `verify:rate-limit-ip-scope`, che
  copre l'isolamento (username, ip)/username-wide toccato da SEC-01, resta verde: la logica di
  scoping non è cambiata, solo la gestione della capacità delle Map.

---

<a id="sec-05"></a>
### SEC-05 — Enumerazione username via timing
**Severità:** Media · **Stato:** ✅ Risolto (2026-07-20) · **File:** `lib/actions/auth.ts`, `scripts/verify-dummy-hash-cost.ts`

Il `DUMMY_HASH` usato per pareggiare i tempi quando l'utente non esiste aveva **cost factor 10**,
mentre gli hash reali sono generati con **cost 12** (`lib/auth/password.ts:4`). Un fattore 4 di
differenza nel tempo di risposta è misurabile e rivelava se uno username esiste.

**Fix applicato:** `DUMMY_HASH` rigenerato con cost 12 (stesso cost di `hashPassword`), su una
stringa che non corrisponde a nessuna password reale.

**Verificato con:**
- Nuovo `npm run verify:dummy-hash-cost` — analisi statica (non timing, intrinsecamente rumoroso e
  quindi inadatto a un test automatico): estrae con regex il cost factor passato a `hash()` in
  `lib/auth/password.ts` e quello incorporato nell'hash `$2b$NN$...` di `DUMMY_HASH` in
  `lib/actions/auth.ts`, e fallisce se i due non coincidono. Così, se in futuro qualcuno alza il
  cost di `hashPassword` senza rigenerare `DUMMY_HASH` (o viceversa), la regressione torna a essere
  rilevabile invece di richiedere di nuovo un'analisi manuale del timing.
- `npx tsc --noEmit` pulito, `npm run lint` solo warning preesistenti non correlati, tutti gli
  altri `verify:*` verdi.

**Non incluso in questo fix:** derivare `DUMMY_HASH` da `hashPassword()` a runtime (invece di una
stringa precalcolata) renderebbe impossibile un disallineamento per costruzione, ma richiederebbe
un hash bcrypt async ad ogni tentativo di login fallito su username inesistente comunque già
presente (`verifyPassword(password, DUMMY_HASH)` lo fa già) — la costante precalcolata è già
sufficiente finché resta allineata, cosa che ora `verify:dummy-hash-cost` garantisce.

---

<a id="sec-06"></a>
### SEC-06 — Nessun header di sicurezza HTTP
**Severità:** Media · **Stato:** ✅ Risolto (2026-07-21) · **File:** `next.config.ts`, `scripts/verify-security-headers.ts` (nuovo)

Non era definito alcun `headers()` in `next.config.ts`: mancavano `Content-Security-Policy`,
`Strict-Transport-Security`, `X-Frame-Options` / `frame-ancestors`, `X-Content-Type-Options`,
`Referrer-Policy`, `Permissions-Policy`. In assenza di CSP, qualunque XSS futuro (oggi non ce ne
sono noti: nessun `dangerouslySetInnerHTML` nel codebase) sarebbe stato pienamente sfruttabile;
senza `frame-ancestors` l'app era incorniciabile (clickjacking).

**Fix applicato:** aggiunto un blocco `async headers()` in `next.config.ts`, applicato a `/(.*)`
(copre anche `app/api/**/route.ts`, non solo le pagine):
- **Sempre** (dev e produzione): `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: strict-origin-when-cross-origin`,
  `Permissions-Policy: camera=(), microphone=(), geolocation=()`.
- **Solo in produzione** (`NODE_ENV === "production"`):
  - `Content-Security-Policy`: `default-src 'self'` con `object-src 'none'`,
    `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self'`, e
    `script-src`/`style-src`/`img-src`/`font-src`/`connect-src` ristretti a `'self'` (più
    `data:` per immagini/font e `'unsafe-inline'` per script/style — vedi nota sotto).
  - `Strict-Transport-Security: max-age=15552000; includeSubDomains` (innocuo se la risposta non
    arriva già su HTTPS: i browser ignorano l'header su HTTP semplice).

  Esclusi da dev perché Turbopack inietta script eval-based e usa un websocket per l'HMR che una
  CSP stretta bloccherebbe, senza alcun beneficio reale su un ambiente locale non esposto.

**Compromesso consapevole — `'unsafe-inline'` su script-src/style-src:** verificato che il
codebase non fa alcuna `fetch`/XHR verso domini esterni, non usa `next/image` con pattern remoti, e
i font (`next/font/google`) sono self-hosted a build time — quindi `'self'` su tutte le altre
direttive non rompe nulla di reale. `'unsafe-inline'` resta necessario per lo script di bootstrap
dell'hydration che Next.js inietta inline nell'HTML (`self.__next_f.push(...)`): una CSP "strict"
con nonce per-richiesta eliminerebbe anche questo, ma richiederebbe generare il nonce in `proxy.ts`
e propagarlo nei Server Component — un cambiamento più ampio, valutato fuori scope per questo fix
proporzionato. La differenza rispetto a nessuna CSP resta comunque sostanziale: blocca comunque il
caricamento di script/risorse da domini esterni in caso di un futuro XSS.

**Verificato con:**
- Nuovo `npm run verify:security-headers` — chiama direttamente `headers()` dalla config esportata
  (impostando `NODE_ENV` a `"development"`/`"production"` nello stesso processo, con import
  dinamico cache-bustato per ogni valore) e verifica: i quattro header sempre presenti; che CSP e
  HSTS **non** compaiano in sviluppo; che in produzione compaiano con le direttive attese
  (`default-src 'self'`, `object-src 'none'`, `frame-ancestors 'none'`, `max-age` su HSTS).
- **Non verificato dal vivo contro un server realmente in ascolto**: Next.js rifiuta una seconda
  istanza `next dev` sullo stesso progetto (vedi nota già in SEC-12), e il dev server dell'utente
  sulla porta 3000 è stato lasciato intatto. Il cambiamento richiede comunque un riavvio del server
  per avere effetto (non si applica a caldo), e in ogni caso **non tocca l'ambiente di sviluppo
  dell'utente**: CSP/HSTS si attivano solo con `NODE_ENV=production` (build/`next start`/Docker),
  quindi il dev server esistente non è interessato. Consigliato un test manuale con
  `npm run build && npm run start` (o l'immagine Docker) prima del prossimo deploy, controllando la
  console del browser per eventuali violazioni CSP sulle pagine più complesse (in particolare
  `settings/pdf`, che carica l'editor TipTap).
- `npx tsc --noEmit` pulito, `npm run lint` solo warning preesistenti non correlati, tutti gli
  altri `verify:*` verdi.

---

<a id="sec-07"></a>
### SEC-07 — PDF serviti senza direttive di cache
**Severità:** Media · **Stato:** ✅ Risolto (2026-07-20) · **File:** `app/api/invoices/[id]/pdf/route.ts`, `scripts/verify-pdf-route-cache-control.ts`

La risposta impostava solo `Content-Type` e `Content-Disposition`. Un PDF di fattura contiene nome
del paziente, del pagante, importi e (implicitamente) la natura della prestazione sanitaria:
andava marcato esplicitamente come non cacheabile da proxy intermedi e dal browser.

**Fix applicato:** aggiunto `"Cache-Control": "private, no-store, max-age=0"` alla risposta.

**Verificato con:**
- Nuovo `npm run verify:pdf-route-cache-control` — analisi statica (stesso approccio di
  `verify-api-routes-auth.ts`): scansiona `app/api/**/route.ts`, e per ogni route che serve
  `Content-Type: application/pdf` richiede che compaia anche `no-store` nell'header
  `Cache-Control`. Copre anche eventuali route PDF future, non solo quella attuale.
- `npx tsc --noEmit` pulito, `npm run lint` solo warning preesistenti non correlati, tutti gli
  altri `verify:*` verdi.

---

<a id="sec-08"></a>
### SEC-08 — Nessun rate limit oltre il login
**Severità:** Media · **Stato:** ✅ Risolto (2026-07-20) · **File:** `lib/auth/rate-limiter.ts` (nuovo), `lib/actions/account.ts`, `lib/actions/users.ts`, `app/api/invoices/[id]/pdf/route.ts`, `scripts/verify-rate-limiter.ts`

- `changePassword` verificava la password attuale senza throttling: chi otteneva una sessione
  poteva forzare in loop la password corrente per confermarla/riusarla altrove.
- `resetUserPassword` (reset da admin) non aveva limiti: una sessione admin compromessa poteva
  resettare in sequenza la password di ogni utente.
- La generazione PDF (`@react-pdf/renderer`) è costosa in CPU e non aveva limiti: un client
  autenticato poteva saturare il processo Node richiedendo PDF in loop.

**Fix applicato:**
1. Nuovo `lib/auth/rate-limiter.ts`: `createRateLimiter({ maxRequests, windowMs })`, un limiter
   generico a finestra fissa in memoria di processo (stesso approccio del rate limiter di login in
   `lib/auth/rate-limit.ts`, ma parametrico e senza lockout — qui basta un conteggio per finestra).
2. `changePassword` (`lib/actions/account.ts`): 10 richieste/ora per utente (chiave = id utente,
   non serve l'IP: la sessione è già autenticata).
3. `resetUserPassword` (`lib/actions/users.ts`): 20 richieste/ora per admin — soglia più larga di
   `changePassword` perché un admin legittimo può dover resettare più account in sequenza (es. dopo
   un incidente).
4. Route PDF (`app/api/invoices/[id]/pdf/route.ts`): 30 richieste/minuto per utente, risposta
   `429` con header `Retry-After` se superato.

**Verificato con:**
- Nuovo `npm run verify:rate-limiter` — testa la logica del limiter generico (finestra, blocco al
  limite, chiavi indipendenti, reset dopo la scadenza) e verifica via analisi statica che
  `changePassword`, `resetUserPassword` e la route PDF chiamino effettivamente
  `<nome>Limiter.consume(...)`, non solo che importino il modulo.
- `npx tsc --noEmit` pulito, `npm run lint` solo warning preesistenti non correlati, tutti gli altri
  `verify:*` verdi.

---

<a id="sec-09"></a>
### SEC-09 — Il container applicativo gira come root
**Severità:** Media · **Stato:** ✅ Risolto (2026-07-21) · **File:** `Dockerfile` (stage `runner`), `.dockerignore`

Nessuna direttiva `USER`: `node server.js` veniva eseguito come `root` dentro il container. Un RCE
o una path traversal avrebbero avuto privilegi massimi nel container.

**Fix applicato:**
1. Nello stage `runner`: `RUN addgroup -g 1001 -S nodejs && adduser -S -u 1001 -G nodejs nextjs`,
   subito dopo le `ENV` e prima delle `COPY`.
2. Tutte le `COPY --from=builder` dello stage `runner` (`node_modules`, `.next/standalone`,
   `.next/static`, `public`, `package.json`, `prisma`) usano ora `--chown=nextjs:nodejs`, così i
   file appartengono all'utente non privilegiato invece che a `root` fin dalla creazione del layer
   (evita un `RUN chown -R` separato, più lento perché riscrive un intero layer aggiuntivo).
3. `USER nextjs` impostato subito prima di `EXPOSE`/`CMD`.
4. `.dockerignore`: aggiunte `/postgres_dev_data` e `/backups` — non necessarie a questo fix in
   sé, ma la prima bloccava qualunque `docker build` (permessi `0700 root:root` sulla cartella dati
   di Postgres locale, non leggibile dal processo che impacchetta il build context), impedendo di
   verificare il fix con un build reale.

**Verificato con — build Docker reale, non solo lettura del Dockerfile:**
- `docker build` dell'immagine completa (entrambi gli stage) da zero: riuscito.
- `docker run ... id` / `whoami` sull'immagine risultante → `uid=1001(nextjs) gid=1001(nodejs)`,
  non `root`.
- `ls -la /app` nel container → tutti i file/directory applicativi di proprietà di
  `nextjs:nodejs`, non `root:root`.
- `touch /root-test` nel container → `Permission denied` (l'utente non ha scrittura sulla root del
  filesystem).
- **Test end-to-end con Postgres effimero** (container Postgres creato solo per questo test, su
  una rete Docker dedicata, poi rimosso — **non** è stato toccato il Postgres di sviluppo
  dell'utente `postgres-dev`): avviato il container applicativo con il `CMD` reale
  (`npx prisma migrate deploy && node server.js`) contro questo DB temporaneo. Le 4 migrazioni si
  sono applicate correttamente, il server Next.js si è avviato (`✓ Ready in 0ms`), e una richiesta
  HTTP a `/login` da un altro container sulla stessa rete ha risposto `200`. `docker exec ... id`
  a container in esecuzione conferma `uid=1001(nextjs)` anche durante il funzionamento normale, non
  solo all'avvio.
- Nota sulla verifica: la build di produzione richiede `JWT_SECRET`/`DATABASE_URL` disponibili già
  in fase di `next build` (conseguenza del fix SEC-03: `assertStrongJwtSecret` viene valutato al
  caricamento del modulo, e la raccolta dati delle pagine in build-time importa quel modulo). Il
  Dockerfile e `docker-compose.prod.yml` tracciati non sono stati modificati per includere segreti
  — la verifica ha usato uno stage `builder` con `ENV` di test aggiunte solo in una copia
  temporanea del Dockerfile, mai committata. Chi farà il prossimo build di produzione reale dovrà
  passare `JWT_SECRET`/`DATABASE_URL` validi come build args o env al passo `docker build`, non
  solo a runtime — non era necessario prima del fix SEC-03 e non risulta ancora documentato in
  `docker-compose.prod.yml`/`README`.

**Non incluso in questo fix:** rendere `docker build` in produzione effettivamente in grado di
ricevere `JWT_SECRET`/`DATABASE_URL` in modo pulito (es. `ARG` dedicati passati da CI/CD, o
un secret mount di BuildKit invece di una `ENV` in chiaro nel Dockerfile) è un problema distinto,
introdotto dal fix di SEC-03 e non ancora tracciato con un proprio ID in questo audit.

---

<a id="sec-10"></a>
### SEC-10 — Backup del DB in chiaro
**Severità:** Media · **Stato:** ✅ Risolto (2026-07-21, solo backup locali) · **File:** `scripts/backup-db.sh`, `docker-compose.prod.yml` (servizio `backup`), `.env.prod.example`, `README-BACKUP.md`

I dump finiscono in `./backups` sull'host come `.sql.gz` **non cifrati**, contenenti l'intero
archivio pazienti/fatture e gli hash delle password. Nessuna copia offsite, nessun controllo dei
permessi della directory, nessuna verifica di ripristino.

**Fix applicato:**
1. `scripts/backup-db.sh`: `umask 077` a inizio script (i file creati sono `rw-------`); lo script
   esce con errore se `BACKUP_ENCRYPTION_KEY` non è impostata; il dump è cifrato in streaming
   (`pg_dump | gzip | gpg --symmetric --cipher-algo AES256`), output `.sql.gz.gpg`; retention a 14
   giorni sui file `*.gpg`.
2. `docker-compose.prod.yml`: il servizio `backup` riceve `BACKUP_ENCRYPTION_KEY` dall'ambiente e
   installa `gnupg` (assente sull'immagine `postgres:16-alpine`) prima di avviare lo script.
3. `.env.prod.example`: documentata la variabile `BACKUP_ENCRYPTION_KEY`.
4. `README-BACKUP.md`: procedura di restore (decifratura GPG + `psql` nel container).

**Non incluso in questo fix:** copia offsite dei backup — restano solo su `./backups` sull'host,
quindi non protetti da un disastro che coinvolga la macchina stessa. Resta un rischio distinto da
tracciare separatamente se necessario.

---

<a id="sec-11"></a>
### SEC-11 — Input testuali senza limite di lunghezza
**Severità:** Media · **Stato:** ✅ Risolto (2026-07-20) · **File:** `lib/validations/invoice.ts`, `lib/validations/patient.ts`, `lib/validations/payer.ts`, `lib/validations/profile.ts`, `lib/validations/pdf-settings.ts`, `scripts/verify-input-length-limits.ts`

Molti campi erano `z.string().min(1)` senza `.max()`. Inoltre `blocchi` era un array senza tetto e
`richContent` / `descrizioneRichContent` / `valoreRichContent` sono `z.unknown()` — blob JSON
arbitrari salvati tal quali su Postgres. Un client autenticato poteva scrivere payload molto
grandi (limite pratico: 1 MB per Server Action) e ripetere l'operazione.

**Fix applicato:**
1. Aggiunto `.max()` ai campi stringa privi di limite:
   - `invoiceSchema`: `commento` (2000), `citta` (100), `cap` (10);
   - `patientSchema`: `nome`/`cognome` (100);
   - `payerSchema`: `nome`/`cognome` (100), `via` (200), `citta` (100), `cap` (10);
   - `profileUpdateSchema`: `nome`/`cognome` (100), `via` (200), `citta` (100), `cap` (10),
     `titolo` (50), `specializzazione` (100). (`pIva`/`cf`/`provincia` erano già vincolati da
     regex a lunghezza fissa, non serviva `.max()`.)
2. `pdfSettingsSchema.blocchi`: da `.min(1)` senza tetto a `.min(1).max(500)` — soglia
   volutamente **più larga di 100** (indicazione esplicita ricevuta): il layout PDF è costruito a
   mano nell'editor drag-and-drop e può crescere con molti blocchi di testo/mesi, il tetto serve
   solo a impedire un payload senza limite, non a vincolare l'uso normale. Verificato che
   `lib/pdf/layout-default.ts` (8 blocchi) resta ampiamente sotto soglia.
3. `bloccoSchema.id`: aggiunto `.max(100)`; `bloccoSchema.testo`: aggiunto `.max(10_000)`.
4. `richContent` / `descrizioneRichContent` / `valoreRichContent`: restano `z.unknown()` — non
   validati in profondità, come da scelta di design esistente (non accoppiare la validazione
   server-side alla struttura interna della libreria di rich-text) — ma ora passano da un nuovo
   `boundedRichContent(maxLength)` che rifiuta il payload se `JSON.stringify(value).length` supera
   50 000 caratteri. Non usa `Buffer` (che romperebbe un bundle client): il modulo è oggi importato
   solo server-side, ma la scelta lo rende sicuro anche se in futuro finisse in un bundle browser.

**Verificato con:**
- Nuovo `npm run verify:input-length-limits` — per ogni campo modificato, chiama `safeParse` con
  un input appena sopra la soglia (deve fallire) e uno alla soglia esatta o sotto (deve passare),
  incluso un `richContent` abbastanza grande da superare i 50 000 caratteri serializzati.
- `npx tsc --noEmit` pulito, `npm run lint` solo warning preesistenti non correlati, tutti gli
  altri `verify:*` verdi.

---

<a id="sec-12"></a>
### SEC-12 — Matcher del proxy basato su prefisso
**Severità:** Bassa · **Stato:** ✅ Risolto (2026-07-20) · **File:** `proxy.ts`, `scripts/verify-proxy-matcher.ts`

Il lookahead `(?!login|api|_next/static|…)` non era ancorato a un confine di segmento: qualsiasi
percorso che **inizia** con quelle stringhe veniva escluso dal controllo di sessione (es.
`/loginhelp`, `/api-docs`). Oggi non esisteva nessuna route del genere, quindi non c'era
esposizione reale, ma era una trappola per route future. Inoltre `favicon.ico` e `robots.txt`
usavano un `.` non escapato: in regex è un wildcard per qualunque carattere, non un punto
letterale (avrebbe potuto matchare anche, ad es., `faviconXico`).

**Fix applicato:** il matcher ora è
`(?!(?:login|api|_next/static|_next/image|favicon\.ico|robots\.txt)(?:/|$))` — ogni voce
dell'allowlist deve essere seguita da `/` o dalla fine del percorso, non solo comparire come
prefisso; il punto in `favicon.ico`/`robots.txt` è escapato (`\.`) così resta letterale.

**Verificato con:**
- Nuovo `npm run verify:proxy-matcher` — estrae con regex la stringa del matcher da `proxy.ts` e
  la testa (ancorata a inizio stringa) contro un set di percorsi. Copre sia le route pubbliche
  legittime (devono restare escluse: `/login`, `/api/...`, asset `_next`, `favicon.ico`,
  `robots.txt`) sia i casi di regressione (`/loginhelp`, `/api-docs`, `/_next/staticfoo`,
  `/faviconXico`, …) che con il matcher precedente sarebbero sfuggiti al controllo di sessione.
  Nota di scope: Next.js compila il matcher con `path-to-regexp` più un wrapping interno (suffissi
  per route dati/RSC, prefisso locale, `basePath` — nessuno rilevante per questa app, che non usa
  i18n né basePath); replicare quella pipeline userebbe API interne di Next non pubbliche e fragili
  tra versioni, quindi il test verifica la stringa del matcher direttamente come `RegExp`
  standard — sufficiente per la proprietà che conta qui (confine di segmento sull'allowlist).
- Non è stato possibile avviare un secondo dev server per un test end-to-end HTTP dal vivo: Next.js
  16 rifiuta una seconda istanza `next dev` sullo stesso progetto (lock singleton), e sulla porta
  3000 risultava già in esecuzione un dev server dell'utente, lasciato intenzionalmente intatto.
- `npx tsc --noEmit` pulito, `npm run lint` solo warning preesistenti non correlati, tutti gli
  altri `verify:*` verdi.

---

<a id="sec-13"></a>
### SEC-13 — Le route API rispondono con redirect invece di 401
**Severità:** Bassa · **Stato:** ✅ Risolto (2026-07-20) · **File:** `lib/auth/session.ts`, `app/api/invoices/[id]/pdf/route.ts`, `scripts/verify-api-routes-auth.ts`, `scripts/lib/api-route-auth-checks.ts` (nuovo), `scripts/verify-api-route-auth-checker.ts` (nuovo)

`requireUserId()` chiamava `redirect("/login")`: in un route handler questo produceva un 307 verso
la pagina di login, non un 401. Un client non autenticato riceveva HTML invece di un errore
interpretabile — proprio il problema che il commento in `proxy.ts` diceva di voler evitare.

**Fix applicato:**
1. Nuovo `getUserIdOrNull()` in `lib/auth/session.ts`: restituisce `null` invece di fare redirect,
   così il chiamante può decidere autonomamente come rispondere.
2. `app/api/invoices/[id]/pdf/route.ts`: sostituito `requireUserId()` con
   `getUserIdOrNull()` + `if (userId === null) return new Response("Non autenticato", { status: 401 })`.
3. `scripts/verify-api-routes-auth.ts` aggiornato per riconoscere anche questo pattern come
   verifica di sessione valida — ma **non** riconosce la sola presenza di `getUserIdOrNull()`: a
   differenza di `requireUserId`/`requireSession`/`requireAdmin` (che impediscono strutturalmente
   di dimenticare il controllo, tramite redirect), `getUserIdOrNull()` restituisce un valore che un
   chiamante distratto potrebbe ignorare. Il pattern è quindi riconosciuto solo se nello stesso
   corpo compaiono anche un controllo `=== null` e una risposta con `status: 401`. I predicati sono
   stati estratti in un modulo condiviso, `scripts/lib/api-route-auth-checks.ts`, senza side-effect
   a livello di import (a differenza dello script principale, che esegue la scansione reale
   all'importazione) così da poterli testare in isolamento.

**Verificato con:**
- Nuovo `npm run verify:api-route-auth-checker` — testa i predicati direttamente: chiamate
  redirect-based bastano da sole; `getUserIdOrNull()` da solo, o con un controllo `=== null` che
  non risponde 401, NON deve bastare; `getUserIdOrNull()` con controllo `=== null` e risposta 401
  deve bastare.
- `npm run verify:api-routes-auth` continua a passare sulla route reale, ora riscritta con
  `getUserIdOrNull()`.
- `npx tsc --noEmit` pulito, `npm run lint` solo warning preesistenti non correlati, tutti gli
  altri `verify:*` verdi.

---

<a id="sec-14"></a>
### SEC-14 — Connessione DB senza TLS e pool senza limiti
**Severità:** Bassa · **Stato:** ✅ Risolto (2026-07-21) · **File:** `lib/prisma.ts`, `.env.prod.example`, `scripts/verify-prisma-pool-limits.ts` (nuovo)

`new Pool({ connectionString })` senza `max`, `idleTimeoutMillis`, `connectionTimeoutMillis`, e la
`DATABASE_URL` di esempio non specificava `sslmode`.

**Fix applicato:**
1. `lib/prisma.ts`: il `Pool` di `pg` ora imposta esplicitamente `max: 10`,
   `idleTimeoutMillis: 30_000`, `connectionTimeoutMillis: 5_000` — evita di aprire connessioni
   senza tetto verso Postgres sotto carico o in presenza di leak, e impedisce che una connessione
   inattiva o un DB irraggiungibile blocchino il pool a tempo indeterminato.
2. `sslmode`: **non abilitato in `DATABASE_URL`**, per scelta esplicita — allo stato attuale
   dell'infrastruttura, applicazione e Postgres girano sulla **stessa macchina**, comunicando sulla
   rete Docker interna del compose (il traffico non attraversa mai l'host o una rete condivisa),
   quindi TLS sulla connessione DB non aggiunge una protezione reale oggi. Aggiunto invece un
   commento esplicito in `.env.prod.example` sopra `DATABASE_URL` che segnala la cosa e ricorda di
   aggiungere `&sslmode=require` **prima** di un eventuale spostamento futuro del database su una
   macchina/host separato (es. Postgres gestito o remoto) — a quel punto la connessione
   attraverserebbe una rete non più fidata quanto il loopback locale.

**Verificato con:**
- Nuovo `npm run verify:prisma-pool-limits` — importa dinamicamente `lib/prisma.ts` con una
  `DATABASE_URL` sintatticamente valida ma non raggiungibile (il `Pool` di `pg` non si connette
  eagerly, solo alla prima query, quindi l'import è sicuro senza un Postgres reale in ascolto) per
  verificare che il modulo si carichi senza lanciare, poi analizza staticamente il sorgente per
  confermare che `max`, `idleTimeoutMillis` e `connectionTimeoutMillis` siano ancora impostati con
  valori numerici espliciti — copre la regressione in cui qualcuno li rimuovesse in futuro.
- `npx tsc --noEmit` pulito, `npm run lint` solo warning preesistenti non correlati, tutti gli
  altri `verify:*` (incluso il nuovo) verdi.

---

<a id="sec-15"></a>
### SEC-15 — Nessun audit log
**Severità:** Bassa · **Stato:** ✅ Risolto (2026-07-21) · **File:** `prisma/schema.prisma` (model `AuditLog`), `lib/audit/actions.ts` (nuovo), `lib/audit/log.ts` (nuovo), `lib/data/audit-log-select.ts` (nuovo), `lib/data/audit-log.ts` (nuovo), `app/(protected)/audit-log/page.tsx` (nuovo), `components/audit-log/audit-log-manager.tsx` (nuovo), `components/layout/sidebar-content.tsx`, `lib/actions/{auth,account,users,invoices,patients,payers,settings}.ts`, `scripts/verify-audit-log-coverage.ts` (nuovo)

Non veniva registrato nulla di: login riusciti/falliti, creazione/modifica/eliminazione fatture,
reset password da admin, cambi di ruolo. In caso di contestazione o incidente non c'era modo di
ricostruire chi avesse fatto cosa. Rilevante anche per l'accountability GDPR (vedi OPS-01).

**Fix applicato:**
1. Nuovo model `AuditLog` (`id`, `id_Utente` nullable con FK verso `Utente` — `ON DELETE SET
   NULL`, `azione` `String` non-enum, `entita`/`entitaId` come identificatori polimorfici non-FK
   (necessario perché `deleteInvoice` fa hard-delete, LOG-03: l'id deve restare leggibile nel log
   anche dopo che la riga referenziata non esiste più), `meta Json?`, `ip`, `createdAt`), migration
   `20260721101241_add_audit_log`.
2. `lib/audit/actions.ts`: elenco chiuso di 20 azioni auditate (`AuditAction` union type +
   `AUDIT_ACTION_LABELS` per la UI); `lib/audit/log.ts`: `logAudit()`, scrittura **best-effort**
   (try/catch, `console.error` se fallisce) e **non bloccante** — un fallimento nella scrittura
   dell'audit log non deve mai far fallire un'operazione già eseguita con successo. Nessuna
   password (nemmeno tentata) o `passwordHash` finisce mai in `meta`.
3. Copertura **ampia** (tutte le mutazioni, non solo le 4 categorie nominate sopra, per scelta
   esplicita): `login`/`logout` (3 rami di fallimento + successo + logout) in `auth.ts`;
   `changePassword`/`updateProfile` in `account.ts`; `createUser`/`updateUser`/
   `resetUserPassword`/`toggleUserEnabled` in `users.ts`; `createInvoice`/`updateInvoice`/
   `deleteInvoice` in `invoices.ts`; create/update/delete di pazienti e paganti; `updatePdfSettings`/
   `refreshInvoicePdfLayout` in `settings.ts`.
4. Nuova pagina admin-only `/audit-log` (stesso pattern di `/users`: `requireAdmin()` nel data
   layer, whitelist esplicita `AUDIT_LOG_SELECT`, tabella `hidden md:block` + card `md:hidden`),
   collegata in sidebar solo per gli admin.
5. Nuovo `npm run verify:audit-log-coverage` (stesso pattern statico di `verify-actions-auth.ts`):
   fallisce se una Server Action mutante in `lib/actions/*.ts` non chiama `logAudit(`, così una
   nuova mutazione futura senza audit log viene segnalata invece di passare inosservata.

**Verificato con:**
- `npm run verify:audit-log-coverage` verde, più tutti gli altri `verify:*` esistenti (in
  particolare `verify:actions-auth`, invariato: l'aggiunta di `logAudit` non tocca i controlli di
  sessione).
- `npx tsc --noEmit` e `npm run lint` puliti (solo warning preesistenti non correlati).
- **Test end-to-end reale** contro il dev server Next.js dell'utente (`docker-compose.dev.yml`,
  Postgres di sviluppo) e non solo lettura del codice: creato un utente admin temporaneo
  (`audit_smoke_test`, rimosso a fine test) e guidato l'app via richieste HTTP reali che replicano
  il protocollo di progressive-enhancement dei form di Next (stessi campi nascosti `$ACTION_*` che
  userebbe un browser senza JS) — login con username inesistente, login con password errata su
  utente esistente, login corretto, apertura di `/audit-log`, logout. Confermato via query diretta
  su `audit_logs` che ogni evento viene scritto con `id_Utente`/`azione`/`entita`/`meta`/`ip`
  corretti (incluso `id_Utente = NULL` per il login con username inesistente) e che **nessuna
  password in chiaro compare mai in `meta`**; confermato via il markup HTML restituito da
  `/audit-log` che la UI traduce correttamente le azioni in etichette italiane e non espone
  password in nessuna colonna. Durante il primo giro il processo dev server dell'utente (avviato
  prima della migration) aveva ancora il vecchio `@prisma/client` in memoria: `getAuditLog()` ha
  fallito con 500 come atteso (nessun try/catch lì, a differenza di `logAudit`), mentre `login()`
  ha continuato a funzionare correttamente nonostante `logAudit` fallisse silenziosamente — prova
  pratica, non solo teorica, che il design best-effort regge sotto un guasto reale. Il dev server è
  stato riavviato (operazione di routine, non distruttiva) per caricare il client rigenerato, dopo
  di che tutto il flusso ha funzionato. Utente/dati di test rimossi a fine verifica.
- Non testato via questo stesso meccanismo HTTP: le mutazioni di fatture/pazienti/paganti dietro
  dialog client-side (il form non esiste nell'HTML finché il dialog non viene aperto lato client,
  quindi non riproducibile con semplice scraping HTML); coperte comunque da lettura diretta del
  codice (stesso pattern esatto di `logAudit` già validato su login/logout) e da
  `verify:audit-log-coverage`.

**Non incluso in questo fix:** filtri/paginazione avanzati sulla pagina `/audit-log` (oggi mostra
gli ultimi 200 eventi, `take: 200`, stesso pattern di `getLatestInvoices`); retention/pulizia
storica degli eventi più vecchi (si ricollega a OPS-01).

---

<a id="sec-16"></a>
### SEC-16 — Policy password debole
**Severità:** Bassa · **Stato:** ✅ Risolto (2026-07-20) · **File:** `lib/validations/user.ts`, `lib/auth/common-passwords.ts` (nuovo), `scripts/verify-password-policy.ts` (nuovo)

Unico requisito era 8 caratteri. Nessun blocco delle password comuni, nessuna verifica che la
nuova password fosse diversa dalla precedente in `changePassword`. (Nessun requisito di
complessità — maiuscole/cifre/simboli — non era nello scope di questo fix, per scelta esplicita:
il remedio concordato punta su lunghezza e deny-list, non su regole di composizione, che la
letteratura NIST/OWASP considera oggi meno efficaci della sola lunghezza.)

**Fix applicato:**
1. Nuovo `passwordSchema` condiviso in `lib/validations/user.ts`: minimo **12 caratteri** (era 8) e
   rifiuto se la password compare in una deny-list di password comuni note
   (`lib/auth/common-passwords.ts`, confronto case-insensitive, voci già ≥12 caratteri dato che
   quelle più corte sarebbero comunque respinte dal requisito di lunghezza). Riusato da
   `userCreateSchema.password` e `resetPasswordSchema.password`.
2. `changePasswordSchema.newPassword` usa lo stesso `passwordSchema`, e un nuovo `.refine()`
   rifiuta la richiesta se `newPassword === currentPassword` — verificato a livello di schema
   (stesso payload, entrambi in chiaro nella richiesta), quindi vale sia per la validazione
   server-side sia per il form client (`zodResolver(changePasswordSchema)` in
   `change-password-form.tsx`), senza bisogno di logica aggiuntiva nell'azione.

**Verificato con:**
- Nuovo `npm run verify:password-policy` — verifica lunghezza minima, deny-list
  (case-insensitive), che `userCreateSchema`/`resetPasswordSchema` usino la stessa policy, che
  `changePasswordSchema` rifiuti `newPassword === currentPassword` pur accettando una password
  robusta e diversa, e che il controllo di conferma (`newPassword === confirmPassword`) preesistente
  continui a funzionare insieme al nuovo.
- `npx tsc --noEmit` pulito, `npm run lint` solo warning preesistenti non correlati, tutti gli
  altri `verify:*` verdi.

---

<a id="sec-17"></a>
### SEC-17 — `getTokenMaxAgeSeconds` usa `decodeJwt` non verificato
**Severità:** Bassa · **Stato:** ✅ Risolto (2026-07-20) · **File:** `lib/auth/jwt.ts`, `lib/auth/session.ts`, `scripts/verify-jwt-max-age-encapsulation.ts` (nuovo)

La funzione leggeva `exp`/`iat` senza verificare la firma. Era sicuro **prima del fix** solo perché
l'unico chiamante (`setSessionCookie`) passava un token appena firmato dal server — precondizione
documentata nel commento ma non imposta dai tipi né da un test. Un chiamante futuro che le avesse
passato un token del client avrebbe potuto farsi impostare un cookie di durata arbitraria, dato che
la funzione era esportata e accettava una stringa qualsiasi come parametro.

**Fix applicato:**
1. `getTokenMaxAgeSeconds` non è più esportata da `lib/auth/jwt.ts` (era `export function`, ora
   `function` senza `export`): non richiamabile da fuori il modulo con un token arbitrario.
2. Nuovo `signSessionWithMaxAge(userId, tokenVersion): Promise<{ token, maxAgeSeconds }>`: firma e
   calcola la durata nello stesso posto, senza mai esporre un punto in cui un token esterno possa
   entrare nel calcolo.
3. `lib/auth/session.ts`: `setSessionCookie` non è più esportata (era usata da un solo punto,
   `createSessionCookie`, ora anch'esso nello stesso file) e accetta `(token, maxAgeSeconds)` già
   calcolati insieme da `signSessionWithMaxAge`, invece di ricalcolare la durata internamente da un
   token generico.

**Verificato con:**
- Nuovo `npm run verify:jwt-max-age-encapsulation` — verifica che `getTokenMaxAgeSeconds` non sia
  più presente tra le esportazioni del modulo (`typeof modulo.getTokenMaxAgeSeconds === "undefined"`)
  e che `signSessionWithMaxAge` produca un `maxAgeSeconds` che corrisponde esattamente a `exp - iat`
  del token appena firmato, oltre a coincidere col fallback `"7d"` di `JWT_EXPIRES_IN` quando non
  impostato.
- `npx tsc --noEmit` pulito (conferma che nessun altro punto del codebase importava
  `getTokenMaxAgeSeconds`/chiamava `setSessionCookie` dall'esterno di `session.ts` — l'unico uso
  era già interno), `npm run lint` solo warning preesistenti non correlati, tutti gli altri
  `verify:*` verdi.

---

## Logica applicativa — dettaglio

<a id="log-01"></a>
### LOG-01 — Marca da bollo non validata lato server
**Severità:** Alta · **Stato:** ✅ Risolto (2026-07-21) · **File:** `lib/validations/invoice.ts`, `scripts/verify-invoice-bollo-threshold.ts` (nuovo), `scripts/verify-input-length-limits.ts`

`SOGLIA_BOLLO` (77,47 €) era usata **solo nel form client** per mostrare un avviso. Né
`invoiceSchema` né `createInvoice`/`updateInvoice` verificavano che, superata la soglia,
`bolloCodice` fosse valorizzato. Poiché le Server Action sono endpoint RPC richiamabili
direttamente, e comunque l'avviso client non bloccava il submit, si potevano salvare fatture sopra
soglia **senza bollo** — cioè documenti fiscalmente non conformi.

**Fix applicato:**
1. `lib/validations/invoice.ts`: `invoiceSchema` ora chiude la definizione con un `.superRefine()`
   che ricalcola il totale sommando `mesi[].prezzo` (sugli stessi dati già coercizzati/validati dallo
   schema, non su un totale eventualmente inviato dal client) e, se supera `SOGLIA_BOLLO` e
   `bolloCodice` non è valorizzato, aggiunge un issue sul path `bolloCodice`. Essendo `invoiceSchema`
   condiviso tra `createInvoice`/`updateInvoice` (`lib/actions/invoices.ts`) e il form client
   (`zodResolver(invoiceSchema)` in `invoice-form.tsx`), il controllo vale automaticamente su
   entrambi i lati senza duplicare la soglia o la somma in un posto diverso.
2. `scripts/verify-input-length-limits.ts`: il `prezzo` di test in `baseValidInvoice` è stato
   abbassato da 100 a 50 (sotto soglia) — con 100 il nuovo `.superRefine()` avrebbe fatto fallire
   quei test per un motivo estraneo al loro scopo (limiti di lunghezza dei campi testuali, non
   logica del bollo).

**Non incluso in questo fix:** il caso simmetrico menzionato nell'audit — `bolloCodice` valorizzato
su una fattura **sotto** soglia — resta permesso. A differenza dell'omissione (documento fiscale
mancante di un elemento dovuto), applicare per errore una marca da bollo non dovuta non produce un
documento fiscalmente non conforme nello stesso senso; il rimedio proposto nell'audit copriva solo
la direzione "sopra soglia senza bollo", che è quella qui risolta.

**Verificato con:**
- Nuovo `npm run verify:invoice-bollo-threshold` — `invoiceSchema.safeParse` con: totale appena
  sopra soglia senza `bolloCodice` (deve fallire), stesso totale con `bolloCodice` valorizzato (deve
  passare), totale esattamente pari alla soglia senza bollo (deve passare, la soglia è un "supera",
  non un "raggiunge"), totale sotto soglia senza bollo (deve passare), e totale sopra soglia ottenuto
  sommando più mesi anziché uno solo (deve fallire, verifica che la somma sull'array sia corretta e
  non solo il singolo elemento).
- `npx tsc --noEmit` pulito, `npm run lint` solo i due warning preesistenti e non correlati su
  `invoice-form.tsx` (`react-hooks/exhaustive-deps` su `mesiValues`, presenti anche nella copia in
  `.claude/worktrees/fix-rate-limit-ip-scoping/`, non toccata da questo fix).
- Tutti gli altri `verify:*` (incluso `verify:input-length-limits`, dopo la correzione del fixture)
  verdi — nessuna regressione.

---

<a id="log-02"></a>
### LOG-02 — Fatture invisibili se pagante/paziente viene eliminato
**Severità:** Alta · **Stato:** 🔴 Aperto · **File:** `lib/data/invoices.ts` (`getInvoices`, `getInvoiceById`, `getLatestInvoices`)

Tutte e tre le query filtrano `pagante: { eliminato: false }, paziente: { eliminato: false }`.
Conseguenza: appena si fa il soft-delete di un pagante o di un paziente, **tutte le sue fatture già
emesse spariscono** dall'elenco e il loro PDF restituisce 404 (`route.ts:19-21` interpreta il `null`
come "fattura non trovata"). I dati restano nel DB ma diventano irraggiungibili dall'applicazione.

Per un archivio fiscale è un comportamento grave: le fatture emesse devono restare consultabili e
ristampabili per 10 anni, indipendentemente dallo stato dell'anagrafica.

**Rimedio proposto:** rimuovere il filtro `eliminato` sulle relazioni nelle query di lettura delle
fatture (mantenendolo solo nelle liste di selezione per le **nuove** fatture, dove è già presente in
`getPayersAndPatients`/`getPatientsForSelect`). Eventualmente marcare in UI l'anagrafica archiviata.

---

<a id="log-03"></a>
### LOG-03 — Cancellazione fisica delle fatture e riuso del numero
**Severità:** Alta · **Stato:** 🔴 Aperto · **File:** `lib/actions/invoices.ts:276-287`, `lib/data/invoices.ts` (`getNextInvoiceNumberForUserYear`)

`deleteInvoice` esegue `prisma.pagamento.delete` — cancellazione fisica, con cascade sui
`FatturaMese`. Il resto del dominio usa coerentemente il soft-delete (`Pagante`, `Paziente`), le
fatture no. Inoltre il numero successivo è calcolato come `max(n_fattura) + 1`: dopo aver
cancellato l'ultima fattura dell'anno, **lo stesso numero viene riassegnato** a una fattura nuova
e diversa. Se la prima era già stata consegnata al cliente, esistono due documenti distinti con lo
stesso numero.

**Rimedio proposto:**
1. Aggiungere `Pagamento.annullata Boolean @default(false)` (o `annullataAt`) e trasformare
   `deleteInvoice` in un annullamento, escludendo le annullate dai totali ma non dall'archivio.
2. Calcolare il prossimo numero includendo anche le annullate, così i numeri non vengono mai riusati.

---

<a id="log-04"></a>
### LOG-04 — Numero, anno e data modificabili su fatture emesse
**Severità:** Media · **Stato:** 🔴 Aperto · **File:** `lib/actions/invoices.ts:187-274`

`updateInvoice` permette di cambiare `n_fattura`, `data` (e quindi `anno`) e tutti gli importi di
una fattura già emessa, senza alcuna traccia della modifica né della versione precedente. Combinato
con l'assenza di audit log (SEC-15), una fattura può cambiare contenuto dopo la consegna senza che
resti evidenza.

**Rimedio proposto:** bloccare la modifica di `n_fattura`/`anno` dopo l'emissione (o richiedere una
nota di variazione), e registrare le modifiche nell'audit log.

---

<a id="log-05"></a>
### LOG-05 — Prezzo non parsabile convertito silenziosamente a 0
**Severità:** Media · **Stato:** ✅ Risolto (2026-07-21) · **File:** `lib/validations/invoice.ts` (campo `mesi[].prezzo`), `scripts/verify-invoice-prezzo-parsing.ts` (nuovo)

```ts
.transform((val) => {
  if (val === "") return 0;
  const n = typeof val === "number" ? val : Number(val);
  return Number.isFinite(n) ? n : 0;   // <-- input non valido => 0, senza errore
})
```

Un input come `"50,00"` (virgola: la separazione decimale italiana!) diventava `NaN` e quindi **0**.
La fattura veniva salvata con un importo sbagliato senza alcun messaggio d'errore. Il `.refine()`
sul totale > 0 non proteggeva se almeno un mese aveva un prezzo valido.

**Fix applicato:** `mesi[].prezzo` in `invoiceSchema` ora, nel `.transform()`:
1. Normalizza un eventuale separatore decimale italiano (`,`) in punto (`normalized =
   val.trim().replace(",", ".")`, o `String(val)` se l'input è già un numero JS — raggiungibile solo
   passando un numero direttamente a una Server Action, dato che `register()` di `react-hook-form`
   produce sempre stringhe).
2. Valida il risultato con `PREZZO_REGEX = /^\d+(\.\d{1,2})?$/` — un numero non negativo con al
   massimo 2 decimali. Se non combacia, chiama `ctx.addIssue(...)` e restituisce `z.NEVER`: la
   validazione **fallisce** invece di degradare silenziosamente a 0, per qualunque input (testo
   arbitrario, virgola con più di 2 decimali, valore negativo, numero JS con più di 2 decimali).
3. La stringa vuota (`""`, mese senza importo inserito) resta un caso legittimo e continua a
   diventare `0`, invariato.

Non tocca l'accoppiamento con `Prisma.Decimal`/il tipo `number` a valle (`lib/actions/invoices.ts`,
`lib/data/invoices.ts`): quello è il problema distinto tracciato in [LOG-06](#log-06).

**Verificato con:**
- Nuovo `npm run verify:invoice-prezzo-parsing` — `invoiceSchema.safeParse` con: testo non numerico
  (`"abc"`, deve fallire), virgola italiana (`"50,00"` → `50`, `"12,5"` → `12.5`, devono passare e
  normalizzare), punto decimale (`"50.40"` → `50.4`, deve passare), stringa vuota su un mese con un
  secondo mese a importo positivo (deve restare `0`, isolato dal refine preesistente "totale > 0"),
  più di 2 decimali sia in stringa (`"50,123"`) sia come numero JS diretto (`50.123`, entrambi
  devono fallire), valore negativo (`"-10"`, deve fallire), numero JS valido (`50`, deve passare).
- `npx tsc --noEmit` pulito, `npm run lint` solo i due warning preesistenti e non correlati su
  `invoice-form.tsx` (`react-hooks/exhaustive-deps`, presenti anche prima di questo fix). Tutti gli
  altri `verify:*` (incluso `verify:invoice-bollo-threshold` e `verify:input-length-limits`, che
  usano `mesi[].prezzo` in fixture con valori ben sotto la precisione di 2 decimali) verdi — nessuna
  regressione.

---

<a id="log-06"></a>
### LOG-06 — Importi trattati come float fuori dal DB
**Severità:** Media · **Stato:** ✅ Risolto (2026-07-21, remedio minimo: arrotondamento esplicito) · **File:** `lib/utils/currency.ts` (nuovo), `lib/pdf/placeholders.ts`, `lib/validations/invoice.ts`, `components/invoices/invoice-form.tsx`, `scripts/verify-currency-rounding.ts` (nuovo)

Il DB usa `Decimal(10,2)` e `createInvoice`/`updateInvoice` sommano correttamente con
`Prisma.Decimal` (non toccato da questo fix, era già corretto). Ma appena usciti dal data layer gli
importi diventano `number`: confronto con `SOGLIA_BOLLO`, e in particolare
`invoice.prezzo_totale + IMPORTO_BOLLO` in `{{fattura.totaleConBollo}}` — somma in virgola mobile
che può produrre valori come `79.47000000001` prima della formattazione (`toLocaleString` maschera
il problema in visualizzazione, ma non è una garanzia per i confronti a monte, es. con
`SOGLIA_BOLLO`).

**Scelta di scope:** tra le due opzioni proposte dall'audit, applicato il rimedio minimo esplicitamente
indicato come sufficiente ("come minimo, arrotondare esplicitamente a 2 decimali prima di ogni
confronto e somma"), non la migrazione completa a `Decimal`/centesimi interi in tutto il codice che
legge fatture (`lib/data/invoices.ts`, dashboard, `invoices-manager.tsx`, export Excel) — quei punti
leggono e formattano un singolo valore già persistito (nessuna somma JS di più importi), quindi non
sono esposti allo stesso errore di accumulo e non richiedevano modifiche.

**Fix applicato:**
1. Nuovo `lib/utils/currency.ts`: `roundCurrency(amount)` — `Math.round((amount + Number.EPSILON) *
   100) / 100`.
2. `lib/pdf/placeholders.ts`: `{{fattura.totaleConBollo}}` ora arrotonda
   `invoice.prezzo_totale + (invoice.bolloCodice ? IMPORTO_BOLLO : 0)` con `roundCurrency` prima di
   `formatCurrency`.
3. `lib/validations/invoice.ts`: entrambe le somme JS di `mesi[].prezzo` (nel `.refine()` "totale >
   0" e nel `.superRefine()` del confronto con `SOGLIA_BOLLO` aggiunto per [LOG-01](#log-01)) sono
   ora arrotondate con `roundCurrency` prima del confronto — il confronto con la soglia del bollo è
   il punto più sensibile: un totale a cavallo della soglia sommato con drift avrebbe potuto
   richiedere/non richiedere il bollo per un errore di frazioni di centesimo, non per un importo
   realmente sopra/sotto soglia.
4. `components/invoices/invoice-form.tsx`: lo stesso calcolo lato client (`totale`, usato per il
   banner "bollo richiesto" e la visualizzazione del totale) arrotondato allo stesso modo, per
   coerenza con la validazione server-side che condivide `invoiceSchema` — stessa classe di bug
   dello stesso calcolo, non elencato esplicitamente tra i file dell'audit ma analogo a
   `lib/validations/invoice.ts`.

**Verificato con:**
- Nuovo `npm run verify:currency-rounding` — verifica `roundCurrency` in isolamento (elimina il
  drift di `0.1 + 0.2`, arrotonda `79.47000000001` a `79.47`, `roundCurrency(0) === 0`), poi un caso
  concreto end-to-end su `invoiceSchema`: tre mesi (`0.01`, `0.03`, `77.43`) la cui somma matematica
  è esattamente `SOGLIA_BOLLO` (77.47) ma che sommati in virgola mobile IEEE 754 danno
  `77.47000000000001` — verificato che, **senza** l'arrotondamento, questo input verrebbe rifiutato
  a torto (richiederebbe `bolloCodice` per un totale che non supera davvero la soglia), e che con il
  fix viene accettato correttamente. Il test verifica esplicitamente la precondizione (fallisce con
  un messaggio esplicito se il drift non si manifesta in quel runtime, invece di dare un falso
  positivo silenzioso).
- `npx tsc --noEmit` pulito, `npm run lint` solo i due warning preesistenti e non correlati su
  `invoice-form.tsx` (`react-hooks/exhaustive-deps`). Tutti gli altri `verify:*` (incluso
  `verify:invoice-bollo-threshold`, che copre lo stesso `superRefine` da un'altra angolazione) verdi
  — nessuna regressione.

---

<a id="log-07"></a>
### LOG-07 — Mesi duplicati e array senza limite
**Severità:** Media · **Stato:** ✅ Risolto (2026-07-21) · **File:** `lib/validations/invoice.ts` (`mesi`), `scripts/verify-invoice-mesi-limits.ts` (nuovo)

`mesi` non aveva `.max()` né controllo di unicità. Due righe con lo stesso mese violavano
`@@unique([id_Pagamento, mese])`: l'eccezione P2002 non era gestita (sono intercettati solo
`bolloCodice` e `n_fattura`) e l'utente vedeva il generico "Errore durante la creazione della
fattura", senza capire cosa correggere.

Verificato che dal form web il bug non era comunque raggiungibile: la UI (`invoice-form.tsx`) è una
griglia di 12 checkbox, una per mese, con `append`/`remove` guidati da un `Set` — non permette
strutturalmente di selezionare lo stesso mese due volte. Il gap era quindi raggiungibile solo
chiamando `createInvoice`/`updateInvoice` direttamente come RPC, stesso threat model già chiuso in
[LOG-01](#log-01)/[LOG-05](#log-05).

**Fix applicato:** sul campo `mesi` di `invoiceSchema`, dopo `.min(1, ...)`:
1. `.max(12, "Non è possibile inserire più di 12 mesi")`.
2. Nuovo `.refine()`: `mesi.length === new Set(mesi.map((m) => m.mese)).size`, con messaggio
   esplicito "Non è possibile selezionare lo stesso mese più di una volta". Necessario oltre al
   `.max(12)`: due sole righe con lo stesso mese restano un array di lunghezza 2, ben sotto il
   tetto, e vengono intercettate solo da questo controllo di unicità.

Nessuna modifica a `lib/actions/invoices.ts`: sia `createInvoice` sia `updateInvoice` passano già da
`invoiceSchema.safeParse` prima di toccare Prisma, quindi il fix a livello di schema chiude il gap
per entrambe le action senza bisogno di gestire il P2002 lato action (le righe 157-160/253-256
citate nell'audit erano solo il punto in cui l'eccezione non gestita si sarebbe manifestata, non
codice da modificare). Lato UI, `errors.mesi.message` era già renderizzato (stesso punto che mostra
già l'errore "Seleziona almeno un mese"/"totale > 0"): nessuna modifica al componente necessaria, i
nuovi messaggi compaiono automaticamente lì se mai raggiunti (in pratica solo via RPC diretta).

**Verificato con:**
- Nuovo `npm run verify:invoice-mesi-limits` — `invoiceSchema.safeParse` con: array di 13 elementi
  (12 mesi distinti + 1 ripetuto, deve fallire per `.max(12)`), array di esattamente 12 mesi
  distinti (deve passare, limite esatto), due righe con lo stesso mese in un array di 2 elementi
  (deve fallire per il `.refine()` di unicità, non per `.max()`), tre mesi distinti come caso base
  (deve passare).
- `npx tsc --noEmit` pulito, `npm run lint` solo i due warning preesistenti e non correlati su
  `invoice-form.tsx`. Tutti gli altri `verify:*` (incluso `verify:invoice-bollo-threshold`,
  `verify:invoice-prezzo-parsing`, `verify:currency-rounding`, `verify:input-length-limits`, che
  usano tutti `mesi` con 1-2 elementi distinti) verdi — nessuna regressione.

---

<a id="log-08"></a>
### LOG-08 — Dashboard e elenco fatture calcolano insiemi diversi
**Severità:** Media · **Stato:** 🔴 Aperto · **File:** `lib/data/invoices.ts` (`getAnnualRevenue`, `getMonthlyRevenue` vs `getInvoices`)

Gli aggregati della dashboard **non** filtrano su `pagante/paziente eliminato`, mentre l'elenco
fatture sì (vedi LOG-02). Risultato: il fatturato annuale mostrato non corrisponde alla somma delle
fatture visibili in elenco, e la differenza è invisibile all'utente. Il fix di LOG-02 risolve anche
questa incoerenza; vanno comunque allineati esplicitamente i criteri (incluse le eventuali fatture
annullate di LOG-03).

---

<a id="log-09"></a>
### LOG-09 — CF/P.IVA dei paganti senza validazione di formato
**Severità:** Bassa · **Stato:** ✅ Risolto (2026-07-21) · **File:** `lib/constants/fiscal.ts` (nuovo), `lib/validations/payer.ts`, `lib/validations/profile.ts`, `scripts/verify-payer-fiscal-format.ts` (nuovo)

Per il **profilo utente** c'erano regex corrette (`^\d{11}$` per la P.IVA, `^[A-Za-z0-9]{16}$` per
il CF). Per i **paganti** — cioè i dati che finiscono stampati sulla fattura — c'era solo un limite
di lunghezza (`max(16)` / `max(11)`): `"abc"` era accettato come codice fiscale. Il vincolo XOR
CF/P.IVA era invece già corretto (non toccato da questo fix).

**Fix applicato:**
1. Nuovo `lib/constants/fiscal.ts`: `PIVA_REGEX` (`^\d{11}$`) e `CF_REGEX` (`^[A-Za-z0-9]{16}$`),
   estratte dalle regex già usate in `profileUpdateSchema` — evita di duplicarle in modo divergente
   in futuro, esattamente il problema che ha causato questo bug.
2. `lib/validations/profile.ts`: `pIva`/`cf` ora referenziano le costanti condivise invece di regex
   inline (stesso comportamento, nessuna modifica funzionale).
3. `lib/validations/payer.ts`: `cf`/`piva` sostituiscono `z.string().min(1).max(N)` con
   `z.string().regex(CF_REGEX | PIVA_REGEX, ...)` (il limite di lunghezza diventa implicito nella
   regex, come già in `profile.ts`). Il CF valido viene normalizzato in maiuscolo nel `.transform()`
   (`val.toUpperCase()`), applicato solo dopo il match della regex — coerente con la normalizzazione
   già esistente su `provincia` in `profile.ts`. La P.IVA non necessita normalizzazione (solo cifre).

**Non incluso in questo fix:** il controllo del carattere di controllo (checksum) del codice fiscale
— l'audit lo proponeva solo come "da valutare", non come parte del rimedio minimo. L'algoritmo reale
(comprese le regole di omocodia per i CF con cifre sostituite da lettere) è sostanzialmente più
complesso della sola forma, e un'implementazione imprecisa rischierebbe di rifiutare codici fiscali
legittimi — rischio ritenuto superiore al beneficio per una severità già classificata "Bassa". Resta
una possibile estensione futura se necessario.

**Verificato con:**
- Nuovo `npm run verify:payer-fiscal-format` — `payerSchema.safeParse` con: CF testo arbitrario
  troppo corto (`"abc"`, deve fallire), CF di 16 caratteri ma con simboli non alfanumerici (`"!"`
  ripetuto 16 volte, deve fallire), CF valido in minuscolo (deve passare e risultare normalizzato in
  maiuscolo), P.IVA non numerica e P.IVA troppo corta (devono fallire), P.IVA valida di 11 cifre
  (deve passare).
- `npx tsc --noEmit` pulito, `npm run lint` solo i due warning preesistenti e non correlati su
  `invoice-form.tsx`. Tutti gli altri `verify:*` (incluso `verify:input-length-limits`, che usa un
  CF valido — `"RSSMRA80A01H501Z"` — nel fixture di `payerSchema`) verdi — nessuna regressione.

---

<a id="log-10"></a>
### LOG-10 — `updateProfile` non invalida la cache
**Severità:** Bassa · **Stato:** ✅ Risolto (2026-07-21) · **File:** `lib/actions/account.ts`, `scripts/verify-account-cache-invalidation.ts` (nuovo)

Tutte le altre action di mutazione chiamano `revalidatePath`; `updateProfile` (e `changePassword`)
no. I dati del mittente cambiati dall'utente possono restare stantii nelle pagine già renderizzate
(sidebar, anteprima PDF) finché non si forza un reload.

**Fix applicato:** `updateProfile` ora chiama, dopo l'audit log e prima del `return { success:
true }`, sia `revalidatePath("/account")` sia `revalidatePath("/", "layout")` — quest'ultimo,
secondo la documentazione ufficiale di Next (`revalidatePath('/', 'layout')`, sezione "Revalidating
all data"), purga la client cache e invalida l'intero albero condiviso (sidebar/header in
`app/(protected)/layout.tsx`, che leggono `nome`/`cognome`/`specializzazione` dalla sessione), non
solo `/account`.

**Scope — `changePassword` deliberatamente escluso:** l'audit cita anche `changePassword` come
action priva di `revalidatePath`, ma il titolo e il rimedio proposto di LOG-10 riguardano solo
`updateProfile`. `changePassword` muta solo `passwordHash`/`tokenVersion`, nessuno dei due
renderizzato in UI: non c'è alcun dato visibile da invalidare, quindi aggiungere `revalidatePath` lì
non correggerebbe alcun bug osservabile.

**Verificato con:**
- Nuovo `npm run verify:account-cache-invalidation` — analisi statica (stesso approccio di
  `verify-audit-log-coverage.ts`): estrae il corpo di `updateProfile` e verifica che contenga
  entrambe le chiamate `revalidatePath("/account")` e `revalidatePath("/", "layout")`. Confermato
  che lo script fallisce davvero se le chiamate vengono rimosse (non è un timbro di gomma): rimosse
  temporaneamente durante lo sviluppo del fix, lo script ha segnalato correttamente entrambe le
  assenze prima di essere ripristinato.
- `npx tsc --noEmit` pulito, `npm run lint` solo i due warning preesistenti e non correlati su
  `invoice-form.tsx`. Tutti gli altri `verify:*` (incluso `verify:audit-log-coverage`, che analizza
  anch'esso staticamente `lib/actions/*.ts` e non risente della nuova `revalidatePath`) verdi —
  nessuna regressione.
- Non testato end-to-end contro il dev server (nessun secondo `next dev` avviabile in questo
  ambiente, stessa limitazione già annotata per altri fix in questo audit, es. SEC-06/SEC-12):
  verificato solo che il comportamento atteso di `revalidatePath('/', 'layout')` sia quello
  documentato ufficialmente da Next per questa versione (`node_modules/next/dist/docs/.../revalidatePath.md`),
  non osservato empiricamente con una richiesta HTTP reale.

---

<a id="log-11"></a>
### LOG-11 — Fallimento silenzioso dello snapshot layout PDF
**Severità:** Bassa · **Stato:** 🔴 Aperto · **File:** `lib/actions/invoices.ts:175-181`

Se `snapshotPdfLayoutForInvoice` fallisce, l'errore viene solo loggato e la fattura resta senza
snapshot. Il fallback in `generateInvoicePdf` usa allora il layout **corrente**: la fattura
sembrerà corretta oggi e cambierà aspetto se in futuro l'utente modifica il template — esattamente
ciò che lo snapshot doveva impedire, e senza che nessuno se ne accorga.

**Rimedio proposto:** creare fattura e snapshot in un'unica `prisma.$transaction`, oppure segnalare
in UI le fatture con `pdfLayoutSnapshot = null` suggerendo "Aggiorna layout PDF".

---

<a id="log-12"></a>
### LOG-12 — Aggregati dipendenti dal fuso orario del server
**Severità:** Bassa · **Stato:** 🔴 Aperto · **File:** `lib/data/invoices.ts` (`yearRange`, `getMonthlyRevenue`), `lib/utils/date.ts:4-7`

Le date sono costruite alle 12:00 **ora locale del processo** e i range degli aggregati usano
`new Date(year, 0, 1)`, anch'esso locale. Il container non imposta `TZ`, quindi gira in UTC mentre
l'utente è in Europe/Rome. La scelta delle 12:00 rende improbabile lo scivolamento di giorno, ma i
confini di anno/mese restano dipendenti dall'ambiente: la stessa fattura può cadere in periodi
diversi tra dev (Windows/Europe-Rome) e produzione (container UTC).

**Rimedio proposto:** fissare `TZ=Europe/Rome` nel container e/o calcolare i range con `date-fns-tz`
su una timezone esplicita.

---

<a id="log-13"></a>
### LOG-13 — Regex globale condivisa in `parseInlineFormatting`
**Severità:** Bassa · **Stato:** 🔴 Aperto · **File:** `lib/pdf/formatting.ts:7-9`

`FORMATTING_REGEX` è dichiarata a livello di modulo con flag `g` e usata con `.exec()` in un ciclo:
lo stato `lastIndex` è condiviso tra tutte le chiamate. Oggi è corretto perché il ciclo arriva
sempre a `null` (che azzera `lastIndex`), ma basta un `break`/`return` anticipato o un'eccezione
dentro il ciclo perché le chiamate successive partano da un offset sbagliato e producano PDF
formattati male in modo non riproducibile.

**Rimedio proposto:** creare la regex dentro la funzione, o usare `text.matchAll(...)`.

---

<a id="log-14"></a>
### LOG-14 — Commento nello schema Prisma cita una migration inesistente
**Severità:** Bassa · **Stato:** 🔴 Aperto · **File:** `prisma/schema.prisma:51-61`

Il commento rimanda a `prisma/migrations/<timestamp>_paganti_partial_unique_active_only/migration.sql`,
directory che non esiste. Gli indici parziali sono realmente creati in
`20260720000000_init/migration.sql:129-130` (`paganti_id_Utente_cf_key`, `paganti_id_Utente_piva_key`,
entrambi `WHERE "eliminato" = false`). L'invariante è quindi rispettata, ma il riferimento è
fuorviante per chi dovrà mantenere il codice.

**Rimedio proposto:** correggere il riferimento in `20260720000000_init`.

---

## Deploy e conformità — dettaglio

<a id="ops-01"></a>
### OPS-01 — Gestione GDPR dei dati
**Severità:** Media · **Stato:** 🔴 Aperto · **File:** trasversale

L'applicazione tratta dati che, nel contesto di uno studio sanitario (logopedista/psicologo),
ricadono nell'art. 9 GDPR (categorie particolari). Mancano: registro dei trattamenti, audit log
(SEC-15), cifratura dei backup (SEC-10), una procedura di cancellazione effettiva (il soft-delete
non cancella nulla), e l'export dei dati di un interessato.

**Rimedio proposto:** almeno (a) audit log, (b) backup cifrati, (c) una funzione di
cancellazione/anonimizzazione reale per i pazienti non più legati a fatture in obbligo di
conservazione, (d) documentare i tempi di conservazione.

---

<a id="ops-02"></a>
### OPS-02 — Nessun test automatico
**Severità:** Bassa · **Stato:** 🔴 Aperto · **File:** `package.json`

Non c'è un test runner configurato. Esistono cinque script di verifica di invarianti
(`verify:actions-auth`, `verify:api-routes-auth`, `verify:safe-user-select`,
`verify:rate-limit-ip-scope`, `verify:rich-text`) — utili, ma verificano la **forma** del codice,
non il comportamento: nessun test copre calcolo del totale, soglia bollo, isolamento multi-tenant,
scadenza sessione.

**Rimedio proposto:** introdurre Vitest e coprire per prime le aree ad alto rischio: calcolo
importi, regole bollo, e un test di isolamento cross-tenant per ogni action.

---

<a id="ops-03"></a>
### OPS-03 — `prisma.config.ts` non copiato nello stage runner del Dockerfile
**Severità:** Alta · **Stato:** ✅ Risolto (2026-07-21) · **File:** `Dockerfile` (stage `runner`)

Scoperto verificando SEC-09 con una build Docker reale (non era emerso da una lettura statica del
Dockerfile). `prisma/schema.prisma` non ha `url = env("DATABASE_URL")` nel blocco `datasource`: da
Prisma 7 l'URL viene letto da `prisma.config.ts` (`datasource.url: process.env["DATABASE_URL"]`).
Lo stage `builder` copia questo file (serve a `prisma generate`), ma lo stage `runner` — quello
che finisce nell'immagine finale — non lo copiava. Risultato: `npx prisma migrate deploy` nel
`CMD` falliva sempre con `Error: The datasource.url property is required in your Prisma config
file`, e siccome il `CMD` è `npx prisma migrate deploy && node server.js`, **il server non si
avviava mai** — indipendentemente dall'utente (root o meno) e indipendentemente da SEC-09. Non
risulta che questa immagine sia mai stata avviata con successo in un ambiente che replica
`docker-compose.prod.yml` da quando lo schema è stato migrato a Prisma 7 senza `url` inline.

**Impatto:** qualunque deploy in produzione con l'immagine Docker tracciata nel repo si sarebbe
bloccato all'avvio, prima ancora di poter servire una singola richiesta.

**Fix applicato:** aggiunta `COPY --from=builder --chown=nextjs:nodejs /app/prisma.config.ts
./prisma.config.ts` nello stage `runner`, accanto alla `COPY` esistente di `./prisma`.

**Verificato con:** vedi il test end-to-end descritto in [SEC-09](#sec-09) — build completa,
`migrate deploy` applica le 4 migrazioni contro un Postgres effimero, `node server.js` si avvia e
risponde `200` su `/login`. Prima di questo fix, lo stesso test falliva immediatamente all'avvio
del container con l'errore di configurazione sopra citato.

---

## Aspetti verificati e risultati corretti

Registrati per non riesaminarli a ogni giro:

- ✔️ **Isolamento multi-tenant:** tutte le query in `lib/data/*.ts` e `lib/actions/*.ts` filtrano per
  `id_Utente`; le `update`/`delete` usano `where: { id, id_Utente }`, quindi non è possibile agire
  su record di altri utenti. `validateInvoiceRelations` verifica anche che pagante e paziente
  appartengano all'utente e siano coerenti tra loro.
- ✔️ **Password:** bcrypt con cost 12, mai loggate né restituite.
- ✔️ **`passwordHash` mai serializzato al client:** whitelist `SAFE_USER_SELECT` + script di verifica.
- ✔️ **Cookie di sessione:** `httpOnly`, `sameSite=lax`, `secure` in produzione, `maxAge` derivato
  dal token stesso (cookie e JWT scadono insieme).
- ✔️ **Utente disabilitato:** `abilitato` è riletto dal DB a ogni richiesta, quindi la disabilitazione
  ha effetto immediato anche su sessioni già aperte.
- ✔️ **Nessuna SQL injection:** solo Prisma, nessun `$queryRawUnsafe`.
- ✔️ **Nessun XSS noto:** nessun `dangerouslySetInnerHTML`, `eval` o `new Function` nel codebase;
  il rich text è renderizzato tramite `@react-pdf/renderer`, non come HTML.
- ✔️ **CSRF:** le mutazioni passano tutte da Server Action, protette dal controllo di origine
  integrato di Next.js.
- ✔️ **Segreti non versionati:** `.env` e `.env.prod` sono ignorati da git (verificato con
  `git ls-files`) ed esclusi dall'immagine Docker via `.dockerignore`.
- ✔️ **Vincoli DB:** unicità di `(id_Utente, n_fattura, anno)`, `(id_Utente, bolloCodice)` e indici
  unici parziali su CF/P.IVA dei paganti attivi — le race condition check-then-insert sono comunque
  intercettate a livello di database.
- ✔️ **Le GET sono protette dal proxy** e le Server Action / route API si autenticano da sole, con
  invariante verificata da script.

---

## Changelog

Aggiungere una riga a ogni modifica di stato (più recente in alto).

| Data | ID | Da → A | Note |
|---|---|---|---|
| 2026-07-21 | LOG-10 | 🔴 → ✅ | `updateProfile` chiama ora `revalidatePath("/account")` + `revalidatePath("/", "layout")`; `changePassword` deliberatamente escluso (nessun dato mutato è renderizzato in UI); nuovo `verify:account-cache-invalidation` |
| 2026-07-21 | LOG-07 | 🔴 → ✅ | `mesi` in `invoiceSchema` limitato a `.max(12)` + nuovo `.refine()` di unicità sul mese (non raggiungibile dal form web, solo via RPC diretta); nuovo `verify:invoice-mesi-limits` |
| 2026-07-21 | LOG-09 | 🔴 → ✅ | `payerSchema.cf`/`.piva` riusano `CF_REGEX`/`PIVA_REGEX` (nuovo `lib/constants/fiscal.ts`, condivise con `profileUpdateSchema`) invece di un semplice limite di lunghezza; CF normalizzato in maiuscolo; checksum del CF deliberatamente fuori scope; nuovo `verify:payer-fiscal-format` |
| 2026-07-21 | LOG-06 | 🔴 → ✅ | Rimedio minimo (arrotondamento esplicito, non migrazione a Decimal ovunque): nuovo `roundCurrency()` applicato a `{{fattura.totaleConBollo}}` e alle somme di `mesi[].prezzo` in `invoiceSchema` (server e client); nuovo `verify:currency-rounding` con un caso concreto di drift IEEE 754 sulla soglia del bollo |
| 2026-07-21 | LOG-05 | 🔴 → ✅ | `mesi[].prezzo` normalizza la virgola decimale italiana in punto e rifiuta (invece di degradare a 0) input non numerici, negativi o con più di 2 decimali; nuovo `verify:invoice-prezzo-parsing` |
| 2026-07-21 | LOG-01 | 🔴 → ✅ | `.superRefine()` su `invoiceSchema` impone `bolloCodice` quando la somma di `mesi[].prezzo` supera `SOGLIA_BOLLO`, condiviso tra Server Action e form client; nuovo `verify:invoice-bollo-threshold`; caso simmetrico (bollo sotto soglia) deliberatamente fuori scope |
| 2026-07-21 | SEC-04 | 🔴 → ✅ | `MAX_ENTRIES_PER_MAP = 10_000` con eviction della voce meno recentemente scritta su entrambe le Map di `lib/auth/rate-limit.ts`; sweep probabilistico sostituito da `setInterval` ogni 5 minuti (`.unref()`, guardia hot-reload); spostamento a Postgres/Redis deliberatamente fuori scope (app a singola istanza); nuovo `verify:rate-limit-bounds` |
| 2026-07-21 | SEC-15 | 🔴 → ✅ | Nuovo model `AuditLog` + `logAudit()` best-effort chiamato da login/logout e da tutte le Server Action di mutazione (copertura ampia); nuova pagina admin `/audit-log`; nuovo `verify:audit-log-coverage`; verificato end-to-end contro il dev server reale (login/logout via HTTP, query dirette su `audit_logs`, nessuna password in chiaro) |
| 2026-07-21 | SEC-14 | 🔴 → ✅ | Pool `pg` con `max`/`idleTimeoutMillis`/`connectionTimeoutMillis` espliciti; `sslmode` non abilitato (app e DB sulla stessa macchina), ma documentato con un promemoria in `.env.prod.example` per quando/se il DB verrà spostato su un host separato; nuovo `verify:prisma-pool-limits` |
| 2026-07-21 | OPS-03 | — → ✅ | Scoperta verificando SEC-09: `prisma.config.ts` mancante nello stage `runner` del Dockerfile bloccava l'avvio di ogni deploy (`migrate deploy` falliva sempre, `CMD` usa `&&`). Aggiunta la `COPY` mancante |
| 2026-07-21 | SEC-09 | 🔴 → ✅ | Utente non privilegiato `nextjs` (uid 1001) nello stage `runner`, `COPY --chown`; verificato con build Docker reale + test end-to-end contro un Postgres effimero (migrazioni + avvio server + risposta HTTP, tutto sotto utente non-root) |
| 2026-07-21 | SEC-06 | 🔴 → ✅ | Aggiunto `headers()` in `next.config.ts` (X-Frame-Options/nosniff/Referrer-Policy/Permissions-Policy sempre, CSP+HSTS solo in produzione); nuovo `verify:security-headers`. Da testare manualmente con build di produzione prima del prossimo deploy |
| 2026-07-20 | SEC-17 | 🔴 → ✅ | `getTokenMaxAgeSeconds` resa privata; nuovo `signSessionWithMaxAge` accoppia firma e durata; nuovo `verify:jwt-max-age-encapsulation` |
| 2026-07-20 | SEC-16 | 🔴 → ✅ | Minimo password 12 caratteri + deny-list comuni + `newPassword !== currentPassword`; nuovo `verify:password-policy` |
| 2026-07-20 | SEC-13 | 🔴 → ✅ | Nuovo `getUserIdOrNull()`; route PDF risponde 401 invece di redirect; checker aggiornato con predicati condivisi testabili (`verify:api-route-auth-checker`) |
| 2026-07-20 | SEC-12 | 🔴 → ✅ | Matcher `proxy.ts` ancorato a confine di segmento + punto letterale escapato; nuovo `verify:proxy-matcher` |
| 2026-07-20 | SEC-11 | 🔴 → ✅ | `.max()` su campi testuali senza limite; `blocchi` limitato a 500 (>100 su richiesta esplicita); tetto di dimensione serializzata sui blob rich-text; nuovo `verify:input-length-limits` |
| 2026-07-20 | SEC-08 | 🔴 → ✅ | Nuovo `lib/auth/rate-limiter.ts` generico; applicato a `changePassword`, `resetUserPassword` e alla route PDF; nuovo `verify:rate-limiter` |
| 2026-07-20 | SEC-07 | 🔴 → ✅ | Aggiunto `Cache-Control: private, no-store` alla route PDF fatture; nuovo `verify:pdf-route-cache-control` |
| 2026-07-20 | SEC-05 | 🔴 → ✅ | `DUMMY_HASH` rigenerato con cost 12 (era 10); nuovo `verify:dummy-hash-cost` a guardia dell'allineamento futuro |
| 2026-07-20 | SEC-03 | 🔴 → ✅ | `assertStrongJwtSecret` in `lib/auth/jwt.ts` rifiuta segreti corti/segnaposto all'avvio; nuovo `verify:jwt-secret-strength` |
| 2026-07-20 | SEC-02 | 🔴 → ✅ | `Utente.tokenVersion` + confronto in `getSession`; cambio/reset password invalidano le sessioni precedenti; nuovo `verify:session-token-version` |
| 2026-07-20 | SEC-01 | 🔴 → ✅ | `TRUSTED_PROXY` gating + contatore username-wide indipendente dall'IP; test estesi in `verify:rate-limit-ip-scope` |
| 2026-07-20 | — | — | Audit iniziale sul commit `f9c9f94` |
