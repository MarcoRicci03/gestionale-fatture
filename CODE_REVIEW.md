# Code Review & Architecture Quality Assessment: Gestionale Fatture

**Ruolo:** Senior Software Architect  
**Repository:** `gestionale-fatture`  
**Stack tecnologico:** Next.js 16 (App Router), React 19, TypeScript 5, Tailwind CSS v4, Prisma ORM 7 + PostgreSQL (`@prisma/adapter-pg`), Vitest, Docker.

---

## Executive Summary & Matrice di Gravità

Il codebase presenta solide fondamenta ingegneristiche: adozione di Next.js 16 con la convenzione `proxy.ts`, suite di oltre 950 test unitari e di regressione architetturale (`scripts/verify-*.test.ts`), multi-tenancy a isolamento applicativo, crittografia a riposo (AES-256-GCM) per le credenziali ministeriali e sanitizzazione preventiva contro Formula Injection nei file Excel.

Tuttavia, l'analisi approfondita dell'intero repository ha evidenziato **vulnerabilità di disponibilità (DoS)**, **componenti monolitici ("God Components") con oltre 2.200 righe di codice**, **duplicazione strutturale estesa tra manager**, **parsing XML fragile basato su espressioni regolari** e **colli di bottiglia computazionali dovuti a letture I/O sincrone ripetute in cicli intensivi**.

I problemi identificati sono classificati rigorosamente in ordine decrescente di gravità (**Critico, Alto, Medio, Basso, Suggerimento**) all'interno di ciascuna delle 6 sezioni richieste.

| Livello di Gravità | Sicurezza | DRY / Duplicazione | Architettura | Performance | Error Handling | Code Smells | Totale |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Critico** | 1 | 0 | 0 | 0 | 0 | 0 | **1** |
| **Alto** | 1 | 1 | 2 | 1 | 1 | 0 | **6** |
| **Medio** | 2 | 2 | 1 | 2 | 1 | 1 | **9** |
| **Basso** | 1 | 1 | 1 | 1 | 1 | 3 | **8** |
| **Suggerimento** | 0 | 0 | 0 | 0 | 0 | 1 | **1** |
| **Totale** | **5** | **4** | **4** | **4** | **3** | **5** | **25** |

### Registro Generale dei Problemi e Identificativi

