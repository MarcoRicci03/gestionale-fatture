import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";
import { AUDIT_ACTIONS } from "@/lib/audit/actions";

// Mock Session & IP
vi.mock("@/lib/auth/session", () => ({
  requireUserId: vi.fn(async () => 1),
}));

vi.mock("@/lib/auth/client-ip", () => ({
  getClientIp: vi.fn(async () => "127.0.0.1"),
}));

// Mock Next.js Cache & Audit
const mockRevalidatePath = vi.fn();
vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

const mockLogAudit = vi.fn();
vi.mock("@/lib/audit/log", () => ({
  logAudit: (...args: unknown[]) => mockLogAudit(...args),
}));

// Mock Vault
vi.mock("@/lib/sistemats/vault", () => ({
  decryptCredential: vi.fn((v: string) => `decrypted_${v}`),
  encryptCredential: vi.fn((v: string) => `encrypted_${v}`),
}));

// Mock XML Builder & Zip
let capturedXmlPayload: unknown = null;
vi.mock("@/lib/sistemats/xml-builder", () => ({
  buildSistemaTsXml: vi.fn((payload) => {
    capturedXmlPayload = payload;
    return "<xml>fake</xml>";
  }),
  createZipArchive: vi.fn(async () => Buffer.from("fake-zip-archive")),
}));

// Mock SistemaTsClient
const mockInviaFile = vi.fn();
const mockInterrogaEsito = vi.fn();
const mockScaricaRicevutaPdf = vi.fn();
const mockScaricaDettaglioErrori = vi.fn();

vi.mock("@/lib/sistemats/client", () => ({
  SistemaTsClient: class {
    inviaFile = mockInviaFile;
    interrogaEsito = mockInterrogaEsito;
    scaricaRicevutaPdf = mockScaricaRicevutaPdf;
    scaricaDettaglioErrori = mockScaricaDettaglioErrori;
  },
}));

// Mock Prisma
const mockImpostazioniFindUnique = vi.fn();
const mockImpostazioniUpsert = vi.fn();
const mockUtenteFindUnique = vi.fn();
const mockPagamentoFindFirst = vi.fn();
const mockPagamentoFindMany = vi.fn();
const mockPagamentoUpdate = vi.fn();
const mockPagamentoUpdateMany = vi.fn();
const mockPaganteFindFirst = vi.fn();
const mockPaganteUpdate = vi.fn();
const mockTrasmissioneFindFirst = vi.fn();
const mockTrasmissioneCreate = vi.fn();
const mockTrasmissioneUpdate = vi.fn();
const mockTransaction = vi.fn(async (cb: (tx: unknown) => unknown) => {
  const tx = {
    trasmissioneTs: {
      create: (...args: unknown[]) => mockTrasmissioneCreate(...args),
      update: (...args: unknown[]) => mockTrasmissioneUpdate(...args),
    },
    pagamento: {
      findMany: (...args: unknown[]) => mockPagamentoFindMany(...args),
      findFirst: (...args: unknown[]) => mockPagamentoFindFirst(...args),
      update: (...args: unknown[]) => mockPagamentoUpdate(...args),
      updateMany: (...args: unknown[]) => mockPagamentoUpdateMany(...args),
    },
    pagante: {
      findFirst: (...args: unknown[]) => mockPaganteFindFirst(...args),
      update: (...args: unknown[]) => mockPaganteUpdate(...args),
    },
  };
  return cb(tx);
});

vi.mock("@/lib/prisma", () => ({
  prisma: {
    impostazioniSistemaTs: {
      findUnique: (...args: unknown[]) => mockImpostazioniFindUnique(...args),
      upsert: (...args: unknown[]) => mockImpostazioniUpsert(...args),
    },
    utente: {
      findUnique: (...args: unknown[]) => mockUtenteFindUnique(...args),
    },
    pagamento: {
      findFirst: (...args: unknown[]) => mockPagamentoFindFirst(...args),
      findMany: (...args: unknown[]) => mockPagamentoFindMany(...args),
      update: (...args: unknown[]) => mockPagamentoUpdate(...args),
      updateMany: (...args: unknown[]) => mockPagamentoUpdateMany(...args),
    },
    trasmissioneTs: {
      findFirst: (...args: unknown[]) => mockTrasmissioneFindFirst(...args),
      create: (...args: unknown[]) => mockTrasmissioneCreate(...args),
      update: (...args: unknown[]) => mockTrasmissioneUpdate(...args),
    },
    pagante: {
      findFirst: (...args: unknown[]) => mockPaganteFindFirst(...args),
      update: (...args: unknown[]) => mockPaganteUpdate(...args),
    },
    $transaction: (...args: unknown[]) => mockTransaction(...args as [(tx: unknown) => unknown]),
  },
}));

import {
  saveSistemaTsSettings,
  inviaLottoFatture,
  sincronizzaEsitoTrasmissione,
  annullaFatturaTs,
  ripristinaFatturaPerReinvio,
  getRicevutaPdfBase64,
  correggiFatturaTs,
} from "./sistema-ts";
import { resetSistemaTsRateLimiters } from "@/lib/sistemats/rate-limiters";

beforeEach(() => {
  resetSistemaTsRateLimiters();
});

