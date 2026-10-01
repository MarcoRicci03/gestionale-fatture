import { describe, it, expect, vi } from "vitest";

// P016: ogni server action che riceve un id è un endpoint RPC pubblico. Un id
// non valido deve diventare un ActionResult, non un'eccezione Prisma (500).
// Il client Prisma qui è un proxy che fallisce a qualunque accesso: se una
// action arriva al DB con un id non valido, il test lo rileva.

vi.mock("@/lib/auth/session", () => ({
  requireUserId: vi.fn(async () => 1),
  requireAdmin: vi.fn(async () => ({ id: 1, isAdmin: true })),
  requireSession: vi.fn(async () => ({ id: 1 })),
}));
vi.mock("@/lib/auth/client-ip", () => ({ getClientIp: vi.fn(async () => "127.0.0.1") }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/audit/log", () => ({ logAudit: vi.fn(), logAuditOrThrow: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: new Proxy(
    {},
    {
      get(_t, prop) {
        throw new Error(`accesso a prisma.${String(prop)} con un id non valido`);
      },
    }
  ),
}));

const invoices = await import("./invoices");
const payers = await import("./payers");
const patients = await import("./patients");
const users = await import("./users");
const settings = await import("./settings");
const sistemaTs = await import("./sistema-ts");

type Chiamata = (id: unknown) => Promise<unknown>;
const azioni: [string, Chiamata][] = [
  ["updateInvoice", (id) => invoices.updateInvoice(id as number, {} as never)],
  ["deleteInvoice", (id) => invoices.deleteInvoice(id as number)],
  ["refreshInvoiceAnagrafica", (id) => invoices.refreshInvoiceAnagrafica(id as number)],
  ["updatePayer", (id) => payers.updatePayer(id as number, {} as never)],
  ["archivePayer", (id) => payers.archivePayer(id as number)],
  ["restorePayer", (id) => payers.restorePayer(id as number)],
  ["hardDeletePayer", (id) => payers.hardDeletePayer(id as number)],
  ["updatePatient", (id) => patients.updatePatient(id as number, {} as never)],
  ["archivePatient", (id) => patients.archivePatient(id as number)],
  ["restorePatient", (id) => patients.restorePatient(id as number)],
  ["hardDeletePatient", (id) => patients.hardDeletePatient(id as number)],
  ["updateUser", (id) => users.updateUser(id as number, {})],
  ["resetUserPassword", (id) => users.resetUserPassword(id as number, {})],
  ["toggleUserEnabled", (id) => users.toggleUserEnabled(id as number, false)],
  ["refreshInvoicePdfLayout", (id) => settings.refreshInvoicePdfLayout(id as number)],
  ["sincronizzaEsitoTrasmissione", (id) => sistemaTs.sincronizzaEsitoTrasmissione(id as number)],
  ["annullaFatturaTs", (id) => sistemaTs.annullaFatturaTs(id as number)],
  ["ripristinaFatturaPerReinvio", (id) => sistemaTs.ripristinaFatturaPerReinvio(id as number)],
];

const idNonValidi: unknown[] = ["12", 1.5, 0, -3, 2_147_483_648, Number.NaN, null];

describe("validazione degli id nelle server action (P016)", () => {
  it.each(azioni)("%s rifiuta gli id non validi senza toccare il DB", async (_nome, chiama) => {
    for (const id of idNonValidi) {
      await expect(chiama(id)).resolves.toEqual({ success: false, error: "Richiesta non valida" });
    }
  });

  it("toggleUserEnabled rifiuta un abilitato non booleano", async () => {
    await expect(users.toggleUserEnabled(2, "false" as unknown as boolean)).resolves.toEqual({
      success: false,
      error: "Richiesta non valida",
    });
  });

  it("getNextInvoiceNumberForYear rifiuta anno o excludeId non validi", async () => {
    await expect(invoices.getNextInvoiceNumberForYear("2026" as unknown as number)).rejects.toThrow(
      "Parametri non validi"
    );
    await expect(invoices.getNextInvoiceNumberForYear(2026, 1.5)).rejects.toThrow("Parametri non validi");
  });
});
