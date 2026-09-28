# Review CodeRabbit — `lib/`

- **Data:** 2026-09-28
- **Branch:** `feature/sistema-ts-integrato`, confrontato con `master`
- **Ambito:** `lib/`, 97 file (`coderabbit review --agent --dir lib`)
- **Esito:** 9 rilievi, 6 major e 3 minor. Risolti: `CR-01`…`CR-05`. Gli altri non sono ancora stati verificati sul codice.

| ID | Gravità | Posizione | Problema | Correzione suggerita | Stato |
| :--- | :--- | :--- | :--- | :--- | :---: |
| `CR-01` | **Major** | [`lib/sistemats/client.ts:244-271`](./lib/sistemats/client.ts#L244-L271) | `inviaFile` ritenta automaticamente anche dopo un timeout o un errore di connessione. Se Sogei aveva già ricevuto il file, il retry può inviarlo due volte. | Per `inviaFile`, ritentare solo quando è certo che la richiesta non è arrivata (status HTTP ritentabili, connessione rifiutata). Lasciare i retry sulle operazioni di lettura. | ✅ RISOLTO |
| `CR-02` | **Major** | [`lib/sistemats/services/transmission.service.ts:297-304`](./lib/sistemats/services/transmission.service.ts#L297-L304) | Se `inviaFile` riesce ma il salvataggio successivo nel DB fallisce, il `catch` esegue `rollbackStatoTrasmissione`. Le fatture già trasmesse tornano così `DA_INVIARE`. | Tenere traccia dell'invio riuscito e del protocollo. Dopo un invio riuscito, niente rollback: le fatture restano `IN_TRASMISSIONE` e l'errore va registrato nel log con il protocollo. | ✅ RISOLTO |
| `CR-03` | **Major** | [`lib/sistemats/services/cancellation.service.ts:257-272`](./lib/sistemats/services/cancellation.service.ts#L257-L272) | `ripristinaFatturaPerReinvioService` riporta a `DA_INVIARE` una fattura `IN_TRASMISSIONE` senza condizioni. | Ripristinare solo se `protocollo_ts` è null e `data_invio_ts` è più vecchia della soglia di stallo, con una scrittura condizionata. Se non viene aggiornata nessuna riga, non ripristinare. | ✅ RISOLTO |
| `CR-04` | **Major** | [`lib/actions/invoices.ts:304-310`](./lib/actions/invoices.ts#L304-L310) | In `updateInvoice` e `refreshInvoiceAnagrafica` l'update non filtra su `stato_ts`. Una race può modificare una fattura appena inviata al Sistema TS. | Aggiungere `stato_ts: "DA_INVIARE"` alla `where` dell'update. Se il record non viene trovato, restituire `FATTURA_GIA_INVIATA_TS_ERROR`. | ✅ RISOLTO |
| `CR-05` | **Major** | [`lib/sistemats/services/correction.service.ts:143-147`](./lib/sistemats/services/correction.service.ts#L143-L147) | La correzione sovrascrive campi che il client non ha inviato (`data_pagamento`, `pagamento_tracciato`, `bolloCodice`). Quando `targetCf` è null, perde `pagante.cf` dallo snapshot. | Aggiornare solo i campi forniti e conservare `currentSnap.pagante.cf`. In `correggiFatturaTsSchema`, rendere `dataPagamento` e `pagamentoTracciato` opzionali senza default. | ✅ RISOLTO |
| `CR-06` | **Major** | [`lib/auth/rate-limiter.ts:74-81`](./lib/auth/rate-limiter.ts#L74-L81) | Quando il limiter raggiunge `maxEntries`, elimina il record più vecchio. Un attaccante che riempie la mappa può azzerare il limite di altre chiavi. | Se dopo `sweepExpired` la mappa è ancora piena, rifiutare la nuova chiave con `retryAfterSeconds` e non toccare i record esistenti. | ⏳ DA VERIFICARE |
| `CR-07` | Minor | [`lib/sistemats/services/cancellation.service.ts:95-105`](./lib/sistemats/services/cancellation.service.ts#L95-L105) | Il lock di cancellazione (`updateMany`) sovrascrive `data_invio_ts` e fa perdere la data dell'invio originale. | Salvare il timestamp del lock in un campo dedicato, oppure conservare il valore originale e ripristinarlo in ogni percorso di uscita. | ⏳ DA VERIFICARE |
| `CR-08` | Minor | [`lib/sistemats/crypto.ts:23`](./lib/sistemats/crypto.ts#L23) | In produzione, se manca il certificato di default, `loadPublicKeyFromCert` ripiega in silenzio su `MOCK_CERT_PATH`. | In produzione lanciare un errore esplicito. Mantenere il fallback mock fuori dalla produzione e il comportamento attuale quando `certPath` è passato esplicitamente. | ⏳ DA VERIFICARE |
| `CR-09` | Minor | [`lib/archive/formatting.ts:29-41`](./lib/archive/formatting.ts#L29-L41) | Testi non corretti: plurale usato anche per una sola fattura collegata e istruzione al plurale sbagliata. | Usare "c'è 1 fattura collegata" quando è una sola e "Archiviali" al plurale. Aggiornare le asserzioni in `formatting.test.ts`. | ⏳ DA VERIFICARE |

**Legenda stato:** ⏳ DA VERIFICARE · ❌ FALSO POSITIVO · ✅ RISOLTO

## Fix applicati

### CR-01 — retry di `inviaFile` limitato ai casi sicuri

Il problema è confermato: `inviaFile` usava la stessa policy di retry delle letture, e quindi ritentava su timeout, ECONNRESET, "fetch failed" generico, 502 e 504.

**Correzioni:**
- **`lib/sistemats/client.ts`:**
  - nuova funzione `isSafeToRetrySubmission()`, che dà `true` solo per HTTP 429/503 e per errori di connessione mai stabilita (`ECONNREFUSED`, `ENOTFOUND`, `EAI_AGAIN`, `UND_ERR_CONNECT_TIMEOUT`, cercati anche nella `cause`);
  - `executeWithRetry` accetta un predicato `shouldRetry`, che `inviaFile` usa al posto di quello standard;
  - quando fallisce in un caso ambiguo, `inviaFile` restituisce `esitoIncerto: true`.
- **Letture** (`interrogaEsito`, `scaricaRicevutaPdf`, `scaricaDettaglioErrori`): i retry restano quelli di prima.
- **`lib/sistemats/services/transmission.service.ts`:** se l'esito è incerto, l'utente riceve l'avviso di verificare sul portale Sistema TS prima di reinviare.
  - Il rollback a `DA_INVIARE` resta invariato: rientra in CR-02/CR-03.

**Test:**
- `lib/sistemats/client.test.ts`: nuovo blocco "CR-01" e test di `isSafeToRetrySubmission`. Aggiornati i due test che fissavano il retry su ECONNRESET.
- `lib/actions/sistema-ts.test.ts`: nuovo test del messaggio di esito incerto.
- Risultato di `npm test`: 1160/1160 passati.

### CR-02 — protocollo acquisito ma non registrato nel DB

Il problema è confermato, con un aggravante che CodeRabbit non ha visto. Saltare il rollback non basta: fatture lasciate `IN_TRASMISSIONE` con `protocollo_ts` nullo vengono comunque riportate a `DA_INVIARE` dal recupero dei lock orfani (dopo 5 minuti, al primo invio successivo).

**Correzioni (`lib/sistemats/services/transmission.service.ts`):**
- `protocolloAcquisito` viene impostato appena Sogei restituisce il protocollo. Da quel punto il `catch` non esegue più `rollbackStatoTrasmissione`, che resta solo per gli errori prima dell'invio.
- La registrazione (`TrasmissioneTs` + fatture `INVIATA`) viene provata due volte. Una violazione di unicità su `protocollo` al secondo tentativo vale come "già registrata".
- Se anche il secondo tentativo fallisce, `gestisciProtocolloNonRegistrato()`:
  - scrive `protocollo_ts` sulle fatture ancora `IN_TRASMISSIONE` del lock, così il recupero dei lock orfani non le tocca;
  - logga `TS_PROTOCOLLO_NON_REGISTRATO` con protocollo, nome file e id fatture;
  - mostra all'utente il protocollo e l'avviso "NON reinviare".

**Limite residuo:** se il DB è del tutto irraggiungibile, fallisce anche la scrittura di ripiego e il protocollo resta solo nel log e nel messaggio. Le fatture rimaste `IN_TRASMISSIONE` con protocollo ma senza `TrasmissioneTs` vanno sistemate a mano. "Ripristina per reinvio" oggi le riporterebbe a `DA_INVIARE` senza condizioni: è CR-03.

**Test:**
- `lib/actions/sistema-ts-concurrency.test.ts`, blocco "CR-02":
  - errore transitorio → successo al secondo tentativo;
  - violazione di unicità su `protocollo` → successo;
  - errore persistente → nessun rollback, scrittura di ripiego, log e messaggio.
- `scripts/verify-transmission-rollback-dry.test.ts`: invariato e verde (6 chiamate di rollback).
- Risultato di `npm test`: 1163/1163 passati.

### CR-03 — "Sblocca / Ripristina per reinvio" senza condizioni

Il problema è confermato ed è più ampio del rilievo. Il pulsante "Sblocca" (`lotti-tab.tsx`) riportava a `DA_INVIARE` qualsiasi fattura `IN_TRASMISSIONE` e ne azzerava il protocollo. Questo valeva anche per le fatture già sul Sistema TS, cioè annullamenti in corso e lotti acquisiti ma non registrati (CR-02), e per invii con la chiamata a Sogei ancora in volo.

**Correzioni:**
- **`lib/sistemats/services/cancellation.service.ts` → `ripristinaFatturaPerReinvioService`:**
  - una fattura `IN_TRASMISSIONE` con `protocollo_ts` valorizzato viene rifiutata, e il messaggio riporta il protocollo;
  - viene rifiutata anche se il lock è più recente di `STALE_LOCK_MINUTES`;
  - la scrittura ora è un `updateMany` condizionato, che ripete le stesse condizioni nella `where`: per `ANNULLATA_TS` lo stato, per `IN_TRASMISSIONE` protocollo nullo e lock scaduto. Con `count === 0` non si ripristina nulla e non si scrive l'audit.
- **`STALE_LOCK_MINUTES`:** prima era duplicato in due service, ora è esportato una sola volta da `transmission.service.ts`.

**Limite residuo:** una fattura rimasta `IN_TRASMISSIONE` con protocollo dopo un annullamento interrotto da un crash non si può più sbloccare dall'interfaccia e va sistemata a mano. È raro, perché il flusso di annullamento rilascia il lock su tutti gli errori gestiti. Se capita, la si può distinguere dal caso CR-02 controllando se esiste un `TrasmissioneTs` con quel protocollo e spostarla su `DA_CANCELLARE_SU_TS`.

**Test:**
- `lib/actions/sistema-ts.test.ts`: la scrittura condizionata per `ANNULLATA_TS` e il caso `count: 0`.
- `lib/actions/sistema-ts-concurrency.test.ts`: lo sblocco con lock scaduto e i rifiuti per lock recente e per protocollo presente.
- Risultato di `npm test`: 1166/1166 passati.

### CR-04 — modifica di una fattura partita nel frattempo per il Sistema TS

Il problema è confermato. `updateInvoice` e `refreshInvoiceAnagrafica` controllavano `stato_ts` con una `findFirst` e poi scrivevano con `update({ where: { id, id_Utente } })`, senza ricontrollare lo stato. Un invio concorrente poteva bloccare la fattura in mezzo, e la modifica finiva su una fattura già in trasmissione o trasmessa. La stessa race c'era anche in un punto non segnalato da CodeRabbit: la propagazione dell'anagrafica alle bozze in `updatePayer`.

**Correzioni** (stesso schema già usato da `deleteInvoice` per ERR-04):
- **`lib/actions/invoices.ts` → `updateInvoice`:**
  - `stato_ts: "DA_INVIARE"` aggiunto alla `where` dell'update;
  - P2025 (`isRecordNotFoundError`) restituisce `FATTURA_GIA_INVIATA_TS_ERROR`;
  - i mesi, annidati nello stesso update, non vengono toccati.
- **`lib/actions/invoices.ts` → `refreshInvoiceAnagrafica`:** stessa `where`, e con P2025 restituisce `ANAGRAFICA_FATTURA_TS_ERROR`.
- **`lib/actions/payers.ts` → `updatePayer`, propagazione alle bozze:** `update({ where: { id } })` diventa `updateMany({ where: { id, stato_ts: "DA_INVIARE" } })`. Una bozza partita nel frattempo viene saltata senza far fallire l'aggiornamento del pagante.
- In tutti e tre i casi l'audit non viene scritto se la scrittura non avviene.

**Test:**
- `lib/actions/invoices-guards.test.ts`, blocco "CR-04": per `updateInvoice` e `refreshInvoiceAnagrafica` verifica la `where` condizionata, il messaggio d'errore con P2025 e l'assenza di audit.
- `lib/actions/payers.test.ts`: la propagazione usa `updateMany` con lo stato nella `where`.
- Risultato di `npm test`: 1168/1168 passati.

### CR-05 — correzione TS con campi non inviati e CF perso

Il problema è confermato, con un campo in più rispetto al rilievo. Lo schema dava un default ai campi salvati: `dataPagamento` → `null`, `pagamentoTracciato` → `true` e anche `flagOpposizione` → `false`, che CodeRabbit non cita. Il service scriveva poi `bolloCodice ?? null`. Un chiamante che ometteva un campo azzerava quindi la data di incasso e il bollo, trasformava un pagamento in contanti in tracciato e revocava l'opposizione. Il dialog attuale manda sempre tutti i campi, ma i test dell'action no: azzeravano quei campi senza che nessuna asserzione lo notasse. In più, con l'opposizione e il CF vuoto, lo snapshot perdeva `pagante.cf`, che si stampa sul PDF. L'opposizione riguarda solo la trasmissione, e XML e service omettono già `cfCittadino`.

**Correzioni:**
- **`lib/validations/sistema-ts-correction.ts`:** `dataPagamento`, `pagamentoTracciato` e `flagOpposizione` sono `.optional()` senza default. Un campo omesso resta `undefined`, mentre `""`/`null` espliciti diventano `null`. `aggiornaAnagrafica` e `propagaFattureInAttesa` tengono il default perché sono opzioni di comportamento.
- **`lib/sistemats/services/correction.service.ts`:**
  - il parametro è tipizzato come `CorreggiFatturaTsData` (output Zod) invece che come input;
  - i valori passano a Prisma così come sono: `undefined` lascia il campo invariato, `null` esplicito lo svuota;
  - `opposizioneEffettiva` = valore inviato o, in mancanza, quello salvato. Senza opposizione si valida il CF effettivo (nuovo o dello snapshot), così si può correggere solo la data senza rimandare il CF;
  - lo snapshot usa `nuovoCf ?? currentSnap.pagante.cf`, quindi non perde mai il CF;
  - l'aggiornamento dell'anagrafica, il controllo di unicità e la propagazione alle bozze partono solo con un CF inviato esplicitamente;
  - `cfModificato` si confronta con lo snapshot della fattura.
- `fix-invoice-ts-dialog.tsx` è invariato.

**Rilievo aperto collegato (fuori scope):** l'update della fattura filtra solo per `id` e non ricontrolla `stato_ts`. È la stessa race di CR-04: un invio concorrente tra la `findFirst` e l'update. Il fix possibile è `where: { id, stato_ts: { in: ["DA_INVIARE", "ANNULLATA_TS"] } }` con la gestione di P2025.

**Test:**
- `lib/actions/sistema-ts.test.ts`, blocco "CR-05":
  - i campi omessi restano `undefined` nell'update;
  - `null` esplicito svuota bollo e data;
  - vale l'opposizione salvata;
  - senza nuovo CF non si aggiorna l'anagrafica e non si propaga;
  - si può correggere la sola data con il CF salvato;
  - la correzione viene rifiutata se il CF salvato non è valido.
- Il test sull'opposizione ora verifica che il CF resti nello snapshot.
- Il blocco CR-05 azzera `mockPagamentoFindFirst`/`mockPaganteFindFirst`: un test precedente lascia un `mockResolvedValueOnce` mai consumato.
- Nuovo `lib/validations/sistema-ts-correction.test.ts`.
- Risultato di `npm test`: 1179/1179 passati.
