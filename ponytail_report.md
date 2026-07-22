# Ponytail Report — audit sovra-ingegnerizzazione

Scope: intero repository (`app/`, `lib/`, `components/`, `scripts/`, `package.json`).
Fuori scope per costruzione: bug di correttezza, sicurezza, performance (vedi `SECURITY_AUDIT.md` per quello).
Regola d'oro rispettata: nessun taglio qui sotto tocca validazione input, sicurezza o accessibilità.

Verdetto generale: repo già magro. Niente classi, niente interface con una sola implementazione,
niente factory/singleton, niente componente-tabella-generico (la duplicazione tra i `*-manager.tsx`
è convenzione esplicita in `AGENTS.md`, non è stata segnalata). I punti sotto sono le eccezioni reali.

## Dipendenze da eliminare

1. **`native:` `date-fns` + `date-fns/locale/it`** — usata in soli 2 file (`lib/utils/date.ts`,
   `components/invoices/invoice-form.tsx`) per 3 chiamate a `format()`. Tutti e tre i format sono
   coperti da `Intl`/`Date` nativi:
   - `format(d, "yyyy-MM-dd")` → `` `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}` ``
   - `format(d, "dd/MM/yyyy", { locale: it })` → `d.toLocaleDateString("it-IT")`
   - `format(new Date(), "MMMM", { locale: it }).toUpperCase()` → `new Date().toLocaleDateString("it-IT", { month: "long" }).toUpperCase()`
   Rimuove 1 dipendenza (+ il pacchetto locale associato) senza toccare logica di parsing esistente
   (`parseDateInput`/`toLocalDate` restano, sono già native). [`lib/utils/date.ts`, `components/invoices/invoice-form.tsx`, `package.json`]

2. **`delete:` `shadcn` in `dependencies`** — è il CLI di scaffolding (`shadcn add ...`), zero import
   nel codice applicativo (i componenti generati vivono già in `components/ui/`, non serve a runtime).
   Va eseguito via `npx shadcn@latest` quando serve, non installato come dipendenza di produzione.
   [`package.json`]

3. **`delete:` `@types/better-sqlite3` in `devDependencies`** — `better-sqlite3` non è nemmeno tra le
   dipendenze del progetto (si usa Postgres via `pg`/Prisma) e non c'è un solo import nel codice.
   Residuo morto, probabilmente di un esperimento passato. [`package.json`]

## Astrazioni morte

1. **`delete:` `isPrismaImpostazioniPdf`** — dichiarata in `lib/pdf/types.ts:158`, mai chiamata da
   nessuna parte del repo (nemmeno dal proprio file, a differenza delle altre type-guard vicine
   `isBlocco`/`isTextAlign`/`isTipoBlocco`/`isMeseConfig` che si compongono a vicenda). Type guard
   morta, -15 righe. [`lib/pdf/types.ts:158-171`]

2. **`yagni:` 26 script `scripts/verify-*.ts` (2462 righe totali) reinventano un mini test-runner**
   — ogni script ripete lo stesso scheletro (`const failures: string[] = []`, funzioni
   `assertEqual`/`assertRejects`/`assertAccepts` copia-incollate, `process.exit(1)` finale) invece di
   usare `vitest`, già installato, già configurato (`vitest.config.ts`) e già in uso nel repo
   (`components/auth/login-form.test.tsx`, `lib/validations/invoice.test.ts`). La logica di
   regressione di ciascuno script (i casi limite su bollo, mesi, rate-limit, ecc.) resta tutta valida
   e va mantenuta — solo l'harness a mano è ridondante: convertendo ogni `verify-X.ts` in un
   `X.test.ts` con `describe/it/expect` si eliminano ~10-15 righe di boilerplate duplicato per file
   e si unifica l'esecuzione sotto un solo comando (`npm test`) invece di 26 script npm separati.
   Nessuna perdita di copertura, stesso costo di manutenzione dei singoli casi. [`scripts/*.ts`]

## Semplificazioni immediate

1. **`native:` generatore di ID a mano** — `makeId()` in `components/settings/pdf-editor.tsx:136-138`
   costruisce un ID con `Date.now().toString(36)` + `Math.random().toString(36)`. `crypto.randomUUID()`
   (Web Crypto API, disponibile in tutti i browser moderni e in Node) fa la stessa cosa in una riga,
   senza rischio di collisione:
   ```ts
   function makeId() {
     return crypto.randomUUID();
   }
   ```
   [`components/settings/pdf-editor.tsx:136-138`]

Nota su un candidato scartato: `JSON.parse(JSON.stringify(ed.getJSON()))` in
`components/settings/use-rich-block-editor.ts:84` sembra un deep-clone da sostituire con
`structuredClone`, ma il commento in loco chiarisce che serve proprio la semantica di
`JSON.stringify` (elimina proprietà non enumerabili di TipTap e garantisce un payload
JSON-puro per la Server Action) — `structuredClone` cambierebbe comportamento. Non è over-engineering, è corretto così.

---

net: **-3 dipendenze** (`date-fns`, `shadcn` da `dependencies`, `@types/better-sqlite3`),
**~-2470 righe possibili** (2462 di boilerplate negli script `verify-*` se convertiti a vitest + 15
di `isPrismaImpostazioniPdf` morta), **0 rischi su validazione/sicurezza/accessibilità** (nessuna
delle voci sopra tocca `lib/actions/*`, `lib/auth/*`, `proxy.ts` o gli schema Zod).
