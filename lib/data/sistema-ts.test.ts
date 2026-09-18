import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma, $Enums } from "@prisma/client";

const mockFindUnique = vi.fn();
const mockPagamentoFindMany = vi.fn();
const mockTrasmissioneFindMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    impostazioniSistemaTs: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
    pagamento: {
      findMany: (...args: unknown[]) => mockPagamentoFindMany(...args),
    },
    trasmissioneTs: {
      findMany: (...args: unknown[]) => mockTrasmissioneFindMany(...args),
    },
  },
}));

import {
  getSistemaTsSettings,
  getFatturePerInvioTs,
  getStoricoTrasmissioniTs,
} from "./sistema-ts";

describe("lib/data/sistema-ts — getSistemaTsSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("restituisce null se non esistono impostazioni per l'utente", async () => {
    mockFindUnique.mockResolvedValueOnce(null);

    const result = await getSistemaTsSettings(1);

    expect(result).toBeNull();
    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { id_Utente: 1 },
    });
  });

  it("restituisce i flag booleani e le impostazioni formattate se presenti", async () => {
    mockFindUnique.mockResolvedValueOnce({
      id: 5,
      username: "dott.rossi",
      passwordEncrypted: "encrypted-pwd-string",
      pincodeEncrypted: "encrypted-pin-string",
      codiceRegione: "030",
      codiceAsl: "001",
      codiceStruttura: "STRUTT_1",
      naturaIvaDefault: "N2.2",
    });

    const result = await getSistemaTsSettings(1);

    expect(result).toEqual({
      id: 5,
      username: "dott.rossi",
      hasPassword: true,
      hasPincode: true,
      codiceRegione: "030",
      codiceAsl: "001",
      codiceStruttura: "STRUTT_1",
      naturaIvaDefault: "N2.2",
    });
  });

  it("applica i valori di default per i campi nulli e hasPassword/hasPincode a false", async () => {
    mockFindUnique.mockResolvedValueOnce({
      id: 6,
      username: "dott.senzapwd",
      passwordEncrypted: null,
      pincodeEncrypted: "",
      codiceRegione: null,
      codiceAsl: null,
      codiceStruttura: null,
      naturaIvaDefault: null,
    });

    const result = await getSistemaTsSettings(2);

    expect(result).toEqual({
      id: 6,
      username: "dott.senzapwd",
      hasPassword: false,
      hasPincode: false,
      codiceRegione: "000",
      codiceAsl: "000",
      codiceStruttura: "",
      naturaIvaDefault: null,
    });
  });
});

