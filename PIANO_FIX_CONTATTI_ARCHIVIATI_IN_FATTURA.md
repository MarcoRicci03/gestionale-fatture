# Piano — Pagante/paziente archiviato non gestito nella modifica fattura

**Data:** 2026-07-26
**Tipo:** bug fix (non una modifica di regola di business)

## Sintomo riportato

Modificando una fattura il cui pagante o paziente è stato archiviato nel frattempo, il campo corrispondente appare vuoto nel form.

## Causa — tre bug della stessa famiglia

Tutte le liste/lookup di pagante e paziente usate dalla UI fatture provengono da `getPayersAndPatients()` (`lib/data/invoices.ts:98-112`), che filtra esplicitamente `archiviato: false`. È corretto che sia così per le operazioni che assegnano un contatto *nuovo* a una fattura, ma **tre punti** usano quello stesso elenco filtrato anche per operazioni sulla fattura *già esistente*, dove invece serve poter continuare a vedere/usare il contatto già assegnato:

### Bug 1 — la tendina del form di modifica (il sintomo riportato)
`components/invoices/invoice-form.tsx`: le `<option>` di Pagante/Paziente vengono generate solo scorrendo gli array `payers`/`patients` (attivi). Se il pagante o il paziente della fattura in modifica non ci sono dentro, non esiste nessuna `<option>` con quel valore e il browser mostra la tendina vuota — anche se `defaultValues` punta all'ID corretto.

### Bug 2 — il salvataggio fallirebbe comunque (il più serio dei tre)
`lib/actions/invoices.ts:73-97`, funzione `validateInvoiceRelations`, usata sia da `createInvoice` (riga 131) sia da `updateInvoice` (riga 271):

```ts
const payer = await prisma.pagante.findFirst({
  where: { id: id_Pagante, id_Utente: userId, archiviato: false },
});
...
const patient = await prisma.paziente.findFirst({
  where: { id: id_Paziente, id_Utente: userId, archiviato: false },
});
```

**Anche risolvendo solo il Bug 1**, salvare una modifica su una fattura con pagante/paziente archiviato verrebbe comunque rifiutato con "Pagante selezionato non valido" / "Paziente selezionato non valido" — perché `updateInvoice` rivalida sempre entrambe le relazioni con lo stesso filtro `archiviato: false`, indipendentemente dal fatto che l'utente abbia toccato quei campi o no. Senza questo secondo fix, il primo da solo produrrebbe un risultato peggiore del sintomo attuale: la tendina sembrerebbe a posto, ma il salvataggio fallirebbe con un errore che sembra un bug diverso.

### Bug 3 — "Vedi dettagli paziente" nel dialog Dettagli Fattura
`components/invoices/invoices-manager.tsx:621`, dentro il dialog "Dettagli Fattura":

```tsx
onClick={() => {
  const patient = patients.find((p) => p.id === viewingInvoice.paziente!.id);
  if (patient) setViewingPatient(patient);
}}
```

Stessa causa: cerca nell'array filtrato. Se il paziente è archiviato, il click non apre nulla (nessun errore visibile, il dialog semplicemente non si apre). Il bottone gemello "Vedi dettagli pagante" **non ha questo problema**, perché usa direttamente `viewingInvoice.pagante` — la relazione già caricata sulla fattura — invece di cercarla nell'elenco filtrato. È il pattern corretto, mancava solo sul lato paziente.

## Perché il fix non richiede nuove query

`getInvoices()` (`lib/data/invoices.ts:4-22`) include già, per ogni fattura, le relazioni `pagante`/`paziente` **senza filtro su `archiviato`** (commento alla riga 6: *"una fattura è un documento fiscale e resta visibile anche se il pagante o il paziente collegato sono stati archiviati"*). Quindi `InvoicesManager` e `InvoiceForm` hanno già, sul client, il record completo e aggiornato del pagante/paziente della fattura — incluso lo stato `archiviato` — senza bisogno di nessuna fetch aggiuntiva. Il fix è quasi interamente un problema di *dove si va a cercare* il dato, non di dati mancanti.

## Modifiche

### 1. Nuovo modulo puro — `lib/invoices/contact-options.ts`

Estraggo la logica di merge in funzioni pure e testabili, sullo stesso modello di `lib/invoices/chronology.ts`/`lib/invoices/anagrafica-snapshot.ts` (regole condivise tra UI e test, non tra UI e Server Action in questo caso):

