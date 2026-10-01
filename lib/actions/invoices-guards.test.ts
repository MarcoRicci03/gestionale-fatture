import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  requireUserId: vi.fn(async () => 1),
}));

vi.mock("@/lib/auth/client-ip", () => ({
  getClientIp: vi.fn(async () => "127.0.0.1"),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { Prisma } from "@prisma/client";

const mockFindFirst = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockAuditLogCreate = vi.fn();
const mockTransaction = vi.fn(async (callback: (tx: unknown) => Promise<unknown>) =>
  callback({
    pagamento: {
      delete: mockDelete,
    },
    auditLog: {
      create: mockAuditLogCreate,
    },
  })
);

const mockPaganteFindFirst = vi.fn();
const mockPazienteFindFirst = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    pagante: {
      findFirst: (...args: unknown[]) => mockPaganteFindFirst(...args),
    },
    paziente: {
      findFirst: (...args: unknown[]) => mockPazienteFindFirst(...args),
    },
    pagamento: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
      delete: (...args: unknown[]) => mockDelete(...args),
    },
    auditLog: {
      create: (...args: unknown[]) => mockAuditLogCreate(...args),
    },
    $transaction: (fn: (tx: unknown) => Promise<unknown>) => mockTransaction(fn),
  },
}));

import {
  updateInvoice,
  refreshInvoiceAnagrafica,
  deleteInvoice,
} from "./invoices";
import {
  FATTURA_GIA_INVIATA_TS_ERROR,
  ANAGRAFICA_FATTURA_TS_ERROR,
  FATTURA_ANNULLATA_TS_DELETE_ERROR,
  FATTURA_ANNULLATA_TS_EDIT_ERROR,
} from "@/lib/invoices/errors";

const validFormData = {
  id_Pagante: 1,
  id_Paziente: 1,
  data: new Date(),
  mod_pag: "BONIFICO" as const,
  n_fattura: 1,
  mesi: [{ mese: "GENNAIO" as const, prezzo: 100 }],
  citta: "Roma",
  cap: "00100",
  natura_iva: "N2.2" as const,
  pagamento_tracciato: true,
  flag_opposizione: false,
};

