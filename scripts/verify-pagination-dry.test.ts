import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { calculatePagination, clampPage } from "@/lib/utils/pagination";

// DRY-07: Verifica statica e architetturale della centralizzazione
// dei calcoli di paginazione e clamping nei moduli di data fetching.

const DATA_DIR = join(__dirname, "..", "lib", "data");
const PAGINATION_UTIL_PATH = join(__dirname, "..", "lib", "utils", "pagination.ts");

describe("DRY-07: Centralizzazione paginazione e sanitizzazione parametri", () => {
  it("lib/utils/pagination.ts esporta calculatePagination e clampPage", () => {
    const source = readFileSync(PAGINATION_UTIL_PATH, "utf-8");
    expect(source).toMatch(/export\s+function\s+calculatePagination\s*\(/);
    expect(source).toMatch(/export\s+function\s+clampPage\s*\(/);
  });

  it("lib/data/invoices.ts usa calculatePagination e clampPage", () => {
    const source = readFileSync(join(DATA_DIR, "invoices.ts"), "utf-8");
    expect(source).toMatch(/import\s*\{[^}]*calculatePagination[^}]*\}\s*from\s*["']@\/lib\/utils\/pagination["']/);
    expect(source).toMatch(/import\s*\{[^}]*clampPage[^}]*\}\s*from\s*["']@\/lib\/utils\/pagination["']/);
    expect(source).toContain("calculatePagination(page, pageSize)");
    expect(source).toContain("clampPage(page, totalCount, pageSize)");
  });

  it("lib/data/patients.ts usa calculatePagination e clampPage", () => {
    const source = readFileSync(join(DATA_DIR, "patients.ts"), "utf-8");
    expect(source).toMatch(/import\s*\{[^}]*calculatePagination[^}]*\}\s*from\s*["']@\/lib\/utils\/pagination["']/);
    expect(source).toMatch(/import\s*\{[^}]*clampPage[^}]*\}\s*from\s*["']@\/lib\/utils\/pagination["']/);
    expect(source).toContain("calculatePagination(page, pageSize)");
    expect(source).toContain("clampPage(page, totalCount, pageSize)");
  });

  it("lib/data/payers.ts usa calculatePagination e clampPage", () => {
    const source = readFileSync(join(DATA_DIR, "payers.ts"), "utf-8");
    expect(source).toMatch(/import\s*\{[^}]*calculatePagination[^}]*\}\s*from\s*["']@\/lib\/utils\/pagination["']/);
    expect(source).toMatch(/import\s*\{[^}]*clampPage[^}]*\}\s*from\s*["']@\/lib\/utils\/pagination["']/);
    expect(source).toContain("calculatePagination(page, pageSize)");
    expect(source).toContain("clampPage(page, totalCount, pageSize)");
  });

  it("lib/data/audit-log.ts usa calculatePagination e clampPage", () => {
    const source = readFileSync(join(DATA_DIR, "audit-log.ts"), "utf-8");
    expect(source).toMatch(/import\s*\{[^}]*calculatePagination[^}]*\}\s*from\s*["']@\/lib\/utils\/pagination["']/);
    expect(source).toMatch(/import\s*\{[^}]*clampPage[^}]*\}\s*from\s*["']@\/lib\/utils\/pagination["']/);
    expect(source).toContain("calculatePagination(page, AUDIT_LOG_PAGE_SIZE)");
    expect(source).toContain("clampPage(page, totalCount, AUDIT_LOG_PAGE_SIZE)");
  });

  it("nessun file in lib/data/ contiene la formula duplicata manuale (page - 1) *", () => {
    const files = readdirSync(DATA_DIR).filter((f) => f.endsWith(".ts"));
    for (const file of files) {
      const source = readFileSync(join(DATA_DIR, file), "utf-8");
      expect(source).not.toContain("(page - 1) *");
    }
  });

  it("calculatePagination impedisce offset negativi e input non validi", () => {
    expect(calculatePagination(-10, 25).skip).toBe(0);
    expect(calculatePagination(0, 25).skip).toBe(0);
    expect(calculatePagination(1, 25).skip).toBe(0);
    expect(calculatePagination(2, 25).skip).toBe(25);
    expect(calculatePagination(3, 20).skip).toBe(40);
  });

  it("clampPage clampa correttamente e non scende mai sotto pagina 1", () => {
    expect(clampPage(-5, 100, 25)).toBe(1);
    expect(clampPage(0, 100, 25)).toBe(1);
    expect(clampPage(1, 100, 25)).toBe(1);
    expect(clampPage(2, 100, 25)).toBe(2);
    expect(clampPage(10, 100, 25)).toBe(4);
    expect(clampPage(10, 0, 25)).toBe(1);
  });
});
