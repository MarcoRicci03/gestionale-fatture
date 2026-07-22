import { it, expect } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { join, relative } from "path";

// Regressione SEC-07: un PDF di fattura contiene dati sanitari/fiscali del
// paziente e del pagante. Ogni route che serve `Content-Type:
// application/pdf` deve marcare esplicitamente la risposta come non
// cacheabile (`Cache-Control: private, no-store`), altrimenti proxy
// intermedi o il browser potrebbero conservarne una copia. Verificato via
// analisi statica invece che con una richiesta HTTP reale, per non dover
// avviare il server Next.js in questo test.
const API_DIR = join(__dirname, "..", "app", "api");

function findRouteFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...findRouteFiles(fullPath));
    } else if (entry.name === "route.ts") {
      files.push(fullPath);
    }
  }
  return files;
}

it("tutte le route che servono PDF impostano Cache-Control: no-store", () => {
  const violations: string[] = [];

  for (const path of findRouteFiles(API_DIR)) {
    const source = readFileSync(path, "utf-8");
    if (!source.includes("application/pdf")) continue;

    const relPath = relative(join(__dirname, ".."), path);
    const hasNoStore = /Cache-Control["'`]?\s*:\s*["'`][^"'`]*no-store/.test(source);
    if (!hasNoStore) {
      violations.push(relPath);
    }
  }

  expect(
    violations,
    'Aggiungi l\'header "Cache-Control": "private, no-store, max-age=0" alla ' +
      "risposta: un PDF di fattura contiene dati sanitari/fiscali e non va " +
      "cacheato da proxy intermedi né dal browser."
  ).toEqual([]);
});