describe("lib/actions/sistema-ts — saveSistemaTsSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("restituisce errore se i dati non superano la validazione dello schema", async () => {
    const invalidInput = {
      username: "", // vuoto non valido
      password: "pwd",
      pincode: "pin",
    };

    const result = await saveSistemaTsSettings(invalidInput as never);

    expect(result).toHaveProperty("error");
    expect(mockImpostazioniUpsert).not.toHaveBeenCalled();
  });

  it("restituisce errore se password o pincode mancano su primo salvataggio", async () => {
    mockImpostazioniFindUnique.mockResolvedValueOnce(null);

    const inputWithoutPwd = {
      username: "dott.rossi",
      password: "",
      pincode: "12345",
      codiceRegione: "030",
      codiceAsl: "001",
      codiceStruttura: "",
      naturaIvaDefault: "N2.2" as const,
    };

    const result = await saveSistemaTsSettings(inputWithoutPwd);

    expect(result).toEqual({
      error: "La password del Sistema TS è obbligatoria.",
    });
    expect(mockImpostazioniUpsert).not.toHaveBeenCalled();
  });

  it("conserva le credenziali cifrate già presenti se l'utente lascia i campi vuoti in modifica", async () => {
    mockImpostazioniFindUnique.mockResolvedValueOnce({
      id: 1,
      id_Utente: 1,
      passwordEncrypted: "existing_enc_pwd",
      pincodeEncrypted: "existing_enc_pin",
    });

    const input = {
      username: "dott.rossi",
      password: "",
      pincode: "",
      codiceRegione: "030",
      codiceAsl: "001",
      codiceStruttura: "SSA001",
      naturaIvaDefault: "N2.2" as const,
    };

    mockImpostazioniUpsert.mockResolvedValueOnce({ id: 1 });

    const result = await saveSistemaTsSettings(input);

    expect(result).toEqual({
      success: true,
      message: "Impostazioni Sistema TS salvate con successo.",
    });

    expect(mockImpostazioniUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id_Utente: 1 },
        create: expect.objectContaining({
          passwordEncrypted: "existing_enc_pwd",
          pincodeEncrypted: "existing_enc_pin",
        }),
        update: expect.objectContaining({
          passwordEncrypted: "existing_enc_pwd",
          pincodeEncrypted: "existing_enc_pin",
        }),
      })
    );

    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        azione: AUDIT_ACTIONS.SISTEMA_TS_SETTINGS_UPDATE,
        userId: 1,
        entita: "ImpostazioniSistemaTs",
      })
    );

    expect(mockRevalidatePath).toHaveBeenCalledWith("/settings/sistema-ts");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/sistema-ts");
  });

  it("cifra e salva le nuove credenziali se fornite", async () => {
    mockImpostazioniFindUnique.mockResolvedValueOnce(null);

    const input = {
      username: "dott.rossi",
      password: "new-secret-password",
      pincode: "998877",
      codiceRegione: "030",
      codiceAsl: "001",
      codiceStruttura: "",
      naturaIvaDefault: "N2.2" as const,
    };

    mockImpostazioniUpsert.mockResolvedValueOnce({ id: 1 });

    const result = await saveSistemaTsSettings(input);

    expect(result).toEqual({
      success: true,
      message: "Impostazioni Sistema TS salvate con successo.",
    });

    expect(mockImpostazioniUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          passwordEncrypted: "encrypted_new-secret-password",
          pincodeEncrypted: "encrypted_998877",
        }),
      })
    );
  });

  it("cattura e gestisce eventuali errori del database", async () => {
    mockImpostazioniFindUnique.mockResolvedValueOnce({
      passwordEncrypted: "enc_pwd",
      pincodeEncrypted: "enc_pin",
    });
    mockImpostazioniUpsert.mockRejectedValueOnce(new Error("Prisma connection failure"));

    const result = await saveSistemaTsSettings({
      username: "dott.rossi",
      password: "",
      pincode: "",
    });

    expect(result).toEqual({
      error: "Errore durante il salvataggio delle impostazioni Sistema TS.",
    });
  });
});

