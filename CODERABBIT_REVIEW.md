# Review CodeRabbit — `lib/`

- **Data:** 2026-09-28
- **Branch:** `feature/sistema-ts-integrato`, confrontato con `master`
- **Ambito:** `lib/`, 97 file (`coderabbit review --agent --dir lib`)
- **Esito:** 9 rilievi, 6 major e 3 minor. Risolti: `CR-01`…`CR-06`. Gli altri non sono ancora stati verificati sul codice.
- **Verifica dei fix (2026-09-28):** ricontrollando `CR-01`…`CR-05` sono emersi tre problemi residui, `CR-10`…`CR-12`, ora risolti. Non vengono da CodeRabbit.

| ID | Gravità | Posizione | Problema | Correzione suggerita | Stato |
| :--- | :--- | :--- | :--- | :--- | :---: |
| `CR-01` | **Major** | [`lib/sistemats/client.ts:244-271`](./lib/sistemats/client.ts#L244-L271) | `inviaFile` ritenta automaticamente anche dopo un timeout o un errore di connessione. Se Sogei aveva già ricevuto il file, il retry può inviarlo due volte. | Per `inviaFile`, ritentare solo quando è certo che la richiesta non è arrivata (status HTTP ritentabili, connessione rifiutata). Lasciare i retry sulle operazioni di lettura. | ✅ RISOLTO |
| `CR-02` | **Major** | [`lib/sistemats/services/transmission.service.ts:297-304`](./lib/sistemats/services/transmission.service.ts#L297-L304) | Se `inviaFile` riesce ma il salvataggio successivo nel DB fallisce, il `catch` esegue `rollbackStatoTrasmissione`. Le fatture già trasmesse tornano così `DA_INVIARE`. | Tenere traccia dell'invio riuscito e del protocollo. Dopo un invio riuscito, niente rollback: le fatture restano `IN_TRASMISSIONE` e l'errore va registrato nel log con il protocollo. | ✅ RISOLTO |
| `CR-03` | **Major** | [`lib/sistemats/services/cancellation.service.ts:257-272`](./lib/sistemats/services/cancellation.service.ts#L257-L272) | `ripristinaFatturaPerReinvioService` riporta a `DA_INVIARE` una fattura `IN_TRASMISSIONE` senza condizioni. | Ripristinare solo se `protocollo_ts` è null e `data_invio_ts` è più vecchia della soglia di stallo, con una scrittura condizionata. Se non viene aggiornata nessuna riga, non ripristinare. | ✅ RISOLTO |
| `CR-04` | **Major** | [`lib/actions/invoices.ts:304-310`](./lib/actions/invoices.ts#L304-L310) | In `updateInvoice` e `refreshInvoiceAnagrafica` l'update non filtra su `stato_ts`. Una race può modificare una fattura appena inviata al Sistema TS. | Aggiungere `stato_ts: "DA_INVIARE"` alla `where` dell'update. Se il record non viene trovato, restituire `FATTURA_GIA_INVIATA_TS_ERROR`. | ✅ RISOLTO |
| `CR-05` | **Major** | [`lib/sistemats/services/correction.service.ts:143-147`](./lib/sistemats/services/correction.service.ts#L143-L147) | La correzione sovrascrive campi che il client non ha inviato (`data_pagamento`, `pagamento_tracciato`, `bolloCodice`). Quando `targetCf` è null, perde `pagante.cf` dallo snapshot. | Aggiornare solo i campi forniti e conservare `currentSnap.pagante.cf`. In `correggiFatturaTsSchema`, rendere `dataPagamento` e `pagamentoTracciato` opzionali senza default. | ✅ RISOLTO |
| `CR-06` | **Major** | [`lib/auth/rate-limiter.ts:74-81`](./lib/auth/rate-limiter.ts#L74-L81) | Quando il limiter raggiunge `maxEntries`, elimina il record più vecchio. Un attaccante che riempie la mappa può azzerare il limite di altre chiavi. | Se dopo `sweepExpired` la mappa è ancora piena, rifiutare la nuova chiave con `retryAfterSeconds` e non toccare i record esistenti. | ✅ RISOLTO |
| `CR-07` | Minor | [`lib/sistemats/services/cancellation.service.ts:95-105`](./lib/sistemats/services/cancellation.service.ts#L95-L105) | Il lock di cancellazione (`updateMany`) sovrascrive `data_invio_ts` e fa perdere la data dell'invio originale. | Salvare il timestamp del lock in un campo dedicato, oppure conservare il valore originale e ripristinarlo in ogni percorso di uscita. | ⏳ DA VERIFICARE |
| `CR-08` | Minor | [`lib/sistemats/crypto.ts:23`](./lib/sistemats/crypto.ts#L23) | In produzione, se manca il certificato di default, `loadPublicKeyFromCert` ripiega in silenzio su `MOCK_CERT_PATH`. | In produzione lanciare un errore esplicito. Mantenere il fallback mock fuori dalla produzione e il comportamento attuale quando `certPath` è passato esplicitamente. | ⏳ DA VERIFICARE |
| `CR-09` | Minor | [`lib/archive/formatting.ts:29-41`](./lib/archive/formatting.ts#L29-L41) | Testi non corretti: plurale usato anche per una sola fattura collegata e istruzione al plurale sbagliata. | Usare "c'è 1 fattura collegata" quando è una sola e "Archiviali" al plurale. Aggiornare le asserzioni in `formatting.test.ts`. | ⏳ DA VERIFICARE |
| `CR-10` | **Major** | [`lib/sistemats/services/transmission.service.ts:297-310`](./lib/sistemats/services/transmission.service.ts#L297-L310) | Residuo di CR-01. Con `esitoIncerto` il service esegue comunque `rollbackStatoTrasmissione` e le fatture tornano subito `DA_INVIARE`: se Sogei aveva ricevuto il file, un nuovo clic su "Invia" crea un lotto duplicato. Stesso rischio se il processo muore dopo l'invio: il recupero dei lock orfani le sblocca dopo 5 minuti. | Non sbloccare automaticamente un invio la cui chiamata a Sogei è partita senza un esito certo. Chiedere una verifica esplicita dell'utente sul portale. | ✅ RISOLTO |
| `CR-11` | Minor | [`lib/sistemats/services/transmission.service.ts:17`](./lib/sistemats/services/transmission.service.ts#L17) | `STALE_LOCK_MINUTES = 5` presume che una chiamata a Sogei non superi i 120 s. Con i retry di `inviaFile` si arriva a circa 6 minuti, e `SISTEMATS_TIMEOUT_MS` non ha limiti: un lock può risultare scaduto mentre la chiamata è ancora in volo. | Limitare la durata complessiva di `inviaFile` a un tempo massimo inferiore alla soglia di stallo, con un limite anche sul timeout configurabile. | ✅ RISOLTO |
| `CR-12` | Minor | [`lib/sistemats/services/correction.service.ts:149-187`](./lib/sistemats/services/correction.service.ts#L149-L187) | Stessa race di CR-04 nella correzione Sistema TS. L'update della fattura e la propagazione del CF alle bozze filtrano solo per `id`: una fattura partita nel frattempo verrebbe modificata. | `where` condizionata sullo stato letto e gestione di P2025 per la fattura; `updateMany` con `stato_ts: "DA_INVIARE"` per le bozze. | ✅ RISOLTO |
| `CR-13` | **Major** | [`lib/auth/rate-limit.ts:82-88`](./lib/auth/rate-limit.ts#L82-L88) | Stesso difetto di CR-06 nel limiter del login, ed è l'unico punto in cui è sfruttabile: lo username lo sceglie l'attaccante. Circa 10.000 login falliti su username inventati espellono dalla Map i record bloccati della vittima e ne azzerano il lockout. | Espellere la voce più vecchia non bloccata. Non rifiutare le chiavi nuove, perché al login impedirebbe l'accesso all'utente legittimo. | ✅ RISOLTO |

**Legenda stato:** ⏳ DA VERIFICARE · ⏳ DA CORREGGERE (verificato, fix da fare) · ❌ FALSO POSITIVO · ✅ RISOLTO

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
  - Il rollback a `DA_INVIARE` era rimasto invariato, e né CR-02 né CR-03 lo coprivano: con esito incerto le fatture tornavano subito inviabili. È stato chiuso da CR-10.

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

**Rilievo aperto collegato:** la race di CR-04 sull'update della fattura e sulla propagazione alle bozze è tracciata come `CR-12`.

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

### CR-12 — race di CR-04 nella correzione Sistema TS

Il problema è confermato. `correggiFatturaTsService` controllava `stato_ts` con una `findFirst` e poi scriveva con `update({ where: { id } })`. Un invio concorrente poteva bloccare la fattura nel mezzo, e la correzione finiva su una fattura in trasmissione. La propagazione del CF alle altre bozze aveva la stessa race.

**Correzioni (`lib/sistemats/services/correction.service.ts`):**
- l'update della fattura ha `where: { id, id_Utente, stato_ts: invoice.stato_ts }`, cioè lo stato letto (`DA_INVIARE` o `ANNULLATA_TS`);
- P2025 (`isRecordNotFoundError`) restituisce lo stesso messaggio del controllo iniziale ("fattura già trasmessa o in fase di trasmissione"). Il pagante aggiornato nella stessa transazione torna com'era, e l'action non scrive l'audit;
- la propagazione alle bozze usa `updateMany({ where: { id, stato_ts: "DA_INVIARE" } })`, come `updatePayer`: una bozza partita nel frattempo viene saltata.

**Test (`lib/actions/sistema-ts.test.ts`):**
- nuovo blocco "CR-12": la `where` condizionata con lo stato letto, e con P2025 l'errore senza audit;
- aggiornate le asserzioni esistenti sulla `where` dell'update e sulla propagazione, che ora usa `updateMany`.

### CR-11 — durata massima di `inviaFile` sotto la soglia dei lock orfani

Il problema è confermato. `STALE_LOCK_MINUTES = 5` presumeva che una chiamata a Sogei non superasse i 120 s, ma con 2 retry su 429/503 `inviaFile` poteva durare circa 6 minuti, e `SISTEMATS_TIMEOUT_MS` non aveva limiti. Un lock poteva quindi risultare "orfano" mentre la chiamata era ancora in volo.

**Correzioni:**
- **Nuovo `lib/sistemats/lock-timing.ts`:** contiene sia `STALE_LOCK_MINUTES` (spostato da `transmission.service.ts`) sia il nuovo `MAX_DURATA_INVIO_MS = 4 min`, perché le due soglie dipendono l'una dall'altra.
- **`lib/sistemats/client.ts`:**
  - `executeWithRetry` accetta un budget `{ totalMs, attemptMs }`: un retry parte solo se attesa più tentativo intero stanno ancora entro `totalMs`;
  - `inviaFile` usa come timeout di ogni tentativo `min(timeoutMs, MAX_DURATA_INVIO_MS)`. Nessun tentativo viene accorciato a metà, perché un timeout anticipato renderebbe incerto l'esito;
  - le letture non cambiano.
- **`SistemaTsConfig.maxDurataInvioMs`:** override del tetto, usato dai test.
- Anche l'annullamento usa `inviaFile`, quindi ne beneficia.

**Test (`lib/sistemats/client.test.ts`, blocco "CR-11"):**
- l'invariante `MAX_DURATA_INVIO_MS < STALE_LOCK_MINUTES`;
- con un orologio simulato, lo stop dei retry quando un tentativo intero non ci sta più (l'esito resta non incerto);
- il timeout del singolo tentativo limitato alla durata massima.

### CR-10 — un invio con esito incerto non si sblocca da solo

Il problema è confermato, e i percorsi sono due. Con `esitoIncerto` il service eseguiva `rollbackStatoTrasmissione` prima ancora di guardare il flag, quindi le fatture tornavano `DA_INVIARE` e bastava un clic su "Invia" per creare un duplicato. Inoltre, se il processo moriva dopo l'invio, il recupero dei lock orfani o il pulsante "Sblocca" le sbloccavano dopo 5 minuti, senza distinguere tra un crash avvenuto prima dell'invio e uno avvenuto dopo.

**Correzioni:**
- **Schema:** nuovo campo `Pagamento.invio_avviato_ts` (migration `add_invio_avviato_ts`). Una migration separata, `align_fatture_trasmissioni_pk`, allinea la tabella ponte al formato di Prisma 7: era un drift preesistente, emerso generando questa migration.
- **`lib/sistemats/services/transmission.service.ts`:**
  - `invio_avviato_ts` viene scritto subito prima di `inviaFile`;
  - con `esitoIncerto` non c'è rollback: log `TS_ESITO_INCERTO` (id e nome file) e un messaggio con il nome file e l'ora, che rimanda a "Verifica e sblocca";
  - il rollback resta per i rifiuti certi e per le eccezioni del `catch`, che arrivano per forza da prima del `fetch`. Rollback e registrazione riuscita azzerano il campo;
  - il recupero dei lock orfani richiede `invio_avviato_ts: null`, quindi sblocca da solo solo i crash avvenuti prima dell'invio.
- **`lib/sistemats/services/cancellation.service.ts` → `ripristinaFatturaPerReinvioService`:**
  - con `invio_avviato_ts` valorizzato serve `confermaEsitoVerificato`, e l'invio deve essere più vecchio di `STALE_LOCK_MINUTES`;
  - lo sblocco riguarda **tutto il lotto** (stesso `data_invio_ts`) e avviene con un `updateMany` condizionato. Con `count === 0` non si sblocca nulla e non si scrive l'audit.
- **`lib/actions/sistema-ts.ts` → `ripristinaFatturaPerReinvio(id, opzioni?)`:**
  - vale solo `confermaEsitoVerificato === true`;
  - la meta dell'audit riceve `esitoIncertoConfermato` e `numFatture`;
  - il tipo delle opzioni ha un nome e non è inline, perché i test statici `verify-actions-auth`/`verify-audit-log-coverage` leggono il corpo dalla prima `{`.
- **UI:**
  - `FatturaTsListItem.esitoDaVerificare`;
  - in `lotti-tab.tsx`, vista desktop e mobile, il badge "Esito da verificare" e il pulsante "Verifica e sblocca";
  - il nuovo `dialogs/verifica-esito-dialog.tsx` spiega cosa controllare sul portale e ha una checkbox obbligatoria.

**Fuori scope:** l'annullamento ha lo stesso schema di esito incerto, ma lì un reinvio non genera dati duplicati, perché Sogei scarta il secondo annullamento dello stesso documento.

**Test:**
- `lib/actions/sistema-ts-concurrency.test.ts`, blocco "CR-10":
  - con esito incerto nessun rollback e il log;
  - il recupero dei lock orfani esclude gli invii avviati;
  - lo sblocco senza conferma, o con una conferma non booleana, viene rifiutato;
  - lo sblocco confermato aggiorna il lotto e scrive l'audit;
  - un invio recente viene rifiutato;
  - `count: 0` non scrive l'audit.
- Aggiornati i test che contavano le chiamate `updateMany` o si aspettavano il rollback su esito incerto (`sistema-ts.test.ts`, `sistema-ts-payload-edge-cases.test.ts`, `verify-transmission-rollback-dry.test.ts`, dove le chiamate di rollback restano 6).
- `components/sistema-ts/sistema-ts-manager.test.tsx`: il badge e il dialog con la checkbox obbligatoria.
- Risultato di `npm test`: 1192/1192 passati. `npm run test:db`: 6/6, tutte le migration applicate.

### CR-06 e CR-13 — il tetto delle mappe dei rate limiter azzerava i blocchi

Il problema è confermato. Il tetto di memoria di SEC-04 espelleva la voce più vecchia qualunque fosse, anche se bloccata, e quella chiave ripartiva da zero. Due test (`verify-rate-limiter` SEC-04 e `verify-rate-limit-bounds`) fissavano proprio questo comportamento come atteso.

**Quanto era sfruttabile, a seconda della chiave:**
- **`createRateLimiter` (CR-06):** di fatto no. Quasi tutti i chiamanti usano come chiave l'`userId` della sessione, e le chiavi possibili sono poche quanto gli utenti. `/api/health` usa l'IP: senza `TRUSTED_PROXY` è sempre `"unknown"`, e con Cloudflare servono 5000 IP reali, che danno comunque 30 richieste/min ciascuno.
- **Login, `lib/auth/rate-limit.ts` (CR-13, fuori dall'ambito di CodeRabbit):** sì, perché lo username è a scelta dell'attaccante. Dopo 5 (o 20) tentativi sulla vittima, circa 10.000 login con username inventati espellevano i blocchi della vittima. Il guadagno è limitato (circa 20 password ogni 10.000 richieste, ognuna un bcrypt), ma il lockout veniva aggirato.

**Perché non basta "rifiuta a mappa piena" (la correzione di CodeRabbit):** chi riempie la mappa di voci fresche bloccherebbe tutte le chiavi nuove. Sul login vorrebbe dire impedire l'accesso all'utente legittimo.

**Correzioni:**
- **`lib/auth/rate-limiter.ts`:** a mappa piena, dopo lo sweep, si espelle la voce più vecchia con `count < maxRequests`. Perderla regala al più `maxRequests - 1` richieste. Solo se sono **tutte** bloccate la chiave nuova viene rifiutata (`retryAfterSeconds` fino alla prima finestra in scadenza), senza toccare le voci esistenti: la correzione di CodeRabbit resta come ultima risorsa.
- **`lib/auth/rate-limit.ts` → `evictOldest`:**
  - si espelle la voce più vecchia con `lockedUntil === null`, esclusa quella appena scritta, altrimenti il fallimento appena registrato sparirebbe subito;
  - se tutte le altre sono bloccate (≥ 50.000 bcrypt per l'attaccante) si ricade sulla più vecchia invece di rifiutare, per non impedire il login a tutti.
- Il tetto di memoria resta rigido in entrambi i limiter.

**Test:**
- `scripts/verify-rate-limiter.test.ts`: il test SEC-04 è stato riscritto. Ora la chiave bloccata sopravvive e viene espulsa la più vecchia non bloccata. Nuovi test coprono:
  - il rifiuto con tutte le chiavi bloccate;
  - uno spray di 1000 chiavi che non sblocca la vittima;
  - il ritorno di spazio dopo la scadenza delle finestre.
- `scripts/verify-rate-limit-bounds.test.ts`: con `MAX_ENTRIES_PER_MAP + 500` login su username nuovi, la coppia bloccata resta bloccata e il filler più vecchio (non bloccato) viene espulso.
- Risultato di `npm test`: 1195/1195 passati.
