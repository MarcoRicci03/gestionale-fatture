import { it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

// Analisi statica (stesso approccio di verify-container-timezone.test.ts):
// scripts/backup-db.sh gira come entrypoint di un container Docker, non
// eseguibile end-to-end in Vitest (pg_dump/gpg reali, loop infinito con
// sleep). BACKUP_RETENTION_DAYS veniva dichiarata con un default ma mai
// letta: la cancellazione aveva "14" cablato nel find, quindi chi impostava
// un valore diverso continuava comunque a perdere i backup dopo 14 giorni
// (LOG-01). Questi test proteggono che la variabile resti effettivamente
// usata, non solo dichiarata.

const ROOT = join(__dirname, "..");
const backupScript = readFileSync(join(ROOT, "scripts", "backup-db.sh"), "utf-8");
const readmeBackup = readFileSync(join(ROOT, "README-BACKUP.md"), "utf-8");

it("dichiara ancora un default per BACKUP_RETENTION_DAYS", () => {
  expect(backupScript).toMatch(/:\s*"\$\{BACKUP_RETENTION_DAYS:=14\}"/);
});

it("la cancellazione dei backup usa $BACKUP_RETENTION_DAYS, non un numero cablato", () => {
  const findLineMatch = /find\s+"\$BACKUP_DIR"[^\n]*-mtime\s+\+"[^"]*"[^\n]*\.gpg[^\n]*|find\s+[^\n]*\*\.gpg[^\n]*/.exec(
    backupScript
  );
  expect(findLineMatch, "riga find per la pulizia dei backup non trovata").not.toBeNull();
  const findLine = findLineMatch![0];

  expect(findLine).toContain('"$BACKUP_DIR"');
  expect(findLine).toContain('+"$BACKUP_RETENTION_DAYS"');
  // Nessun numero cablato al posto della variabile nell'opzione -mtime.
  expect(findLine).not.toMatch(/-mtime\s+\+\d/);
});

it("non usa più /backups cablato nella pulizia (usa $BACKUP_DIR)", () => {
  expect(backupScript).not.toMatch(/find\s+\/backups\b/);
});

it("README-BACKUP.md rimanda alla variabile invece di ripetere un numero fisso di giorni", () => {
  expect(readmeBackup).toContain("BACKUP_RETENTION_DAYS");
  expect(readmeBackup).not.toMatch(/più vecchi di 14 giorni/);
});