describe("updateInvoice TS desync protection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("blocca l'aggiornamento se la fattura è in stato INVIATA", async () => {
    mockFindFirst.mockResolvedValueOnce({
      id: 10,
      n_fattura: 1,
      anno: 2026,
      stato_ts: "INVIATA",
      id_Pagante: 1,
      id_Paziente: 1,
      data: new Date("2026-01-15"),
      mod_pag: "BONIFICO",
      sedute: null,
      commento: null,
      citta: "Roma",
      cap: "00100",
      bolloCodice: null,
      mesi: [{ mese: "GENNAIO", prezzo: 100 }],
    });

    const result = await updateInvoice(10, validFormData);

    expect(result).toEqual({ success: false, error: FATTURA_GIA_INVIATA_TS_ERROR });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("blocca l'aggiornamento se la fattura è in stato DA_CANCELLARE_SU_TS", async () => {
    mockFindFirst.mockResolvedValueOnce({
      id: 10,
      n_fattura: 1,
      anno: 2026,
      stato_ts: "DA_CANCELLARE_SU_TS",
      id_Pagante: 1,
      id_Paziente: 1,
      data: new Date("2026-01-15"),
      mod_pag: "BONIFICO",
      sedute: null,
      commento: null,
      citta: "Roma",
      cap: "00100",
      bolloCodice: null,
      mesi: [{ mese: "GENNAIO", prezzo: 100 }],
    });

    const result = await updateInvoice(10, validFormData);

    expect(result).toEqual({ success: false, error: FATTURA_GIA_INVIATA_TS_ERROR });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("blocca l'aggiornamento se la fattura è in stato ANNULLATA_TS", async () => {
    mockFindFirst.mockResolvedValueOnce({
      id: 10,
      n_fattura: 1,
      anno: 2026,
      stato_ts: "ANNULLATA_TS",
      id_Pagante: 1,
      id_Paziente: 1,
      data: new Date("2026-01-15"),
      mod_pag: "BONIFICO",
      sedute: null,
      commento: null,
      citta: "Roma",
      cap: "00100",
      bolloCodice: null,
      mesi: [{ mese: "GENNAIO", prezzo: 100 }],
    });

    const result = await updateInvoice(10, validFormData);

    expect(result).toEqual({ success: false, error: FATTURA_ANNULLATA_TS_EDIT_ERROR });
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});

describe("refreshInvoiceAnagrafica TS desync protection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("blocca l'aggiornamento dell'anagrafica se la fattura è in stato INVIATA", async () => {
    mockFindFirst.mockResolvedValueOnce({
      id: 10,
      stato_ts: "INVIATA",
      pagante: { nome: "Mario", cognome: "Rossi" },
      paziente: { nome: "Luigi", cognome: "Rossi" },
    });

    const result = await refreshInvoiceAnagrafica(10);

    expect(result).toEqual({ success: false, error: ANAGRAFICA_FATTURA_TS_ERROR });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("blocca l'aggiornamento dell'anagrafica se la fattura è in stato DA_CANCELLARE_SU_TS", async () => {
    mockFindFirst.mockResolvedValueOnce({
      id: 10,
      stato_ts: "DA_CANCELLARE_SU_TS",
      pagante: { nome: "Mario", cognome: "Rossi" },
      paziente: { nome: "Luigi", cognome: "Rossi" },
    });

    const result = await refreshInvoiceAnagrafica(10);

    expect(result).toEqual({ success: false, error: ANAGRAFICA_FATTURA_TS_ERROR });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("blocca l'aggiornamento dell'anagrafica se la fattura è in stato ANNULLATA_TS", async () => {
    mockFindFirst.mockResolvedValueOnce({
      id: 10,
      stato_ts: "ANNULLATA_TS",
      pagante: { nome: "Mario", cognome: "Rossi" },
      paziente: { nome: "Luigi", cognome: "Rossi" },
    });

    const result = await refreshInvoiceAnagrafica(10);

    expect(result).toEqual({ success: false, error: FATTURA_ANNULLATA_TS_EDIT_ERROR });
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});

describe("CR-04: race tra controllo di stato e scrittura", () => {
  // La fattura è DA_INVIARE al momento della lettura, ma un invio concorrente
  // la blocca in IN_TRASMISSIONE prima dell'update: la where condizionata non
  // trova la riga e Prisma lancia P2025.
  const recordNotFound = () =>
    new Prisma.PrismaClientKnownRequestError("No record was found for an update.", {
      code: "P2025",
      clientVersion: "test",
    });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updateInvoice: scrive solo se ancora DA_INVIARE e, se non lo è più, restituisce FATTURA_GIA_INVIATA_TS_ERROR", async () => {
    mockFindFirst
      .mockResolvedValueOnce({
        id: 10,
        n_fattura: 1,
        anno: validFormData.data.getFullYear(),
        stato_ts: "DA_INVIARE",
        id_Pagante: 1,
        id_Paziente: 1,
        data: validFormData.data,
        mod_pag: "BONIFICO",
        sedute: null,
        commento: null,
        citta: "Roma",
        cap: "00100",
        bolloCodice: null,
        mesi: [{ mese: "GENNAIO", prezzo: new Prisma.Decimal(100) }],
      })
      .mockResolvedValue(null); // vicini cronologici: nessuno
    mockPaganteFindFirst.mockResolvedValueOnce({ id: 1, nome: "Mario", cognome: "Rossi" });
    mockPazienteFindFirst.mockResolvedValueOnce({ id: 1, id_Pagante: 1, nome: "Luigi", cognome: "Rossi" });
    mockUpdate.mockRejectedValueOnce(recordNotFound());

    const result = await updateInvoice(10, validFormData);

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 10, id_Utente: 1, stato_ts: "DA_INVIARE" },
      })
    );
    expect(result).toEqual({ success: false, error: FATTURA_GIA_INVIATA_TS_ERROR });
    expect(mockAuditLogCreate).not.toHaveBeenCalled();
  });

  it("P019: updateInvoice registra nel log un errore non riconosciuto", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    mockFindFirst
      .mockResolvedValueOnce({
        id: 10,
        n_fattura: 1,
        anno: validFormData.data.getFullYear(),
        stato_ts: "DA_INVIARE",
        id_Pagante: 1,
        id_Paziente: 1,
        data: validFormData.data,
        mod_pag: "BONIFICO",
        sedute: null,
        commento: null,
        citta: "Roma",
        cap: "00100",
        bolloCodice: null,
        mesi: [{ mese: "GENNAIO", prezzo: new Prisma.Decimal(100) }],
      })
      .mockResolvedValue(null);
    mockPaganteFindFirst.mockResolvedValueOnce({ id: 1, nome: "Mario", cognome: "Rossi" });
    mockPazienteFindFirst.mockResolvedValueOnce({ id: 1, id_Pagante: 1, nome: "Luigi", cognome: "Rossi" });
    const guasto = new Error("deadlock detected");
    mockUpdate.mockRejectedValueOnce(guasto);

    const result = await updateInvoice(10, validFormData);

    expect(result).toEqual({ success: false, error: "Errore durante l'aggiornamento della fattura" });
    expect(consoleError).toHaveBeenCalledWith("updateInvoice error", guasto);
    consoleError.mockRestore();
  });

  it("refreshInvoiceAnagrafica: scrive solo se ancora DA_INVIARE e, se non lo è più, restituisce ANAGRAFICA_FATTURA_TS_ERROR", async () => {
    mockFindFirst.mockResolvedValueOnce({
      id: 10,
      stato_ts: "DA_INVIARE",
      pagante: { nome: "Mario", cognome: "Rossi" },
      paziente: { nome: "Luigi", cognome: "Rossi" },
    });
    mockUpdate.mockRejectedValueOnce(recordNotFound());

    const result = await refreshInvoiceAnagrafica(10);

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 10, id_Utente: 1, stato_ts: "DA_INVIARE" },
      })
    );
    expect(result).toEqual({ success: false, error: ANAGRAFICA_FATTURA_TS_ERROR });
    expect(mockAuditLogCreate).not.toHaveBeenCalled();
  });
});

