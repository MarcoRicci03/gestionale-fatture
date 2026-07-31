import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

// Analisi statica (stesso approccio di verify-container-timezone.test.ts):
// Dockerfile/docker-compose.prod.yml non sono eseguibili end-to-end in
// Vitest (richiedono una build Docker reale, non disponibile in questo
// ambiente). Questi test proteggono le invarianti strutturali di DEP-05 da
// una regressione silenziosa.
//
// DEP-03 (copia selettiva di node_modules invece dell'intero albero) è
// stato tentato e poi RIPORTATO INDIETRO: emerso solo su un deploy reale in
// produzione (non riproducibile senza Docker), l'albero di dipendenze della
// CLI Prisma è più profondo e meno prevedibile del previsto — oltre al
// symlink node_modules/.bin/prisma dereferenziato da COPY (risolto),
// @prisma/config richiede a sua volta il pacchetto `effect`, non incluso da
// una copia selettiva. Vedi il commento nel Dockerfile. Nessun test qui per
// quella parte: il Dockerfile è tornato alla copia completa di
// node_modules, il comportamento noto-funzionante.

const ROOT = join(__dirname, "..");
const compose = readFileSync(join(ROOT, "docker-compose.prod.yml"), "utf-8");

describe("DEP-05: audit-log-retention dichiara la propria stanza build", () => {
  it("ha una sezione build con lo stesso context/dockerfile di app", () => {
    const retentionService = compose.slice(
      compose.indexOf("  audit-log-retention:")
    );
    expect(retentionService).toMatch(/build:\s*\n\s*context:\s*\.\s*\n\s*dockerfile:\s*Dockerfile/);
  });
});