describe("lib/actions/sistema-ts — inviaLottoFatture", () => {
  const defaultSettings = {
    id_Utente: 1,
    username: "ts_user",
    passwordEncrypted: "enc_pwd",
    pincodeEncrypted: "enc_pin",
    codiceRegione: "000",
    codiceAsl: "000",
    codiceStruttura: "",
  };

  const defaultUser = {
    id: 1,
    cf: "RSSMRA85M01H501Q",
    pIva: "12345678901",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    resetSistemaTsRateLimiters();
    capturedXmlPayload = null;
    mockImpostazioniFindUnique.mockResolvedValue(defaultSettings);
    mockUtenteFindUnique.mockResolvedValue(defaultUser);
    mockPagamentoUpdateMany.mockResolvedValue({ count: 1 });
    mockTrasmissioneCreate.mockResolvedValue({ id: 10 });
    mockInviaFile.mockResolvedValue({
      success: true,
      protocollo: "PROT_TS_OK",
      codiceEsito: "000",
      descrizioneEsito: "File inviato con successo",
    });
  });

  it("restituisce errore se non viene passata alcuna fattura", async () => {
    const result = await inviaLottoFatture([]);
    expect(result).toEqual({ error: "Nessuna fattura selezionata per l'invio." });
    expect(mockInviaFile).not.toHaveBeenCalled();
  });

  it("blocca con errore se si superano le 10 richieste di trasmissione al minuto", async () => {
    mockPagamentoFindMany.mockResolvedValue([]);
    for (let i = 0; i < 10; i++) {
      await inviaLottoFatture([1]);
    }
    const eleventh = await inviaLottoFatture([1]);
    expect(eleventh).toEqual(
      expect.objectContaining({
        error: expect.stringContaining("Troppe richieste di trasmissione inviate"),
      })
    );
  });

  it("restituisce errore se le credenziali Sistema TS non sono configurate", async () => {
    mockImpostazioniFindUnique.mockResolvedValueOnce(null);

    const result = await inviaLottoFatture([1]);

    expect(result).toEqual(
      expect.objectContaining({
        error: expect.stringContaining("Credenziali Sistema TS non configurate"),
      })
    );
    expect(mockInviaFile).not.toHaveBeenCalled();
  });

  it("restituisce errore se il profilo utente è privo di CF o P.IVA", async () => {
    mockUtenteFindUnique.mockResolvedValueOnce({ id: 1, cf: null, pIva: null });

    const result = await inviaLottoFatture([1]);

    expect(result).toEqual(
      expect.objectContaining({
        error: expect.stringContaining("Profilo utente incompleto"),
      })
    );
  });

  it("restituisce errore se nessuna fattura idonea (in DA_INVIARE) viene trovata", async () => {
    mockPagamentoFindMany.mockResolvedValueOnce([]);

    const result = await inviaLottoFatture([999]);

    expect(result).toEqual({
      error: "Nessuna fattura idonea trovata tra quelle selezionate.",
    });
  });

  it("blocca la trasmissione se il Codice Fiscale del pagante non è valido (senza opposizione)", async () => {
    mockPagamentoFindMany.mockResolvedValueOnce([
      {
        id: 1,
        n_fattura: 5,
        anno: 2026,
        data: new Date("2026-03-01"),
        prezzo_totale: new Prisma.Decimal("100.00"),
        natura_iva: "N2.2",
        flag_opposizione: false,
        pagamento_tracciato: true,
        bolloCodice: null,
        pagante: { nome: "Mario", cognome: "Rossi", cf: "CF_NON_VALIDO" },
        paziente: { nome: "Mario", cognome: "Rossi", cf: "CF_NON_VALIDO" },
      },
    ]);

    const result = await inviaLottoFatture([1]);

    expect(result).toEqual(
      expect.objectContaining({
        error: expect.stringContaining("Fattura n. 5/2026"),
      })
    );
    expect(result).toEqual(
      expect.objectContaining({
        error: expect.stringContaining("Codice Fiscale Pagante ('CF_NON_VALIDO') non valido"),
      })
    );
    expect(mockInviaFile).not.toHaveBeenCalled();
  });

  it("blocca la trasmissione se la data di incasso è futura rispetto alla data odierna (DM 19/10/2020)", async () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 5);

    mockPagamentoFindMany.mockResolvedValueOnce([
      {
        id: 1,
        n_fattura: 99,
        anno: 2026,
        data: new Date(),
        data_pagamento: futureDate,
        prezzo_totale: new Prisma.Decimal("100.00"),
        natura_iva: "N2.2",
        flag_opposizione: false,
        pagamento_tracciato: true,
        bolloCodice: null,
        pagante: { nome: "Mario", cognome: "Rossi", cf: "RSSMRA85M01H501Q" },
        paziente: { nome: "Mario", cognome: "Rossi", cf: "RSSMRA85M01H501Q" },
      },
    ]);

    const result = await inviaLottoFatture([1]);

    expect(result).toEqual(
      expect.objectContaining({
        error: expect.stringContaining("Fattura n. 99/2026"),
      })
    );
    expect(result).toEqual(
      expect.objectContaining({
        error: expect.stringContaining("è futura rispetto alla data odierna"),
      })
    );
    expect(mockInviaFile).not.toHaveBeenCalled();
    expect(mockPagamentoUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { stato_ts: "DA_INVIARE", data_invio_ts: null },
      })
    );
  });

  it("gestisce correttamente l'opposizione assistito: salta validazione CF, invia cf vuoto e flag 1", async () => {
    mockPagamentoFindMany.mockResolvedValueOnce([
      {
        id: 2,
        n_fattura: 6,
        anno: 2026,
        data: new Date("2026-03-02"),
        prezzo_totale: new Prisma.Decimal("50.00"),
        natura_iva: "N2.2",
        flag_opposizione: true, // Opposizione
        pagamento_tracciato: true,
        bolloCodice: null,
        pagante: { nome: "Anna", cognome: "Neri", cf: null },
        paziente: { nome: "Anna", cognome: "Neri", cf: null },
      },
    ]);

    const result = await inviaLottoFatture([2]);

    expect(result).toEqual(
      expect.objectContaining({
        success: true,
        protocollo: "PROT_TS_OK",
      })
    );

    const payload = capturedXmlPayload as { documenti: Array<{ cfCittadino: string; flagOpposizione: number }> };
    expect(payload.documenti[0].cfCittadino).toBe("");
    expect(payload.documenti[0].flagOpposizione).toBe(1);
  });

  it("aggiunge la riga bollo (2.00 € N1) se il totale supera la soglia di 77.47 €", async () => {
    mockPagamentoFindMany.mockResolvedValueOnce([
      {
        id: 3,
        n_fattura: 7,
        anno: 2026,
        data: new Date("2026-03-03"),
        prezzo_totale: new Prisma.Decimal("100.00"), // > 77.47
        natura_iva: "N2.2",
        flag_opposizione: false,
        pagamento_tracciato: true,
        bolloCodice: null,
        pagante: { nome: "Mario", cognome: "Rossi", cf: "RSSMRA85M01H501Q" },
        paziente: { nome: "Mario", cognome: "Rossi", cf: "RSSMRA85M01H501Q" },
      },
    ]);

    const result = await inviaLottoFatture([3]);

    expect(result).toHaveProperty("success", true);

    const payload = capturedXmlPayload as {
      documenti: Array<{ vociSpesa: Array<{ importo: number; naturaIva: string }> }>;
    };
    expect(payload.documenti[0].vociSpesa).toHaveLength(2);
    expect(payload.documenti[0].vociSpesa[1]).toEqual({
      tipoSpesa: "SP",
      importo: 2,
      naturaIva: "N2.2",
    });
  });

  it("aggiunge la riga bollo con natura N1 se la fattura è in regime ordinario esente art. 10 (N4)", async () => {
    mockPagamentoFindMany.mockResolvedValueOnce([
      {
        id: 33,
        n_fattura: 77,
        anno: 2026,
        data: new Date("2026-03-03"),
        prezzo_totale: new Prisma.Decimal("100.00"),
        natura_iva: "N4",
        flag_opposizione: false,
        pagamento_tracciato: true,
        bolloCodice: null,
        pagante: { nome: "Mario", cognome: "Rossi", cf: "RSSMRA85M01H501Q" },
        paziente: { nome: "Mario", cognome: "Rossi", cf: "RSSMRA85M01H501Q" },
      },
    ]);

    const result = await inviaLottoFatture([33]);
    expect(result).toHaveProperty("success", true);

    const payload = capturedXmlPayload as {
      documenti: Array<{ vociSpesa: Array<{ importo: number; naturaIva: string }> }>;
    };
    expect(payload.documenti[0].vociSpesa[1]).toEqual({
      tipoSpesa: "SP",
      importo: 2,
      naturaIva: "N1",
    });
  });

  it("aggiunge la riga bollo anche sotto soglia se bolloCodice è presente", async () => {
    mockPagamentoFindMany.mockResolvedValueOnce([
      {
        id: 4,
        n_fattura: 8,
        anno: 2026,
        data: new Date("2026-03-04"),
        prezzo_totale: new Prisma.Decimal("50.00"), // <= 77.47
        natura_iva: "N2.2",
        flag_opposizione: false,
        pagamento_tracciato: true,
        bolloCodice: "BOLLO_APP_01",
        pagante: { nome: "Mario", cognome: "Rossi", cf: "RSSMRA85M01H501Q" },
        paziente: { nome: "Mario", cognome: "Rossi", cf: "RSSMRA85M01H501Q" },
      },
    ]);

    const result = await inviaLottoFatture([4]);

    expect(result).toHaveProperty("success", true);

    const payload = capturedXmlPayload as {
      documenti: Array<{ vociSpesa: Array<{ importo: number; naturaIva: string }> }>;
    };
    expect(payload.documenti[0].vociSpesa).toHaveLength(2);
    expect(payload.documenti[0].vociSpesa[1].naturaIva).toBe("N2.2");
  });

  it("utilizza data_pagamento per dataPagamento se valorizzata, altrimenti fa fallback su data", async () => {
    mockPagamentoFindMany.mockResolvedValueOnce([
      {
        id: 101,
        n_fattura: 20,
        anno: 2026,
        data: new Date("2026-01-10"),
        data_pagamento: new Date("2026-02-15"),
        prezzo_totale: new Prisma.Decimal("100.00"),
        natura_iva: "N2.2",
        flag_opposizione: false,
        pagamento_tracciato: true,
        bolloCodice: null,
        pagante: { nome: "Mario", cognome: "Rossi", cf: "RSSMRA85M01H501Q" },
        paziente: { nome: "Mario", cognome: "Rossi", cf: "RSSMRA85M01H501Q" },
      },
      {
        id: 102,
        n_fattura: 21,
        anno: 2026,
        data: new Date("2026-01-12"),
        data_pagamento: null,
        prezzo_totale: new Prisma.Decimal("100.00"),
        natura_iva: "N2.2",
        flag_opposizione: false,
        pagamento_tracciato: true,
        bolloCodice: null,
        pagante: { nome: "Luigi", cognome: "Bianchi", cf: "RSSMRA85M01H501Q" },
        paziente: { nome: "Luigi", cognome: "Bianchi", cf: "RSSMRA85M01H501Q" },
      },
    ]);

    mockPagamentoUpdateMany
      .mockResolvedValueOnce({ count: 0 }) // Stale locks cleanup
      .mockResolvedValueOnce({ count: 2 }); // Atomic lock candidate invoices
    const result = await inviaLottoFatture([101, 102]);
    expect(result).toHaveProperty("success", true);

    const payload = capturedXmlPayload as {
      documenti: Array<{
        idSpesa: { dataEmissione: Date; numDocumento: string };
        dataPagamento: Date;
      }>;
    };
    expect(payload.documenti).toHaveLength(2);
    // Fattura 1: dataPagamento = data_pagamento
    expect(payload.documenti[0].idSpesa.dataEmissione).toEqual(new Date("2026-01-10"));
    expect(payload.documenti[0].dataPagamento).toEqual(new Date("2026-02-15"));

    // Fattura 2: dataPagamento fallback su data di emissione
    expect(payload.documenti[1].idSpesa.dataEmissione).toEqual(new Date("2026-01-12"));
    expect(payload.documenti[1].dataPagamento).toEqual(new Date("2026-01-12"));
  });

  it("invia una sola riga spesa se sotto soglia e senza bolloCodice", async () => {
    mockPagamentoFindMany.mockResolvedValueOnce([
      {
        id: 5,
        n_fattura: 9,
        anno: 2026,
        data: new Date("2026-03-05"),
        prezzo_totale: new Prisma.Decimal("60.00"),
        natura_iva: "N2.2",
        flag_opposizione: false,
        pagamento_tracciato: true,
        bolloCodice: null,
        pagante: { nome: "Mario", cognome: "Rossi", cf: "RSSMRA85M01H501Q" },
        paziente: { nome: "Mario", cognome: "Rossi", cf: "RSSMRA85M01H501Q" },
      },
    ]);

    const result = await inviaLottoFatture([5]);

    expect(result).toHaveProperty("success", true);

    const payload = capturedXmlPayload as {
      documenti: Array<{ vociSpesa: Array<{ importo: number; naturaIva: string }> }>;
    };
    expect(payload.documenti[0].vociSpesa).toHaveLength(1);
    expect(payload.documenti[0].vociSpesa[0].importo).toBe(60);
  });
});

