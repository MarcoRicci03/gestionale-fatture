# Refactoring UX "Blocco Mesi" nel costruttore layout PDF — Analisi e Piano

> Documento di sola analisi/pianificazione. Nessuna modifica al codice è stata applicata.

**Obiettivo:** eliminare la necessità, per l'utente finale, di scrivere sintassi Handlebars grezza (`{{#each fattura.mesi}}...{{/each}}`) per mostrare l'elenco dei mesi/voci in fattura, sostituendola con una UI dedicata.

---

## 1. Mappa dello stato attuale

### Correzione di premessa importante

La richiesta parlava di "stato... tra la pagina principale e la sidebar". In realtà:

- `app/(protected)/settings/pdf/page.tsx` è un semplice Server Component che carica `getPdfSettings()` e monta `<PdfEditor initialSettings={settings} userId={session.id} />`. Non contiene logica di stato propria.
- `components/layout/sidebar-content.tsx` è la sidebar di **navigazione globale** dell'app: contiene solo il link `/settings/pdf` (voce "Impostazioni PDF"). Non gestisce né legge lo stato dei blocchi PDF in alcun modo.
- Tutto lo stato del blocco di testo (incluso il ciclo `{{#each}}`) vive **interamente dentro un unico Client Component**: `components/settings/pdf-editor.tsx` (`PdfEditor`). La "sidebar" a cui probabilmente ci si riferiva è il **pannello proprietà** interno all'editor (colonna destra, "Pannello proprietà" — righe 988-1232 del file), non la sidebar di navigazione dell'app.

### Flusso dati reale

```
lib/pdf/layout-default.ts (LAYOUT_DEFAULT.blocchi[])
        │  fornisce default / reset
        ▼
components/settings/pdf-editor.tsx (PdfEditor)
  - useState<{ history: ImpostazioniPdf[]; index }> → undo/redo
  - settings.blocchi[]: ogni Blocco ha un campo libero `testo?: string`
  - Pannello proprietà destro: <Textarea id="testo"> collegata a
    selectedBlock.testo via updateBlock(id, { testo })
  - Bottoni "Inserisci valore dinamico" (PLACEHOLDER_GROUPS) iniettano
    stringhe tipo "{{fattura.mesi}}" nel punto del cursore (insertPlaceholder)
  - NESSUN bottone dedicato inserisce il ciclo {{#each}}...{{/each}}:
    è scritto a mano oppure preimpostato solo nel LAYOUT_DEFAULT
  - previewMode → resolvePlaceholders(blocco.testo, mockInvoice) per
    l'anteprima a schermo
        │  onClick "Salva modifiche" → updatePdfSettings(input)
        ▼
lib/actions/settings.ts (updatePdfSettings)
  - valida con lib/validations/pdf-settings.ts (bloccoSchema.testo è
    z.string().optional() — NESSUNA validazione sintattica sul contenuto,
    un {{#each}} malformato viene salvato senza errori)
        │
        ▼
lib/data/settings.ts (upsertPdfSettings) → Prisma impostazioniPdf.blocchi (Json)

--- generazione PDF reale (invio/download fattura) ---

lib/pdf/invoices.tsx (generateInvoicePdf)
  - carica invoice + layout (snapshot o getPdfSettingsForUser)
        ▼
components/invoices/invoice-pdf-document.tsx (InvoicePDFDocument)
  - per ogni blocco: resolvePlaceholders(blocco.testo, invoice)
        ▼
lib/pdf/placeholders.ts
  - expandEachLoops(): regex HARDCODED che cerca solo
    {{#each fattura.mesi}}...{{/each}}, ripete il body per ogni
    invoice.mesi[], sostituendo {{this.mese}}, {{this.meseLabel}},
    {{this.prezzo}}, {{this.prezzoNumero}}
  - resolvePlaceholders(): sostituisce poi tutti gli altri placeholder
    statici; qualunque token {{...}} non riconosciuto (incluso un
    residuo di #each rotto) viene rimosso silenziosamente
```