describe("deleteInvoice TS protection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("blocca l'eliminazione se la fattura è in stato ANNULLATA_TS", async () => {
    mockFindFirst.mockResolvedValueOnce({
      id: 10,
      n_fattura: 1,
      anno: 2026,
      stato_ts: "ANNULLATA_TS",
    });

    const result = await deleteInvoice(10);

    expect(result).toEqual({ success: false, error: FATTURA_ANNULLATA_TS_DELETE_ERROR });
  });

  it("blocca l'eliminazione se la fattura è in stato IN_TRASMISSIONE", async () => {
    mockFindFirst.mockResolvedValueOnce({
      id: 10,
      n_fattura: 1,
      anno: 2026,
      stato_ts: "IN_TRASMISSIONE",
    });

    const result = await deleteInvoice(10);

    expect(result).toEqual({
      success: false,
      error:
        "La fattura è attualmente in fase di trasmissione al Sistema TS e non può essere eliminata.",
    });
  });

  it("esegue la cancellazione atomica verificando stato_ts: 'DA_INVIARE'", async () => {
    mockFindFirst.mockResolvedValueOnce({
      id: 10,
      n_fattura: 1,
      anno: 2026,
      stato_ts: "DA_INVIARE",
      data: new Date("2026-01-15"),
      prezzo_totale: 100,
      id_Pagante: 1,
      id_Paziente: 1,
    });
    mockDelete.mockResolvedValueOnce({});

    const result = await deleteInvoice(10);

    expect(result).toEqual({ success: true });
    expect(mockDelete).toHaveBeenCalledWith({
      where: {
        id: 10,
        id_Utente: 1,
        stato_ts: "DA_INVIARE",
      },
    });
  });

  it("gestisce la race condition (P2025) se la fattura cambia stato concorrentemente prima del delete", async () => {
    mockFindFirst.mockResolvedValueOnce({
      id: 10,
      n_fattura: 1,
      anno: 2026,
      stato_ts: "DA_INVIARE",
      data: new Date("2026-01-15"),
      prezzo_totale: 100,
      id_Pagante: 1,
      id_Paziente: 1,
    });
    mockDelete.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("Record not found", {
        code: "P2025",
        clientVersion: "5.x",
      })
    );

    const result = await deleteInvoice(10);

    expect(result).toEqual({
      success: false,
      error:
        "La fattura è stata modificata o è attualmente in fase di trasmissione al Sistema TS e non può essere eliminata.",
    });
  });
});
