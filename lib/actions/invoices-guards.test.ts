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

const mockFindFirst = vi.fn();
const mockUpdate = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    pagamento: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
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

    expect(result).toEqual({ error: FATTURA_GIA_INVIATA_TS_ERROR });
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

    expect(result).toEqual({ error: FATTURA_GIA_INVIATA_TS_ERROR });
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

    expect(result).toEqual({ error: ANAGRAFICA_FATTURA_TS_ERROR });
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

    expect(result).toEqual({ error: ANAGRAFICA_FATTURA_TS_ERROR });
    expect(mockUpdate).not.toHaveBeenCalled();
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

    expect(result).toEqual({ error: FATTURA_ANNULLATA_TS_DELETE_ERROR });
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
      error:
        "La fattura è attualmente in fase di trasmissione al Sistema TS e non può essere eliminata.",
    });
  });
});