### Criticità UX individuate

1. Il ciclo `{{#each fattura.mesi}}...{{/each}}` è testo libero indistinguibile dal resto: un utente può cancellarlo/spezzarlo per errore modificando la Textarea, senza alcun avviso (fallback silenzioso di `resolvePlaceholders` nasconde l'errore finché non si guarda il PDF).
2. Non esiste alcun bottone/scorciatoia in `PLACEHOLDER_GROUPS` per (re)inserire il blocco each — è un'isola sintattica che l'utente deve conoscere a memoria.
3. Il pannello proprietà tratta il blocco "mesi" esattamente come un blocco `tipo: "testo"` qualsiasi: nessuna specializzazione UI in base al contenuto.
4. `bloccoSchema` (zod) non valida affatto la sintassi Handlebars: errori di sintassi passano la validazione e si scoprono solo a runtime nel PDF.

---

## 2. Piano di modifica proposto

**Idea chiave:** introdurre un nuovo `tipo` di blocco esplicito, `"mesi"`, con dati strutturati al posto del campo `testo` libero. Ogni riga-mese è composta da **due mini-template** (descrizione a sinistra, valore a destra) editabili con lo stesso meccanismo a pillole/grassetto già esistente per gli altri blocchi — mai il ciclo `{{#each}}/{{/each}}` visibile o editabile a mano.

> **Aggiornamento dopo esempio utente:** il caso reale richiede frasi libere con dentro nome paziente (in grassetto) e mese, più un prezzo allineato a destra in grassetto sulla stessa riga — es. *"Seduta di logoterapia a favore di **Nathan Matias Joaquin Campos** per il mese di GENNAIO　　　　　**120 €**"*. Il design "colonne fisse + separatore" (bozza precedente) non copre questo caso; è stato sostituito dal design a **due template liberi per riga** descritto sotto.

### Step 1 — Estendere il modello dati
**File:** `lib/pdf/types.ts`
- Aggiungere `"mesi"` a `TipoBlocco`.
- Aggiungere un campo strutturato al `Blocco`, esclusivo per questo tipo:
  ```ts
  export type MeseConfig = {
    titolo?: string;               // riga di intestazione opzionale, es. "Dettaglio mesi"
    descrizioneTemplate: string;   // es. "Seduta di logoterapia a favore di <b>{{paziente.cognomeNome}}</b> per il mese di {{riga.meseLabel}}"
    valoreTemplate: string;        // es. "<b>{{riga.prezzo}}</b>" — colonna allineata a destra sulla stessa riga
    mostraTotale: boolean;
    totaleLabel?: string;          // es. "Totale"
  };
  ```
  aggiunto come `meseConfig?: MeseConfig` sul tipo `Blocco`.
- `descrizioneTemplate`/`valoreTemplate` sono stringhe con `{{token}}` e tag `<b>`/`<i>`/`<note>` — **esattamente come già oggi per i blocchi mittente/intestatario/paziente/pagamento** (nessuna sintassi nuova per l'utente): l'unica differenza è che qui i placeholder vengono generati esclusivamente cliccando pillole nella UI (Step 4), l'utente non apre mai una textarea "a mano libera" priva di guida. Il ciclo `{{#each}}` semplicemente non esiste più: l'iterazione sui mesi è implicita nel tipo di blocco stesso.
- Nuovi token disponibili solo dentro questi due template, scoped alla singola riga-mese: `{{riga.mese}}`, `{{riga.meseLabel}}`, `{{riga.prezzo}}`, `{{riga.prezzoNumero}}` (equivalenti agli attuali `this.mese/meseLabel/prezzo/prezzoNumero` di `expandEachLoops`, rinominati per chiarezza e per non collidere con gli alias aggregati già esistenti `{{mese.nome}}`/`{{mese.anno}}`). Restano inoltre utilizzabili **tutti i placeholder già esistenti** (`{{paziente.*}}`, `{{intestatario.*}}`, `{{mittente.*}}`, `{{fattura.*}}`), per poter comporre frasi come quella d'esempio.
- Aggiornare `isTipoBlocco` e `isBlocco` (type guard) per includere il nuovo tipo/campo.

### Step 2 — Validazione
**File:** `lib/validations/pdf-settings.ts`
- Aggiungere `"mesi"` a `tipoBloccoValues`.
- Aggiungere `meseConfigSchema` (zod): `descrizioneTemplate`/`valoreTemplate` come stringhe con limite di lunghezza (es. max 300 caratteri), `titolo`/`totaleLabel` opzionali, `mostraTotale` booleano; includerlo come campo opzionale in `bloccoSchema`.
- Questo chiude la criticità #4: non elimina ogni possibile errore di battitura in un placeholder (resta una stringa), ma elimina strutturalmente il rischio specifico del ciclo `{{#each}}` rotto, perché quel ciclo non esiste più come sintassi scrivibile.

### Step 3 — Motore di rendering
**File:** `lib/pdf/placeholders.ts`
- Estrarre la costruzione del dizionario di sostituzioni (righe 71-158 di `resolvePlaceholders`, oggi inline) in una funzione riutilizzabile `buildReplacements(invoice: InvoiceWithRelations): Record<string, string>`, per evitare di duplicare ~90 righe di logica quando serve lo stesso dizionario dentro ogni riga-mese.
- Aggiungere `renderMesiRows(config: MeseConfig, invoice: InvoiceWithRelations): { descrizione: string; valore: string }[]`:
  - per ogni `invoice.mesi[i]`, unisce `buildReplacements(invoice)` con i token di riga (`{{riga.mese}}`, `{{riga.meseLabel}}`, `{{riga.prezzo}}`, `{{riga.prezzoNumero}}`);
  - applica la sostituzione a `descrizioneTemplate` e `valoreTemplate` (stessa regex di sostituzione già usata in `resolvePlaceholders`, riutilizzata via helper condiviso);
  - **non** chiama `parseInlineFormatting` qui: restituisce le stringhe grezze (con eventuali `<b>/<i>/<note>` ancora dentro), che verranno interpretate a valle esattamente come già avviene oggi per gli altri blocchi — stesso pattern, nessuna duplicazione.
  - se `mostraTotale`, aggiunge una riga finale sintetica `{ descrizione: totaleLabel ?? "Totale", valore: "{{fattura.prezzoTotale}}" }` risolta con lo stesso meccanismo (niente nuova funzione di formattazione valuta: si riusa il placeholder `{{fattura.prezzoTotale}}` già presente in `buildReplacements`).
- `expandEachLoops`/`resolvePlaceholders` restano invariate per retrocompatibilità con i blocchi `tipo: "testo"` già salvati in DB da utenti esistenti (nessuna rottura per i layout legacy).

**File:** `components/invoices/invoice-pdf-document.tsx`
- Nel loop su `settings.blocchi`, quando `blocco.tipo === "mesi"` e `blocco.meseConfig` presente: invece del singolo `<Text>` multilinea attuale, renderizzare (dentro il `<View>` posizionato di quel blocco):
  - una `<Text>` per `titolo` se presente;
  - per ogni riga restituita da `renderMesiRows`, una `<View style={{ flexDirection: "row", justifyContent: "space-between" }}>` contenente due `<Text>` (descrizione a sinistra con `flexGrow: 1`, valore a destra) — ciascuna delle due stringhe passata a `parseInlineFormatting` esattamente come già avviene oggi per il testo dei blocchi generici (righe 106-128 del file attuale), quindi il grassetto/corsivo scelto dall'utente per nome paziente/prezzo funziona senza codice di rendering nuovo.
- Altrimenti (blocchi `tipo !== "mesi"`), mantenere invariato il path esistente `resolvePlaceholders` + `<Text>` singolo.

**File (anteprima nell'editor):** `components/settings/pdf-editor.tsx`, funzione `Block` — stessa diramazione (titolo + righe a due colonne flex) per calcolare l'anteprima in `previewMode`, riusando `renderMesiRows` con `buildMockInvoice()`.

### Step 4 — Nuovo componente UI dedicato
**Nuovo file:** `components/settings/pdf-editor-mesi-panel.tsx`
- Estratto dal pannello proprietà di `pdf-editor.tsx` (che è già ~1250 righe) per tenere la UI del nuovo blocco isolata e testabile.
- Quando `selectedBlock.tipo === "mesi"`, il pannello proprietà mostra questo componente al posto della singola `<Textarea id="testo">` generica. Riusa **lo stesso meccanismo già esistente** in `pdf-editor.tsx` (Textarea + toolbar grassetto/corsivo/nota via `wrapText` + bottoni pillola via `insertPlaceholder`), duplicato in due sezioni indipendenti:
  - **"Descrizione riga"**: Textarea legata a `meseConfig.descrizioneTemplate`, con pillole sia del nuovo gruppo **"Riga mese"** (`{{riga.meseLabel}}`, `{{riga.mese}}`) sia dei gruppi già esistenti in `PLACEHOLDER_GROUPS` (Paziente, Intestatario, Mittente, Fattura) — così l'esempio "a favore di **Nome Paziente** per il mese di GENNAIO" si compone cliccando due pillole, senza scrivere nulla a mano.
  - **"Valore riga (a destra)"**: stessa meccanica, Textarea legata a `meseConfig.valoreTemplate`, con pillole `{{riga.prezzo}}` / `{{riga.prezzoNumero}}`.
  - Input testo per `titolo` (intestazione opzionale sopra le righe).
  - Toggle "Mostra riga totale" + input `totaleLabel` quando attivo.
  - Anteprima live inline (righe con mesi mock via `buildMockInvoice()`, stesso layout a due colonne del PDF finale).

**File:** `components/settings/pdf-editor.tsx`
- Aggiungere `mesi` a `PRESETS` (nuova icona, es. `CalendarDays` da `lucide-react`, label "Mesi/Voci", con `meseConfig` di default invece di `defaultText`).
- In `addBlock`, quando `tipo === "mesi"`, inizializzare `meseConfig` di default invece di (o oltre a) `testo`.
- Nel rendering del pannello proprietà, condizionare: `selectedBlock.tipo === "mesi" ? <PdfEditorMesiPanel .../> : <Textarea .../>` (il resto — posizione, dimensione, font, allineamento — resta condiviso/invariato per tutti i tipi).

### Step 5 — Migrazione del layout di default
**File:** `lib/pdf/layout-default.ts`
- Convertire il blocco `dettaglio-mesi` (righe 90-101) da `tipo: "testo"` + stringa Handlebars a `tipo: "mesi"` + `meseConfig` equivalente: `descrizioneTemplate: "{{riga.meseLabel}}"`, `valoreTemplate: "{{riga.prezzo}}"`, `mostraTotale: true`, `totaleLabel: "Totale"`, `titolo: "Dettaglio mesi"` — layout di default resta minimale (senza nome paziente), l'esempio più ricco dello screenshot resta a disposizione dell'utente come composizione libera nel nuovo pannello, non imposto come default per tutti gli utenti (non tutti sono logoterapisti).

### Step 6 — Compatibilità con layout già salvati
- Nessuna migrazione DB necessaria: `blocchi` resta un campo `Json` in Prisma: i layout utente esistenti con `tipo: "testo"` + `{{#each}}` scritto a mano continuano a funzionare tramite il motore legacy in `placeholders.ts` (Step 3), quindi il rollout è non distruttivo.
- Fuori scope minimo, ma da valutare in review: un bottone "Converti in Blocco Mesi" per chi ha già un blocco each scritto a mano, che tenta un parse best-effort del `testo` esistente e pre-compila `meseConfig`.
- Nota: la migrazione Prisma non ancora applicata in `prisma/migrations/20260717120000_fattura_mesi_prezzo/` riguarda lo schema `FatturaMese`/prezzo mensile, non lo schema del blocco PDF — non ha overlap diretto con questo refactoring.

### Step 7 — Pulizia UI del blocco testo libero (opzionale)
- Valutare se rimuovere `{{fattura.mesi}}` / `{{mese.nome}}` / `{{mese.anno}}` da `PLACEHOLDER_GROUPS` (usati solo nel blocco `testo` generico) per scoraggiare l'uso della sintassi grezza a favore del nuovo blocco dedicato, mantenendo però `{{fattura.mesi}}` (stringa piatta "GIUGNO, LUGLIO") come opzione legittima per chi vuole solo l'elenco nomi senza prezzi in una riga di intestazione.

---

## 3. File coinvolti

### Da modificare
| File | Modifica |
|---|---|
| `lib/pdf/types.ts` | nuovo `TipoBlocco = "mesi"`, tipo `MeseConfig` (con `descrizioneTemplate`/`valoreTemplate`), campo `meseConfig?` su `Blocco`, aggiornamento type guards |
| `lib/validations/pdf-settings.ts` | schema zod per `meseConfig`, nuovo valore enum `tipoBloccoValues` |
| `lib/pdf/placeholders.ts` | estrarre `buildReplacements` (riuso interno), nuova funzione pura `renderMesiRows` (righe descrizione+valore), `expandEachLoops`/`resolvePlaceholders` invariate (legacy) |
| `lib/pdf/layout-default.ts` | blocco `dettaglio-mesi` convertito al nuovo formato strutturato |
| `components/invoices/invoice-pdf-document.tsx` | diramazione rendering per `tipo === "mesi"`: righe a due colonne flex (descrizione sx / valore dx) invece del `<Text>` singolo |
| `components/settings/pdf-editor.tsx` | nuovo preset `mesi`, diramazione pannello proprietà + anteprima `Block` a due colonne, `addBlock` aggiornato |

### Nuovi file proposti
| File | Responsabilità |
|---|---|
| `components/settings/pdf-editor-mesi-panel.tsx` | UI dedicata: due sezioni "Descrizione riga" / "Valore riga" (Textarea + pillole + grassetto/corsivo, stesso meccanismo già esistente), titolo, toggle totale, anteprima live |
| `lib/pdf/mesi-template.ts` *(opzionale)* | `renderMesiRows`/`buildReplacements` estratti qui invece che in `placeholders.ts`, se si preferisce tenere il file legacy invariato e isolare la testabilità della parte nuova |

### Non necessari da toccare
| File | Motivo |
|---|---|
| `app/(protected)/settings/pdf/page.tsx` | Nessuna logica di stato propria: monta solo `PdfEditor` |
| `components/layout/sidebar-content.tsx` | Sidebar di navigazione globale, non gestisce lo stato dei blocchi PDF |
| `lib/actions/settings.ts`, `lib/data/settings.ts` | Persistono `blocchi` come JSON generico già validato a monte da zod; nessuna modifica strutturale richiesta |
| `lib/pdf/formatting.ts` | `parseInlineFormatting` (grassetto/corsivo/nota) è ortogonale e continua a funzionare identico, applicata due volte per riga (descrizione, valore) invece di una sola per blocco |

---

## Prossimi passi

Questo documento è un'analisi/proposta, non ancora un piano di implementazione TDD bite-sized. Se l'approccio viene approvato, il passo successivo è trasformarlo in un piano di implementazione dettagliato (task per task, con test) prima di toccare codice.