describe("lib/data/sistema-ts — getFatturePerInvioTs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("interroga con ordinamento e include pagante/paziente senza filtri aggiuntivi", async () => {
    mockPagamentoFindMany.mockResolvedValueOnce([]);

    await getFatturePerInvioTs(42);

    expect(mockPagamentoFindMany).toHaveBeenCalledWith({
      where: { id_Utente: 42 },
      include: {
        pagante: true,
        paziente: true,
      },
      orderBy: [{ anno: "desc" }, { n_fattura: "desc" }],
    });
  });

  it("filtra per stato_ts se specificato e diverso da ALL", async () => {
    mockPagamentoFindMany.mockResolvedValueOnce([]);

    await getFatturePerInvioTs(42, { stato: "DA_INVIARE" });

    expect(mockPagamentoFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id_Utente: 42,
          stato_ts: "DA_INVIARE",
        }),
      })
    );
  });

  it("ignora il filtro stato_ts se impostato su ALL", async () => {
    mockPagamentoFindMany.mockResolvedValueOnce([]);

    await getFatturePerInvioTs(42, { stato: "ALL" });

    expect(mockPagamentoFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id_Utente: 42 },
      })
    );
  });

  it("applica il range di date con gte (inizio giornata) e lte (fine giornata) secondo il principio di cassa (data_pagamento con fallback su data)", async () => {
    mockPagamentoFindMany.mockResolvedValueOnce([]);

    await getFatturePerInvioTs(42, {
      dateFrom: "2026-03-01",
      dateTo: "2026-03-31",
    });

    const callArgs = mockPagamentoFindMany.mock.calls[0][0];
    expect(callArgs.where.OR).toBeDefined();
    expect(callArgs.where.OR).toHaveLength(2);

    const [pagamentoFilter, fallbackEmissionFilter] = callArgs.where.OR;

    const dataPagFilter = pagamentoFilter.data_pagamento;
    expect(dataPagFilter.gte).toBeInstanceOf(Date);
    expect(dataPagFilter.gte.getHours()).toBe(0);
    expect(dataPagFilter.gte.getMinutes()).toBe(0);

    expect(dataPagFilter.lte).toBeInstanceOf(Date);
    expect(dataPagFilter.lte.getHours()).toBe(23);
    expect(dataPagFilter.lte.getMinutes()).toBe(59);
    expect(dataPagFilter.lte.getSeconds()).toBe(59);

    // Fallback: se data_pagamento è null, filtra sulla data di emissione
    expect(fallbackEmissionFilter.data_pagamento).toBeNull();
    const fallbackDataFilter = fallbackEmissionFilter.data;
    expect(fallbackDataFilter.gte).toEqual(dataPagFilter.gte);
    expect(fallbackDataFilter.lte).toEqual(dataPagFilter.lte);
  });

  it("applica solo dateFrom o solo dateTo correttamente nel blocco OR", async () => {
    mockPagamentoFindMany.mockResolvedValueOnce([]);

    await getFatturePerInvioTs(42, {
      dateFrom: "2026-01-01",
    });

    const callArgs = mockPagamentoFindMany.mock.calls[0][0];
    expect(callArgs.where.OR).toBeDefined();
    expect(callArgs.where.OR[0].data_pagamento.gte).toBeInstanceOf(Date);
    expect(callArgs.where.OR[0].data_pagamento.lte).toBeUndefined();
    expect(callArgs.where.OR[1].data_pagamento).toBeNull();
    expect(callArgs.where.OR[1].data.gte).toBeInstanceOf(Date);
    expect(callArgs.where.OR[1].data.lte).toBeUndefined();
  });

  it("mappa correttamente le fatture con validazione CF, calcolo bollo e decimali", async () => {
    const fakeInvoice1 = {
      id: 10,
      n_fattura: 1,
      anno: 2026,
      data: new Date("2026-03-10"),
      prezzo_totale: new Prisma.Decimal("100.00"),
      mod_pag: $Enums.ModalitaPagamento.BONIFICO,
      pagamento_tracciato: true,
      natura_iva: "N2.2",
      flag_opposizione: false,
      bollo: new Prisma.Decimal("2.00"),
      bolloCodice: null,
      stato_ts: $Enums.StatoTs.DA_INVIARE,
      protocollo_ts: null,
      protocollo_cancellazione_ts: null,
      data_invio_ts: null,
      pagante: {
        nome: "Mario",
        cognome: "Rossi",
        cf: "RSSMRA85M01H501Q", // CF valido
      },
      paziente: {
        nome: "Luigi",
        cognome: "Rossi",
        cf: "RSSMRA85M01H501Q",
      },
    };

    const fakeInvoice2 = {
      id: 20,
      n_fattura: 2,
      anno: 2026,
      data: new Date("2026-03-11"),
      prezzo_totale: new Prisma.Decimal("50.00"),
      mod_pag: $Enums.ModalitaPagamento.CONTANTI,
      pagamento_tracciato: false,
      natura_iva: "N2.2",
      flag_opposizione: false,
      bollo: new Prisma.Decimal("0.00"),
      bolloCodice: null,
      stato_ts: $Enums.StatoTs.DA_INVIARE,
      protocollo_ts: null,
      protocollo_cancellazione_ts: null,
      data_invio_ts: null,
      pagante: {
        nome: "Anna",
        cognome: "Verdi",
        cf: "INVALID_CF", // CF non valido
      },
      paziente: {
        nome: "Anna",
        cognome: "Verdi",
        cf: "INVALID_CF",
      },
    };

    const fakeInvoice3 = {
      id: 30,
      n_fattura: 3,
      anno: 2026,
      data: new Date("2026-03-12"),
      prezzo_totale: new Prisma.Decimal("150.00"),
      mod_pag: $Enums.ModalitaPagamento.BONIFICO,
      pagamento_tracciato: true,
      natura_iva: "N2.2",
      flag_opposizione: true, // Opposizione attiva: CF considerato valido
      bollo: new Prisma.Decimal("2.00"),
      bolloCodice: "BOLLO_APP_123",
      stato_ts: $Enums.StatoTs.INVIATA,
      protocollo_ts: "PROT_99",
      protocollo_cancellazione_ts: null,
      data_invio_ts: new Date("2026-03-12"),
      pagante: {
        nome: "Giulia",
        cognome: "Neri",
        cf: null, // CF mancante ma con opposizione
      },
      paziente: {
        nome: "Giulia",
        cognome: "Neri",
        cf: null,
      },
    };

    mockPagamentoFindMany.mockResolvedValueOnce([
      fakeInvoice1,
      fakeInvoice2,
      fakeInvoice3,
    ]);

    const items = await getFatturePerInvioTs(42);

    expect(items).toHaveLength(3);

    // Fattura 1: prezzo > 77.47 senza bolloCodice -> bolloMancante = true, CF valido, importo valido
    expect(items[0]).toEqual(
      expect.objectContaining({
        id: 10,
        n_fattura: 1,
        prezzo_totale: 100,
        bollo: 2,
        paganteNomeCompleto: "Rossi Mario",
        pazienteNomeCompleto: "Rossi Luigi",
        cfValido: true,
        cfErrore: undefined,
        importoValido: true,
        importoErrore: undefined,
        richiedeBollo: true,
        bolloMancante: true,
        isDataFutura: false,
        haAnomalie: false,
        isProntaPerInvio: true,
      })
    );

    // Fattura 2: prezzo <= 77.47, CF non valido, importo valido
    expect(items[1]).toEqual(
      expect.objectContaining({
        id: 20,
        n_fattura: 2,
        prezzo_totale: 50,
        cfValido: false,
        cfErrore: expect.stringContaining("attesi 16 caratteri"),
        importoValido: true,
        importoErrore: undefined,
        richiedeBollo: false,
        bolloMancante: false,
      })
    );

    // Fattura 3: opposizione attiva -> cfValido = true, bollo presente -> bolloMancante = false, importo valido
    expect(items[2]).toEqual(
      expect.objectContaining({
        id: 30,
        n_fattura: 3,
        prezzo_totale: 150,
        flag_opposizione: true,
        cfValido: true,
        cfErrore: undefined,
        importoValido: true,
        importoErrore: undefined,
        richiedeBollo: true,
        bolloMancante: false,
      })
    );
  });

  it("identifica correttamente fatture con importo non valido per Sistema TS (<= 0)", async () => {
    mockPagamentoFindMany.mockResolvedValueOnce([
      {
        id: 99,
        n_fattura: 99,
        anno: 2026,
        data: new Date("2026-03-15"),
        prezzo_totale: new Prisma.Decimal("0.00"),
        mod_pag: $Enums.ModalitaPagamento.BONIFICO,
        pagamento_tracciato: true,
        natura_iva: "N2.2",
        flag_opposizione: false,
        bollo: new Prisma.Decimal("0.00"),
        bolloCodice: null,
        stato_ts: $Enums.StatoTs.DA_INVIARE,
        protocollo_ts: null,
        protocollo_cancellazione_ts: null,
        data_invio_ts: null,
        pagante: { nome: "Paolo", cognome: "Gialli", cf: "RSSMRA85M01H501Q" },
        paziente: { nome: "Paolo", cognome: "Gialli", cf: "RSSMRA85M01H501Q" },
      },
    ]);

    const items = await getFatturePerInvioTs(42);
    expect(items).toHaveLength(1);
    expect(items[0].importoValido).toBe(false);
    expect(items[0].importoErrore).toContain("maggiore di zero");
  });
});

