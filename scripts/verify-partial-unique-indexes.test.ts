import { it, expect } from "vitest";
import { readdirSync, readFileSync } from "fs";
import { join } from "path";

// DB-03: l'unicità di cf/piva su paganti vale solo tra i paganti ATTIVI
// (eliminato = false) — voluto, permette di archiviare un pagante e
// ricrearlo con lo stesso CF/P.IVA. Il DSL di Prisma non sa esprimere un
// indice unique parziale (vedi il commento sul model Pagante in
// schema.prisma, che vieta esplicitamente di reintrodurre
// @@unique([id_Utente, cf])/@@unique([id_Utente, piva])), quindi vive solo
// come SQL scritto a mano nelle migration. Un `prisma migrate dev` futuro
// che "corregga" questo drift non dichiarato sostituendolo con un vincolo
// PIENO riaprirebbe il bug: archiviare un pagante e ricrearne uno con lo
// stesso CF fallirebbe. Questo test verifica testualmente le migration
// esistenti, senza bisogno di un database (stesso spirito degli altri
// verify-*.test.ts).
const MIGRATIONS_DIR = join(__dirname, "..", "prisma", "migrations");

function allMigrationSql(): string {
  const dirs = readdirSync(MIGRATIONS_DIR, { withFileTypes: true }).filter((e) =>
    e.isDirectory()
  );
  return dirs
    .map((dir) => {
      const path = join(MIGRATIONS_DIR, dir.name, "migration.sql");
      try {
        return readFileSync(path, "utf-8");
      } catch {
        return "";
      }
    })
    .join("\n");
}

it("gli indici unique parziali su paganti(cf)/paganti(piva) hanno la clausola WHERE eliminato = false", () => {
  const sql = allMigrationSql();

  expect(sql).toMatch(
    /CREATE UNIQUE INDEX "paganti_id_Utente_cf_key"\s+ON\s+"paganti"\("id_Utente",\s*"cf"\)\s+WHERE\s+"eliminato"\s*=\s*false/
  );
  expect(sql).toMatch(
    /CREATE UNIQUE INDEX "paganti_id_Utente_piva_key"\s+ON\s+"paganti"\("id_Utente",\s*"piva"\)\s+WHERE\s+"eliminato"\s*=\s*false/
  );
});

it("nessuna migration reintroduce cf/piva come vincolo unique PIENO (senza WHERE)", () => {
  const sql = allMigrationSql();

  // Un `@@unique([id_Utente, cf])` reintrodotto per errore nello schema
  // genererebbe un CREATE UNIQUE INDEX su queste stesse colonne ma SENZA
  // clausola WHERE: la riga di chiusura ";" senza un "WHERE" prima
  // distingue i due casi.
  const fullUniqueOnCf = /CREATE UNIQUE INDEX "[^"]+"\s+ON\s+"paganti"\("id_Utente",\s*"cf"\)\s*;/;
  const fullUniqueOnPiva = /CREATE UNIQUE INDEX "[^"]+"\s+ON\s+"paganti"\("id_Utente",\s*"piva"\)\s*;/;

  expect(fullUniqueOnCf.test(sql)).toBe(false);
  expect(fullUniqueOnPiva.test(sql)).toBe(false);
});