describe("lib/actions/sistema-ts — sincronizzaEsitoTrasmissione", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockImpostazioniFindUnique.mockResolvedValue({
      id_Utente: 1,
      username: "user",
      passwordEncrypted: "p",
      pincodeEncrypted: "pin",
    });
    mockUtenteFindUnique.mockResolvedValue({
      id: 1,
      cf: "RSSMRA85M01H501Q",
      pIva: "12345678901",
    });
  });

  it("restituisce errore se la trasmissione non esiste o appartiene a un altro utente", async () => {
    mockTrasmissioneFindFirst.mockResolvedValueOnce(null);

    const result = await sincronizzaEsitoTrasmissione(999);

    expect(result).toEqual({ error: "Trasmissione non trovata." });
    expect(mockInterrogaEsito).not.toHaveBeenCalled();
  });

  it("restituisce errore se l'interrogazione dell'esito da client fallisce", async () => {
    mockTrasmissioneFindFirst.mockResolvedValueOnce({
      id: 10,
      id_Utente: 1,
      protocollo: "PROT_10",
      nomeFile: "invio_1.zip",
    });

    mockInterrogaEsito.mockResolvedValueOnce({
      success: false,
      errorMessage: "Errore di autenticazione con Sogei",
    });

    const result = await sincronizzaEsitoTrasmissione(10);

    expect(result).toEqual({ error: "Errore di autenticazione con Sogei" });
    expect(mockTrasmissioneUpdate).not.toHaveBeenCalled();
  });

  it("blocca con errore se si superano le 15 richieste di verifica esito al minuto", async () => {
    mockTrasmissioneFindFirst.mockResolvedValue({
      id: 10,
      id_Utente: 1,
      protocollo: "PROT_10",
      nomeFile: "invio_1.zip",
    });
    mockInterrogaEsito.mockResolvedValue({
      success: false,
      errorMessage: "Non ancora pronto",
    });

    for (let i = 0; i < 15; i++) {
      await sincronizzaEsitoTrasmissione(10);
    }

    const sixteenth = await sincronizzaEsitoTrasmissione(10);
    expect(sixteenth).toEqual(
      expect.objectContaining({
        error: expect.stringContaining("Troppe richieste di verifica esito ravvicinate"),
      })
    );
  });

  it("scarica la ricevuta PDF per trasmissioni accolte con stato '3' (segnalazioni)", async () => {
    mockTrasmissioneFindFirst.mockResolvedValueOnce({
      id: 20,
      id_Utente: 1,
      protocollo: "PROT_20",
      nomeFile: "invio_2.zip",
      fatture: [
        { id: 101, n_fattura: 1 },
        { id: 102, n_fattura: 2 },
      ],
    });

    mockInterrogaEsito.mockResolvedValueOnce({
      success: true,
      statoElaborazione: "3", // Accolto con segnalazioni
      codiceEsito: "000",
      descrizioneEsito: "Elaborato con segnalazioni",
      numDocumentiRicevuti: 2,
      numDocumentiAccolti: 1,
      numDocumentiScartati: 1,
    });

    mockScaricaRicevutaPdf.mockResolvedValueOnce({
      success: true,
      pdfBuffer: Buffer.from("pdf-ricevuta"),
    });

    mockScaricaDettaglioErrori.mockResolvedValueOnce({
      success: true,
      rawCsv:
        "numDoc;codErrore;descrizione;tipo\n1;S017;Gia presente;ERRORE\n2;S050;CF errato;ERRORE",
    });

    const result = await sincronizzaEsitoTrasmissione(20);

    expect(result).toHaveProperty("success", true);

    expect(mockScaricaRicevutaPdf).toHaveBeenCalledWith("PROT_20");
    expect(mockScaricaDettaglioErrori).toHaveBeenCalledWith("PROT_20");

    expect(mockTrasmissioneUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 20 },
        data: expect.objectContaining({
          statoElaborazione: "3",
          pdfRicevuta: expect.any(Uint8Array),
          csvErrori: expect.stringContaining("S017"),
        }),
      })
    );

    // Documento 1 con S017 -> INVIATA
    expect(mockPagamentoUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { in: [101] },
          id_Utente: 1,
          protocollo_ts: "PROT_20",
        }),
        data: { stato_ts: "INVIATA" },
      })
    );

    // Documento 2 con scarto -> DA_INVIARE
    expect(mockPagamentoUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { in: [102] },
          id_Utente: 1,
          protocollo_ts: "PROT_20",
        }),
        data: { stato_ts: "DA_INVIARE", protocollo_ts: null, data_invio_ts: null },
      })
    );

    expect(mockTransaction).toHaveBeenCalledTimes(1);

    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        azione: AUDIT_ACTIONS.SISTEMA_TS_SYNC,
        entitaId: 20,
      })
    );
  });

  it("esegue tutte le mutazioni su DB in una transazione atomica e gestisce il rollback in caso di errore DB", async () => {
    mockTrasmissioneFindFirst.mockResolvedValueOnce({
      id: 25,
      id_Utente: 1,
      protocollo: "PROT_TX_ERR",
      nomeFile: "invio_tx.zip",
      fatture: [{ id: 101, n_fattura: 1 }],
    });

    mockInterrogaEsito.mockResolvedValueOnce({
      success: true,
      statoElaborazione: "3",
      codiceEsito: "000",
      descrizioneEsito: "Elaborato con errori",
      numDocumentiRicevuti: 1,
      numDocumentiAccolti: 0,
      numDocumentiScartati: 1,
    });

    mockScaricaRicevutaPdf.mockResolvedValueOnce({
      success: true,
      pdfBuffer: Buffer.from("pdf"),
    });

    mockScaricaDettaglioErrori.mockResolvedValueOnce({
      success: true,
      rawCsv: "numDoc;codErrore;descrizione;tipo\n1;S050;Errore;ERRORE",
    });

    mockPagamentoUpdateMany.mockRejectedValueOnce(new Error("DB transaction failure"));

    const result = await sincronizzaEsitoTrasmissione(25);

    expect(result).toEqual({
      error: "Errore durante la sincronizzazione dell'esito: DB transaction failure",
    });
    expect(mockTransaction).toHaveBeenCalled();
  });

  it("M2: sincronizzando un vecchio lotto, non muta fatture che sono già state reinviate con un protocollo più recente", async () => {
    mockTrasmissioneFindFirst.mockResolvedValueOnce({
      id: 30,
      id_Utente: 1,
      protocollo: "PROT_VECCHIO",
      nomeFile: "invio_vecchio.zip",
      fatture: [
        { id: 101, n_fattura: 1 },
        { id: 102, n_fattura: 2 },
      ],
    });

    mockInterrogaEsito.mockResolvedValueOnce({
      success: true,
      statoElaborazione: "4", // Scarto totale
      codiceEsito: "004",
      descrizioneEsito: "File scartato",
      numDocumentiRicevuti: 2,
      numDocumentiAccolti: 0,
      numDocumentiScartati: 2,
    });

    mockScaricaDettaglioErrori.mockResolvedValueOnce({
      success: false,
    });

    const result = await sincronizzaEsitoTrasmissione(30);

    expect(result).toHaveProperty("success", true);
    // L'update deve essere rigorosamente vincolato a protocollo_ts: "PROT_VECCHIO"
    expect(mockPagamentoUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { in: [101, 102] },
          id_Utente: 1,
          protocollo_ts: "PROT_VECCHIO",
        }),
        data: { stato_ts: "DA_INVIARE", protocollo_ts: null, data_invio_ts: null },
      })
    );
  });

  it("disambigua fatture con stesso n_fattura ma anni diversi in base alla data del CSV Sogei", async () => {
    mockTrasmissioneFindFirst.mockResolvedValueOnce({
      id: 35,
      id_Utente: 1,
      protocollo: "PROT_MULTI_ANNO",
      nomeFile: "invio_multi.zip",
      fatture: [
        { id: 101, n_fattura: 1, anno: 2025, data: new Date("2025-04-10") },
        { id: 102, n_fattura: 1, anno: 2026, data: new Date("2026-04-10") },
      ],
    });

    mockInterrogaEsito.mockResolvedValueOnce({
      success: true,
      statoElaborazione: "3",
      codiceEsito: "000",
      descrizioneEsito: "Elaborato con errori",
      numDocumentiRicevuti: 2,
      numDocumentiAccolti: 1,
      numDocumentiScartati: 1,
    });

    mockScaricaRicevutaPdf.mockResolvedValueOnce({
      success: true,
      pdfBuffer: Buffer.from("pdf-ricevuta"),
    });

    // Errore Sogei solo per la fattura 1 del 2025 (data 10/04/2025)
    mockScaricaDettaglioErrori.mockResolvedValueOnce({
      success: true,
      rawCsv:
        "protocollo;id;tipo;cf;pi;10/04/2025;disp;1;v;S050;CF non valido;ERRORE",
    });

    const result = await sincronizzaEsitoTrasmissione(35);

    expect(result).toHaveProperty("success", true);

    // Solo la fattura 101 (2025) deve essere reimpostata a DA_INVIARE
    expect(mockPagamentoUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { in: [101] },
          id_Utente: 1,
          protocollo_ts: "PROT_MULTI_ANNO",
        }),
        data: { stato_ts: "DA_INVIARE", protocollo_ts: null, data_invio_ts: null },
      })
    );

    // La fattura 102 (2026) non deve essere stata inserita negli scartati
    expect(mockPagamentoUpdateMany).not.toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { in: [102] },
        }),
      })
    );
  });

  it("azzera completamente protocollo_ts e data_invio_ts per le fatture scartate, garantendo la compatibilità con il recovery lock orfani", async () => {
    mockTrasmissioneFindFirst.mockResolvedValueOnce({
      id: 40,
      id_Utente: 1,
      protocollo: "PROT_SCARTO_RESET",
      nomeFile: "invio_scarto.zip",
      fatture: [
        { id: 101, n_fattura: 1, anno: 2026, data: new Date("2026-03-01") },
      ],
    });

    mockInterrogaEsito.mockResolvedValueOnce({
      success: true,
      statoElaborazione: "3",
      codiceEsito: "000",
      descrizioneEsito: "Elaborato con errori",
      numDocumentiRicevuti: 1,
      numDocumentiAccolti: 0,
      numDocumentiScartati: 1,
    });

    mockScaricaRicevutaPdf.mockResolvedValueOnce({
      success: true,
      pdfBuffer: Buffer.from("pdf-ricevuta"),
    });

    mockScaricaDettaglioErrori.mockResolvedValueOnce({
      success: true,
      rawCsv:
        "numDoc;codErrore;descrizione;tipo\n1;S050;CF cittadino non valido;ERRORE",
    });

    const result = await sincronizzaEsitoTrasmissione(40);

    expect(result).toHaveProperty("success", true);

    expect(mockPagamentoUpdateMany).toHaveBeenCalledWith({
      where: {
        id: { in: [101] },
        id_Utente: 1,
        protocollo_ts: "PROT_SCARTO_RESET",
      },
      data: {
        stato_ts: "DA_INVIARE",
        protocollo_ts: null,
        data_invio_ts: null,
      },
    });
  });
});

