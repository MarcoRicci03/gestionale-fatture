import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const ROOT = join(__dirname, "..");
const ROUTE_PATH = join(ROOT, "app", "api", "sistema-ts", "trasmissioni", "[id]", "ricevuta", "route.ts");
const STORICO_TAB_PATH = join(ROOT, "components", "sistema-ts", "tabs", "storico-tab.tsx");
const MANAGER_PATH = join(ROOT, "components", "sistema-ts", "sistema-ts-manager.tsx");
const ACTIONS_PATH = join(ROOT, "lib", "actions", "sistema-ts.ts");

describe("ARCH-08: Analisi statica architetturale Route Handler Ricevuta TS", () => {
  it("il Route Handler esiste ed esporta la funzione GET", () => {
    expect(existsSync(ROUTE_PATH)).toBe(true);
    const source = readFileSync(ROUTE_PATH, "utf-8");
    expect(source).toMatch(/export\s+async\s+function\s+GET\s*\(/);
  });

  it("il Route Handler imposta gli header corretti: application/pdf, attachment e no-store", () => {
    const source = readFileSync(ROUTE_PATH, "utf-8");
    expect(source).toMatch(/"Content-Type":\s*"application\/pdf"/);
    expect(source).toMatch(/"Content-Disposition":\s*`attachment;\s*filename=.*`/);
    expect(source).toMatch(/"Cache-Control":\s*"private,\s*no-store,\s*max-age=0"/);
  });

  it("il Route Handler valida la sessione utente e filtra per id_Utente", () => {
    const source = readFileSync(ROUTE_PATH, "utf-8");
    expect(source).toMatch(/getUserIdOrNull\s*\(/);
    expect(source).toMatch(/id_Utente:\s*userId/);
  });

  it("storico-tab.tsx fa riferimento direttamente alla route HTTP per il download della ricevuta", () => {
    const source = readFileSync(STORICO_TAB_PATH, "utf-8");
    expect(source).toMatch(/\/api\/sistema-ts\/trasmissioni\/.*\/ricevuta/);
  });

  it("sistema-ts-manager.tsx non esegue più la decodifica base64 / window.atob", () => {
    const source = readFileSync(MANAGER_PATH, "utf-8");
    expect(source).not.toMatch(/window\.atob/);
  });

  // P023: la Server Action deprecata getRicevutaPdfBase64 è stata rimossa:
  // restava un endpoint RPC pubblico senza chiamanti.
  it("la Server Action getRicevutaPdfBase64 non esiste più", () => {
    const source = readFileSync(ACTIONS_PATH, "utf-8");
    expect(source).not.toMatch(/getRicevutaPdfBase64/);
  });
});