describe("lib/data/sistema-ts — getStoricoTrasmissioniTs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ricostruisce lo storico delle trasmissioni di invio e riconcilia gli esiti dei documenti", async () => {
    const fakeTrasmissione = {
      id: 100,
      id_Utente: 1,
      protocollo: "PROT_INVIO_001",
      nomeFile: "invio_20260315.zip",
      dataInvio: new Date("2026-03-15T10:00:00Z"),
      statoElaborazione: "3", // Accolto con segnalazioni
      codiceEsito: "000",
      descrizioneEsito: "Elaborazione con errori/warning",
      numRicevuti: 3,
      numAccolti: 2,
      numScartati: 1,
      pdfRicevuta: Buffer.from("pdf-data"),
      csvErrori:
        "numDoc;codErrore;descrizione;tipo\n1;S017;Identificativo già presente;ERRORE\n2;S050;CF errato;ERRORE\n3;W001;Avviso minore;WARNING",
      fatture: [
        {
          id: 1,
          n_fattura: 1,
          anno: 2026,
          data: new Date("2026-03-01"),
          prezzo_totale: new Prisma.Decimal("100.00"),
          stato_ts: $Enums.StatoTs.INVIATA,
          pagante: { nome: "Mario", cognome: "Rossi", cf: "RSSMRA85M01H501Q" },
        },
        {
          id: 2,
          n_fattura: 2,
          anno: 2026,
          data: new Date("2026-03-02"),
          prezzo_totale: new Prisma.Decimal("80.00"),
          stato_ts: $Enums.StatoTs.DA_INVIARE,
          pagante: { nome: "Luigi", cognome: "Verdi", cf: "VRDLGU80A01H501U" },
        },
        {
          id: 3,
          n_fattura: 3,
          anno: 2026,
          data: new Date("2026-03-03"),
          prezzo_totale: new Prisma.Decimal("120.00"),
          stato_ts: $Enums.StatoTs.INVIATA,
          pagante: { nome: "Paolo", cognome: "Bianchi", cf: "BNCPLA90A01H501X" },
        },
      ],
    };

    mockTrasmissioneFindMany.mockResolvedValueOnce([fakeTrasmissione]);

    const result = await getStoricoTrasmissioniTs(1);

    expect(result).toHaveLength(1);
    const t = result[0];

    expect(t.tipo).toBe("INVIO");
    expect(t.hasPdfRicevuta).toBe(true);
    expect(t.hasCsvErrori).toBe(true);
    expect(t.totaleFatture).toBe(3);

    // Fattura 1: S017 -> GIA_PRESENTE_TS
    expect(t.fatture[0].esitoFattura).toBe("GIA_PRESENTE_TS");
    expect(t.fatture[0].errori).toEqual([
      expect.objectContaining({ codiceErrore: "S017" }),
    ]);

    // Fattura 2: S050 (ERRORE) -> SCARTATA
    expect(t.fatture[1].esitoFattura).toBe("SCARTATA");

    // Fattura 3: W001 (WARNING) -> ACCOLTA_CON_WARNING
    expect(t.fatture[2].esitoFattura).toBe("ACCOLTA_CON_WARNING");
  });

  it("ricostruisce le trasmissioni di cancellazione collegando le fatture per protocollo_cancellazione_ts", async () => {
    const fakeCancellationTrasmissione = {
      id: 200,
      id_Utente: 1,
      protocollo: "PROT_ANN_999",
      nomeFile: "annulla_15.zip",
      dataInvio: new Date("2026-03-16T12:00:00Z"),
      statoElaborazione: "2", // Accolto
      codiceEsito: "000",
      descrizioneEsito: "Cancellazione accolta",
      numRicevuti: 1,
      numAccolti: 1,
      numScartati: 0,
      pdfRicevuta: null,
      csvErrori: null,
      fatture: [], // vuoto su relazione diretta perché non id_TrasmissioneTs
    };

    mockTrasmissioneFindMany.mockResolvedValueOnce([fakeCancellationTrasmissione]);

    // Seconda query per recuperare le fatture cancellate tramite protocollo_cancellazione_ts
    mockPagamentoFindMany.mockResolvedValueOnce([
      {
        id: 15,
        n_fattura: 15,
        anno: 2026,
        data: new Date("2026-02-15"),
        prezzo_totale: new Prisma.Decimal("200.00"),
        stato_ts: $Enums.StatoTs.ANNULLATA_TS,
        protocollo_cancellazione_ts: "PROT_ANN_999",
        pagante: { nome: "Anna", cognome: "Neri", cf: "NRANNA80A01H501Z" },
      },
    ]);

    const result = await getStoricoTrasmissioniTs(1);

    expect(result).toHaveLength(1);
    const t = result[0];

    expect(t.tipo).toBe("CANCELLAZIONE");
    expect(t.totaleFatture).toBe(1);
    expect(t.hasPdfRicevuta).toBe(false);
    expect(t.hasCsvErrori).toBe(false);

    expect(t.fatture[0]).toEqual(
      expect.objectContaining({
        id: 15,
        n_fattura: 15,
        esitoFattura: "ACCOLTA",
        paganteNome: "Neri Anna",
      })
    );
  });

  it("assegna esito IN_ELABORAZIONE se statoElaborazione è '0' o nullo", async () => {
    const fakeTrasmissione = {
      id: 300,
      id_Utente: 1,
      protocollo: "PROT_PENDING",
      nomeFile: "invio_20260317.zip",
      dataInvio: new Date(),
      statoElaborazione: "0",
      codiceEsito: null,
      descrizioneEsito: null,
      numRicevuti: 1,
      numAccolti: 0,
      numScartati: 0,
      pdfRicevuta: null,
      csvErrori: null,
      fatture: [
        {
          id: 50,
          n_fattura: 50,
          anno: 2026,
          data: new Date(),
          prezzo_totale: new Prisma.Decimal("100.00"),
          stato_ts: "IN_TRASMISSIONE" as unknown as $Enums.StatoTs,
          pagante: null,
        },
      ],
    };

    mockTrasmissioneFindMany.mockResolvedValueOnce([fakeTrasmissione]);

    const result = await getStoricoTrasmissioniTs(1);

    expect(result[0].fatture[0].esitoFattura).toBe("IN_ELABORAZIONE");
    expect(result[0].fatture[0].paganteNome).toBe("-");
    expect(result[0].fatture[0].paganteCf).toBeNull();
  });

  it("M2: conserva la stessa fattura nello storico di trasmissioni multiple (reinvio dopo scarto)", async () => {
    const fatturaCondivisa = {
      id: 77,
      n_fattura: 77,
      anno: 2026,
      data: new Date("2026-03-01"),
      prezzo_totale: new Prisma.Decimal("150.00"),
      stato_ts: $Enums.StatoTs.INVIATA,
      pagante: { nome: "Chiara", cognome: "Gialli", cf: "GLLCHR85A01H501Y" },
    };

    // T1: Primo invio scartato per errore S050
    const t1 = {
      id: 10,
      id_Utente: 1,
      protocollo: "PROT_T1_SCARTATA",
      nomeFile: "lotto_1.zip",
      dataInvio: new Date("2026-03-01T10:00:00Z"),
      statoElaborazione: "3",
      codiceEsito: "000",
      descrizioneEsito: "Elaborato con errori",
      numRicevuti: 1,
      numAccolti: 0,
      numScartati: 1,
      pdfRicevuta: null,
      csvErrori: "numDoc;codErrore;descrizione;tipo\n77;S050;CF errato;ERRORE",
      fatture: [fatturaCondivisa],
    };

    // T2: Reinvio in un secondo lotto accolto con successo
    const t2 = {
      id: 11,
      id_Utente: 1,
      protocollo: "PROT_T2_ACCOLTA",
      nomeFile: "lotto_2.zip",
      dataInvio: new Date("2026-03-02T10:00:00Z"),
      statoElaborazione: "2",
      codiceEsito: "000",
      descrizioneEsito: "Accolto interamente",
      numRicevuti: 1,
      numAccolti: 1,
      numScartati: 0,
      pdfRicevuta: Buffer.from("pdf"),
      csvErrori: null,
      fatture: [fatturaCondivisa],
    };

    mockTrasmissioneFindMany.mockResolvedValueOnce([t2, t1]);

    const result = await getStoricoTrasmissioniTs(1);

    expect(result).toHaveLength(2);

    // T2 ha la fattura con esito ACCOLTA
    expect(result[0].protocollo).toBe("PROT_T2_ACCOLTA");
    expect(result[0].totaleFatture).toBe(1);
    expect(result[0].fatture[0].id).toBe(77);
    expect(result[0].fatture[0].esitoFattura).toBe("ACCOLTA");

    // T1 conserva tuttora la fattura con esito SCARTATA e dettaglio errori
    expect(result[1].protocollo).toBe("PROT_T1_SCARTATA");
    expect(result[1].totaleFatture).toBe(1);
    expect(result[1].fatture[0].id).toBe(77);
    expect(result[1].fatture[0].esitoFattura).toBe("SCARTATA");
    expect(result[1].fatture[0].errori[0].codiceErrore).toBe("S050");
  });
});