describe("lib/actions/sistema-ts — annullaFatturaTs fallback & error handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockImpostazioniFindUnique.mockResolvedValue({
      id_Utente: 1,
      username: "user",
      passwordEncrypted: "p",
      pincodeEncrypted: "pin",
    });
    mockUtenteFindUnique.mockResolvedValue({
      id: 1,
      cf: "RSSMRA85M01H501Q",
      pIva: "12345678901",
    });
  });

  it("restituisce errore se la fattura non esiste", async () => {
    mockPagamentoFindFirst.mockResolvedValueOnce(null);

    const result = await annullaFatturaTs(999);

    expect(result).toEqual({ error: "Fattura non trovata." });
  });

  it("rifiuta l'annullamento se la fattura è in stato DA_INVIARE", async () => {
    mockPagamentoFindFirst.mockResolvedValueOnce({
      id: 50,
      n_fattura: 1,
      anno: 2026,
      stato_ts: "DA_INVIARE",
    });

    const result = await annullaFatturaTs(50);

    expect(result).toEqual({
      error:
        "Non è possibile annullare sul Sistema TS una fattura che non è mai stata trasmessa (stato 'Da Inviare').",
    });
    expect(mockInviaFile).not.toHaveBeenCalled();
  });

  it("rifiuta l'annullamento se la fattura è in stato ANNULLATA_TS", async () => {
    mockPagamentoFindFirst.mockResolvedValueOnce({
      id: 51,
      n_fattura: 2,
      anno: 2026,
      stato_ts: "ANNULLATA_TS",
    });

    const result = await annullaFatturaTs(51);

    expect(result).toEqual({
      error: "La fattura risulta già annullata sul Sistema TS.",
    });
    expect(mockInviaFile).not.toHaveBeenCalled();
  });

  it("blocca con errore se si superano le 10 richieste di annullamento/trasmissione al minuto", async () => {
    mockPagamentoFindFirst.mockResolvedValue({
      id: 50,
      n_fattura: 1,
      anno: 2026,
      data: new Date("2026-03-01"),
      prezzo_totale: new Prisma.Decimal("100"),
      stato_ts: "INVIATA",
      flag_opposizione: false,
      pagamento_tracciato: true,
      pagante: { cf: "RSSMRA85M01H501Q" },
      paziente: { cf: "RSSMRA85M01H501Q" },
    });
    mockInviaFile.mockResolvedValue({
      success: true,
      protocollo: "PROT_CANC",
    });

    for (let i = 0; i < 10; i++) {
      await annullaFatturaTs(50);
    }

    const eleventh = await annullaFatturaTs(50);
    expect(eleventh).toEqual(
      expect.objectContaining({
        error: expect.stringContaining("Troppe richieste di trasmissione inviate"),
      })
    );
  });

  it("imposta DA_CANCELLARE_SU_TS e fallback=true se il client restituisce esito non positivo", async () => {
    mockPagamentoFindFirst.mockResolvedValueOnce({
      id: 10,
      n_fattura: 3,
      anno: 2026,
      data: new Date("2026-03-01"),
      prezzo_totale: new Prisma.Decimal("100"),
      stato_ts: "INVIATA",
      pagante: { nome: "A", cognome: "B", cf: "RSSMRA85M01H501Q" },
      paziente: { nome: "A", cognome: "B", cf: "RSSMRA85M01H501Q" },
    });

    mockInviaFile.mockResolvedValueOnce({
      success: false,
      errorMessage: "Servizio MEF temporaneamente non disponibile",
    });

    const result = await annullaFatturaTs(10);

    expect(result).toEqual(
      expect.objectContaining({
        error: "Servizio MEF temporaneamente non disponibile",
        fallback: true,
      })
    );

    expect(mockPagamentoUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 10 },
        data: { stato_ts: "DA_CANCELLARE_SU_TS" },
      })
    );
  });

  it("imposta DA_CANCELLARE_SU_TS e fallback=true su eccezione di rete", async () => {
    mockPagamentoFindFirst.mockResolvedValueOnce({
      id: 11,
      n_fattura: 4,
      anno: 2026,
      data: new Date("2026-03-01"),
      prezzo_totale: new Prisma.Decimal("100"),
      stato_ts: "INVIATA",
      pagante: { nome: "A", cognome: "B", cf: "RSSMRA85M01H501Q" },
      paziente: { nome: "A", cognome: "B", cf: "RSSMRA85M01H501Q" },
    });

    mockInviaFile.mockRejectedValueOnce(new Error("ETIMEDOUT"));

    const result = await annullaFatturaTs(11);

    expect(result).toEqual(
      expect.objectContaining({
        fallback: true,
      })
    );
    expect(result).toHaveProperty("error");

    expect(mockPagamentoUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 11 },
        data: { stato_ts: "DA_CANCELLARE_SU_TS" },
      })
    );
  });

  it("include la riga bollo nel payload di cancellazione se l'importo supera 77.47 €", async () => {
    mockPagamentoFindFirst.mockResolvedValueOnce({
      id: 12,
      n_fattura: 5,
      anno: 2026,
      data: new Date("2026-03-01"),
      prezzo_totale: new Prisma.Decimal("100"), // > 77.47
      stato_ts: "INVIATA",
      flag_opposizione: false,
      pagamento_tracciato: true,
      bolloCodice: null,
      pagante: { nome: "A", cognome: "B", cf: "RSSMRA85M01H501Q" },
      paziente: { nome: "A", cognome: "B", cf: "RSSMRA85M01H501Q" },
    });

    mockInviaFile.mockResolvedValueOnce({
      success: true,
      protocollo: "PROT_CANCEL_OK",
    });

    const result = await annullaFatturaTs(12);

    expect(result).toHaveProperty("success", true);

    const payload = capturedXmlPayload as {
      documenti: Array<{
        flagOperazione: string;
        vociSpesa: Array<{ tipoSpesa: string; importo: number; naturaIva: string }>;
      }>;
    };
    expect(payload.documenti[0].flagOperazione).toBe("C");
    expect(payload.documenti[0].vociSpesa).toHaveLength(2);
    expect(payload.documenti[0].vociSpesa[1]).toEqual({
      tipoSpesa: "SP",
      importo: 2,
      naturaIva: "N2.2",
    });
  });

  it("omette il CF del cittadino e imposta flagOpposizione=1 nel payload di cancellazione se presente opposizione", async () => {
    mockPagamentoFindFirst.mockResolvedValueOnce({
      id: 13,
      n_fattura: 6,
      anno: 2026,
      data: new Date("2026-03-01"),
      prezzo_totale: new Prisma.Decimal("50"),
      stato_ts: "INVIATA",
      flag_opposizione: true, // Opposizione attiva
      pagamento_tracciato: true,
      bolloCodice: null,
      pagante: { nome: "A", cognome: "B", cf: "RSSMRA85M01H501Q" },
      paziente: { nome: "A", cognome: "B", cf: "RSSMRA85M01H501Q" },
    });

    mockInviaFile.mockResolvedValueOnce({
      success: true,
      protocollo: "PROT_CANCEL_OK",
    });

    const result = await annullaFatturaTs(13);

    expect(result).toHaveProperty("success", true);

    const payload = capturedXmlPayload as {
      documenti: Array<{
        flagOperazione: string;
        cfCittadino: string;
        flagOpposizione: number;
      }>;
    };
    expect(payload.documenti[0].flagOperazione).toBe("C");
    expect(payload.documenti[0].cfCittadino).toBe("");
    expect(payload.documenti[0].flagOpposizione).toBe(1);
  });
});

