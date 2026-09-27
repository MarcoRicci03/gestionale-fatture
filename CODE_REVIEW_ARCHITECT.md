# Code Review & Architecture Quality Assessment: Gestionale Fatture

**Ruolo:** Senior Software Architect  
**Data:** Settembre 2026  
**Repository:** `gestionale-fatture`  
**Stack tecnologico:** Next.js 16 (App Router), React 19, TypeScript 5, Tailwind CSS v4, Prisma ORM 7 + PostgreSQL (`@prisma/adapter-pg`), Vitest, Docker.

---

## Executive Summary & Matrice di Gravità

Il presente documento costituisce una revisione critica approfondita dello stato attuale del codebase di **Gestionale Fatture**.
L'applicazione dimostra un elevato livello di maturità ingegneristica complessiva: adozione delle convenzioni più recenti di Next.js 16 (inclusa la gestione protetta delle route tramite `proxy.ts`), una suite di test automatizzati estesa a oltre 1.040 test (unitari, di integrazione e di conformità architetturale), isolamento multi-tenant dei dati a livello applicativo e crittografia AES-256-GCM a riposo per le credenziali sensibili del Sistema TS (Tessera Sanitaria).

Ciononostante, un'analisi condotta con criteri rigorosi di architettura del software ha portato all'individuazione di **23 rilievi qualitativi**, articolati nelle 6 aree di indagine richieste. Tra questi emergono:
- **Criticità di sicurezza e controllo accessi**: bypass potenziale della protezione CSRF sull'export dati per trust incondizionato dell'header `X-Forwarded-Host`, vulnerabilità di tipo Time-of-Check to Time-of-Use (TOCTOU) nella gestione dell'ultimo amministratore di sistema, mancata invalidazione immediata della sessione JWT alla disabilitazione di un utente e formula injection su file Excel esportati per bypass con caratteri di spaziatura.
- **Incongruenze di dominio fiscale ed errori funzionali**: disallineamento sul calcolo dell'imposta di bollo (€ 2,00) tra il tracciato XML inviato al Ministero dell'Economia e delle Finanze e il documento PDF stampato per il paziente, esclusione silenziosa di fatture pomeridiane nei filtri a intervallo temporale per via dell'ancoraggio a mezzogiorno, e controlli cronologici con comparazione temporale a millisecondi che bloccano fatture consecutive legittime emesse nello stesso giorno.
- **Debito tecnico architetturale e DRY**: quintuplice duplicazione della query di rollback nelle transizioni di stato di Sistema TS, schemi Zod che escludono indebitamente professionisti con concorrenza di Codice Fiscale e Partita IVA, e trasmissione di stream binari PDF veicolati in Base64 all'interno di RPC Server Action anziché tramite Route Handler dedicati.

I risultati sono organizzati rigorosamente in **ordine decrescente di gravità** (Critico, Alto, Medio, Basso, Suggerimento) all'interno di ciascuna delle 6 sezioni tematiche.

### Matrice di Distribuzione dei Rilievi

| Livello di Gravità | Sicurezza | DRY / Duplicazione | Architettura | Performance | Error Handling | Code Smells | Totale |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Critico** | 0 | 0 | 0 | 0 | 0 | 0 | **0** |
| **Alto** | 2 | 0 | 1 | 0 | 2 | 0 | **5** |
| **Medio** | 2 | 2 | 1 | 1 | 1 | 1 | **8** |
| **Basso** | 1 | 1 | 2 | 1 | 1 | 2 | **8** |
| **Suggerimento** | 0 | 0 | 0 | 1 | 0 | 1 | **2** |
| **Totale** | **5** | **3** | **4** | **3** | **4** | **4** | **23** |

---

### Indice Generale dei Problemi Identificati

