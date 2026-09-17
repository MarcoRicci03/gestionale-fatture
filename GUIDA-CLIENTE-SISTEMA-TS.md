# Guida Operativa: Integrazione Sistema Tessera Sanitaria (Sistema TS)

Benvenuto nella guida operativa per l'invio telematico delle spese sanitarie al **Sistema Tessera Sanitaria (Sistema TS)**, il portale del Ministero dell'Economia e delle Finanze (MEF) utilizzato per predisporre il **730 precompilato** per i tuoi pazienti.

Questa nuova funzionalità ti permette di inviare, consultare e gestire le tue fatture sanitarie direttamente dal gestionale con un semplice clic, senza dover compilare manualmente i dati sul portale del Ministero.

---

## 1. Configurazione Iniziale (Da fare una sola volta)

Per poter comunicare con il Ministero, è necessario inserire le tue credenziali professionali fornite dal Sistema TS:

1. Nel menu laterale, vai su **Impostazioni** ➔ **Sistema TS** (oppure accedi alla pagina di configurazione).
2. Compila i campi richiesti:
   - **Nome Utente**: il tuo Codice Fiscale da professionista sanitario.
   - **Password**: la tua password di accesso al portale Sistema TS.
   - **Pincode**: il codice PIN numerico di sicurezza rilasciato dal Ministero insieme alle credenziali.
   - **Natura IVA predefinita**: impostata automaticamente su `N2.2` (prestazioni sanitarie esenti da IVA ai sensi dell'art. 10 DPR 633/72).
   - *(Opzionale)* **Codice Regione / ASL / Struttura**: solo se richiesto per la tua convenzione specifica o se operi all'interno di una struttura accreditata (altrimenti lascia vuoto o sui valori di default `000`).
3. Clicca su **Salva Impostazioni**.

> 🔒 **Nota sulla Sicurezza**: Tutte le tue credenziali (password e pincode) vengono salvate nel database con **cifratura di grado bancario AES-256-GCM**. Nessuno (neppure gli amministratori del sistema) può leggerle in chiaro.

---

## 2. Cosa cambia quando emetti o modifichi una fattura?

Il gestionale è stato arricchito con alcuni controlli e campi automatici per garantire che le tue fatture siano sempre conformi alle regole ministeriali:

1. **Verifica automatica del Codice Fiscale del Pagante**:
   - Mentre compili o salvi una fattura, il sistema verifica che il Codice Fiscale sia formalmente valido, controllando anche il carattere di controllo (CIN).
   - Nella lista comparirà una spunta verde ✅ se è corretto, o un'icona di attenzione ⚠️ con la spiegazione dell'errore (es. lunghezza errata, caratteri non validi) per evitare che il Ministero scarti la fattura.

2. **Metodo di Pagamento e Tracciabilità**:
   - Per consentire al paziente di detrarre la spesa sanitaria nel 730, il pagamento deve essere tracciato (Bonifico, Carta di Credito/POS, ecc.).
   - Se selezioni **Bonifico** o **Carta**, il sistema contrassegna automaticamente la spesa come **Tracciata** (invio `pagamentoTracciato = SI`).
   - Se selezioni **Contanti**, il sistema indica che il pagamento non è tracciato (la spesa comparirà nel 730 ma con l'indicazione di non tracciabilità).

3. **Marca da Bollo (2,00 €)**:
   - Se la fattura supera l'importo di 77,47 € o inserisci il codice della marca da bollo, il gestionale include automaticamente la riga del bollo nel file inviato al Ministero con la codifica corretta (natura IVA `N1`).

4. **Diritto di Opposizione del Paziente (Privacy)**:
   - Se il paziente ti richiede esplicitamente di **non** far comparire la fattura nella sua dichiarazione dei redditi precompilata (facoltà garantita dalla legge sulla privacy sanitaria), basta spuntare l'opzione **"Opposizione all'invio 730 precompilato"**.
   - In questo caso, il gestionale invia comunque il documento al Ministero per rispettare l'obbligo fiscale, ma **senza il Codice Fiscale del paziente**, garantendone il totale anonimato.

---

## 3. Quali dati vengono effettivamente inviati al Ministero?

Per ogni fattura trasmessa, il gestionale crea un flusso cifrato e sicuro contenente:

| Dato inviato | Origine nel Gestionale | Scopo |
| :--- | :--- | :--- |
| **Identificativo Professionista** | P.IVA e Codice Fiscale dell'utente logopedista | Identifica il medico/sanitario che ha emesso la fattura |
| **Numero e Data Fattura** | Numero progressivo e data della fattura | Riferimento fiscale del documento |
| **Data del Pagamento** | Data del pagamento registrata | Principio di cassa (anno fiscale di competenza della detrazione) |
| **Tipo Spesa** | Valore fisso `SP` (Spesa Sanitaria) | Classificazione della prestazione sanitaria |
| **Importo e Natura IVA** | Importo della prestazione (es. esente `N2.2`) | Calcolo della spesa detraibile |
| **Eventuale Bollo** | Importo di 2,00 € con natura IVA `N1` | Registrazione del bollo virtuale/cartaceo |
| **Tracciabilità** | `SI` (Bonifico/Carta) oppure `NO` (Contanti) | Requisito per la detraibilità Irpef al 19% |
| **Codice Fiscale Assistito** | CF del pagante / paziente intestatario | Assegnazione della detrazione al codice fiscale (omesso se c'è opposizione) |
| **Flag Opposizione** | Spunta privacy presente sulla fattura | Segnala se il cittadino si è opposto |

---

## 4. Come inviare le fatture (Guida Quotidiana)

Troverai una nuova voce dedicata nel menu principale: **Sistema TS**.

### Passo 1: Verifica le fatture pronte
- Entra nella schermata **Sistema TS**.
- Troverai la tabella con tutte le fatture in stato **"Da inviare"**.
- Puoi filtrare per intervallo di date (es. tutto l'anno in corso o un mese specifico).
- Controlla visivamente che i Codici Fiscali abbiano la spunta verde ✅.

### Passo 2: Seleziona e Invia
- Puoi selezionare le fatture singolarmente con la casella di spunta a sinistra, oppure cliccare sulla casella in alto per **selezionarle tutte**.
- In alto a destra clicca sul pulsante **Invia al Sistema TS** (verrà indicato il numero di fatture selezionate, ad es. *"Invia 10 fatture"*).
- Il sistema mostra una barra di avanzamento e trasmette il lotto al Ministero in un archivio protetto e firmato digitalmente.

### Passo 3: Conferma e Ricevuta
- Al termine dell'invio, il Ministero restituisce un **Numero di Protocollo univoco** (es. `2026091512345678`).
- Lo stato delle fatture passa immediatamente da *"Da inviare"* a **"Inviata"**.
- Nella sezione **Storico Trasmissioni** (in fondo alla pagina) puoi:
  - Vedere la data e ora esatta dell'invio.
  - Vedere l'esito ministeriale (**Accolto**, **Accolto con segnalazioni** o **Scartato**).
  - Scaricare la **Ricevuta Ufficiale PDF** rilasciata dal Ministero dell'Economia e delle Finanze come prova legale dell'avvenuta trasmissione.

---

## 5. Come gestire Modifiche ed Errori

### Posso modificare o eliminare una fattura già inviata?
Per evitare problemi con l'Agenzia delle Entrate e discrepanze contabili:
- Una volta che una fattura è in stato **"Inviata"**, il gestionale ne blocca la modifica diretta o l'eliminazione accidentale.
- **Se devi correggere una fattura già inviata:**
  1. Vai nella pagina **Sistema TS** (o nell'elenco fatture).
  2. Clicca sul pulsante **Annulla TS** accanto alla fattura.
  3. Il sistema invia una richiesta telematica di cancellazione (operazione `"C"`) al Ministero per rimuovere quel documento dal 730 precompilato.
  4. Una volta confermata la cancellazione, la fattura assume lo stato **"Annullata TS"**: ora puoi emettere la nuova fattura corretta oppure ripristinarla per un nuovo invio.

### Cosa succede se una fattura viene scartata dal Ministero?
Se il Ministero rileva un'anomalia (es. Codice Fiscale inesistente all'Anagrafe Tributaria):
1. Nello **Storico Trasmissioni**, il lotto risulterà con dicitura **Scartato** o **Accolto con errori**.
2. Cliccando su **Vedi Errori**, il gestionale ti mostra il dettaglio esatto dell'errore restituito dal Ministero (scaricato dal file CSV ufficiale).
3. Potrai correggere l'anagrafica del paziente e reinviare la fattura con il lotto successivo.

---

## 6. Riepilogo degli Stati della Fattura

| Stato | Significato | Azione possibile |
| :--- | :--- | :--- |
| **Da inviare** | La fattura è stata emessa ed è pronta per la trasmissione. | Modificabile, eliminabile, selezionabile per l'invio. |
| **In trasmissione** | L'invio telematico è attualmente in corso verso i server MEF. | Bloccata temporaneamente in attesa della risposta ministeriale. |
| **Inviata** | Trasmessa con successo e presa in carico per il 730 precompilato. | Protetta da modifiche; può essere annullata telematicamente tramite *Annulla TS*. |
| **Da cancellare** | È stata richiesta la cancellazione ma si è verificato un errore di rete. | Riprovabile in automatico al prossimo tentativo. |
| **Annullata TS** | Cancellata con successo dal Sistema TS. | Conservata a fini fiscali per non rompere la sequenza numerica. |

---

## 7. Domande Frequenti (FAQ)

**D: Entro quando devo inviare le spese sanitarie?**  
*R: La scadenza per l'invio al Sistema TS delle spese sanitarie relative all'anno precedente è solitamente fissata al **31 gennaio** (o nei termini stabiliti dai decreti annuali del MEF). Si consiglia comunque di inviare periodicamente (es. a fine mese o a fine trimestre) per non accumulare lavoro a ridosso della scadenza.*

**D: Devo inviare anche le fatture per cui il paziente non ha pagato?**  
*R: No. Le spese sanitarie vanno comunicate secondo il **principio di cassa**, cioè con riferimento alla data in cui il pagamento è stato effettivamente percepito.*

**D: Le fatture con marca da bollo cartacea richiedono passaggi particolari?**  
*R: No. Basta inserire il codice a 14 cifre della marca da bollo nella schermata della fattura: il gestionale valorizzerà l'importo e la natura IVA richiesta dal tracciato ministeriale.*

**D: Posso scaricare le ricevute in caso di controllo fiscale?**  
*R: Sì. Ogni trasmissione conserva per sempre il suo numero di protocollo e la ricevuta PDF firmata digitalmente dal Ministero, scaricabile in qualsiasi momento con un clic dallo storico.*