describe("lib/actions/sistema-ts — ripristinaFatturaPerReinvio", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("restituisce errore se la fattura non esiste", async () => {
    mockPagamentoFindFirst.mockResolvedValueOnce(null);

    const result = await ripristinaFatturaPerReinvio(999);

    expect(result).toEqual({ error: "Fattura non trovata." });
  });

  it("rifiuta il ripristino se la fattura non è in ANNULLATA_TS o IN_TRASMISSIONE", async () => {
    mockPagamentoFindFirst.mockResolvedValueOnce({
      id: 20,
      n_fattura: 1,
      anno: 2026,
      stato_ts: "INVIATA", // Non ripristinabile direttamente senza prima annullarla
    });

    const result = await ripristinaFatturaPerReinvio(20);

    expect(result).toEqual(
      expect.objectContaining({
        error: expect.stringContaining("Non è possibile cambiare lo stato della fattura"),
      })
    );
    expect(mockPagamentoUpdate).not.toHaveBeenCalled();
  });

  it("ripristina la fattura a DA_INVIARE e azzera protocollo se era in ANNULLATA_TS", async () => {
    mockPagamentoFindFirst.mockResolvedValueOnce({
      id: 21,
      n_fattura: 2,
      anno: 2026,
      stato_ts: "ANNULLATA_TS",
    });

    mockPagamentoUpdate.mockResolvedValueOnce({ id: 21 });

    const result = await ripristinaFatturaPerReinvio(21);

    expect(result).toEqual(
      expect.objectContaining({
        success: true,
        message: expect.stringContaining("ripristinata su \"Da Inviare\""),
      })
    );

    expect(mockPagamentoUpdate).toHaveBeenCalledWith({
      where: { id: 21 },
      data: {
        stato_ts: "DA_INVIARE",
        protocollo_ts: null,
        data_invio_ts: null,
      },
    });

    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        azione: AUDIT_ACTIONS.SISTEMA_TS_RESET,
        entitaId: 21,
      })
    );

    expect(mockRevalidatePath).toHaveBeenCalledWith("/invoices");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/sistema-ts");
  });
});