```ts
import type { Pagante, Paziente } from "@prisma/client";

// Le tendine pagante/paziente del form fattura ricevono solo i contatti
// attivi (getPayersAndPatients filtra archiviato: false): reinserisce SOLO
// il contatto già assegnato a QUESTA fattura, se archiviato e non già
// presente — mai altri contatti archiviati. Creare una fattura, o
// riassegnarne una esistente a un contatto diverso, deve continuare a
// richiedere un contatto attivo.
export function withCurrentPayer(
  payers: Pagante[],
  current: Pagante | null | undefined
): Pagante[] {
  if (!current || payers.some((p) => p.id === current.id)) return payers;
  return [...payers, current];
}

export function withCurrentPatient<T extends Paziente & { pagante: Pagante | null }>(
  patients: T[],
  current: Paziente | null | undefined,
  currentPayer: Pagante | null | undefined
): T[] {
  if (!current || patients.some((p) => p.id === current.id)) return patients;
  return [...patients, { ...current, pagante: currentPayer ?? null } as T];
}
```

`currentPayer` viene passato esplicitamente invece di dedurlo da `current.id_Pagante` perché serve l'oggetto `Pagante` completo per il campo annidato `pagante` richiesto dal tipo di riga usato altrove (`Paziente & { pagante: Pagante | null }`), e per una fattura esistente `paziente.id_Pagante === invoice.id_Pagante` è già garantito da `validateInvoiceRelations` al momento del salvataggio — non serve ricontrollarlo qui.

### 2. `components/invoices/invoice-form.tsx` — usa gli elenchi "effettivi"

```ts
import { withCurrentPayer, withCurrentPatient } from "@/lib/invoices/contact-options";
...
const effectivePayers = useMemo(
  () => withCurrentPayer(payers, inv?.pagante),
  [payers, inv]
);
const effectivePatients = useMemo(
  () => withCurrentPatient(patients, inv?.paziente, inv?.pagante),
  [patients, inv]
);
```

Sostituire ogni uso di `payers`/`patients` nel corpo del componente con `effectivePayers`/`effectivePatients`:
- il `.map()` che genera le `<option>` di Pagante;
- `filteredPatients` (che oggi filtra `patients`, va filtrata `effectivePatients`);
- l'`useEffect` di autocompilazione città/CAP (`payers.find(...)`), per coerenza — così un pagante archiviato compila città/CAP allo stesso modo di uno attivo, invece di no-oppare silenziosamente.

**Etichetta delle opzioni**: quando il contatto iniettato è archiviato, aggiungere il suffisso `" (archiviato)"` all'etichetta della `<option>` (stesso testo già usato in `patients-manager.tsx` per i paganti archiviati) — senza, l'opzione comparirebbe indistinguibile da un contatto attivo, il che confonderebbe più che risolvere il problema.

### 3. `lib/actions/invoices.ts` — permettere di mantenere (non riassegnare) un contatto archiviato

Estendere `validateInvoiceRelations` con un parametro opzionale che esenta dal filtro `archiviato: false` solo l'id che **non sta cambiando** rispetto a quello già salvato:

```ts
async function validateInvoiceRelations(
  userId: number,
  id_Pagante: number,
  id_Paziente: number,
  unchanged?: { id_Pagante: number; id_Paziente: number }
): Promise<RelationValidationResult> {
  const payer = await prisma.pagante.findFirst({
    where: {
      id: id_Pagante,
      id_Utente: userId,
      ...(unchanged?.id_Pagante === id_Pagante ? {} : { archiviato: false }),
    },
  });
  if (!payer) return { error: "Pagante selezionato non valido" };

  const patient = await prisma.paziente.findFirst({
    where: {
      id: id_Paziente,
      id_Utente: userId,
      ...(unchanged?.id_Paziente === id_Paziente ? {} : { archiviato: false }),
    },
  });
  if (!patient) return { error: "Paziente selezionato non valido" };

  if (patient.id_Pagante !== id_Pagante) {
    return { error: "Il paziente non è associato al pagante selezionato" };
  }
  return { payer, patient };
}
```

- **`createInvoice`** (riga 131): chiamata invariata, senza il 4° argomento → continua a richiedere sempre un contatto attivo. Nessuna modifica al comportamento di creazione, come richiesto.
- **`updateInvoice`** (riga 271): passa `{ id_Pagante: existing.id_Pagante, id_Paziente: existing.id_Paziente }` (`existing` è già letto poco sopra, righe 236-239, con quei due campi già nel `select`). Se l'utente **riassegna** la fattura a un pagante/paziente diverso, quel nuovo id resta soggetto al filtro `archiviato: false` (comportamento invariato per la riassegnazione) — solo mantenere lo stesso id già presente sulla fattura diventa consentito anche se nel frattempo è stato archiviato.

Questo copre esattamente i due casi richiesti impliciti nella segnalazione: vedere il contatto nel form, e riuscire a salvare senza doverlo cambiare.

