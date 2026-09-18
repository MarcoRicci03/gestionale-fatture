export interface SogeiErrorHelp {
  codice: string;
  titolo: string;
  significato: string;
  azioneConsigliata: string;
  gravita: "ERRORE" | "WARNING" | "INFO";
}

export const SOGEI_ERROR_CATALOG: Record<string, Omit<SogeiErrorHelp, "codice">> = {
  S017: {
    titolo: "Documento già presente nel Sistema TS",
    significato:
      "Questa fattura risulta già acquisita nei server ministeriali del MEF da una precedente trasmissione o da un altro gestionale.",
    azioneConsigliata:
      "Se la spesa registrata è corretta, non occorre reinviarla. Se invece la fattura conteneva dati errati, deve essere prima annullata su Sistema TS.",
    gravita: "INFO",
  },
  S003: {
    titolo: "Codice Fiscale non presente in Anagrafe Tributaria",
    significato:
      "Il Codice Fiscale dell'assistito o del pagante non è stato trovato negli archivi dell'Agenzia delle Entrate (frequente per neonati, stranieri con codice provvisorio o variazioni recenti).",
    azioneConsigliata:
      "Verifica l'esattezza dei dati anagrafici con il paziente. Se si tratta di un neonato non ancora censito, puoi attivare la spunta 'Opposizione del paziente' per escludere la spesa ed evitare il blocco del lotto.",
    gravita: "ERRORE",
  },
  S050: {
    titolo: "Codice Fiscale formalmente errato",
    significato:
      "Il Codice Fiscale inserito non rispetta i criteri formali ministeriali (lunghezza non valida, caratteri errati o carattere di controllo CIN scorretto).",
    azioneConsigliata:
      "Correggi il Codice Fiscale nell'anagrafica del paziente o del pagante. Il gestionale verificherà automaticamente la validità del CIN.",
    gravita: "ERRORE",
  },
  S004: {
    titolo: "Mittente non autorizzato alla trasmissione",
    significato:
      "Il Codice Fiscale del professionista sanitario mittente non risulta autorizzato all'invio per l'anno di competenza presso il Sistema TS.",
    azioneConsigliata:
      "Verifica le credenziali in Impostazioni > Sistema TS (P.IVA, Codice Fiscale e PIN) e accertati sul portale ministeriale TS-Web di essere regolarmente iscritto all'albo abilitato per l'anno in corso.",
    gravita: "ERRORE",
  },
  S001: {
    titolo: "P.IVA o Codice Fiscale mittente non conforme",
    significato:
      "La combinazione di Partita IVA e Codice Fiscale mittente indicata non coincide con i dati registrati negli archivi del Sistema TS.",
    azioneConsigliata:
      "Controlla e correggi la Partita IVA e il Codice Fiscale del titolare in Impostazioni > Sistema TS.",
    gravita: "ERRORE",
  },
  S022: {
    titolo: "Pagamento anticipato senza contrassegno ministeriale",
    significato:
      "La data di effettivo incasso della fattura è antecedente alla data di emissione, ma nel documento inviato non era presente il flag ministeriale di pagamento anticipato.",
    azioneConsigliata:
      "Verifica le date di emissione e di effettivo pagamento della fattura. Se il pagamento è avvenuto in anticipo, il gestionale applicherà automaticamente il flag al prossimo invio.",
    gravita: "ERRORE",
  },
  S010: {
    titolo: "Documento fiscale non trovato in archivio",
    significato:
      "Si è tentato di annullare o variare una fattura che non risulta presente negli archivi Sogei o i cui identificativi (numero, anno, data) differiscono da quelli originari.",
    azioneConsigliata:
      "Verifica che il numero della fattura, l'anno e la data coincidano esattamente con quelli della spesa originariamente trasmessa.",
    gravita: "ERRORE",
  },
  S016: {
    titolo: "Dati spesa o aliquota IVA non conformi",
    significato:
      "Uno o più elementi di dettaglio della spesa, la natura IVA (es. N2.2, N4) o l'imposta di bollo non rispettano le specifiche XSD del disciplinare tecnico ministeriale.",
    azioneConsigliata:
      "Verifica che la tipologia di spesa (es. SP), la natura IVA e il codice della marca da bollo (se dovuta) siano valorizzati correttamente prima del reinvio.",
    gravita: "ERRORE",
  },
  S036: {
    titolo: "Data pagamento futura rispetto alla data di invio",
    significato:
      "La data di incasso indicata nella fattura è successiva alla data di trasmissione del lotto al Sistema TS.",
    azioneConsigliata:
      "Non è possibile trasmettere spese con data di pagamento futura. Attendi che la data di incasso sia trascorsa prima di inviare la fattura, oppure correggi la data se è stata digitata per errore.",
    gravita: "ERRORE",
  },
  W001: {
    titolo: "Segnalazione su Codice Fiscale (Spesa Accolta)",
    significato:
      "Il documento è stato regolarmente acquisito dal Sistema TS per il Modello 730, ma l'Anagrafe Tributaria ha rilevato un avviso non bloccante sul Codice Fiscale.",
    azioneConsigliata:
      "Nessuna azione richiesta per questo invio: la spesa è valida. Verifica e aggiorna i dati anagrafici del paziente per le fatture future.",
    gravita: "WARNING",
  },
  W003: {
    titolo: "Anomalia formale non bloccante (Spesa Accolta)",
    significato:
      "La spesa è stata accolta con successo nei server ministeriali, con una segnalazione formale di avviso.",
    azioneConsigliata:
      "Nessuna azione richiesta: la trasmissione ha avuto esito positivo e la detrazione è garantita.",
    gravita: "WARNING",
  },
};

/**
 * Risolve l'helper esplicativo e l'azione consigliata per un codice di anomalia Sogei.
 * Se il codice è censito nel catalogo, restituisce il record puntuale;
 * altrimenti restituisce un fallback descrittivo differenziato tra ERRORE e WARNING.
 */
export function getSogeiErrorHelper(
  codiceErrore?: string | null,
  descrizioneMinisteriale?: string | null,
  tipo?: "ERRORE" | "WARNING"
): SogeiErrorHelp {
  const normalizedCode = (codiceErrore || "").trim().toUpperCase();
  const known = SOGEI_ERROR_CATALOG[normalizedCode];

  if (known) {
    return {
      codice: normalizedCode,
      ...known,
    };
  }

  const isWarning = tipo === "WARNING" || normalizedCode.startsWith("W");

  if (isWarning) {
    return {
      codice: normalizedCode || "AVVISO",
      titolo: `Segnalazione ministeriale [${normalizedCode || "WARNING"}]`,
      significato:
        descrizioneMinisteriale ||
        "Il documento è stato accolto nei server ministeriali, ma è presente un avviso formale non bloccante.",
      azioneConsigliata:
        "La spesa è stata acquisita regolarmente. Verifica i dati segnalati in vista delle prossime fatture.",
      gravita: "WARNING",
    };
  }

  return {
    codice: normalizedCode || "ERRORE",
    titolo: `Scarto ministeriale [${normalizedCode || "ERRORE"}]`,
    significato:
      descrizioneMinisteriale ||
      "La fattura è stata scartata dai server del Sistema TS e non è stata inserita nella precompilata del cittadino.",
    azioneConsigliata:
      "Consulta la descrizione dell'errore, correggi i dati indicati nella fattura o nell'anagrafica e procedi al reinvio dopo averla ripristinata.",
    gravita: "ERRORE",
  };
}
