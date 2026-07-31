import { it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

// DEP-06: analisi statica (stesso approccio di
// verify-backup-integrity.test.ts) — audit-log-retention.mjs gira in un
// loop infinito con setTimeout settimanale, non eseguibile end-to-end in
// Vitest. Verifica solo che il ping di esito resti cablato correttamente
// nel sorgente, non il comportamento a runtime di fetch().

const source = readFileSync(
  join(__dirname, "audit-log-retention.mjs"),
  "utf-8"
);

it("pingHealthcheck resta inerte senza AUDIT_LOG_RETENTION_HEALTHCHECK_PING_URL", () => {
  expect(source).toMatch(/if\s*\(\s*!HEALTHCHECK_PING_URL\s*\)\s*return/);
});

it("usa la convenzione Healthchecks.io: URL base per successo, /fail per fallimento", () => {
  expect(source).toMatch(/`\$\{HEALTHCHECK_PING_URL\}\/fail`/);
});

it("chiama pingHealthcheck(true) dopo purgeOnce riuscita e pingHealthcheck(false) in caso di errore", () => {
  expect(source).toMatch(/\.then\(\(\)\s*=>\s*pingHealthcheck\(true\)\)/);
  expect(source).toMatch(/pingHealthcheck\(false\)/);
});