### 4. `components/invoices/invoices-manager.tsx` — Bug 3

Riga 621, sostituire la ricerca nell'array filtrato con la relazione già caricata sulla fattura, stesso pattern già usato per "Vedi dettagli pagante":

```tsx
onClick={() => {
  if (viewingInvoice.paziente) setViewingPatient(viewingInvoice.paziente);
}}
```

Nota: `viewingInvoice.paziente` non porta con sé la relazione annidata `pagante` (a differenza delle righe di `patients`), ma il dialog "Dettagli Paziente" la usa per mostrare il pagante associato (righe 810-844). Va quindi passato un oggetto arricchito, riusando lo stesso helper del punto 1:

```tsx
onClick={() => {
  if (!viewingInvoice.paziente) return;
  setViewingPatient({ ...viewingInvoice.paziente, pagante: viewingInvoice.pagante ?? null });
}}
```

(non serve `withCurrentPatient` qui: non c'è un elenco da arricchire, solo un singolo oggetto da passare al dialog.)

## Cosa NON cambia

- La creazione di una nuova fattura continua a richiedere un pagante e un paziente attivi: nessuna tendina mostra contatti archiviati diversi da quello già assegnato alla fattura in modifica.
- Riassegnare una fattura a un contatto diverso continua a richiedere che sia attivo.
- Nessuna riattivazione implicita: salvare una fattura mantenendo il contatto archiviato non lo riporta attivo, resta archiviato.
- `getPayersAndPatients()`/`getInvoices()` restano invariate: nessuna nuova query, il dato serve già.

## Test

| File | Cosa copre |
|---|---|
| `lib/invoices/contact-options.test.ts` (nuovo) | `withCurrentPayer`: non aggiunge nulla se il contatto è già presente o è `null`/`undefined`; aggiunge il contatto se assente. `withCurrentPatient`: stesso comportamento, più la corretta attribuzione di `pagante` nell'oggetto iniettato. |
| `scripts/verify-invoice-lifecycle.test.ts` (esteso) | Se questo file testa già logica di ciclo di vita fattura in isolamento — verificare come sono strutturati i test esistenti prima di aggiungere qui i casi su `validateInvoiceRelations`; in alternativa nuovo `scripts/verify-invoice-archived-contact.test.ts` dedicato, seguendo lo stile con Prisma mockato se già presente altrove, o documentando il comportamento atteso se l'azione non è testata a questo livello nel resto del progetto. |
| `components/invoices/invoice-form.test.tsx` (nuovo, se non già coperto) | Render con un `invoice` la cui `paziente`/`pagante` non compare in `patients`/`payers` (simulando l'archiviazione) → verificare che l'opzione corrispondente sia comunque presente e selezionata nel `<select>`. |

La verifica esatta del punto 2 (dove/come testare `validateInvoiceRelations`) va decisa guardando prima come il resto di `lib/actions/*.ts` è coperto oggi (a colpo d'occhio, nessuna Server Action sembra avere test diretti con Prisma mockato in questo progetto — la logica di business è quasi sempre estratta in moduli puri come `lib/invoices/chronology.ts` proprio per essere testabile senza Prisma). Se è così, il modo più coerente con lo stile del progetto è **non** mockare Prisma, ma coprire il comportamento tramite un test end-to-end aggiunto a `e2e/` oppure lasciarlo alla verifica manuale sotto — da confermare in fase di implementazione.

## Verifica

```sh
npx tsc --noEmit
npm run lint
npm test
```

Prova manuale:
1. Creare pagante A, paziente P collegato ad A, e una fattura F per P/A.
2. Archiviare P (e/o A) dalla relativa pagina.
3. Aprire F in modifica: il campo Paziente (e/o Pagante) deve mostrare il contatto corretto (con eventuale suffisso "(archiviato)"), non vuoto.
4. Salvare F **senza** cambiare pagante/paziente → deve salvare correttamente.
5. Provare a riassegnare F a un paziente diverso, attivo → deve funzionare normalmente.
6. Aprire il dettaglio di F e cliccare "Vedi dettagli paziente" → deve aprirsi anche se P è archiviato.

## Ordine di esecuzione

1. `lib/invoices/contact-options.ts` + test.
2. `components/invoices/invoice-form.tsx` (Bug 1).
3. `lib/actions/invoices.ts` (Bug 2 — il più importante dei tre, senza il quale il punto 2 da solo non basta a salvare).
4. `components/invoices/invoices-manager.tsx` (Bug 3, indipendente dagli altri).
5. Verifica finale + prova manuale.

Un solo commit: i tre bug condividono la stessa causa e lo stesso commit di `lib/data/invoices.ts` che li spiega tutti — separarli non aggiungerebbe chiarezza.
