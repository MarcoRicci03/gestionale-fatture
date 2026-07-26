import { it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

// prisma/seed.mjs non può importare passwordSchema (è JavaScript puro, senza
// build step, eseguibile anche dentro l'immagine di produzione dove non c'è
// TypeScript): la soglia minima è duplicata come costante locale. Questo test
// tiene le due soglie allineate per analisi statica del sorgente, così un
// futuro innalzamento del minimo in lib/validations/user.ts non lascia il
// seed del primo admin silenziosamente indietro.

const SEED_PATH = join(__dirname, "..", "prisma", "seed.mjs");
const USER_VALIDATION_PATH = join(
  __dirname,
  "..",
  "lib",
  "validations",
  "user.ts"
);

function extractSeedMinLength(): number {
  const source = readFileSync(SEED_PATH, "utf-8");
  const match = /MIN_PASSWORD_LENGTH\s*=\s*(\d+)/.exec(source);
  if (!match) {
    throw new Error("MIN_PASSWORD_LENGTH non trovata in prisma/seed.mjs");
  }
  return Number(match[1]);
}

function extractSchemaMinLength(): number {
  const source = readFileSync(USER_VALIDATION_PATH, "utf-8");
  const passwordSchemaMatch = /passwordSchema\s*=\s*z\s*\.string\(\)\s*\.min\((\d+)/.exec(
    source
  );
  if (!passwordSchemaMatch) {
    throw new Error(
      "Soglia minima di passwordSchema non trovata in lib/validations/user.ts"
    );
  }
  return Number(passwordSchemaMatch[1]);
}

it("la soglia minima del seed coincide con quella di passwordSchema", () => {
  expect(extractSeedMinLength()).toBe(extractSchemaMinLength());
});
