# Report di Audit Approfondito del Codice (Code Audit & Quality Review)

Questo documento raccoglie in modo strutturato tutti i nuovi problemi, anti-pattern, warning di linting e possibili race condition identificati durante la scansione approfondita del repository successiva alla risoluzione dei primi 25 rilievi di [`CODE_REVIEW.md`](./CODE_REVIEW.md).

I problemi sono classificati per categoria e ordinati per livello di gravità (**Alto, Medio, Basso, Suggerimento**).

---

## 1. Matrice di Sintesi dei Problemi

| Livello di Gravità | Error Handling e Concorrenza | Code Smells e React Anti-Pattern | Architettura e Tipizzazione | Validazione Dati | Totale |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Alto** | 0 | 0 | 0 | 0 | **0** |
| **Medio** | 1 | 1 | 0 | 0 | **2** |
| **Basso** | 0 | 2 | 1 | 1 | **4** |
| **Suggerimento** | 0 | 1 | 0 | 0 | **1** |
| **Totale** | **1** | **4** | **1** | **1** | **7** |

---

## 2. Registro Generale dei Problemi e Identificativi

| ID | Gravità | Categoria | Titolo Sintetico | Stato | Posizione |
| :--- | :--- | :--- | :--- | :---: | :--- |
| [`ERR-04`](#err-04) | **Medio** | Error Handling e Concorrenza | Race Condition (TOCTOU) su cancellazione fisica fattura concorrente a trasmissione TS | ✅ RISOLTO | Branch `fix/err04-invoice-delete-toctou` |
| [`SMELL-06`](#smell-06) | **Medio** | Code Smells e React Anti-Pattern | Violazione regole React Hooks: `setState` sincrono dentro `useEffect` (Cascading Renders) | ✅ RISOLTO | Branch `fix/smell06-react-hooks-setstate` |
| [`SMELL-07`](#smell-07) | **Basso** | Code Smells e React Anti-Pattern | Caratteri apostrofo non sottoposti ad escape nel JSX (`react/no-unescaped-entities`) | ✅ RISOLTO | Branch `fix/smell06-react-hooks-setstate` |
| [`SMELL-08`](#smell-08) | **Basso** | Code Smells e React Anti-Pattern | Funzioni pure interne ad hook omesse dalle dipendenze di `useMemo` (`exhaustive-deps`) | ✅ RISOLTO | Branch `fix/smell08-lotti-exhaustive-deps` |
| [`ARCH-05`](#arch-05) | **Basso** | Architettura e Tipizzazione | Disallineamento nel pattern discriminated union in `deleteInvoice` | ✅ RISOLTO | Branch `fix/err04-invoice-delete-toctou` |
| [`DATA-01`](#data-01) | **Basso** | Validazione Dati | Parsing date senza validazione del calendario reale in `FixInvoiceTsDialog` | ⏳ DA RISOLVERE | [`components/sistema-ts/fix-invoice-ts-dialog.tsx:83`](./components/sistema-ts/fix-invoice-ts-dialog.tsx#L83) |
| [`SMELL-09`](#smell-09) | **Suggerimento** | Code Smells e Naming Conventions | Import e parametri non utilizzati (`@typescript-eslint/no-unused-vars`) | ⏳ DA RISOLVERE | Vari file di componenti e test |

---

## 3. Dettaglio dei Rilievi per Categoria

### Sezione 1: Error Handling e Concorrenza

<a id="err-04"></a>
### [ERR-04] [Medio] Race Condition (TOCTOU) su cancellazione fisica fattura concorrente a trasmissione TS
- **Identificativo:** `ERR-04`
- **Gravità:** `Medio`
- **Categoria:** Error Handling e Concorrenza
- **Stato:** ✅ RISOLTO (Branch `fix/err04-invoice-delete-toctou`)
- **Posizione:** [`lib/actions/invoices.ts:489-525`](./lib/actions/invoices.ts#L489-L525)
- **Descrizione:**
  In `deleteInvoice`, viene eseguito un controllo preliminare sullo stato TS della fattura:
  ```ts
  if (invoice.stato_ts === "IN_TRASMISSIONE") {
    return { success: false, error: "La fattura è attualmente in fase di trasmissione al Sistema TS e non può essere eliminata." };
  }
  ```
  Tuttavia, tra questa lettura iniziale e l'esecuzione della transazione di eliminazione fisica:
  ```ts
  await tx.pagamento.delete({ where: { id, id_Utente: userId } });
  ```
  un'operazione concorrente di invio batch (`inviaLottoFatture`) può acquisire il lock atomico e portare la stessa fattura in `IN_TRASMISSIONE`. La `tx.pagamento.delete` non vincola `stato_ts: "DA_INVIARE"` nella clausola `where`. Se la cancellazione si intercala durante la chiamata di rete SOAP verso Sogei, la fattura verrebbe eliminata fisicamente dal database pur essendo inclusa nel payload ZIP in fase di trasmissione ministeriale.
- **Soluzione consigliata:**
  Blindare atomicamente la clausola `where` nella query di eliminazione:
  ```ts
  const deleted = await tx.pagamento.deleteMany({
    where: {
      id,
      id_Utente: userId,
      stato_ts: "DA_INVIARE",
    },
  });
  if (deleted.count === 0) {
    throw new Error("Fattura non più eliminabile o in fase di trasmissione al Sistema TS");
  }
  ```

---

### Sezione 2: Code Smells e React Anti-Pattern

<a id="smell-06"></a>
### [SMELL-06] [Medio] Violazione regole React Hooks: `setState` sincrono dentro `useEffect` (Cascading Renders)
- **Identificativo:** `SMELL-06`
- **Gravità:** `Medio`
- **Categoria:** Code Smells e React Anti-Pattern
- **Stato:** ✅ RISOLTO (Branch `fix/smell06-react-hooks-setstate`)
- **Posizione:**
  - [`components/sistema-ts/dialogs/cancel-invoice-ts-dialog.tsx:36-42`](./components/sistema-ts/dialogs/cancel-invoice-ts-dialog.tsx#L36-L42)
  - [`components/sistema-ts/fix-invoice-ts-dialog.tsx:55-67`](./components/sistema-ts/fix-invoice-ts-dialog.tsx#L55-L67)
  - [`components/sistema-ts/hooks/use-sistema-ts-lotti.ts:29-34`](./components/sistema-ts/hooks/use-sistema-ts-lotti.ts#L29-L34)
- **Descrizione:**
  In tre punti distinti, lo stato React viene aggiornato in modo sincrono all'interno di un hook `useEffect`:
  1. `cancel-invoice-ts-dialog.tsx`: reset dei campi di conferma (`setCancelConfirmNumero("")`, ecc.) quando `!cancellingInvoice`.
  2. `fix-invoice-ts-dialog.tsx`: popolamento dei campi form quando `invoice && open`.
  3. `use-sistema-ts-lotti.ts`: sincronizzazione delle props `initialFilters` nello stato locale del componente.
  Questo pattern viola le raccomandazioni ufficiali di React (*"You Might Not Need an Effect"*), causa rendering a cascata (re-render forzati subito dopo il montaggio/aggiornamento) e genera 3 errori bloccanti nella regola ESLint `react-hooks/set-state-in-effect`.
- **Soluzione consigliata:**
  1. In `cancel-invoice-ts-dialog.tsx`: azzerare gli stati del form negli handler di evento (`handleClose`, `onConfirm`), oppure montare i campi del dialog solo quando `cancellingInvoice` è presente con `key={cancellingInvoice.id}`.
  2. In `fix-invoice-ts-dialog.tsx`: isolare i campi del form in un sub-componente interno montato con `key={invoice.id}` quando `open && invoice`. I singoli stati (`cf`, `dataPagamento`, ecc.) possono così essere inizializzati direttamente e naturalmente in `useState(invoice.paganteCf ?? "")` senza alcun `useEffect`.
  3. In `use-sistema-ts-lotti.ts`: sincronizzare lo stato durante la fase di render tracciando le props precedenti ("*Adjusting some state when a prop changes*"), come documentato dalla guida React.

---

<a id="smell-07"></a>
### [SMELL-07] [Basso] Caratteri apostrofo non sottoposti ad escape nel JSX (`react/no-unescaped-entities`)
- **Identificativo:** `SMELL-07`
- **Gravità:** `Basso`
- **Categoria:** Code Smells e React Anti-Pattern
- **Stato:** ✅ RISOLTO (Branch `fix/smell06-react-hooks-setstate`)
- **Posizione:** [`components/sistema-ts/fix-invoice-ts-dialog.tsx:238, 289`](./components/sistema-ts/fix-invoice-ts-dialog.tsx#L238)
- **Descrizione:**
  Nel markup JSX del dialog di correzione rapida sono presenti caratteri apostrofo `'` inseriti come testo letterale:
  - Riga 238: `... dell'anagrafica cliente ...`
  - Riga 289: `... dell'assistito ...`
  Questo causa 2 errori bloccanti nella regola ESLint `react/no-unescaped-entities`.
- **Soluzione consigliata:**
  Sostituire i caratteri con la relativa entità HTML `&apos;` o `&#39;`.

---

<a id="smell-08"></a>
### [SMELL-08] [Basso] Funzioni pure interne ad hook omesse dalle dipendenze di `useMemo` (`exhaustive-deps`)
- **Identificativo:** `SMELL-08`
- **Gravità:** `Basso`
- **Categoria:** Code Smells e React Anti-Pattern
- **Stato:** ✅ RISOLTO (Branch `fix/smell08-lotti-exhaustive-deps`)
- **Posizione:** [`components/sistema-ts/hooks/use-sistema-ts-lotti.ts:36-50, 59, 94`](./components/sistema-ts/hooks/use-sistema-ts-lotti.ts#L36-L50)
- **Descrizione:**
  Le funzioni `isInvoiceFuture`, `isInvoiceWithAnomalies` e `isInvoiceReady` sono dichiarate all'interno del corpo dell'hook `useSistemaTsLotti`. Vengono utilizzate all'interno di `useMemo` (righe 59 e 94) senza essere incluse nell'array delle dipendenze, scatenando warning di `react-hooks/exhaustive-deps`. Inoltre, non dipendendo da alcuno stato o prop dell'hook (ricevono solo l'oggetto `f: FatturaTsListItem`), vengono ricreate inutilmente ad ogni render del componente.
- **Soluzione consigliata:**
  Estrarre le tre funzioni pure all'esterno dell'hook `useSistemaTsLotti` (a livello di modulo o in `types.ts`), rendendole stabili ed eliminando la necessità di tracciarle tra le dipendenze dei memo.

---

### Sezione 3: Architettura e Tipizzazione

<a id="arch-05"></a>
### [ARCH-05] [Basso] Disallineamento nel pattern discriminated union in `deleteInvoice`
- **Identificativo:** `ARCH-05`
- **Gravità:** `Basso`
- **Categoria:** Architettura e Tipizzazione
- **Stato:** ✅ RISOLTO (Branch `fix/err04-invoice-delete-toctou`)
- **Posizione:** [`lib/actions/invoices.ts:506`](./lib/actions/invoices.ts#L506)
- **Descrizione:**
  In `deleteInvoice`, il controllo sul risultato dell'annullamento telematico è scritto come:
  ```ts
  const cancelResult = await annullaFatturaTs(id);
  if ("error" in cancelResult) {
    return { success: false, error: cancelResult.error };
  }
  ```
  Sebbene funzioni a runtime, con l'introduzione di **ARCH-03** il tipo `SistemaTsActionState` è stato standardizzato come discriminated union con proprietà discriminante `success: true | false`. Il controllo canonico e type-safe raccomandato è `if (!cancelResult.success)`.
- **Soluzione consigliata:**
  Sostituire `"error" in cancelResult` con `!cancelResult.success`.

---

### Sezione 4: Validazione Dati

<a id="data-01"></a>
### [DATA-01] [Basso] Parsing date senza validazione del calendario reale in `FixInvoiceTsDialog`
- **Identificativo:** `DATA-01`
- **Gravità:** `Basso`
- **Categoria:** Validazione Dati
- **Stato:** ⏳ DA RISOLVERE
- **Posizione:** [`components/sistema-ts/fix-invoice-ts-dialog.tsx:83-86`](./components/sistema-ts/fix-invoice-ts-dialog.tsx#L83-L86)
- **Descrizione:**
  Nel calcolo di `isDateFuture` per il vincolo ministeriale S036, la stringa `dataPagamento` (formato `YYYY-MM-DD`) viene scomposta con `split("-")` e passata a `new Date(y, m - 1, d, 12, 0, 0)`. Il costruttore `Date` di JavaScript corregge automaticamente date non esistenti (ad esempio `2026-02-31` viene convertita in `2026-03-03`). Sebbene Zod convalidi la data prima del salvataggio definitivo, durante la digitazione nel form l'indicatore visivo di "Data futura" potrebbe basarsi su una data slittata senza avvisare l'utente della non validità del giorno.
- **Soluzione consigliata:**
  Verificare che la data istanziata corrisponda al giorno e mese digitati (`selected.getDate() === d && selected.getMonth() === m - 1`).

---

### Sezione 5: Code Smells e Naming Conventions

<a id="smell-09"></a>
### [SMELL-09] [Suggerimento] Import e parametri non utilizzati (`@typescript-eslint/no-unused-vars`)
- **Identificativo:** `SMELL-09`
- **Gravità:** `Suggerimento`
- **Categoria:** Code Smells e Naming Conventions
- **Stato:** ⏳ DA RISOLVERE
- **Posizione:**
  - `components/sistema-ts/tabs/lotti-tab.tsx:12`: `ShieldCheck`
  - `components/settings/pdf-editor.tsx:32, 47`: `ImpostazioniPdf`, `userId`
  - `components/invoices/use-invoice-selection.ts:15`: `page`
  - `lib/actions/payers.test.ts:75`: `createPayer`
  - `lib/sistemats/payload-builder.test.ts:6`: `SISTEMATS_IMPORTO_MIN`
  - `lib/validations/sistema-ts.test.ts:230`: `_`
  - `scripts/verify-password-policy.test.ts:9`: `MAX_PASSWORD_BYTES`
- **Descrizione:**
  Variabili, tipi o parametri dichiarati o importati ma mai utilizzati nel codice sorgente. Generano 7 warning durante `npm run lint`.
- **Soluzione consigliata:**
  Rimuovere gli import e parametri inutilizzati (o aggiungere il prefisso `_` dove prescritto dalla firma).
