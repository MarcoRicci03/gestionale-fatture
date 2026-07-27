import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const ROUTE_PATH = join(__dirname, "route.ts");
const source = readFileSync(ROUTE_PATH, "utf-8");

describe("app/api/invoices/export/route.ts", () => {
  it("importa buildInvoiceWhere per il ramo filters", () => {
    expect(source).toMatch(/buildInvoiceWhere/);
  });

  it("distingue i due rami con 'ids' in parsed.data", () => {
    expect(source).toMatch(/"ids"\s+in\s+parsed\.data/);
  });

  it("continua a filtrare sempre per id_Utente, anche nel ramo filters", () => {
    // Il ramo ids costruisce where inline con id_Utente esplicito; il ramo
    // filters lo delega a buildInvoiceWhere, che lo inserisce sempre (Task 1).
    expect(source).toMatch(/id_Utente:\s*userId/);
  });

  it("continua a verificare la sessione con getUserIdOrNull + controllo === null", () => {
    expect(source).toMatch(/getUserIdOrNull\s*\(/);
    expect(source).toMatch(/userId\s*===\s*null/);
  });

  it("blocca (non tronca silenziosamente) quando i risultati superano MAX_EXPORT_INVOICES", () => {
    expect(source).toMatch(/invoices\.length\s*>\s*MAX_EXPORT_INVOICES/);
    expect(source).toMatch(/status:\s*400/);
  });

  it("continua a registrare l'audit dell'export", () => {
    expect(source).toMatch(/logAudit\s*\(/);
    expect(source).toMatch(/AUDIT_ACTIONS\.INVOICE_EXPORT/);
  });
});
