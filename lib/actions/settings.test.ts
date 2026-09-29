import { describe, it, expect, vi, beforeEach } from "vitest";
import { AUDIT_ACTIONS } from "@/lib/audit/actions";
import { LAYOUT_DEFAULT } from "@/lib/pdf/layout-default";

// P028: test di comportamento delle action delle impostazioni PDF.

vi.mock("@/lib/auth/session", () => ({
  requireSession: vi.fn(async () => ({ id: 4 })),
}));
vi.mock("@/lib/auth/client-ip", () => ({ getClientIp: vi.fn(async () => "127.0.0.1") }));
const mockLogAudit = vi.fn();
vi.mock("@/lib/audit/log", () => ({ logAudit: (...a: unknown[]) => mockLogAudit(...a) }));
const mockUpsert = vi.fn();
vi.mock("@/lib/data/settings", () => ({ upsertPdfSettings: (...a: unknown[]) => mockUpsert(...a) }));
const mockSnapshot = vi.fn();
vi.mock("@/lib/pdf/invoices", () => ({
  snapshotPdfLayoutForInvoice: (...a: unknown[]) => mockSnapshot(...a),
}));

const { updatePdfSettings, refreshInvoicePdfLayout } = await import("./settings");

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("updatePdfSettings", () => {
  it("salva un layout valido e scrive l'audit", async () => {
    mockUpsert.mockResolvedValueOnce({ id: 11 });

    const res = await updatePdfSettings(LAYOUT_DEFAULT);

    expect(res).toEqual({ success: true });
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ pageWidth: LAYOUT_DEFAULT.pageWidth, blocchi: LAYOUT_DEFAULT.blocchi })
    );
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({ azione: AUDIT_ACTIONS.PDF_SETTINGS_UPDATE, userId: 4, entitaId: 11 })
    );
  });

  it("rifiuta dati non validi senza scrivere", async () => {
    const res = await updatePdfSettings({ ...LAYOUT_DEFAULT, pageWidth: "largo" });

    expect(res).toEqual({ success: false, error: "Dati non validi" });
    expect(mockUpsert).not.toHaveBeenCalled();
    expect(mockLogAudit).not.toHaveBeenCalled();
  });

  it("se il salvataggio fallisce non scrive l'audit", async () => {
    mockUpsert.mockRejectedValueOnce(new Error("DB down"));

    const res = await updatePdfSettings(LAYOUT_DEFAULT);

    expect(res.success).toBe(false);
    expect(mockLogAudit).not.toHaveBeenCalled();
  });
});

describe("refreshInvoicePdfLayout", () => {
  it("aggiorna lo snapshot della fattura dell'utente e scrive l'audit", async () => {
    mockSnapshot.mockResolvedValueOnce(undefined);

    const res = await refreshInvoicePdfLayout(20);

    expect(res).toEqual({ success: true });
    expect(mockSnapshot).toHaveBeenCalledWith(20, 4);
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({ azione: AUDIT_ACTIONS.PDF_SETTINGS_REFRESH_LAYOUT, entitaId: 20 })
    );
  });

  it("con una fattura non trovata restituisce errore senza audit", async () => {
    mockSnapshot.mockRejectedValueOnce(new Error("P2025"));

    const res = await refreshInvoicePdfLayout(20);

    expect(res.success).toBe(false);
    expect(mockLogAudit).not.toHaveBeenCalled();
  });
});