| ID | Gravità | Categoria | Titolo Sintetico / Nome Problema | File di Riferimento | Stato |
| :--- | :--- | :--- | :--- | :--- | :---: |
| [`SEC-06`](#sec-06) | **Alto** | Sicurezza | Convalida CSRF fragile tramite trust incondizionato di `X-Forwarded-Host` | `lib/security/same-origin.ts` | ✅ RISOLTO |
| [`SEC-07`](#sec-07) | **Alto** | Sicurezza | Condizione di corsa (TOCTOU) su declassamento o disabilitazione ultimo admin | `lib/actions/users.ts` | ✅ RISOLTO |
| [`SEC-08`](#sec-08) | **Medio** | Sicurezza | Mancata revoca sessione (`tokenVersion`) alla disabilitazione dell'account | `lib/actions/users.ts` / `auth.ts` | ✅ RISOLTO |
| [`SEC-09`](#sec-09) | **Medio** | Sicurezza | Formula Injection nei file Excel esportati per bypass con spaziatura iniziale | `lib/excel/sanitize.ts` | ✅ RISOLTO |
| [`SEC-10`](#sec-10) | **Basso** | Sicurezza | Timing Leakage e bypass del rate limit su input login sovradimensionati | `lib/actions/auth.ts` | ✅ RISOLTO |
| [`DRY-05`](#dry-05) | **Medio** | Duplicazione | Quintuplice duplicazione della logica di rollback stato in `transmission.service` | `lib/sistemats/services/transmission.service.ts` | ✅ RISOLTO |
| [`DRY-06`](#dry-06) | **Medio** | Duplicazione | Duplicazione inline del modale Dettagli Paziente in `patients-manager` | `components/patients/patients-manager.tsx` | ✅ RISOLTO |
| [`DRY-07`](#dry-07) | **Basso** | Duplicazione | Sanitizzazione ripetuta dei parametri di paginazione nei moduli dati | `lib/data/*.ts` | ✅ RISOLTO |
| [`ARCH-06`](#arch-06) | **Alto** | Architettura | Discrepanza fiscale nel calcolo dell'imposta di bollo tra Sistema TS e PDF | `lib/pdf/placeholders.ts` / `lib/sistemats/` | ✅ RISOLTO |
| [`ARCH-07`](#arch-07) | **Medio** | Architettura | Schema validazione pagante rifiuta professionisti con CF e P.IVA concorrenti | `lib/validations/payer.ts` | ⏸️ AS IS |
| [`ARCH-08`](#arch-08) | **Basso** | Architettura | Download ricevute PDF veicolato in Base64 su Server Action anziché Route Handler | `lib/actions/sistema-ts.ts` |
| [`ARCH-09`](#arch-09) | **Basso** | Architettura | Accoppiamento diretto tra entità Prisma e stato dei componenti Client | `lib/data/*.ts` / `components/` |
| [`PERF-05`](#perf-05) | **Medio** | Performance | Sincronizzazione ricevute TS sequenziale con query singole ripetute | `lib/sistemats/services/sync-receipts.service.ts` |
| [`PERF-06`](#perf-06) | **Basso** | Performance | Paginazione offset non scalabile ($O(N)$) su tabelle storiche ad alto volume | `lib/data/audit.ts` / `lib/data/invoices.ts` |
| [`PERF-07`](#perf-07) | **Suggerimento** | Performance | Inizializzazione ripetuta di espressioni regolari e formattatori nei cicli di render | `lib/utils/date.ts` / `lib/utils/currency.ts` |
| [`ERR-05`](#err-05) | **Alto** | Error Handling | Taglio a mezzogiorno in `parseDateInput` esclude fatture pomeridiane nei filtri | `lib/invoices/list-query.ts` / `lib/utils/date.ts` |
| [`ERR-06`](#err-06) | **Alto** | Error Handling | Controllo cronologico a millisecondi genera falsi positivi su fatture stesso giorno | `lib/invoices/chronology.ts` |
| [`ERR-07`](#err-07) | **Medio** | Error Handling | Disallineamento logico in `canSubmit` correzione TS: omessa validazione bollo | `components/sistema-ts/fix-invoice-ts-dialog.tsx` | ✅ RISOLTO |
| [`ERR-08`](#err-08) | **Basso** | Error Handling | Mappatura incompleta e collasso degli errori nativi nei web service SOAP Sogei | `lib/sistemats/client.ts` / `xml-parser.ts` |
| [`SMELL-10`](#smell-10) | **Medio** | Code Smells | Calcolo isolato di `bolloMancante` escluso da `haAnomalie` in Sistema TS | `lib/data/sistema-ts.ts` | ✅ RISOLTO |
| [`SMELL-11`](#smell-11) | **Basso** | Code Smells | Costanti e codici IVA sparsi come Magic Numbers anziché centralizzati | `components/` / `lib/sistemats/` |
| [`SMELL-12`](#smell-12) | **Basso** | Code Smells | Disallineamento di nomenclatura tra database snake_case e TypeScript camelCase | `schema.prisma` / `types/` |
| [`SMELL-13`](#smell-13) | **Suggerimento** | Code Smells | Utilizzo di `console.error` non strutturato in luogo di un logger diagnostico | `lib/actions/*.ts` |

---

## 1. Problemi di Sicurezza e Vulnerabilità

<a id="sec-06"></a>
### [Alto] [SEC-06] Convalida CSRF fragile tramite trust incondizionato di `X-Forwarded-Host` in `isSameOriginRequest`
- **Posizione:** [`lib/security/same-origin.ts`](file:///home/marcor/Projects/gestionale-fatture/lib/security/same-origin.ts#L10-L23), [`app/api/invoices/export/route.ts`](file:///home/marcor/Projects/gestionale-fatture/app/api/invoices/export/route.ts#L16)
- **Descrizione:**
  La funzione `isSameOriginRequest` protegge le API route (escluse dai controlli CSRF automatici che Next.js 16 applica alle sole Server Actions) verificando che l'header `Origin` coincida con l'host della richiesta:
  ```ts
  export function isSameOriginRequest(request: Request): boolean {
    const origin = request.headers.get("origin");
    if (!origin) return false;

    const host =
      request.headers.get("x-forwarded-host") ?? request.headers.get("host");
    if (!host) return false;

    try {
      return new URL(origin).host === host;
    } catch {
      return false;
    }
  }
  ```
  A differenza del modulo [`lib/auth/client-ip.ts`](file:///home/marcor/Projects/gestionale-fatture/lib/auth/client-ip.ts#L26-L63) — in cui la lettura degli header inoltrati (`X-Forwarded-For`, ecc.) è rigorosamente subordinata a `isTrustedProxyEnabled()` per prevenire lo spoofing dell'IP — in `isSameOriginRequest` l'header `x-forwarded-host` viene **accettato e preferito incondizionatamente**.
  
  In scenari in cui l'applicazione è esposta direttamente senza un reverse proxy che sovrascriva `X-Forwarded-Host`, o qualora il proxy sia configurato male, un client attaccante può inviare da una pagina malevola (`https://attacker.com`) una richiesta POST a `/api/invoices/export` impostando:
  - `Origin: https://attacker.com`
  - `X-Forwarded-Host: attacker.com`
  
  La valutazione `new URL(origin).host === host` si risolve in `attacker.com === attacker.com`, che restituisce `true`. Il controllo CSRF viene interamente eluso, consentendo l'esfiltrazione o la manipolazione non autorizzata di dati contabili sensibili.
- **Soluzione consigliata:**
  Condizionare l'uso di `x-forwarded-host` al controllo di proxy fidato (`isTrustedProxyEnabled()`):
  ```ts
  import { isTrustedProxyEnabled } from "@/lib/auth/client-ip";

  export function isSameOriginRequest(request: Request): boolean {
    const origin = request.headers.get("origin");
    if (!origin) return false;

    const host = isTrustedProxyEnabled()
      ? (request.headers.get("x-forwarded-host") ?? request.headers.get("host"))
      : request.headers.get("host");

    if (!host) return false;

    try {
      return new URL(origin).host === host;
    } catch {
      return false;
    }
  }
  ```

---

<a id="sec-07"></a>
### [Alto] [SEC-07] Condizione di corsa (TOCTOU) su declassamento o disabilitazione dell'ultimo amministratore attivo
- **Stato:** ✅ RISOLTO (Risolto avvolgendo il conteggio e l'aggiornamento in `prisma.$transaction` con lock deterministico `SELECT id FROM "utenti" WHERE "isAdmin" = true AND "abilitato" = true ORDER BY id FOR UPDATE` in `updateUser` e `toggleUserEnabled`, con test dedicato in `scripts/verify-last-admin-guard.test.ts`).
- **Posizione:** [`lib/actions/users.ts`](file:///home/marcor/Projects/gestionale-fatture/lib/actions/users.ts#L108-L150), [`lib/actions/users.ts`](file:///home/marcor/Projects/gestionale-fatture/lib/actions/users.ts#L225-L260)
- **Descrizione:**
  Nelle Server Actions `updateUser` e `toggleUserEnabled`, per impedire che il gestionale rimanga senza alcun utente con ruolo amministrativo, viene effettuata una verifica preventiva del conteggio degli altri amministratori abilitati:
  ```ts
  if (!isAdmin || !abilitato) {
    const adminAttivi = await prisma.utente.count({
      where: { isAdmin: true, abilitato: true, NOT: { id } },
    });
    if (adminAttivi === 0) {
      return { success: false, error: "Deve restare almeno un amministratore abilitato" };
    }
  }

  await prisma.utente.update({ where: { id }, data: { ... } });
  ```
  Questa verifica soffre di un classico difetto di concorrenza **Time-of-Check to Time-of-Use (TOCTOU)**. Se due amministratori autorizzati (Admin 1 e Admin 2) eseguono quasi simultaneamente la disabilitazione o la revoca del ruolo admin dell'altro:
  1. Il processo del thread 1 conta gli admin attivi escluso Admin 2: trova Admin 1 (`count = 1`). Controllo superato.
  2. Il processo del thread 2 conta gli admin attivi escluso Admin 1: trova Admin 2 (`count = 1`). Controllo superato.
  3. Il thread 1 esegue l'update disabilitando Admin 2.
  4. Il thread 2 esegue l'update disabilitando Admin 1.
  
  Il sistema si ritrova con **zero amministratori abilitati nel database**. Poiché l'accesso a `/users` e `/audit-log` richiede rigorosamente la sessione di un amministratore attivo (`requireAdmin()`), il sistema entra in uno stato di lockout irreversibile a livello applicativo, richiedendo un intervento manuale diretto sul database di produzione per ripristinare l'accesso.
- **Soluzione consigliata:**
  Eseguire l'operazione all'interno di una transazione interattiva Prisma (`prisma.$transaction`) con lock o verificare con un vincolo sul database PostgreSQL:
  ```ts
  await prisma.$transaction(async (tx) => {
    if (!isAdmin || !abilitato) {
      const adminAttivi = await tx.utente.count({
        where: { isAdmin: true, abilitato: true, NOT: { id } },
      });
      if (adminAttivi === 0) {
        throw new Error("LAST_ADMIN_GUARD");
      }
    }
    await tx.utente.update({
      where: { id },
      data: { username, nome: nome || null, cognome: cognome || null, isAdmin, abilitato },
    });
  });
  ```

---

<a id="sec-08"></a>
### [Medio] [SEC-08] Mancata revoca della sessione (`tokenVersion`) alla disabilitazione dell'account utente
- **Stato:** ✅ RISOLTO (Risolto estendendo l'incremento di `tokenVersion` a `toggleUserEnabled` su `!abilitato`, a `updateUser` su disabilitazione, revoca admin o cambio username, e a `logout` per l'invalidazione dei JWT lato server; verificato con test di regressione in `scripts/verify-session-token-version.test.ts`).
- **Posizione:** [`lib/actions/users.ts`](file:///home/marcor/Projects/gestionale-fatture/lib/actions/users.ts#L130-L145), [`lib/actions/users.ts`](file:///home/marcor/Projects/gestionale-fatture/lib/actions/users.ts#L265-L278), [`lib/actions/auth.ts`](file:///home/marcor/Projects/gestionale-fatture/lib/actions/auth.ts#L130-L145)
- **Descrizione:**
  Nella Server Action `toggleUserEnabled(id, abilitato)`, quando un amministratore sospende o disabilita un utente (`abilitato: false`), il record viene aggiornato impostando solo il flag booleano:
  ```ts
  await prisma.utente.update({
    where: { id },
    data: { abilitato },
  });
  ```
  A differenza dell'azione `resetUserPassword` (riga 186) — che incrementa esplicitamente `tokenVersion: { increment: 1 }` per revocare istantaneamente tutti i token JWT firmati in precedenza — la disabilitazione dell'account **non incrementa `tokenVersion`**.
  
  Mentre `getSession()` rifiuta l'accesso finché l'utente è disabilitato (`if (!user.abilitato) return null;`), qualora l'utente venga successivamente riabilitato (`toggleUserEnabled(id, true)`), qualsiasi token JWT emesso prima della sospensione e non ancora giunto alla sua scadenza temporale (il default è di ben **7 giorni**) **torna immediatamente valido e funzionante**. Se la disabilitazione era stata disposta a fronte di una presunta compromissione delle credenziali o del dispositivo dell'utente, l'eventuale attaccante in possesso del cookie/token di sessione riacquisterà l'accesso senza doversi riautenticare.
- **Soluzione consigliata:**
  Incrementare `tokenVersion` ogni volta che lo stato di abilitazione o i privilegi dell'utente vengono revocati:
  ```ts
  await prisma.utente.update({
    where: { id },
    data: {
      abilitato,
      ...(!abilitato ? { tokenVersion: { increment: 1 } } : {}),
    },
  });
  ```

---

<a id="sec-09"></a>
### [Medio] [SEC-09] Formula Injection nei file Excel esportati per bypass dei caratteri di trigger con spaziatura iniziale
- **Stato:** ✅ RISOLTO (Risolto aggiornando `sanitizeCellValue` in `lib/excel/sanitize.ts` per verificare sia il primo carattere grezzo sia il primo carattere significativo dopo la rimozione degli spazi iniziali e del `trimStart()`, coperto da test unitari completi in `lib/excel/sanitize.test.ts` e `lib/excel/invoices-export.test.ts`).
- **Posizione:** [`lib/excel/sanitize.ts`](file:///home/marcor/Projects/gestionale-fatture/lib/excel/sanitize.ts#L8-L26)
- **Descrizione:**
  Il modulo di sanitizzazione preventiva contro attacchi CSV / Formula Injection implementa la seguente funzione:
  ```ts
  const FORMULA_TRIGGER_CHARS = new Set(["=", "+", "-", "@", "\t", "\r"]);

  export function sanitizeCellValue(value: string): string {
    if (value.length === 0) return value;
    if (value[0] === "'") return value;
    return FORMULA_TRIGGER_CHARS.has(value[0]) ? `'${value}` : value;
  }
  ```
  La funzione ispeziona unicamente il primissimo carattere della stringa (`value[0]`). Tuttavia, software di fogli di calcolo come Microsoft Excel e LibreOffice Calc scartano automaticamente gli spazi bianchi iniziali quando valutano il contenuto di una cella CSV/TSV come formula matematica o comando DDE dinamico.
  
  Se un utente o un attore malevolo inserisce nei campi anagrafici (es. via o note del pagante) una stringa del tipo `"  =cmd|' /C calc'!A0"` o `"   +2+5"`, `value[0]` è il carattere spazio `" "`, che non appartiene a `FORMULA_TRIGGER_CHARS`. Il valore viene inserito nel file esportato senza l'apice di escape (`'`), venendo poi regolarmente eseguito al momento dell'apertura del file da parte del personale amministrativo.
- **Soluzione consigliata:**
  Eseguire il controllo sul primo carattere significativo dopo aver rimosso la spaziatura iniziale con `trimStart()`:
  ```ts
  export function sanitizeCellValue(value: string): string {
    if (value.length === 0) return value;
    const trimmed = value.trimStart();
    if (trimmed.length === 0) return value;
    if (trimmed[0] === "'") return value;
    return FORMULA_TRIGGER_CHARS.has(trimmed[0]) ? `'${value}` : value;
  }
  ```

---

<a id="sec-10"></a>
### [Basso] [SEC-10] Timing Leakage e bypass del rate limit su input login sovradimensionati
- **Stato:** ✅ RISOLTO (Risolto anticipando il controllo del rate limit rispetto alle validazioni dimensionali su `username` e `password`, eseguendo la comparazione a tempo costante `verifyPassword(password.slice(0, 72), DUMMY_HASH)` e registrando il tentativo fallito in caso di input fuori range, con messaggio di errore uniforme `"Credenziali non valide"`; verificato con test invariante in `scripts/verify-login-input-security.test.ts`).
- **Posizione:** [`lib/actions/auth.ts`](file:///home/marcor/Projects/gestionale-fatture/lib/actions/auth.ts#L44-L80)
- **Descrizione:**
  Nella Server Action `login`, il controllo preventivo sulla lunghezza di username e password è strutturato prima dell'acquisizione del rate limiter e del confronto a tempo costante:
  ```ts
  if (
    username.length > 50 ||
    password.length > 72 ||
    Buffer.byteLength(password, "utf8") > 72
  ) {
    return { success: false, error: "Input non valido" };
  }

  const ip = await getClientIp();
  const rateLimit = checkLoginRateLimit(username, ip);
  ```
  Ciò produce due comportamenti indesiderati dal punto di vista della sicurezza applicativa:
  1. **Bypass del Rate Limiting**: un attaccante può inviare raffiche massive di tentativi con password eccedenti 72 byte senza che tali tentativi vengano conteggiati o bloccati dal meccanismo di lockout dell'IP o dello username.
  2. **Discrepanza di Timing & Oracle Informativo**: la risposta restituita (`"Input non valido"`) si distingue chiaramente dall'errore ordinario (`"Credenziali non valide"`) e viene restituita in frazioni di millisecondo, a differenza della verifica bcrypt (`~80-120ms`). Questo espone l'endpoint a probe di timing differenziale.
- **Soluzione consigliata:**
  Registrare sempre l'operazione nel rate limiter ed eseguire il confronto fittizio a tempo costante (`verifyPassword(password, DUMMY_HASH)`) prima di restituire un messaggio di errore uniforme:
  ```ts
  const ip = await getClientIp();
  const rateLimit = checkLoginRateLimit(username, ip);
  if (!rateLimit.allowed) {
    return { success: false, error: `Troppi tentativi falliti. Riprova tra ${rateLimit.retryAfterMinutes} minuti.` };
  }

  if (username.length > 50 || Buffer.byteLength(password, "utf8") > 72) {
    recordFailedLogin(username, ip);
    await verifyPassword(password.slice(0, 72), DUMMY_HASH);
    return { success: false, error: "Credenziali non valide" };
  }
  ```

---

## 2. Duplicazione del Codice e Principi DRY

<a id="dry-05"></a>
### [Medio] [DRY-05] Quintuplice duplicazione della logica di ripristino stato (Rollback) in `transmission.service.ts`
- **Stato:** ✅ RISOLTO (Risolto estraendo la funzione helper modulare `rollbackStatoTrasmissione(candidateIds, userId, lockTimestamp?)` in `lib/sistemats/services/transmission.service.ts`, sostituendo i 5 blocchi di query duplicati e garantendo l'applicazione coerente del timestamp di lock, protetto da test statici e unitari in `scripts/verify-transmission-rollback-dry.test.ts`).
- **Posizione:** [`lib/sistemats/services/transmission.service.ts`](file:///home/marcor/Projects/gestionale-fatture/lib/sistemats/services/transmission.service.ts#L35-L55)
- **Descrizione:**
  All'interno del metodo `inviaFattureTS`, per garantire che un blocco temporaneo di fatture in stato `IN_TRASMISSIONE` venga correttamente rilasciato in caso di errore, la seguente query Prisma viene riscritta per esteso in **cinque punti diversi**:
  - Validazione Codice Fiscale fallita (righe 143–153);
  - Validazione importo spesa fallita (righe 164–173);
  - Verifica data pagamento futura fallita (righe 183–193);
  - Scarto o risposta non positiva del web service SOAP ministeriale (righe 240–250);
  - Blocco `catch` per cattura di eccezioni runtime non gestite (righe 271–280).
  
  ```ts
  await prisma.pagamento.updateMany({
    where: {
      id: { in: candidateIds },
      id_Utente: userId,
      stato_ts: "IN_TRASMISSIONE",
      data_invio_ts: lockTimestamp,
    },
    data: {
      stato_ts: "DA_INVIARE",
      data_invio_ts: null,
    },
  });
  ```
  Questa ripetizione letterale viola il principio DRY e aumenta notevolmente il rischio di regressioni qualora vengano aggiornati i campi di lock o aggiunte metriche di rollback.
- **Soluzione consigliata:**
  Estrarre una funzione helper privata all'interno del modulo o del servizio:
  ```ts
  async function rollbackStatoTrasmissione(
    candidateIds: number[],
    userId: number,
    lockTimestamp?: Date
  ): Promise<void> {
    await prisma.pagamento.updateMany({
      where: {
        id: { in: candidateIds },
        id_Utente: userId,
        stato_ts: "IN_TRASMISSIONE",
        ...(lockTimestamp ? { data_invio_ts: lockTimestamp } : {}),
      },
      data: {
        stato_ts: "DA_INVIARE",
        data_invio_ts: null,
      },
    });
  }
  ```

---

<a id="dry-06"></a>
### [Medio] [DRY-06] Duplicazione inline del modale "Dettagli Paziente" in `patients-manager.tsx`
- **Stato:** ✅ RISOLTO (Risolto estraendo il componente modulare autonomo `PatientDetailDialog` in `components/patients/patient-detail-dialog.tsx`, rimuovendo oltre 70 righe di JSX duplicato da `patients-manager.tsx` e re-esportando il componente in `components/invoices/patient-detail-dialog.tsx` a garanzia della retrocompatibilità con `invoices-manager.tsx`; verificato con test unitari e invarianti in `components/patients/patient-detail-dialog.test.tsx` e `scripts/verify-patient-detail-dialog-dry.test.ts`).
- **Posizione:** [`components/patients/patient-detail-dialog.tsx`](file:///home/marcor/Projects/gestionale-fatture/components/patients/patient-detail-dialog.tsx), [`components/patients/patients-manager.tsx`](file:///home/marcor/Projects/gestionale-fatture/components/patients/patients-manager.tsx#L485-L490)
- **Descrizione:**
  In seguito ai precedenti interventi di refactoring (in particolare `DRY-02`), il componente modale di dettaglio del pagante è stato correttamente estratto nel file riutilizzabile [`components/payers/payer-detail-dialog.tsx`](file:///home/marcor/Projects/gestionale-fatture/components/payers/payer-detail-dialog.tsx).
  Al contrario, il componente "Dettagli Paziente" (`viewingPatient`) è rimasto implementato come oltre 72 righe di JSX inlined direttamente nel corpo di `patients-manager.tsx`. Oltre ad appesantire inutilmente il file del manager (che supera le 560 righe), tale implementazione duplica la logica di presentazione dei dati anagrafici e dell'eventuale pagante collegato, impedendone il riutilizzo da altre sezioni (ad es. da `invoices` o dalla futura scheda anamnestica).
- **Soluzione consigliata:**
  Estrarre il componente autonomo `components/patients/patient-detail-dialog.tsx` secondo il medesimo pattern già validato per i paganti:
  ```tsx
  export function PatientDetailDialog({
    patient,
    onOpenChange,
    onViewPayer,
  }: PatientDetailDialogProps) { ... }
  ```

---

<a id="dry-07"></a>
### [Basso] [DRY-07] Sanitizzazione ripetuta dei parametri di paginazione nei moduli di data fetching
- **Stato:** ✅ RISOLTO (Risolto introducendo in `lib/utils/pagination.ts` le funzioni pure `calculatePagination` e `clampPage` con sanitizzazione robusta contro indici inferiori a 1, decimali o parametri non validi, ed integrandole uniformemente in `lib/data/invoices.ts`, `lib/data/patients.ts`, `lib/data/payers.ts` e `lib/data/audit-log.ts`; verificato con test unitari e controlli invarianti in `lib/utils/pagination.test.ts` e `scripts/verify-pagination-dry.test.ts`).
- **Posizione:** [`lib/utils/pagination.ts`](file:///home/marcor/Projects/gestionale-fatture/lib/utils/pagination.ts), [`lib/data/invoices.ts`](file:///home/marcor/Projects/gestionale-fatture/lib/data/invoices.ts), [`lib/data/patients.ts`](file:///home/marcor/Projects/gestionale-fatture/lib/data/patients.ts), [`lib/data/payers.ts`](file:///home/marcor/Projects/gestionale-fatture/lib/data/payers.ts), [`lib/data/audit-log.ts`](file:///home/marcor/Projects/gestionale-fatture/lib/data/audit-log.ts)
- **Descrizione:**
  In ciascuna funzione di accesso ai dati paginati (`getInvoices`, `getPatients`, `getPayers`, `getArchivedPatients`, `getArchivedPayers`), il calcolo della pagina effettiva, il clamp del valore minimo a 1 e il calcolo del parametro Prisma `skip = (page - 1) * pageSize` sono implementati attraverso frammenti di codice ridondanti scritti localmente.
- **Soluzione consigliata:**
  Estendere il modulo [`lib/utils/pagination.ts`](file:///home/marcor/Projects/gestionale-fatture/lib/utils/pagination.ts) aggiungendo una funzione pura di calcolo offset:
  ```ts
  export function calculatePagination(page: number, pageSize: number) {
    const validPage = Math.max(1, Math.floor(page) || 1);
    return {
      page: validPage,
      pageSize,
      skip: (validPage - 1) * pageSize,
      take: pageSize,
    };
  }
  ```

---

## 3. Architettura, Manutenibilità e Modularità

<a id="arch-06"></a>
### [Alto] [ARCH-06] Discrepanza architetturale e fiscale nel calcolo dell'imposta di bollo (€ 2,00) tra Sistema TS e PDF
- **Stato:** ✅ RISOLTO (Risolto introducendo il modulo di dominio centralizzato `lib/fiscal/bollo.ts` con `calcolaTotaliFattura`, sincronizzando la logica di inclusione del bollo tra PDF e tracciato XML solo a fronte di `isBolloApplicato(bolloCodice)`, e introducendo il blocco vincolante alla trasmissione in `transmission.service.ts` e `fix-invoice-ts-dialog.tsx` per fatture superiori a 77,47 € prive di bollo; verificato con test unitari e invarianti).
- **Posizione:** [`lib/fiscal/bollo.ts`](file:///home/marcor/Projects/gestionale-fatture/lib/fiscal/bollo.ts), [`lib/sistemats/payload-builder.ts`](file:///home/marcor/Projects/gestionale-fatture/lib/sistemats/payload-builder.ts#L73-L79), [`lib/pdf/placeholders.ts`](file:///home/marcor/Projects/gestionale-fatture/lib/pdf/placeholders.ts#L161-L170), [`lib/data/sistema-ts.ts`](file:///home/marcor/Projects/gestionale-fatture/lib/data/sistema-ts.ts#L110-L121)
- **Descrizione:**
  Nel sistema è presente un grave disallineamento concettuale tra la logica di generazione del tracciato di spesa sanitaria per l'Agenzia delle Entrate e la resa del documento PDF/fattura destinata al paziente:
  
  1. In `payload-builder.ts` (trasmissione TS):
     ```ts
     if (params.prezzoTotale > SOGLIA_BOLLO || Boolean(params.bolloCodice)) {
       voci.push({
         tipoSpesa: "SP",
         importo: IMPORTO_BOLLO, // 2.00 €
         naturaIva: resolveNaturaIvaBollo(params.naturaIva),
       });
     }
     ```
     Se la fattura supera € 77,47, il bollo di € 2,00 viene **incluso d'ufficio nel tracciato XML ministeriale**, anche se il codice identificativo del bollo non è stato inserito dall'utente.
  
  2. In `placeholders.ts` (generazione PDF per il paziente):
     ```ts
     "{{fattura.bolloImporto}}": invoice.bolloCodice ? formatCurrency(IMPORTO_BOLLO) : "",
     "{{fattura.totaleConBollo}}": formatCurrency(
       roundCurrency(invoice.prezzo_totale + (invoice.bolloCodice ? IMPORTO_BOLLO : 0))
     ),
     ```
     Nel PDF consegnato al paziente, il bollo e il totale con bollo vengono calcolati **SOLO se `invoice.bolloCodice` è valorizzato**.
  
  **Impatto fiscale:** se un medico emette una prestazione sanitaria da € 100,00 senza aver inserito il codice della marca da bollo, il paziente riceve un PDF con totale € 100,00, mentre all'Agenzia delle Entrate viene comunicato un totale spesa di € 102,00. Questa discordanza espone il professionista sanitario a contestazioni e sanzioni in sede di controllo formale del 730 precompilato.
- **Soluzione consigliata:**
  Centralizzare la business logic dell'imposta di bollo in un modulo di dominio unificato `lib/fiscal/bollo.ts` con una funzione condivisa `calcolaTotaliFattura(prezzoTotale, bolloCodice)` e garantire che PDF e tracciato XML operino con regole univoche e sincronizzate.

---

<a id="arch-07"></a>
### [Medio] [ARCH-07] Schema di validazione Pagante esclude indebitamente liberi professionisti e ditte individuali (CF + P.IVA)
- **Stato:** ⏸️ AS IS (Decisione di Business: la mutua esclusione tra CF e P.IVA per i paganti è voluta e confermata come requisito di dominio).
- **Posizione:** [`lib/validations/payer.ts`](file:///home/marcor/Projects/gestionale-fatture/lib/validations/payer.ts#L29-L38)
- **Descrizione:**
  Lo schema Zod `payerSchema` impone un vincolo di mutua esclusione mediante `refine`:
  ```ts
  .refine(
    (data) => {
      const hasCf = data.cf != null;
      const hasPiva = data.piva != null;
      return (hasCf || hasPiva) && !(hasCf && hasPiva);
    },
    {
      message: "Inserire solo il Codice Fiscale o solo la Partita IVA",
    }
  );
  ```
  Nella prassi tributaria e gestionale italiana, una ditta individuale o un libero professionista (es. uno psicologo, un fisioterapista o un avvocato che riceve una fattura sanitaria o di consulenza) possiede **contemporaneamente** un Codice Fiscale personale alfanumerico (16 caratteri) e un numero di Partita IVA (11 cifre).
  Impedire la coesistenza di entrambi i dati fiscali rende impossibile completare l'anagrafica di professionisti e ditte individuali secondo le norme fiscali vigenti, forzando l'utente a mutilare i dati contabili.
- **Soluzione consigliata:**
  Consentire la presenza di entrambi i campi purché almeno uno dei due sia fornito:
  ```ts
  .refine(
    (data) => {
      const hasCf = data.cf != null && data.cf !== "";
      const hasPiva = data.piva != null && data.piva !== "";
      return hasCf || hasPiva;
    },
    {
      message: "Inserire almeno il Codice Fiscale o la Partita IVA",
    }
  );
  ```

---

<a id="arch-08"></a>
### [Basso] [ARCH-08] Download di ricevute PDF veicolato in Base64 tramite Server Action RPC anziché Route Handler HTTP
- **Posizione:** [`lib/actions/sistema-ts.ts`](file:///home/marcor/Projects/gestionale-fatture/lib/actions/sistema-ts.ts#L234-L253)
- **Descrizione:**
  La Server Action `getRicevutaPdfBase64` estrae il PDF memorizzato nel campo Postgres `Bytes` e lo invia al client come stringa Base64 serializzata in un payload JSON:
  ```ts
  return {
    success: true,
    base64: Buffer.from(trasmissione.pdfRicevuta).toString("base64"),
    fileName: `ricevuta_${trasmissione.protocollo}.pdf`,
  };
  ```
  Questo design contrasta con l'architettura adottata per l'esportazione delle fatture ([`app/api/invoices/[id]/pdf/route.ts`](file:///home/marcor/Projects/gestionale-fatture/app/api/invoices/[id]/pdf/route.ts)). La serializzazione JSON di file binari provoca un aumento del 33% del carico di rete, impedisce lo streaming HTTP diretto e costringe il browser a ricostruire manualmente l'oggetto in memoria (`atob` -> `Uint8Array` -> `Blob` -> URL object), con conseguente frammentazione della memoria per documenti voluminosi.
- **Soluzione consigliata:**
  Convertire l'azione in un Route Handler HTTP: `GET /api/sistema-ts/trasmissioni/[id]/ricevuta` con appropriati header `Content-Type: application/pdf` e `Content-Disposition: attachment`.

---

<a id="arch-09"></a>
### [Basso] [ARCH-09] Accoppiamento diretto tra entità Prisma e stato dei componenti Client
- **Posizione:** [`lib/data/*.ts`](file:///home/marcor/Projects/gestionale-fatture/lib/data/), [`components/**/*-manager.tsx`](file:///home/marcor/Projects/gestionale-fatture/components/)
- **Descrizione:**
  I moduli del Data Layer restituiscono spesso tipi Prisma grezzi contenenti istanze `Decimal` e `Date`. I componenti Client si trovano quindi costretti a eseguire manualmente conversioni come `inv.prezzo_totale.toNumber()` o `data.toISOString()`. Questo approccio viola la separazione dei livelli (Clean Architecture), esponendo dettagli implementativi dell'ORM ai layer di presentazione.
- **Soluzione consigliata:**
  Definire View Model / DTO espliciti nei moduli `lib/data/` che restituiscano unicamente tipi primitivi serializzabili (`number`, `string` ISO), disaccoppiando l'interfaccia utente dalle strutture del database.

---

## 4. Performance ed Efficienza

<a id="perf-05"></a>
### [Medio] [PERF-05] Sincronizzazione ricevute TS sequenziale con query singole ripetute
- **Posizione:** `lib/sistemats/services/sync-receipts.service.ts`
- **Descrizione:**
  Durante l'operazione di sincronizzazione massiva delle ricevute delle trasmissioni, il servizio itera sequenzialmente (`for...of`) su tutte le trasmissioni non ancora concluse, effettuando chiamate di rete verso l'endpoint SOAP Sogei seguite da singole query di aggiornamento sul database Prisma per ciascuna di esse.
  All'aumentare del volume di trasmissioni in uno storico annuale, il tempo complessivo di elaborazione cresce linearmente, rischiando di incorrere nei timeout di esecuzione delle Server Actions di Next.js (tipicamente 15-30 secondi).
- **Soluzione consigliata:**
  Introdurre un pool di concorrenza controllato (es. con un concurrency limiter a 3-5 richieste parallele) per le chiamate SOAP e raggruppare gli aggiornamenti del database in un'unica operazione transazionale (`prisma.$transaction`).

---

<a id="perf-06"></a>
### [Basso] [PERF-06] Paginazione offset non scalabile ($O(N)$) su tabelle storiche ad alto volume
- **Posizione:** [`lib/data/audit.ts`](file:///home/marcor/Projects/gestionale-fatture/lib/data/audit.ts#L40-L55), [`lib/data/invoices.ts`](file:///home/marcor/Projects/gestionale-fatture/lib/data/invoices.ts#L50-L75)
- **Descrizione:**
  L'utilizzo di `skip: (page - 1) * pageSize` scala linearmente in termini di costo I/O su PostgreSQL. Sulla tabella `AuditLog`, che accumula costantemente record a ogni mutazione di sicurezza, navigare su pagine avanzate (es. pagina 200) obbliga il motore relazionale a leggere e scartare migliaia di tuple prima di restituire il blocco desiderato.
- **Soluzione consigliata:**
  Valutare per la tabella di audit la transizione a una paginazione basata su cursore (`cursor: { id: lastSeenId }`), che sfrutta direttamente l'indice B-Tree primario con complessità costante $O(1)$.

---

<a id="perf-07"></a>
### [Suggerimento] [PERF-07] Inizializzazione ripetuta di espressioni regolari e formattatori nei cicli di render
- **Posizione:** [`lib/utils/date.ts`](file:///home/marcor/Projects/gestionale-fatture/lib/utils/date.ts#L63-L70), [`lib/utils/currency.ts`](file:///home/marcor/Projects/gestionale-fatture/lib/utils/currency.ts)
- **Descrizione:**
  Nella funzione `maskDateInput`, le espressioni regolari per la validazione e il matching dei formati di input data vengono istanziate dinamicamente a ogni pressione di tasto dell'utente, anziché essere dichiarate una volta a livello di modulo (`const ISO_DATE_REGEX = ...`).
- **Soluzione consigliata:**
  Spostare tutte le RegExp statiche a livello di modulo nel top-level scope per consentire al motore V8 di compilarle una sola volta.

---

## 5. Error Handling e Robustezza

<a id="err-05"></a>
### [Alto] [ERR-05] Taglio a mezzogiorno in `parseDateInput` esclude fatture pomeridiane nei filtri a intervallo temporale
- **Posizione:** [`lib/invoices/list-query.ts`](file:///home/marcor/Projects/gestionale-fatture/lib/invoices/list-query.ts#L56-L63), [`lib/utils/date.ts`](file:///home/marcor/Projects/gestionale-fatture/lib/utils/date.ts#L21-L27)
- **Descrizione:**
  La funzione [`parseDateInput`](file:///home/marcor/Projects/gestionale-fatture/lib/utils/date.ts#L21-L27) converte le stringhe di data impostando arbitrariamente l'orario a **mezzogiorno** (ore 12:00:00 local time):
  ```ts
  export function parseDateInput(value: string): Date {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day, 12, 0, 0);
  }
  ```
  Nella costruzione della query di filtro per l'elenco e l'esportazione delle fatture ([`lib/invoices/list-query.ts`](file:///home/marcor/Projects/gestionale-fatture/lib/invoices/list-query.ts#L56-L63)):
  ```ts
  if (filters.dataDa || filters.dataA) {
    conditions.push({
      data: {
        ...(filters.dataDa ? { gte: parseDateInput(filters.dataDa) } : {}),
        ...(filters.dataA ? { lte: parseDateInput(filters.dataA) } : {}),
      },
    });
  }
  ```
  Nel database Postgres, la colonna `data` di `Pagamento` è un timestamp (`DateTime`). Se un medico emette una fattura il 31 marzo alle ore 16:30, e l'amministratore filtra l'elenco impostando il campo "Fino al: 31/03/2026", la condizione SQL generata sarà:
  `data <= '2026-03-31T12:00:00.000'`.
  
  Poiché `16:30:00 > 12:00:00`, la fattura emessa il 31 marzo viene **completamente e silenziosamente omessa** dalla lista delle fatture, dall'esportazione Excel e dal computo dei totali contabili. Analogamente, una fattura emessa alle ore 09:00 del mattino verrebbe esclusa dal filtro `dataDa`.
- **Soluzione consigliata:**
  Introdurre funzioni dedicate che impostino rispettivamente l'inizio della giornata (00:00:00.000) per `dataDa` e la fine esatta della giornata (23:59:59.999) per `dataA`:
  ```ts
  export function parseDateStartOfDay(value: string): Date {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day, 0, 0, 0, 0);
  }

  export function parseDateEndOfDay(value: string): Date {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day, 23, 59, 59, 999);
  }
  ```

---

<a id="err-06"></a>
### [Alto] [ERR-06] Controllo cronologico con comparazione a millisecondi genera falsi positivi su fatture consecutive emesse nello stesso giorno
- **Posizione:** [`lib/invoices/chronology.ts`](file:///home/marcor/Projects/gestionale-fatture/lib/invoices/chronology.ts#L20-L32)
- **Descrizione:**
  Il modulo di verifica della cronologia delle fatture confronta le date tramite `getTime()`:
  ```ts
  export function findChronologyConflict(
    data: Date,
    previous: ChronologyNeighbor | null,
    next: ChronologyNeighbor | null
  ): ChronologyConflict | null {
    if (previous && data.getTime() < previous.data.getTime()) {
      return { side: "precedente", neighbor: previous };
    }
    if (next && data.getTime() > next.data.getTime()) {
      return { side: "successivo", neighbor: next };
    }
    return null;
  }
  ```
  Se la fattura precedente (#4) è stata salvata con un orario reale (es. `15:00:00`) o con timezone diversa, e la fattura successiva (#5) viene creata nello stesso identico giorno solare (es. `15/03/2026`) tramite un input form che imposta le ore `12:00:00`, la condizione:
  `data.getTime() < previous.data.getTime()`
  risulta **vera** per via della differenza di ore/millisecondi.
  
  Il sistema solleva un blocco applicativo sostenendo che la data non può essere precedente a quella della fattura #4, impedendo all'utente di emettere fatture successive nello stesso giorno. Secondo i principi contabili italiani (D.P.R. 633/1972, art. 21), l'ordine cronologico è vincolato alla **data di calendario (giorno solare)**, consentendo l'emissione di fatture numericamente progressive nella stessa giornata.
- **Soluzione consigliata:**
  Eseguire il confronto normalizzando preventivamente entrambe le date all'inizio del giorno solare:
  ```ts
  function toStartOfDayTime(date: Date): number {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  }

  export function findChronologyConflict(
    data: Date,
    previous: ChronologyNeighbor | null,
    next: ChronologyNeighbor | null
  ): ChronologyConflict | null {
    const target = toStartOfDayTime(data);
    if (previous && target < toStartOfDayTime(previous.data)) {
      return { side: "precedente", neighbor: previous };
    }
    if (next && target > toStartOfDayTime(next.data)) {
      return { side: "successivo", neighbor: next };
    }
    return null;
  }
  ```

---

<a id="err-07"></a>
### [Medio] [ERR-07] Disallineamento logico in `canSubmit` del dialogo correzione TS: omessa validazione bollo — ✅ RISOLTO
- **Posizione:** [`components/sistema-ts/fix-invoice-ts-dialog.tsx`](file:///home/marcor/Projects/gestionale-fatture/components/sistema-ts/fix-invoice-ts-dialog.tsx#L100-L113)
- **Descrizione:**
  Nel dialogo di correzione delle anomalie per Sistema TS, il componente calcola esplicitamente la validità del bollo:
  ```ts
  const requiresBollo = invoice.prezzo_totale > 77.47;
  const isBolloValid = useMemo(() => {
    if (!requiresBollo) return true;
    if (!bolloCodice) return false;
    return /^\d{14}$/.test(bolloCodice.trim());
  }, [requiresBollo, bolloCodice]);
  ```
  Tuttavia, nella definizione della guardia di abilitazione del submit (`canSubmit`):
  ```ts
  const canSubmit = useMemo(() => {
    if (!paymentDateValidation.valid) return false;
    if (flagOpposizione) return true;
    return cfValidation.valid;
  }, [paymentDateValidation.valid, flagOpposizione, cfValidation.valid]);
  ```
  La variabile `isBolloValid` **non compare tra le condizioni**. Un utente può quindi confermare e inviare la correzione anche lasciando il codice bollo non valido o vuoto per importi superiori a € 77,47, vanificando la correzione e provocando un successivo scarto Sogei o incongruenza contabile.
- **Soluzione consigliata:**
  Includere `isBolloValid` nei requisiti vincolanti di `canSubmit`:
  ```ts
  const canSubmit = useMemo(() => {
    if (!paymentDateValidation.valid) return false;
    if (!isBolloValid) return false;
    if (flagOpposizione) return true;
    return cfValidation.valid;
  }, [paymentDateValidation.valid, isBolloValid, flagOpposizione, cfValidation.valid]);
  ```

---

<a id="err-08"></a>
### [Basso] [ERR-08] Mappatura incompleta e collasso degli errori nativi nei web service SOAP Sogei
- **Posizione:** [`lib/sistemats/client.ts`](file:///home/marcor/Projects/gestionale-fatture/lib/sistemats/client.ts), [`lib/sistemats/xml-parser.ts`](file:///home/marcor/Projects/gestionale-fatture/lib/sistemats/xml-parser.ts)
- **Descrizione:**
  In fase di parsing delle risposte del servizio di trasmissione ministeriale, gli errori restituiti (che includono codice errore numerico, descrizione ufficiale ministeriale, tipo scarto `E` ed eventuali warning `W`) vengono in molti casi collassati in una stringa generica unificata. Questo impedisce di fornire all'utente un feedback puntuale e contestuale all'interno dell'interfaccia (es. distinguere un errore sul codice fiscale del cittadino da un problema di certificato o credenziali).
- **Soluzione consigliata:**
  Restituire un tipo di errore strutturato:
  ```ts
  export type SistemaTsFault = {
    code: string;
    description: string;
    type: "ERROR" | "WARNING";
    targetDocument?: string;
  };
  ```

---

## 6. Code Smells e Naming Conventions

<a id="smell-10"></a>
### [Medio] [SMELL-10] Calcolo isolato di `bolloMancante` escluso da `haAnomalie` in Sistema TS
- **Stato:** ✅ RISOLTO (Risolto includendo `bolloMancante` in `haAnomalie` in `lib/data/sistema-ts.ts` e vincolando la validazione sia a livello di servizio `transmission.service.ts` sia nel dialogo `fix-invoice-ts-dialog.tsx`, sanato contestualmente con `ARCH-06`).
- **Posizione:** [`lib/data/sistema-ts.ts`](file:///home/marcor/Projects/gestionale-fatture/lib/data/sistema-ts.ts#L110-L121)
- **Descrizione:**
  Nella query che prepara i documenti per l'interfaccia di trasmissione a Sistema TS:
  ```ts
  const richiedeBollo = prezzoTotale > SOGLIA_BOLLO;
  const bolloMancante = richiedeBollo && !inv.bolloCodice;

  const cfValido = inv.flag_opposizione ? true : cfCheck.valid;
  const importoValido = importoCheck.valid;
  const haAnomalie = !cfValido || !importoValido;

  const isProntaPerInvio = inv.stato_ts === "DA_INVIARE" && !isDataFutura && !haAnomalie;
  ```
  Il valore `bolloMancante` viene calcolato ma **completamente ignorato** nella determinazione di `haAnomalie` e conseguentemente di `isProntaPerInvio`.
  Una fattura con importo di € 150,00 priva di codice di bollo virtuale viene segnalata alla UI con `isProntaPerInvio = true`, consentendo all'utente di selezionarla e inviarla in batch senza alcun avviso preliminare.
- **Soluzione consigliata:**
  Integrare `bolloMancante` nel calcolo di `haAnomalie`:
  ```ts
  const haAnomalie = !cfValido || !importoValido || bolloMancante;
  ```

---

<a id="smell-11"></a>
### [Basso] [SMELL-11] Costanti e codici fiscali/IVA sparsi come Magic Numbers anziché centralizzati
- **Posizione:** [`components/sistema-ts/fix-invoice-ts-dialog.tsx`](file:///home/marcor/Projects/gestionale-fatture/components/sistema-ts/fix-invoice-ts-dialog.tsx#L101), [`lib/sistemats/payload-builder.ts`](file:///home/marcor/Projects/gestionale-fatture/lib/sistemats/payload-builder.ts#L69)
- **Descrizione:**
  Nonostante sia presente un modulo apposito [`lib/constants/fiscal.ts`](file:///home/marcor/Projects/gestionale-fatture/lib/constants/fiscal.ts), nel codice si riscontra la presenza di valori hardcoded inline, quali il letterale numerico `77.47` in `fix-invoice-ts-dialog.tsx` e stringhe fisse come `"N2.2"` in `payload-builder.ts`.
- **Soluzione consigliata:**
  Sostituire ogni istanza letterale con le costanti centralizzate esportate da `@/lib/constants/fiscal` (`SOGLIA_BOLLO`, `DEFAULT_NATURA_IVA`, ecc.).

---

<a id="smell-12"></a>
### [Basso] [SMELL-12] Disallineamento di nomenclatura tra database snake_case e TypeScript camelCase
- **Posizione:** [`prisma/schema.prisma`](file:///home/marcor/Projects/gestionale-fatture/prisma/schema.prisma), [`types/index.ts`](file:///home/marcor/Projects/gestionale-fatture/types/index.ts)
- **Descrizione:**
  Il modello dati presenta un mix incoerente di stili di naming: campi storici in `snake_case` (`n_fattura`, `data_pagamento`, `stato_ts`, `id_Utente`) convivono con campi più recenti definiti in `camelCase` (`bolloCodice`, `mustChangePassword`, `tokenVersion`). Nei componenti React questo genera destrutturazioni asimmetriche (es. `const { n_fattura, bolloCodice } = invoice`) che inficiano la leggibilità e l'uniformità del codice.
- **Soluzione consigliata:**
  Utilizzare la direttiva `@map` di Prisma sul database PostgreSQL per mantenere la persistenza in snake_case esponendo un'interfaccia di modello rigorosamente in camelCase (`nFattura @map("n_fattura")`).

---

<a id="smell-13"></a>
### [Suggerimento] [SMELL-13] Utilizzo di `console.error` non strutturato in luogo di un logger diagnostico
- **Posizione:** [`lib/actions/users.ts`](file:///home/marcor/Projects/gestionale-fatture/lib/actions/users.ts#L138), [`lib/actions/invoices.ts`](file:///home/marcor/Projects/gestionale-fatture/lib/actions/invoices.ts)
- **Descrizione:**
  Nelle clausole `catch` delle Server Actions, gli errori di runtime vengono intercettati e registrati tramite semplici invocazioni di `console.error("updateUser error", error)`. In un contesto applicativo critico (gestione fatturazione e dati sanitari), l'assenza di un logger strutturato (con output JSON contenente `timestamp`, `userId`, `requestId` e stack trace serializzato) rende difficoltosa la correlazione degli incidenti in ambienti containerizzati e su piattaforme di log aggregation.
- **Soluzione consigliata:**
  Introdurre un logger centrale strutturato (es. basato su `pino` o `winston`) con arricchimento contestuale delle chiamate.

---

## Conclusioni e Roadmap di Bonifica Suggerita

1. **Sprint 1 (Sicurezza & Integrità Fiscale - Immediato)**:
   - Risoluzione immediata di `SEC-06` (CSRF header trust) e `SEC-09` (Formula Injection).
   - Allineamento delle regole di calcolo e validazione del bollo (`ARCH-06`, `ERR-07`, `SMELL-10`).
   - Correzione dei vincoli temporali nei filtri e nella cronologia (`ERR-05`, `ERR-06`).

2. **Sprint 2 (Robustezza & Session Management)**:
   - Atomicità nella gestione amministratori (`SEC-07`) e revoca immediata delle sessioni con `tokenVersion` (`SEC-08`).
   - Sblocco anagrafico per professionisti con CF e P.IVA concorrenti (`ARCH-07`).

3. **Sprint 3 (Refactoring Architetturale & DRY)**:
   - Estrazione helper di rollback (`DRY-05`) e componente modale paziente (`DRY-06`).
   - Conversione download ricevute TS in streaming HTTP Route Handler (`ARCH-08`).
