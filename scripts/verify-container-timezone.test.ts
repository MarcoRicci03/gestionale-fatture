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
//
// Gli script npm usano `cross-env`, non un prefisso POSIX diretto
// (`TZ=Europe/Rome comando`): in alcuni ambienti di sviluppo (es. WSL con PATH
// che risolve l'npm di Windows) gli script vengono eseguiti da cmd.exe, che
// non capisce quella sintassi e falliva con "'TZ' is not recognized". Non
// tornare al prefisso nudo.

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

  it("start esporta TZ=Europe/Rome tramite cross-env", () => {
    expect(scripts.start).toMatch(/cross-env\s+TZ=Europe\/Rome/);
  });

  it("dev esporta TZ=Europe/Rome tramite cross-env", () => {
    expect(scripts.dev).toMatch(/cross-env\s+TZ=Europe\/Rome/);
  });

  it("cross-env è dichiarato tra le devDependencies", () => {
    const deps = JSON.parse(packageJson).devDependencies ?? {};
    expect(deps).toHaveProperty("cross-env");
  });
});
