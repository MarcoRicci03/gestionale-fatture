import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

// Regressione LOG-12 in SECURITY_AUDIT.md. Analisi statica (stesso approccio di
// verify-invoice-lifecycle.test.ts): gli aggregati fatturato e la costruzione
// delle date usano new Date(anno, mese, ...) in ora locale del processo. Perché
// dev (Europe/Rome) e produzione (container, altrimenti UTC) concordino, il
// fuso del processo va pinnato a Europe/Rome. Questi test falliscono se un
// domani qualcuno rimuove il pinning dal Dockerfile o dagli script npm, invece
// di far riemergere il bug in silenzio.

const ROOT = join(__dirname, "..");
const dockerfile = readFileSync(join(ROOT, "Dockerfile"), "utf-8");
const packageJson = readFileSync(join(ROOT, "package.json"), "utf-8");

describe("Dockerfile pinna il fuso a Europe/Rome (LOG-12)", () => {
  it("imposta ENV TZ=Europe/Rome", () => {
    expect(dockerfile).toMatch(/ENV\s+TZ=Europe\/Rome/);
  });

  it("installa tzdata (senza cui Node su Alpine ignora TZ)", () => {
    expect(dockerfile).toMatch(/apk\s+add[^\n]*\btzdata\b/);
  });
});

describe("gli script npm di avvio pinnano il fuso a Europe/Rome (LOG-12)", () => {
  const scripts = (JSON.parse(packageJson).scripts ?? {}) as Record<
    string,
    string
  >;

  it("start esporta TZ=Europe/Rome", () => {
    expect(scripts.start).toMatch(/TZ=Europe\/Rome/);
  });

  it("dev esporta TZ=Europe/Rome", () => {
    expect(scripts.dev).toMatch(/TZ=Europe\/Rome/);
  });
});
