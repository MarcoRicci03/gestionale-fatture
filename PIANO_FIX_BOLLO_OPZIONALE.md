# Piano — Marca da bollo facoltativa anche sopra soglia

**Data:** 2026-07-26
**Tipo:** modifica di una regola di business esistente (non un bug)

## Richiesta

La marca da bollo resta dovuta per legge sopra €77,47 (`SOGLIA_BOLLO`), ma l'app non deve più bloccare:

1. la **creazione** di una fattura sopra soglia senza codice bollo (per comodità: il codice si aggiunge quando disponibile);
2. la **rimozione** del codice bollo in fase di modifica, anche se il totale resta sopra soglia.

## Contesto — stiamo invertendo un fix precedente

`invoiceSchema` (`lib/validations/invoice.ts`, righe 85-98) ha oggi un `superRefine` che **rifiuta** la validazione se il totale supera la soglia e `bolloCodice` è vuoto:

```ts
.superRefine((data, ctx) => {
  const totale = roundCurrency(data.mesi.reduce((somma, m) => somma + m.prezzo, 0));
  if (totale > SOGLIA_BOLLO && !data.bolloCodice) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["bolloCodice"],
      message: `Il totale supera ${SOGLIA_BOLLO}€: è obbligatorio indicare il codice della marca da bollo`,
    });
  }
});
```

Questo blocco è condiviso da `zodResolver` nel form client **e** da `createInvoice`/`updateInvoice` lato server (stesso schema) — quindi oggi è impossibile salvare o aggiornare una fattura sopra soglia senza codice, in entrambi i punti.

Il commento in testa a `scripts/verify-invoice-bollo-threshold.test.ts` spiega perché è stato introdotto: prima di quel fix, l'obbligo era solo un avviso client-side aggirabile chiamando la Server Action direttamente, producendo "documenti fiscalmente non conformi". **Questo piano rimuove volutamente quella garanzia**, su tua richiesta esplicita: da qui in poi l'app traccia e segnala il bollo dovuto, ma non impedisce più di salvare senza. La responsabilità di completare il codice torna a carico di chi usa il gestionale.

## Perché il fix è piccolo

Il resto della codebase è **già scritto per il modello "facoltativo con avviso"**, non per quello bloccante:

- `components/invoices/invoice-form.tsx` (righe 129-130, 329-336): calcola `bolloMancante` e mostra un avviso non bloccante il cui testo dice già *"Inserisci il codice quando disponibile"* — non un errore che impedisce il submit.
- `components/invoices/invoices-manager.tsx` (righe 292-300, 649-660): mostra già un'icona di avviso ⚠️ per fatture esistenti sopra soglia senza bollo, sia nella tabella che nel dettaglio — cioè questo stato è già gestito come legittimo ovunque nella UI.
- `lib/actions/invoices.ts`: `createInvoice`/`updateInvoice` scrivono già `bolloCodice: bolloCodice ?? null` senza altre condizioni; l'unico controllo aggiuntivo (`isBolloCodiceTaken`) è già `if (bolloCodice && ...)`, quindi si salta da solo quando il campo è vuoto.
- `lib/pdf/placeholders.ts`, `lib/excel/column-catalog.ts`: già gestiscono `bolloCodice: null` senza errori (stringa vuota o "n/d").

L'unico punto che blocca davvero è il `superRefine`. Tolto quello, **creazione e rimozione in modifica funzionano automaticamente** — non serve toccare le Server Action né i componenti.

## Modifiche

### 1. `lib/validations/invoice.ts`
- Rimuovere l'intero blocco `.superRefine((data, ctx) => {...})` (righe 85-98).
- Rimuovere `SOGLIA_BOLLO` dall'import in cima al file (`BOLLO_CODICE_REGEX` resta: il formato a 14 cifre, quando un codice *viene* inserito, non cambia).
- Nessun'altra modifica allo schema: la regex del campo `bolloCodice` (14 cifre se valorizzato) resta invariata.

### 2. Test da aggiornare

| File | Modifica |
|---|---|
| `scripts/verify-invoice-bollo-threshold.test.ts` | Riscritto: da "verifica che il bollo sia obbligatorio sopra soglia" a "verifica che il bollo NON sia più obbligatorio sopra soglia, il formato resti validato se fornito, e sia possibile azzerarlo anche sopra soglia". Aggiunto un test esplicito per il caso "modifica" (parse con `bolloCodice: ""` su un totale sopra soglia deve avere successo). |
| `lib/validations/invoice.test.ts` | Rimosso/invertito il test "richiede il codice bollo quando il totale supera la soglia" (righe 26-36), che oggi asserisce il comportamento opposto a quello voluto. |
| `scripts/verify-currency-rounding.test.ts` | Nessuna modifica funzionale (il test asserisce già `success: true` per un totale esattamente pari alla soglia, che resta vero); solo il commento in testa (righe 8-14, 36-40), che cita "il superRefine di invoiceSchema", va aggiornato per non riferirsi a un blocco che non esiste più. |

### 3. Cosa NON cambia (per essere espliciti)

- `SOGLIA_BOLLO` (77,47€) e `IMPORTO_BOLLO` (2€) restano gli stessi: la soglia normativa non cambia, cambia solo se l'app la fa rispettare a forza.
- Gli avvisi visivi in `invoice-form.tsx`/`invoices-manager.tsx` restano identici: sono già corretti per il nuovo comportamento.
- Il formato del codice (14 cifre) resta obbligatorio *quando* lo si inserisce — non stiamo permettendo codici invalidi, solo l'assenza del codice.
- Il controllo di unicità (`isBolloCodiceTaken`) resta invariato.

## Effetti collaterali preesistenti (fuori scope, solo per consapevolezza)

- `{{fattura.totaleConBollo}}` (`lib/pdf/placeholders.ts`) aggiunge i 2€ di bollo solo se `bolloCodice` è valorizzato: un PDF stampato prima di inserire il codice mostrerà il totale senza quei 2€. Comportamento già esistente oggi (si può già lasciare vuoto sotto soglia), non introdotto da questo fix — segnalo solo perché ora capiterà più spesso (sopra soglia, non solo sotto).
- L'audit log di `INVOICE_UPDATE` non registra quali campi sono cambiati (bollo incluso) — limite generale già noto (LOG-03 della roadmap), non specifico di questo fix: non lo tocco qui perché riguarderebbe ogni campo della fattura, non solo il bollo.

## Verifica

```sh
npx tsc --noEmit
npm run lint
npm test
```

Prova manuale:
1. Creare una fattura con totale > 77,47€ senza codice bollo → deve salvare, mostrando l'avviso ⚠️ nella lista.
2. Aprire in modifica una fattura sopra soglia **con** codice bollo già presente, svuotare il campo e salvare → deve salvare, l'avviso ⚠️ deve ricomparire nella lista.

## Ordine di esecuzione

1. Rimuovere il `superRefine` e l'import inutilizzato in `lib/validations/invoice.ts`.
2. Aggiornare i tre file di test.
3. Verifica finale (`tsc`, `lint`, `test`) + prova manuale sopra.

Un solo commit: è una modifica isolata a una singola regola, non ha senso spezzarla in step intermedi.