describe("lib/actions/sistema-ts — getRicevutaPdfBase64", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("restituisce errore se la trasmissione non esiste o è di altro utente", async () => {
    mockTrasmissioneFindFirst.mockResolvedValueOnce(null);

    const result = await getRicevutaPdfBase64(999);

    expect(result).toEqual({
      error: "Ricevuta PDF non trovata per questa trasmissione.",
    });
  });

  it("restituisce errore se il record trasmissione non ha memorizzato pdfRicevuta", async () => {
    mockTrasmissioneFindFirst.mockResolvedValueOnce({
      id: 30,
      protocollo: "PROT_30",
      pdfRicevuta: null,
    });

    const result = await getRicevutaPdfBase64(30);

    expect(result).toEqual({
      error: "Ricevuta PDF non trovata per questa trasmissione.",
    });
  });

  it("converte il buffer Uint8Array in Base64 e restituisce il nome file con protocollo", async () => {
    const rawBuffer = Buffer.from("%PDF-1.4 fake pdf content");
    mockTrasmissioneFindFirst.mockResolvedValueOnce({
      id: 31,
      protocollo: "PROT_2026_ABC",
      pdfRicevuta: new Uint8Array(rawBuffer),
    });

    const result = await getRicevutaPdfBase64(31);

    expect(result).toEqual({
      success: true,
      base64: rawBuffer.toString("base64"),
      fileName: "ricevuta_PROT_2026_ABC.pdf",
    });
  });
});