| ID | Gravità | Categoria | Titolo Sintetico | Stato | Dettagli Risoluzione / Note |
| :--- | :--- | :--- | :--- | :---: | :--- |
| [`SEC-01`](#sec-01) | **Critico** | Sicurezza e Vulnerabilità | Denial of Service & Container Crash-Loop tramite Healthcheck Starvation | ✅ RISOLTO | Branch `fix/healthcheck-dos-starvation` (commit `af85c7b`) |
| [`SEC-02`](#sec-02) | **Alto** | Sicurezza e Vulnerabilità | Troncamento silenzioso a 72 byte di bcryptjs e potenziale Lockout da disallineamento schemi password | ⏳ DA RISOLVERE | - |
| [`SEC-03`](#sec-03) | **Medio** | Sicurezza e Vulnerabilità | Spoofing IP ed evasione lockout tramite primo elemento di `X-Forwarded-For` | ⏳ DA RISOLVERE | - |
| [`SEC-04`](#sec-04) | **Medio** | Sicurezza e Vulnerabilità | Memory Leak potenziale per assenza di tetto massimo in `createRateLimiter` | ⏳ DA RISOLVERE | - |
| [`SEC-05`](#sec-05) | **Basso** | Sicurezza e Vulnerabilità | Assenza di versioning della chiave di cifratura delle credenziali TS (Key Rotation Risk) | ⏳ DA RISOLVERE | - |
| [`DRY-01`](#dry-01) | **Alto** | Duplicazione e Principi DRY | Duplicazione strutturale estesa tra `patients-manager.tsx` e `payers-manager.tsx` | ⏳ DA RISOLVERE | - |
| [`DRY-02`](#dry-02) | **Medio** | Duplicazione e Principi DRY | Duplicazione completa del componente `PayerDetailDialog` | ⏳ DA RISOLVERE | - |
| [`DRY-03`](#dry-03) | **Medio** | Duplicazione e Principi DRY | Serializzazione ripetuta dei campi Decimal di Prisma | ⏳ DA RISOLVERE | - |
| [`DRY-04`](#dry-04) | **Basso** | Duplicazione e Principi DRY | Query duplicata e incoerente tra `getPdfSettings` e `getPdfSettingsForUser` | ⏳ DA RISOLVERE | - |
| [`ARCH-01`](#arch-01) | **Alto** | Architettura, Manutenibilità e Modularità | Monolite Client Component: `sistema-ts-manager.tsx` (2.243 righe di codice) | ⏳ DA RISOLVERE | - |
| [`ARCH-02`](#arch-02) | **Alto** | Architettura, Manutenibilità e Modularità | Accoppiamento e complessità monolitica in `lib/actions/sistema-ts.ts` | ⏳ DA RISOLVERE | - |
| [`ARCH-03`](#arch-03) | **Medio** | Architettura, Manutenibilità e Modularità | Disallineamento nei contratti di ritorno delle Server Actions (`ActionState`) | ⏳ DA RISOLVERE | - |
| [`ARCH-04`](#arch-04) | **Basso** | Architettura, Manutenibilità e Modularità | Docker CMD non esegue il replacement del processo (Assenza di `exec`) | ⏳ DA RISOLVERE | - |
| [`PERF-01`](#perf-01) | **Alto** | Performance ed Efficienza | I/O sincrono e parsing X.509 ripetuto su ogni documento nel loop di trasmissione TS | ⏳ DA RISOLVERE | - |
| [`PERF-02`](#perf-02) | **Medio** | Performance ed Efficienza | Pattern N+1 Query nella propagazione dell'anagrafica alle bozze di fattura | ⏳ DA RISOLVERE | - |
| [`PERF-03`](#perf-03) | **Medio** | Performance ed Efficienza | Caricamento non paginato di tutti i paganti attivi nella vista archiviati | ⏳ DA RISOLVERE | - |
| [`PERF-04`](#perf-04) | **Basso** | Performance ed Efficienza | Ordinamento non deterministico in `getLatestInvoices` per assenza di Tie-Breaker | ⏳ DA RISOLVERE | - |
| [`ERR-01`](#err-01) | **Alto** | Error Handling e Robustezza | Parsing XML delle risposte SOAP tramite Regular Expression | ⏳ DA RISOLVERE | - |
| [`ERR-02`](#err-02) | **Medio** | Error Handling e Robustezza | Race Condition (TOCTOU) su cancellazione definitiva Pagante/Paziente | ⏳ DA RISOLVERE | - |
| [`ERR-03`](#err-03) | **Basso** | Error Handling e Robustezza | Rischio di Date-Drift nel calcolo della retention mensile in `audit-log-retention.mjs` | ⏳ DA RISOLVERE | - |
| [`SMELL-01`](#smell-01) | **Medio** | Code Smells e Naming Conventions | Rottura del comando `npm run lint` per mancata esclusione di `postgres_dev_data` | ⏳ DA RISOLVERE | - |
| [`SMELL-02`](#smell-02) | **Basso** | Code Smells e Naming Conventions | Utilizzo della proprietà CSS non standard `zoom` nel Canvas PDF Editor | ⏳ DA RISOLVERE | - |
| [`SMELL-03`](#smell-03) | **Basso** | Code Smells e Naming Conventions | Valore sentinella fittizio `id: 0` in `getPdfSettings` (Rilievo QUA-03) | ⏳ DA RISOLVERE | - |
| [`SMELL-04`](#smell-04) | **Basso** | Code Smells e Naming Conventions | Riferimenti a documentazione non presente nel repository (Rilievo DOC-01) | ⏳ DA RISOLVERE | - |
| [`SMELL-05`](#smell-05) | **Suggerimento** | Code Smells e Naming Conventions | Posizionamento incoerente di `getPayersForSelect` in `patients.ts` | ⏳ DA RISOLVERE | - |

---

## 1. Problemi di Sicurezza e Vulnerabilità

<a id="sec-01"></a>
### [SEC-01] [Critico] Denial of Service & Container Crash-Loop tramite Healthcheck Starvation
- **Identificativo:** `SEC-01`
- **Gravità:** `Critico`
- **Categoria:** Sicurezza e Vulnerabilità
- **Stato:** ✅ RISOLTO — Branch `fix/healthcheck-dos-starvation` (commit `af85c7b`)
- **Posizione:** [`app/api/health/route.ts:18-40`](file:///home/marcor/Projects/gestionale-fatture/app/api/health/route.ts#L18-L40) e [`docker-compose.prod.yml:54-59`](file:///home/marcor/Projects/gestionale-fatture/docker-compose.prod.yml#L54-L59)
- **Descrizione:** La route pubblica di liveness/readiness `/api/health` è protetta da un rate limiter in memoria di processo (`healthCheckLimiter`) configurato con `maxRequests: 30` su finestra di 1 minuto, basato sulla chiave IP restituita da `getClientIp()`.
  1. Quando `TRUSTED_PROXY=false` (il default sicuro) o quando la richiesta non proviene da Cloudflare Tunnel, l'IP del client viene risolto con il valore sentinella `"unknown"`.
  2. L'healthcheck periodico del container Docker eseguito ogni 10 secondi tramite `wget -q -O- http://127.0.0.1:3000/api/health` effettua una chiamata locale HTTP senza header `cf-connecting-ip` o `x-forwarded-for`, ricadendo **esattamente nello stesso bucket `"unknown"`**.
  3. Un client non autenticato su internet può inviare 30 richieste consecutive all'endpoint pubblico `/api/health` consumando l'intero budget del minuto. Da quel momento, il check locale interno di Docker riceve `HTTP 429 Too Many Requests`. Il comando `wget` fallisce (exit code 8) e, dopo 5 tentativi consecutivi (50 secondi), il demone Docker dichiara il container `unhealthy` forzandone il riavvio. L'attaccante può provocare un crash-loop continuo dell'applicazione con un volume di traffico irrisorio.
- **Soluzione consigliata:**
  Esentare esplicitamente le chiamate provenienti da loopback (`127.0.0.1`, `::1` o porta interna) dal rate limiting, oppure verificare l'origine locale prima di consumare il token:
  ```typescript
  // app/api/health/route.ts
  import { headers } from "next/headers";

  export async function GET(request: Request) {
    const headersList = await headers();
    const host = headersList.get("host") || "";
    const isLocalhost = host.startsWith("localhost:") || host.startsWith("127.0.0.1:");

    if (!isLocalhost) {
      const clientIp = await getClientIp();
      const rateLimit = healthCheckLimiter.consume(clientIp);
      if (!rateLimit.allowed) {
        return Response.json(
          { status: "error" },
          { status: 429, headers: rateLimit.retryAfterSeconds ? { "Retry-After": String(rateLimit.retryAfterSeconds) } : undefined }
        );
      }
    }

    try {
      await prisma.$queryRaw`SELECT 1`;
      return Response.json({ status: "ok" }, { status: 200 });
    } catch {
      return Response.json({ status: "error" }, { status: 503 });
    }
  }
  ```

---

<a id="sec-02"></a>
### [SEC-02] [Alto] Troncamento silenzioso a 72 byte di bcryptjs e potenziale Lockout da disallineamento schemi password
- **Identificativo:** `SEC-02`
- **Gravità:** `Alto`
- **Categoria:** Sicurezza e Vulnerabilità
- **Stato:** ⏳ DA RISOLVERE
- **Posizione:** [`lib/validations/user.ts:18-23`](file:///home/marcor/Projects/gestionale-fatture/lib/validations/user.ts#L18-L23), [`lib/actions/auth.ts:43-45`](file:///home/marcor/Projects/gestionale-fatture/lib/actions/auth.ts#L43-L45) e [`lib/auth/password.ts:1-13`](file:///home/marcor/Projects/gestionale-fatture/lib/auth/password.ts#L1-L13)
- **Descrizione:**
  1. `passwordSchema` impone un vincolo di lunghezza minima `.min(12)` e il controllo sui pattern deboli, ma **non definisce alcun limite superiore `.max()`**.
  2. L'algoritmo standard bcrypt (implementato tramite il package `bcryptjs`) presenta un limite architetturale di **72 byte** sul segreto: qualsiasi carattere oltre il 72-esimo byte viene ignorato durante il calcolo dell'hash. Due password che condividono i primi 72 byte risulteranno identiche per `bcrypt.compare`, compromettendo l'aspettativa di entropia.
  3. In fase di login ([`lib/actions/auth.ts:43`](file:///home/marcor/Projects/gestionale-fatture/lib/actions/auth.ts#L43)), è presente un controllo cablato:
     `if (username.length > 50 || password.length > 100) return { error: "Input non valido" };`
     Se un amministratore crea un utente o un utente imposta una password di oltre 100 caratteri (ammessa da `passwordSchema`), al momento del login l'utente verrà respinto con `"Input non valido"`, rimanendo bloccato fuori dall'account senza comprenderne il motivo.
- **Soluzione consigliata:**
  Allineare la validazione Zod imponendo il limite massimo standard di 72 byte sia alla creazione/cambio password che in fase di login:
  ```typescript
  // lib/validations/user.ts
  export const passwordSchema = z
    .string()
    .min(12, "La password deve avere almeno 12 caratteri")
    .max(72, "La password non può superare 72 caratteri (limite crittografico bcrypt)")
    .refine((value) => !isCommonWeakPassword(value), {
      message: "Questa password è troppo comune, scegline una più sicura",
    });
  ```

---

<a id="sec-03"></a>
### [SEC-03] [Medio] Spoofing IP ed evasione lockout tramite primo elemento di `X-Forwarded-For`
- **Identificativo:** `SEC-03`
- **Gravità:** `Medio`
- **Categoria:** Sicurezza e Vulnerabilità
- **Stato:** ⏳ DA RISOLVERE
- **Posizione:** [`lib/auth/client-ip.ts:36-40`](file:///home/marcor/Projects/gestionale-fatture/lib/auth/client-ip.ts#L36-L40)
- **Descrizione:** In `parseClientIpFromHeaders`, se `CF-Connecting-IP` è assente e `TRUSTED_PROXY=true` è configurato, il codice estrae l'IP con:
  `const first = forwardedFor.split(",")[0]?.trim();`
  Come documentato nei commenti stessi del file, proxy come NGINX (`$proxy_add_x_forwarded_for`) accodano l'IP reale in coda alla catena. Se un client malevolo invia un header contraffatto `X-Forwarded-For: 1.2.3.4`, questo valore compare all'indice `[0]` e viene erroneamente identificato come l'IP del client. Ciò consente a un attaccante di:
  - Aggirare il rate limiting per-IP variando l'header ad ogni richiesta.
  - Causare un DoS selettivo (lockout) ai danni di un IP specifico facendolo bloccare intenzionalmente dopo 5 tentativi errati.
- **Soluzione consigliata:**
  In ambienti con proxy a catena che accodano, leggere l'ultimo elemento fidato o configurare esplicitamente il numero di hop:
  ```typescript
  // lib/auth/client-ip.ts
  const parts = forwardedFor.split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length > 0) {
    // Se c'è un solo proxy fidato davanti all'app, l'IP del client è il penultimo o l'ultimo fornito dal proxy
    const clientIp = parts[parts.length - 1];
    if (clientIp) return clientIp;
  }
  ```

---

<a id="sec-04"></a>
### [SEC-04] [Medio] Memory Leak potenziale per assenza di tetto massimo in `createRateLimiter`
- **Identificativo:** `SEC-04`
- **Gravità:** `Medio`
- **Categoria:** Sicurezza e Vulnerabilità
- **Stato:** ⏳ DA RISOLVERE
- **Posizione:** [`lib/auth/rate-limiter.ts:27-40`](file:///home/marcor/Projects/gestionale-fatture/lib/auth/rate-limiter.ts#L27-L40)
- **Descrizione:** A differenza di [`lib/auth/rate-limit.ts`](file:///home/marcor/Projects/gestionale-fatture/lib/auth/rate-limit.ts#L17) (che implementa `MAX_ENTRIES_PER_MAP = 10_000` con espulsione LRU e sweep temporizzato), l'istanza generica `createRateLimiter` mantiene una `Map<string, WindowRecord>` senza alcun limite di cardinalità massima. La rimozione delle chiavi scadute si affida esclusivamente a uno sweep probabilistico all'1% (`Math.random() < 0.01`). Sotto attacco o con endpoint interrogati con parametri/chiavi arbitrarie, la `Map` cresce senza vincoli consumando la memoria del processo Node.js.
- **Soluzione consigliata:**
  Aggiungere un limite massimo di elementi (`maxEntries`) con eviction automatica del record più vecchio:
  ```typescript
  // lib/auth/rate-limiter.ts
  export function createRateLimiter(options: {
    maxRequests: number;
    windowMs: number;
    maxEntries?: number;
  }): RateLimiter {
    const { maxRequests, windowMs, maxEntries = 5000 } = options;
    const records = new Map<string, WindowRecord>();

    return {
      consume(key: string): RateLimitResult {
        const now = Date.now();
        // Eviction se superata la capacità massima
        if (records.size >= maxEntries && !records.has(key)) {
          const oldestKey = records.keys().next().value;
          if (oldestKey !== undefined) records.delete(oldestKey);
        }
        // ... logica di finestra ...
      }
    };
  }
  ```

---

<a id="sec-05"></a>
### [SEC-05] [Basso] Assenza di versioning della chiave di cifratura delle credenziali TS (Key Rotation Risk)
- **Identificativo:** `SEC-05`
- **Gravità:** `Basso`
- **Categoria:** Sicurezza e Vulnerabilità
- **Stato:** ⏳ DA RISOLVERE
- **Posizione:** [`lib/sistemats/vault.ts:58-103`](file:///home/marcor/Projects/gestionale-fatture/lib/sistemats/vault.ts#L58-L103)
- **Descrizione:** Le credenziali di Sistema TS (Password e PinCode) vengono cifrate con AES-256-GCM nel formato stringa `iv:authTag:ciphertext`. Non è previsto un prefisso di versione della chiave crittografica (`keyId` o `v1`). In caso di rotazione periodica della variabile d'ambiente `TS_ENCRYPTION_SECRET` (ad esempio in seguito a sospetta compromissione o audit di sicurezza), tutti i dati precedentemente memorizzati sul DB falliranno immediatamente la decifratura con eccezione non recuperabile, senza possibilità di migrazione automatizzata a doppio round.
- **Soluzione consigliata:**
  Salvare il prefisso della chiave nel ciphertext (es. `v1:iv:tag:data`) e consentire al modulo `vault.ts` di accettare una chiave primaria per la cifratura e chiavi secondarie di fallback per la decifratura e ri-cifratura immediata.

---

## 2. Duplicazione del Codice e Principi DRY

<a id="dry-01"></a>
### [DRY-01] [Alto] Duplicazione strutturale estesa tra `patients-manager.tsx` e `payers-manager.tsx`
- **Identificativo:** `DRY-01`
- **Gravità:** `Alto`
- **Categoria:** Duplicazione e Principi DRY
- **Stato:** ⏳ DA RISOLVERE
- **Posizione:** [`components/patients/patients-manager.tsx:49-74, 224-348, 372-477`](file:///home/marcor/Projects/gestionale-fatture/components/patients/patients-manager.tsx#L49-L74) e [`components/payers/payers-manager.tsx:47-74, 224-348, 372-490`](file:///home/marcor/Projects/gestionale-fatture/components/payers/payers-manager.tsx#L47-L74)
- **Descrizione:** Oltre 350 righe di logica UI e business presentation sono clonate quasi identiche tra i due componenti:
  1. `formatCurrency` e `invoiceImpactLabel` sono identiche al 100%.
  2. La logica di navigazione con `latestListStateRef`, gestione parametri `q`, `page`, `archivedPage`, `pageSize` e push tramite `router.replace` è un copia-incolla esatto.
  3. Il blocco di rendering duale responsive (Tabella Desktop `hidden md:block` e Lista Card Mobile `md:hidden`) replica la medesima struttura di bottoni, checkbox di selezione e messaggi di blocco.
- **Soluzione consigliata:**
  1. Estrarre le funzioni di calcolo e formattazione dell'impatto archivio in un file comune [`lib/archive/formatting.ts`](file:///home/marcor/Projects/gestionale-fatture/lib/archive):
     ```typescript
     // lib/archive/formatting.ts
     export function formatArchiveInvoiceImpact(
       count: number,
       totale: number,
       annoMin: number | null,
       annoMax: number | null
     ): string | null {
       if (count === 0) return null;
       const years = annoMin === annoMax ? `${annoMin}` : `${annoMin}-${annoMax}`;
       const plural = count === 1 ? "" : "e";
       return `${count} fattura${plural} collegata${plural} (${years}, ${formatCurrency(totale)})`;
     }
     ```
  2. Astrarre la sincronizzazione dei parametri di paginazione/ricerca in un hook riutilizzabile `useArchivePagination()`.

---

<a id="dry-02"></a>
### [DRY-02] [Medio] Duplicazione completa del componente `PayerDetailDialog`
- **Identificativo:** `DRY-02`
- **Gravità:** `Medio`
- **Categoria:** Duplicazione e Principi DRY
- **Stato:** ⏳ DA RISOLVERE
- **Posizione:** [`components/patients/patients-manager.tsx:588-630`](file:///home/marcor/Projects/gestionale-fatture/components/patients/patients-manager.tsx#L588-L630) e [`components/invoices/payer-detail-dialog.tsx:1-61`](file:///home/marcor/Projects/gestionale-fatture/components/invoices/payer-detail-dialog.tsx#L1-L61)
- **Descrizione:** All'interno di `patients-manager.tsx`, alle righe 588-630 è definita inline una finestra di dialogo completa di 42 righe per visualizzare i dettagli del pagante collegato (Nome, Cognome, Indirizzo, CF, Partita IVA). Il progetto dispone già di un componente isolato e collaudato con i relativi test unitari: [`components/invoices/payer-detail-dialog.tsx`](file:///home/marcor/Projects/gestionale-fatture/components/invoices/payer-detail-dialog.tsx).
- **Soluzione consigliata:**
  Eliminare il blocco modale inline in `patients-manager.tsx` e importare il componente esistente (eventualmente spostandolo sotto `components/shared/` o `components/payers/` per chiarezza di dominio):
  ```tsx
  // components/patients/patients-manager.tsx
  import { PayerDetailDialog } from "@/components/invoices/payer-detail-dialog";

  // Nel JSX:
  <PayerDetailDialog
    payer={viewingPayer}
    onOpenChange={(isOpen) => !isOpen && setViewingPayer(null)}
  />
  ```

---

<a id="dry-03"></a>
### [DRY-03] [Medio] Serializzazione ripetuta dei campi Decimal di Prisma
- **Identificativo:** `DRY-03`
- **Gravità:** `Medio`
- **Categoria:** Duplicazione e Principi DRY
- **Stato:** ⏳ DA RISOLVERE
- **Posizione:** [`lib/data/invoices.ts:64-69, 114-119, 252-257`](file:///home/marcor/Projects/gestionale-fatture/lib/data/invoices.ts#L64-L69) e [`app/api/invoices/export/route.ts:93-97`](file:///home/marcor/Projects/gestionale-fatture/app/api/invoices/export/route.ts#L93-L97)
- **Descrizione:** In 4 punti diversi del codebase viene ripetuto lo stesso mapping per convertire gli oggetti `Decimal` di Prisma nei corrispondenti `number` nativi JavaScript per prevenire errori di serializzazione Server-Client:
  ```typescript
  prezzo_totale: invoice.prezzo_totale.toNumber(),
  bollo: invoice.bollo ? invoice.bollo.toNumber() : 0,
  mesi: invoice.mesi.map((m) => ({ ...m, prezzo: m.prezzo.toNumber() })),
  ```
- **Soluzione consigliata:**
  Centralizzare la trasformazione in una funzione helper fortemente tipizzata in `lib/invoices/serialize.ts`:
  ```typescript
  // lib/invoices/serialize.ts
  export function serializeInvoiceNumbers<T extends {
    prezzo_totale: Prisma.Decimal;
    bollo?: Prisma.Decimal | null;
    mesi?: Array<{ prezzo: Prisma.Decimal; [k: string]: unknown }>;
  }>(invoice: T) {
    return {
      ...invoice,
      prezzo_totale: invoice.prezzo_totale.toNumber(),
      bollo: invoice.bollo ? invoice.bollo.toNumber() : 0,
      mesi: invoice.mesi ? invoice.mesi.map((m) => ({ ...m, prezzo: m.prezzo.toNumber() })) : [],
    };
  }
  ```

---

<a id="dry-04"></a>
### [DRY-04] [Basso] Query duplicata e incoerente tra `getPdfSettings` e `getPdfSettingsForUser`
- **Identificativo:** `DRY-04`
- **Gravità:** `Basso`
- **Categoria:** Duplicazione e Principi DRY
- **Stato:** ⏳ DA RISOLVERE
- **Posizione:** [`lib/data/settings.ts:17-35`](file:///home/marcor/Projects/gestionale-fatture/lib/data/settings.ts#L17-L35) e [`lib/data/settings.ts:75-88`](file:///home/marcor/Projects/gestionale-fatture/lib/data/settings.ts#L75-L88)
- **Descrizione:** Entrambe le funzioni interrogano la tabella `impostazioniPdf` per lo stesso utente. `getPdfSettingsForUser` sfrutta la cache React (`cache()`) e restituisce `PdfLayout`, mentre `getPdfSettings` esegue una query diretta non memorizzata e restituisce `ImpostazioniPdf` con campi sintetici di default.
- **Soluzione consigliata:**
  Unificare la logica di accesso ai dati facendo delegare `getPdfSettings` alla funzione memorizzata `getPdfSettingsForUser`.

---

## 3. Architettura, Manutenibilità e Modularità

<a id="arch-01"></a>
### [ARCH-01] [Alto] Monolite Client Component: `sistema-ts-manager.tsx` (2.243 righe di codice)
- **Identificativo:** `ARCH-01`
- **Gravità:** `Alto`
- **Categoria:** Architettura, Manutenibilità e Modularità
- **Stato:** ⏳ DA RISOLVERE
- **Posizione:** [`components/sistema-ts/sistema-ts-manager.tsx`](file:///home/marcor/Projects/gestionale-fatture/components/sistema-ts/sistema-ts-manager.tsx) (2.243 righe, 105 KB)
- **Descrizione:** Il componente `SistemaTsManager` rappresenta un classico "God Component" che concentra un carico di responsabilità eccessivo in un unico file client:
  - Gestione filtri, ordinamento e selezione per il lotto fatture.
  - Gestione filtri, ricerca testuale per protocollo/paziente ed espansione righe per lo storico trasmissioni.
  - Dialog modale di conferma invio batch con riepilogo importi e conteggio anomalie.
  - Dialog modale di annullamento trasmissione con form a 3 campi vincolanti (numero, data, intestatario).
  - Dialog modale per l'ispezione degli errori CSV Sogei (con toggle tra vista tabellare analitica e testo RAW).
  - Dialog di correzione rapida e propagazione dati fiscali.
  Questo accumulo genera un bundle client sovradimensionato, rende la manutenzione ad altissimo rischio di regressioni e impedisce test di integrazione mirati sui singoli flussi utente.
- **Soluzione consigliata:**
  Decomporre il file in moduli focalizzati:
  1. `components/sistema-ts/tabs/lotti-table.tsx`
  2. `components/sistema-ts/tabs/storico-table.tsx`
  3. `components/sistema-ts/dialogs/annulla-ts-dialog.tsx`
  4. `components/sistema-ts/dialogs/csv-report-dialog.tsx`
  5. `components/sistema-ts/hooks/use-sistema-ts-filters.ts`

---

<a id="arch-02"></a>
### [ARCH-02] [Alto] Accoppiamento e complessità monolitica in `lib/actions/sistema-ts.ts`
- **Identificativo:** `ARCH-02`
- **Gravità:** `Alto`
- **Categoria:** Architettura, Manutenibilità e Modularità
- **Stato:** ⏳ DA RISOLVERE
- **Posizione:** [`lib/actions/sistema-ts.ts:1-1216`](file:///home/marcor/Projects/gestionale-fatture/lib/actions/sistema-ts.ts#L1-L1216) (1.216 righe)
- **Descrizione:** Il modulo raccoglie in un unico file `"use server"`:
  - Gestione impostazioni e crittografia credenziali.
  - Acquisizione del lock di concorrenza e rollback transazionale.
  - Costruzione dell'archivio ZIP e chiamata di rete SOAP MTOM.
  - Logica di riconciliazione esiti con parser errori CSV e riassegnazione automatica stati (`DA_INVIARE`, `INVIATA`, `ANNULLATA_TS`).
  - Annullamento sincrono e correzione anagrafica con propagazione a cascata sulle bozze.
  La logica di dominio (business logic) è strettamente intrecciata con le chiamate al database Prisma, le chiamate HTTP esterne e le API di caching di Next.js (`revalidatePath`).
- **Soluzione consigliata:**
  Estrarre la logica di dominio in un layer di servizio disaccoppiato da Next.js:
  - `lib/sistemats/services/transmission.service.ts` (orchestrazione lock, build payload e chiamata SOAP).
  - `lib/sistemats/services/reconciliation.service.ts` (interpretazione codici Sogei e aggiornamento stati DB).
  Le Server Action in `lib/actions/sistema-ts.ts` dovranno limitarsi ad autenticare l'utente (`requireUserId`), validare l'input con Zod e delegare al service.

---

<a id="arch-03"></a>
### [ARCH-03] [Medio] Disallineamento nei contratti di ritorno delle Server Actions (`ActionState`)
- **Identificativo:** `ARCH-03`
- **Gravità:** `Medio`
- **Categoria:** Architettura, Manutenibilità e Modularità
- **Stato:** ⏳ DA RISOLVERE
- **Posizione:** [`lib/actions/invoices.ts:44`](file:///home/marcor/Projects/gestionale-fatture/lib/actions/invoices.ts#L44), [`lib/actions/settings.ts:12`](file:///home/marcor/Projects/gestionale-fatture/lib/actions/settings.ts#L12), [`lib/actions/sistema-ts.ts:37-40`](file:///home/marcor/Projects/gestionale-fatture/lib/actions/sistema-ts.ts#L37-L40), [`lib/actions/auth.ts:21-23`](file:///home/marcor/Projects/gestionale-fatture/lib/actions/auth.ts#L21-L23)
- **Descrizione:** Ogni modulo di mutazione definisce la propria variante di stato dell'azione con convenzioni differenti:
  - `InvoiceActionState`: `{ success: true } | { error: string }`
  - `PdfSettingsActionState`: `{ success: true } | { success: false; error: string }`
  - `SistemaTsActionState`: `{ success: true; ... } | { error: string; fallback?: boolean }`
  - `LoginState`: `{ error?: string }`
  Questa asimmetria impedisce l'adozione di un pattern comune lato UI per la gestione dei toast, la disabilitazione degli stati di caricamento e la gestione unificata dei messaggi di errore nei form.
- **Soluzione consigliata:**
  Adottare un tipo discriminated union standard in tutto il progetto:
  ```typescript
  // lib/types/actions.ts
  export type ActionSuccess<T = void> = T extends void
    ? { success: true; message?: string }
    : { success: true; data: T; message?: string };

  export type ActionFailure = {
    success: false;
    error: string;
    fieldErrors?: Record<string, string[]>;
  };

  export type ActionResult<T = void> = ActionSuccess<T> | ActionFailure;
  ```

---

<a id="arch-04"></a>
### [ARCH-04] [Basso] Docker CMD non esegue il replacement del processo (Assenza di `exec`)
- **Identificativo:** `ARCH-04`
- **Gravità:** `Basso`
- **Categoria:** Architettura, Manutenibilità e Modularità
- **Stato:** ⏳ DA RISOLVERE
- **Posizione:** [`Dockerfile:102`](file:///home/marcor/Projects/gestionale-fatture/Dockerfile#L102)
- **Descrizione:** La direttiva finale del container di produzione è:
  `CMD ["sh", "-c", "npx prisma migrate deploy && node server.js"]`
  Quando il comando viene lanciato in questo modo, il processo con PID 1 all'interno del container rimane la shell `/bin/sh`. Quando Docker o l'orchestratore invia un segnale `SIGTERM` durante lo stop del container, `sh` non propaga automaticamente il segnale al processo figlio `node server.js`. Ne consegue che la logica di chiusura controllata delle connessioni implementata in [`lib/prisma.ts:54-62`](file:///home/marcor/Projects/gestionale-fatture/lib/prisma.ts#L54-L62) non viene eseguita, provocando la terminazione forzata (`SIGKILL`) dopo il grace period di default (10s).
- **Soluzione consigliata:**
  Utilizzare il comando `exec` di shell per rimpiazzare il processo shell con il processo Node:
  ```dockerfile
  # Dockerfile
  CMD ["sh", "-c", "npx prisma migrate deploy && exec node server.js"]
  ```

---

## 4. Performance ed Efficienza

<a id="perf-01"></a>
### [PERF-01] [Alto] I/O sincrono e parsing X.509 ripetuto su ogni documento nel loop di trasmissione TS
- **Identificativo:** `PERF-01`
- **Gravità:** `Alto`
- **Categoria:** Performance ed Efficienza
- **Stato:** ⏳ DA RISOLVERE
- **Posizione:** [`lib/sistemats/crypto.ts:11-25`](file:///home/marcor/Projects/gestionale-fatture/lib/sistemats/crypto.ts#L11-L25) e [`lib/sistemats/xml-builder.ts:60, 90`](file:///home/marcor/Projects/gestionale-fatture/lib/sistemats/xml-builder.ts#L60)
- **Descrizione:** Durante la composizione dell'XML per il Sistema TS (`buildSistemaTsXml`), per ogni singola fattura priva di opposizione viene cifrato il Codice Fiscale del cittadino tramite `encryptRsaPkcs1`. Tale funzione richiama `loadPublicKeyFromCert()`, che esegue in maniera sincrona:
  1. `fs.existsSync(targetPath)`
  2. `fs.readFileSync(targetPath)`
  3. `new crypto.X509Certificate(certBytes)`
  In una trasmissione cumulativa di fine anno (es. 250 fatture), il file del certificato `SanitelCF.cer` viene letto dal file system e analizzato **251 volte consecutive** all'interno del thread principale di Node.js, causando un picco di latenza CPU/IO e ritardando l'invio della risposta.
- **Soluzione consigliata:**
  Memoizzare la chiave pubblica X.509 in un singleton in memoria di processo al primo caricamento:
  ```typescript
  // lib/sistemats/crypto.ts
  let cachedPublicKey: crypto.KeyObject | null = null;
  let cachedCertPath: string | null = null;

  export function loadPublicKeyFromCert(certPath?: string): crypto.KeyObject {
    const targetPath = certPath || (fs.existsSync(DEFAULT_CERT_PATH) ? DEFAULT_CERT_PATH : MOCK_CERT_PATH);

    if (cachedPublicKey && cachedCertPath === targetPath) {
      return cachedPublicKey;
    }

    if (!fs.existsSync(targetPath)) {
      throw new Error(`Certificato X.509 non trovato al percorso: ${targetPath}`);
    }

    const certBytes = fs.readFileSync(targetPath);
    const cert = new crypto.X509Certificate(certBytes);
    cachedPublicKey = cert.publicKey;
    cachedCertPath = targetPath;
    return cachedPublicKey;
  }
  ```

---

<a id="perf-02"></a>
### [PERF-02] [Medio] Pattern N+1 Query nella propagazione dell'anagrafica alle bozze di fattura
- **Identificativo:** `PERF-02`
- **Gravità:** `Medio`
- **Categoria:** Performance ed Efficienza
- **Stato:** ⏳ DA RISOLVERE
- **Posizione:** [`lib/actions/payers.ts:155-176`](file:///home/marcor/Projects/gestionale-fatture/lib/actions/payers.ts#L155-L176) e [`lib/actions/sistema-ts.ts:1161-1176`](file:///home/marcor/Projects/gestionale-fatture/lib/actions/sistema-ts.ts#L1161-L1176)
- **Descrizione:** Quando l'utente aggiorna i dati di un pagante (o corregge un Codice Fiscale da Sistema TS) con l'opzione `propagaFattureInAttesa: true`, il codice esegue un `findMany` per recuperare tutte le bozze `DA_INVIARE`, e poi itera con un ciclo sequenziale `for (const draft of drafts)` eseguendo un singolo statement `await tx.pagamento.update(...)` per ciascuna fattura all'interno della transazione interattiva. Se il cliente ha decine di prestazioni in sospeso, la transazione rimane aperta a lungo in attesa di multipli round-trip di rete verso PostgreSQL, aumentando il rischio di lock contention.
- **Soluzione consigliata:**
  Eseguire gli aggiornamenti concorrenzialmente tramite `Promise.all` all'interno della transazione per saturare il pool di query:
  ```typescript
  // lib/actions/payers.ts
  await Promise.all(
    drafts.map((draft) => {
      const snap = resolveAnagrafica(draft);
      const newSnap = {
        ...snap,
        pagante: {
          ...snap.pagante,
          nome: parsed.data.nome,
          cognome: parsed.data.cognome,
          via: parsed.data.via,
          citta: parsed.data.citta,
          cap: parsed.data.cap,
          cf: parsed.data.cf ?? null,
          piva: parsed.data.piva ?? null,
        },
      };
      return tx.pagamento.update({
        where: { id: draft.id },
        data: { snapshotAnagrafica: newSnap as unknown as Prisma.InputJsonValue },
      });
    })
  );
  ```

---

<a id="perf-03"></a>
### [PERF-03] [Medio] Caricamento non paginato di tutti i paganti attivi nella vista archiviati
- **Identificativo:** `PERF-03`
- **Gravità:** `Medio`
- **Categoria:** Performance ed Efficienza
- **Stato:** ⏳ DA RISOLVERE
- **Posizione:** [`lib/data/payers.ts:85-88`](file:///home/marcor/Projects/gestionale-fatture/lib/data/payers.ts#L85-L88)
- **Descrizione:** In `getArchivedPayers`, a ogni richiesta di pagina della sezione "Archiviati" (anche per soli 20 record visualizzati), viene eseguita la query:
  ```typescript
  prisma.pagante.findMany({
    where: { id_Utente: userId, archiviato: false },
    select: { id: true, cf: true, piva: true },
  });
  ```
  Tale operazione carica in memoria l'intero parco clienti attivi dello studio per alimentare il controllo client-side `findRestoreConflict`. Con la crescita dell'anagrafica nel tempo, questa query alloca memoria non necessaria ad ogni cambio pagina o ricerca sugli archiviati.
- **Soluzione consigliata:**
  Filtrare lato database verificando l'esistenza di conflitti solo per i CF e le P.IVA dei record presenti nella pagina corrente:
  ```typescript
  // lib/data/payers.ts
  const pageCfs = effectivePayers.map((p) => p.cf).filter((cf): cf is string => Boolean(cf));
  const pagePivas = effectivePayers.map((p) => p.piva).filter((p): p is string => Boolean(p));

  const conflictingActivePayers = await prisma.pagante.findMany({
    where: {
      id_Utente: userId,
      archiviato: false,
      OR: [
        ...(pageCfs.length > 0 ? [{ cf: { in: pageCfs } }] : []),
        ...(pagePivas.length > 0 ? [{ piva: { in: pagePivas } }] : []),
      ],
    },
    select: { id: true, cf: true, piva: true },
  });
  ```

---

<a id="perf-04"></a>
### [PERF-04] [Basso] Ordinamento non deterministico in `getLatestInvoices` per assenza di Tie-Breaker
- **Identificativo:** `PERF-04`
- **Gravità:** `Basso`
- **Categoria:** Performance ed Efficienza
- **Stato:** ⏳ DA RISOLVERE
- **Posizione:** [`lib/data/invoices.ts:249`](file:///home/marcor/Projects/gestionale-fatture/lib/data/invoices.ts#L249)
- **Descrizione:** In `findInvoicesPage` l'ordinamento è configurato come `orderBy: [{ data: "desc" }, { id: "desc" }]` per assicurare stabilità in caso di fatture emesse nella stessa data. In `getLatestInvoices` (utilizzato dalla dashboard) l'ordinamento è invece impostato unicamente su `orderBy: { data: "desc" }`. Poiché PostgreSQL non garantisce l'ordine tra tuple con valori identici di `data`, l'elenco delle fatture recenti può mutare ordine arbitrariamente tra reload successivi.
- **Soluzione consigliata:**
  Uniformare aggiungendo `id: "desc"` come secondo criterio di ordinamento.

---

## 5. Error Handling e Robustezza

<a id="err-01"></a>
### [ERR-01] [Alto] Parsing XML delle risposte SOAP tramite Regular Expression
- **Identificativo:** `ERR-01`
- **Gravità:** `Alto`
- **Categoria:** Error Handling e Robustezza
- **Stato:** ⏳ DA RISOLVERE
- **Posizione:** [`lib/sistemats/client.ts:35-39, 483-570`](file:///home/marcor/Projects/gestionale-fatture/lib/sistemats/client.ts#L35-L39)
- **Descrizione:** L'estrazione dei dati delle risposte del Sistema TS (protocollo, esito elaborazione, contatori accolti/scartati, payload base64 di ricevute ed errori) è affidata alla funzione `extractTagValue`, basata sulla regex:
  ```typescript
  new RegExp(`<(?:[a-zA-Z0-9_-]+:)?${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[a-zA-Z0-9_-]+:)?${tagName}>`, "i")
  ```
  L'uso di espressioni regolari per parsare documenti XML gerarchici è intrinsecamente fragile:
  1. Non gestisce tag auto-chiusi (es. `<dettaglioErrori />`).
  2. In caso di tag omonimi annidati o tag ripetuti all'interno di elementi differenti, la quantificazione non-greedy `[\s\S]*?` tronca l'estrazione al primo tag di chiusura incontrato.
  3. Risposte con formattazioni impreviste o payload con entità speciali possono causare il fallimento silenzioso del parse e la mancata acquisizione del protocollo.
- **Soluzione consigliata:**
  Sostituire la regex con un parser XML standard e rigoroso (es. `fast-xml-parser`):
  ```typescript
  // lib/sistemats/xml-parser.ts
  import { XMLParser } from "fast-xml-parser";

  const parser = new XMLParser({
    ignoreAttributes: true,
    removeNSPrefix: true,
    trimValues: true,
  });

  export function parseSoapResponse<T>(xml: string): T {
    return parser.parse(xml);
  }
  ```

---

<a id="err-02"></a>
### [ERR-02] [Medio] Race Condition (TOCTOU) su cancellazione definitiva Pagante/Paziente
- **Identificativo:** `ERR-02`
- **Gravità:** `Medio`
- **Categoria:** Error Handling e Robustezza
- **Stato:** ⏳ DA RISOLVERE
- **Posizione:** [`lib/actions/payers.ts:348-379`](file:///home/marcor/Projects/gestionale-fatture/lib/actions/payers.ts#L348-L379)
- **Descrizione:** In `hardDeletePayer`, il controllo che verifica l'assenza di fatture o pazienti non archiviati collegati (`canHardDeletePayer`) viene eseguito tramite conteggi indipendenti:
  ```typescript
  const [fatture, pazientiNonArchiviati] = await Promise.all([...]);
  if (!canHardDeletePayer({ fatture, pazientiNonArchiviati })) { ... }
  // Finestra di concorrenza (TOCTOU)
  await prisma.pagante.delete({ where: { id, id_Utente: userId } });
  ```
  Tra l'esecuzione dei conteggi e la successiva operazione `delete`, una richiesta concorrente (es. creazione fattura da un'altra scheda o importazione) può associare un nuovo record al pagante. La cancellazione fallirà a livello di foreign key constraint Postgres (`ON DELETE RESTRICT`), ma l'errore verrà mascherato dal blocco `catch` generico restituendo `"Errore durante l'eliminazione definitiva del pagante"`.
- **Soluzione consigliata:**
  Inglobare verifica e cancellazione in una transazione interattiva isolata, gestendo esplicitamente il codice di errore Prisma `P2003` (Foreign Key Constraint Violation) per notificare l'utente con precisione.

---

<a id="err-03"></a>
### [ERR-03] [Basso] Rischio di Date-Drift nel calcolo della retention mensile in `audit-log-retention.mjs`
- **Identificativo:** `ERR-03`
- **Gravità:** `Basso`
- **Categoria:** Error Handling e Robustezza
- **Stato:** ⏳ DA RISOLVERE
- **Posizione:** [`scripts/audit-log-retention.mjs:54-56`](file:///home/marcor/Projects/gestionale-fatture/scripts/audit-log-retention.mjs#L54-L56)
- **Descrizione:** Il calcolo della soglia di eliminazione dell'audit log è implementato come:
  ```javascript
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - RETENTION_MONTHS);
  ```
  Nel motore JavaScript, l'uso di `setMonth()` sui giorni 29, 30 e 31 produce un salto di mese involontario (ad esempio, il 31 marzo meno 1 mese porta al 3 marzo, a causa dell'assenza del 31 febbraio). Per una retention di 12 mesi il salto si verifica tipicamente il 29 febbraio di anni bisestili.
- **Soluzione consigliata:**
  Calcolare il cutoff in giorni precisi o normalizzare la data prima della sottrazione:
  ```javascript
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - (RETENTION_MONTHS * 30));
  ```

---

## 6. Code Smells e Naming Conventions

<a id="smell-01"></a>
### [SMELL-01] [Medio] Rottura del comando `npm run lint` per mancata esclusione di `postgres_dev_data`
- **Identificativo:** `SMELL-01`
- **Gravità:** `Medio`
- **Categoria:** Code Smells e Naming Conventions
- **Stato:** ⏳ DA RISOLVERE
- **Posizione:** [`eslint.config.mjs:9-17`](file:///home/marcor/Projects/gestionale-fatture/eslint.config.mjs#L9-L17)
- **Descrizione:** Eseguendo `npm run lint` nell'ambiente di lavoro corrente, il linter fallisce immediatamente con errore bloccante:
  ```text
  Error: EACCES: permission denied, scandir '/home/marcor/Projects/gestionale-fatture/postgres_dev_data'
  ```
  La cartella `postgres_dev_data` viene generata dal bind mount del container `docker-compose.dev.yml` con proprietario `root`/`postgres`. Poiché non è inclusa nell'array `globalIgnores` di ESLint, il processo di linting esplora ricorsivamente la cartella e termina con errore fatale di permessi, compromettendo la verifica automatica del codice in locale e su pipeline CI.
- **Soluzione consigliata:**
  Aggiungere `postgres_dev_data/**` alla lista degli ignore globali in `eslint.config.mjs`:
  ```javascript
  // eslint.config.mjs
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    ".claude/**",
    "postgres_dev_data/**",
  ]),
  ```

---

<a id="smell-02"></a>
### [SMELL-02] [Basso] Utilizzo della proprietà CSS non standard `zoom` nel Canvas PDF Editor
- **Identificativo:** `SMELL-02`
- **Gravità:** `Basso`
- **Categoria:** Code Smells e Naming Conventions
- **Stato:** ⏳ DA RISOLVERE
- **Posizione:** [`components/settings/pdf-editor.tsx:396`](file:///home/marcor/Projects/gestionale-fatture/components/settings/pdf-editor.tsx#L396)
- **Descrizione:** Il ridimensionamento dinamico del foglio di lavoro A4 nell'editor grafico è implementato applicando direttamente la proprietà CSS inline `zoom`:
  `style={{ width: PAGE_W, height: PAGE_H, zoom, flexShrink: 0 }}`
  La proprietà `zoom` non fa parte dello standard W3C CSS: sebbene supportata da Chrome e Safari, produce anomalie di rendering o mancato supporto su Firefox.
- **Soluzione consigliata:**
  Adottare la trasformazione CSS standard `transform: scale(zoom)` abbinata a `transformOrigin: "top left"`.

---

<a id="smell-03"></a>
### [SMELL-03] [Basso] Valore sentinella fittizio `id: 0` in `getPdfSettings` (Rilievo QUA-03)
- **Identificativo:** `SMELL-03`
- **Gravità:** `Basso`
- **Categoria:** Code Smells e Naming Conventions
- **Stato:** ⏳ DA RISOLVERE
- **Posizione:** [`lib/data/settings.ts:27`](file:///home/marcor/Projects/gestionale-fatture/lib/data/settings.ts#L27)
- **Descrizione:** Quando un utente non ha ancora salvato una configurazione PDF personalizzata, `getPdfSettings()` restituisce un oggetto conforme a `ImpostazioniPdf` popolando arbitrariamente `id: 0`. Un valore intero arbitrario che simula una chiave primaria inesistente sul database costituisce un code smell ("falso positivo di persistenza") che può indurre in errore chiamanti futuri (`if (settings.id)`).
- **Soluzione consigliata:**
  Rendere il tipo di ritorno nullable (`Promise<ImpostazioniPdf | null>`) oppure restituire `PdfLayout` senza campi database fittizi.

---

<a id="smell-04"></a>
### [SMELL-04] [Basso] Riferimenti a documentazione non presente nel repository (Rilievo DOC-01)
- **Identificativo:** `SMELL-04`
- **Gravità:** `Basso`
- **Categoria:** Code Smells e Naming Conventions
- **Stato:** ⏳ DA RISOLVERE
- **Posizione:** [`lib/security/csp.ts:5`](file:///home/marcor/Projects/gestionale-fatture/lib/security/csp.ts#L5), [`proxy.ts:28`](file:///home/marcor/Projects/gestionale-fatture/proxy.ts#L28), [`scripts/audit-log-retention.mjs:2`](file:///home/marcor/Projects/gestionale-fatture/scripts/audit-log-retention.mjs#L2)
- **Descrizione:** Nel codice sorgente e negli script sono presenti commenti che rimandano a documenti architetturali (`PIANO_FIX_CSP_NONCE.md`, `PIANO_FIX_AUDIT_LOG_RETENTION.md`) non presenti nel repository poiché esclusi dalla regola `docs/` in `.gitignore`. Questo genera debito documentale e disorienta gli sviluppatori che consultano i commenti.
- **Soluzione consigliata:**
  Integrare le specifiche rilevanti in `README.md` o consentire il versionamento della cartella `docs/`.

---

<a id="smell-05"></a>
### [SMELL-05] [Suggerimento] Posizionamento incoerente di `getPayersForSelect` in `patients.ts`
- **Identificativo:** `SMELL-05`
- **Gravità:** `Suggerimento`
- **Categoria:** Code Smells e Naming Conventions
- **Stato:** ⏳ DA RISOLVERE
- **Posizione:** [`lib/data/patients.ts:60-66`](file:///home/marcor/Projects/gestionale-fatture/lib/data/patients.ts#L60-L66)
- **Descrizione:** La funzione `getPayersForSelect` interroga la tabella `paganti` (`prisma.pagante.findMany(...)`), ma è posizionata all'interno del modulo `lib/data/patients.ts`. In base ai principi di modularità e domain-driven design, tutte le query su un'entità specifica dovrebbero risiedere nel modulo dati di competenza.
- **Soluzione consigliata:**
  Spostare `getPayersForSelect` in [`lib/data/payers.ts`](file:///home/marcor/Projects/gestionale-fatture/lib/data/payers.ts) e aggiornare gli import nei file chiamanti.

---

## Conclusioni e Piano di Remediation Consigliato

L'applicazione dimostra un grado di maturità e attenzione alla sicurezza notevolmente superiore alla media dei gestionali di pari scala (adozione di CSP stretta con nonce, rate limiting capillare, audit log strutturato conforme a GDPR/PII e snapshot anagrafici immutabili).

Per raggiungere un livello di robustezza enterprise, si raccomanda di articolare i fix nei seguenti tre sprint prioritari:

1. **Sprint Sicurezza & Affidabilità (Immediato):**
   - Risolvere la vulnerabilità DoS su `/api/health` esentando il localhost/container dal rate limit.
   - Limitare `passwordSchema` a 72 byte per allinearlo a bcrypt ed evitare lockout al login.
   - Inserire `postgres_dev_data/**` in `eslint.config.mjs` per ripristinare il corretto funzionamento di `npm run lint`.
   - Aggiungere `exec` nel CMD del `Dockerfile` per abilitare la chiusura graceful del database.
2. **Sprint Prestazioni & I/O (Breve termine):**
   - Memoizzare in memoria di processo la chiave pubblica X.509 in `crypto.ts`.
   - Ottimizzare `getArchivedPayers` per evitare il full-table scan dei paganti attivi.
   - Sostituire il parsing XML Regex in `client.ts` con una libreria parser dedicata.
3. **Sprint Refactoring & Modularità (Medio termine):**
   - Decomporre il monolite `sistema-ts-manager.tsx` in sotto-componenti mirati.
   - Unificare la logica duplicata tra `patients-manager.tsx` e `payers-manager.tsx`.
   - Standardizzare il tipo `ActionResult<T>` tra tutte le Server Actions.