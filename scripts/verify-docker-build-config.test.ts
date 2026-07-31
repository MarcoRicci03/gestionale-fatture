import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

// Analisi statica (stesso approccio di verify-container-timezone.test.ts):
// Dockerfile/docker-compose.prod.yml non sono eseguibili end-to-end in
// Vitest (richiedono una build Docker reale, non disponibile in questo
// ambiente). Questi test proteggono le invarianti strutturali di DEP-03/
// DEP-05 da una regressione silenziosa.

const ROOT = join(__dirname, "..");
const dockerfile = readFileSync(join(ROOT, "Dockerfile"), "utf-8");
const compose = readFileSync(join(ROOT, "docker-compose.prod.yml"), "utf-8");

describe("DEP-03: lo stage runner copia selettivamente solo i pacchetti della CLI Prisma", () => {
  it("non copia più l'intero node_modules del builder", () => {
    expect(dockerfile).not.toMatch(
      /COPY --from=builder[^\n]*\/app\/node_modules\s+\.\/node_modules\s*$/m
    );
  });

  it("copia .next/standalone prima di qualunque aggiunta selettiva a node_modules", () => {
    const standaloneIndex = dockerfile.indexOf(".next/standalone");
    const prismaBinIndex = dockerfile.indexOf("node_modules/.bin/prisma");
    expect(standaloneIndex).toBeGreaterThan(-1);
    expect(prismaBinIndex).toBeGreaterThan(-1);
    expect(standaloneIndex).toBeLessThan(prismaBinIndex);
  });

  it("copia comunque prisma, @prisma e il binario prisma (servono a `npx prisma migrate deploy` nel CMD)", () => {
    expect(dockerfile).toMatch(/node_modules\/prisma\s+\.\/node_modules\/prisma/);
    expect(dockerfile).toMatch(/node_modules\/@prisma\s+\.\/node_modules\/@prisma/);
    expect(dockerfile).toMatch(/node_modules\/\.bin\/prisma\s+\.\/node_modules\/\.bin\/prisma/);
  });
});

describe("DEP-05: audit-log-retention dichiara la propria stanza build", () => {
  it("ha una sezione build con lo stesso context/dockerfile di app", () => {
    const retentionService = compose.slice(
      compose.indexOf("  audit-log-retention:")
    );
    expect(retentionService).toMatch(/build:\s*\n\s*context:\s*\.\s*\n\s*dockerfile:\s*Dockerfile/);
  });
});