describe("lib/actions/sistema-ts — correggiFatturaTs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const baseInvoice = {
    id: 10,
    id_Utente: 1,
    id_Pagante: 100,
    id_Paziente: 200,
    n_fattura: 5,
    anno: 2026,
    stato_ts: "DA_INVIARE",
    prezzo_totale: new Prisma.Decimal("100.00"),
    data: new Date("2026-03-01T12:00:00Z"),
    data_pagamento: null,
    flag_opposizione: false,
    pagamento_tracciato: true,
    bolloCodice: null,
    snapshotAnagrafica: {
      pagante: {
        nome: "Mario",
        cognome: "Rossi",
        via: "Via Roma 1",
        citta: "Roma",
        cap: "00100",
        cf: "WRONG_CF",
        piva: null,
      },
      paziente: {
        nome: "Luigi",
        cognome: "Rossi",
      },
    },
    pagante: {
      id: 100,
      id_Utente: 1,
      nome: "Mario",
      cognome: "Rossi",
      via: "Via Roma 1",
      citta: "Roma",
      cap: "00100",
      cf: "WRONG_CF",
      piva: null,
      archiviato: false,
    },
    paziente: {
      id: 200,
      id_Utente: 1,
      nome: "Luigi",
      cognome: "Rossi",
      archiviato: false,
    },
  };

  it("restituisce errore se la fattura non esiste o appartiene ad altro utente", async () => {
    mockPagamentoFindFirst.mockResolvedValueOnce(null);

    const res = await correggiFatturaTs({
      invoiceId: 999,
      paganteCf: "RSSMRA80A01H501U",
      aggiornaAnagrafica: true,
      propagaFattureInAttesa: false,
      flagOpposizione: false,
    });

    expect(res).toEqual({ error: "Fattura non trovata." });
  });

  it("blocca la correzione se la fattura è già stata trasmessa a TS", async () => {
    mockPagamentoFindFirst.mockResolvedValueOnce({
      ...baseInvoice,
      stato_ts: "INVIATA",
    });

    const res = await correggiFatturaTs({
      invoiceId: 10,
      paganteCf: "RSSMRA80A01H501U",
      aggiornaAnagrafica: true,
      propagaFattureInAttesa: false,
      flagOpposizione: false,
    });

    expect(res).toEqual({
      error: "Non è possibile modificare i dati di una fattura già trasmessa o in fase di trasmissione.",
    });
  });

  it("restituisce errore se il Codice Fiscale ha formato non valido e non c'è opposizione", async () => {
    mockPagamentoFindFirst.mockResolvedValueOnce({ ...baseInvoice });

    const res = await correggiFatturaTs({
      invoiceId: 10,
      paganteCf: "INVALID123",
      aggiornaAnagrafica: true,
      propagaFattureInAttesa: false,
      flagOpposizione: false,
    });

    expect("error" in res && res.error).toBeTruthy();
    expect((res as { error: string }).error).toContain("Codice fiscale non valido");
  });

  it("restituisce errore se il CF appartiene già ad un altro cliente dell'utente", async () => {
    mockPagamentoFindFirst.mockResolvedValueOnce({ ...baseInvoice });
    mockPaganteFindFirst.mockResolvedValueOnce({
      id: 101,
      nome: "Giuseppe",
      cognome: "Verdi",
      cf: "RSSMRA80A01H501U",
    });

    const res = await correggiFatturaTs({
      invoiceId: 10,
      paganteCf: "RSSMRA80A01H501U",
      aggiornaAnagrafica: true,
      propagaFattureInAttesa: false,
      flagOpposizione: false,
    });

    expect("error" in res && res.error).toBeTruthy();
    expect((res as { error: string }).error).toContain("è già associato ad un altro cliente");
  });

  it("corregge la fattura corrente e aggiorna l'anagrafica Pagante", async () => {
    mockPagamentoFindFirst.mockResolvedValueOnce({ ...baseInvoice });
    mockPaganteFindFirst.mockResolvedValueOnce(null);

    const res = await correggiFatturaTs({
      invoiceId: 10,
      paganteCf: "RSSMRA80A01H501U",
      aggiornaAnagrafica: true,
      propagaFattureInAttesa: false,
      flagOpposizione: false,
    });

    expect(res).toEqual({
      success: true,
      message: "Fattura n. 5/2026 corretta con successo.",
    });

    expect(mockPaganteUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 100 },
        data: { cf: "RSSMRA80A01H501U" },
      })
    );

    expect(mockPagamentoUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 10 },
        data: expect.objectContaining({
          snapshotAnagrafica: expect.objectContaining({
            pagante: expect.objectContaining({
              cf: "RSSMRA80A01H501U",
            }),
          }),
        }),
      })
    );

    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        azione: AUDIT_ACTIONS.SISTEMA_TS_CORRECTION,
        entita: "Pagamento",
        entitaId: 10,
      })
    );
  });

  it("propaga il nuovo CF alle altre fatture DA_INVIARE dello stesso pagante quando la spunta è attiva", async () => {
    mockPagamentoFindFirst.mockResolvedValueOnce({ ...baseInvoice });
    mockPaganteFindFirst.mockResolvedValueOnce(null);

    const otherDraft = {
      id: 11,
      id_Utente: 1,
      id_Pagante: 100,
      id_Paziente: 200,
      stato_ts: "DA_INVIARE",
      snapshotAnagrafica: {
        pagante: { nome: "Mario", cognome: "Rossi", via: "Via Roma 1", citta: "Roma", cap: "00100", cf: "WRONG_CF", piva: null },
        paziente: { nome: "Luigi", cognome: "Rossi" },
      },
      pagante: baseInvoice.pagante,
      paziente: baseInvoice.paziente,
    };

    mockPagamentoFindMany.mockResolvedValueOnce([otherDraft]);

    const res = await correggiFatturaTs({
      invoiceId: 10,
      paganteCf: "RSSMRA80A01H501U",
      aggiornaAnagrafica: true,
      propagaFattureInAttesa: true,
      flagOpposizione: false,
    });

    expect(res).toHaveProperty("success", true);

    // Deve aggiornare sia la fattura 10 che l'altra bozza 11
    expect(mockPagamentoUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 11 },
        data: expect.objectContaining({
          snapshotAnagrafica: expect.objectContaining({
            pagante: expect.objectContaining({ cf: "RSSMRA80A01H501U" }),
          }),
        }),
      })
    );
  });

  it("NON propaga il nuovo CF alle altre fatture quando la spunta è disattivata", async () => {
    mockPagamentoFindFirst.mockResolvedValueOnce({ ...baseInvoice });
    mockPaganteFindFirst.mockResolvedValueOnce(null);

    const res = await correggiFatturaTs({
      invoiceId: 10,
      paganteCf: "RSSMRA80A01H501U",
      aggiornaAnagrafica: false,
      propagaFattureInAttesa: false,
      flagOpposizione: false,
    });

    expect(res).toHaveProperty("success", true);
    expect(mockPagamentoFindMany).not.toHaveBeenCalled();
    expect(mockPaganteUpdate).not.toHaveBeenCalled();
  });

  it("consente il salvataggio con opposizione senza richiedere il Codice Fiscale", async () => {
    mockPagamentoFindFirst.mockResolvedValueOnce({ ...baseInvoice });

    const res = await correggiFatturaTs({
      invoiceId: 10,
      paganteCf: "",
      aggiornaAnagrafica: false,
      propagaFattureInAttesa: false,
      flagOpposizione: true,
    });

    expect(res).toEqual({
      success: true,
      message: "Fattura n. 5/2026 corretta con successo.",
    });

    expect(mockPagamentoUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 10 },
        data: expect.objectContaining({
          flag_opposizione: true,
        }),
      })
    );
  });
});

