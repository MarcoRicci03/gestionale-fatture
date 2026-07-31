import { it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

// Analisi statica (stesso approccio di verify-backup-retention.test.ts):
// scripts/backup-db.sh gira come entrypoint di un container Docker, non
// eseguibile end-to-end in Vitest (pg_dump/gpg/rclone reali, loop infinito
// con sleep) — verificato manualmente con build Docker reale, vedi
// ROADMAP.md (DEP-06). Questi test proteggono le proprietà di sicurezza e
// le invarianti strutturali che un refactor futuro potrebbe rompere senza
// che un `npm test` lo segnali.

const ROOT = join(__dirname, "..");
const backupScript = readFileSync(join(ROOT, "scripts", "backup-db.sh"), "utf-8");
const dockerfileBackup = readFileSync(join(ROOT, "Dockerfile.backup"), "utf-8");
const compose = readFileSync(join(ROOT, "docker-compose.prod.yml"), "utf-8");

it("verifica il ripristino decifrando e ripristinando in un DB usa-e-getta", () => {
  expect(backupScript).toMatch(/gpg --decrypt/);
  expect(backupScript).toMatch(/createdb\s.*"\$verify_db"/);
  expect(backupScript).toMatch(/psql\s.*ON_ERROR_STOP=1/);
  expect(backupScript).toMatch(/dropdb\s.*--if-exists\s+"\$verify_db"/);
});

it("il dump decifrato in chiaro va solo in /tmp, mai nel bind mount condiviso con l'host", () => {
  // "plain=" e "compressed=" devono puntare a /tmp: se in futuro qualcuno li
  // sposta in $BACKUP_DIR (il bind mount ./backups), un dump in chiaro
  // toccherebbe il disco dell'host anche solo per pochi secondi.
  expect(backupScript).toMatch(/plain="\/tmp\//);
  expect(backupScript).toMatch(/compressed="\/tmp\//);
  expect(backupScript).not.toMatch(/plain="\$BACKUP_DIR/);
});

it("una verifica fallita non cancella il backup (resta per ispezione manuale)", () => {
  // verify_backup è la condizione di un if/else (DEP-06: il ramo else
  // chiama ping_healthcheck 0 invece del precedente `|| true`): un suo
  // fallimento non deve comunque innescare `rm -f "$filename"` (quella riga
  // esiste solo nel ramo "pg_dump/gpg falliti", non dopo la verifica).
  const verifyBranch = backupScript.slice(
    backupScript.indexOf('if verify_backup "$filename"'),
    backupScript.indexOf("sync_offsite")
  );
  expect(verifyBranch).not.toMatch(/rm -f "\$filename"/);
});

it("DEP-06: ping_healthcheck riflette l'esito del dump E della verifica di ripristino, resta inerte senza BACKUP_HEALTHCHECK_PING_URL", () => {
  expect(backupScript).toMatch(/if\s+\[\s+-z\s+"\$\{BACKUP_HEALTHCHECK_PING_URL:-\}"\s+\]/);
  expect(backupScript).toMatch(/curl[^\n]*"\$url"/);
  // Ping di successo (1) solo se verify_backup riesce, di fallimento (0) sia
  // se verify_backup fallisce sia se il dump/gpg iniziale fallisce.
  expect(backupScript).toMatch(/if verify_backup "\$filename"; then\s*\n\s*ping_healthcheck 1/);
  expect(backupScript).toMatch(/ping_healthcheck 0/);
});

it("la copia off-site è saltata senza RCLONE_REMOTE, e copia solo il file cifrato", () => {
  expect(backupScript).toMatch(/if\s+\[\s+-z\s+"\$\{RCLONE_REMOTE:-\}"\s+\]/);
  expect(backupScript).toMatch(/rclone copy\s+"\$encrypted"/);
});

it("Dockerfile.backup installa rclone insieme a gnupg", () => {
  expect(dockerfileBackup).toMatch(/apk add --no-cache[^\n]*\brclone\b/);
});

it("docker-compose.prod.yml espone RCLONE_REMOTE e monta rclone.conf sul servizio backup", () => {
  const backupService = compose.slice(compose.indexOf("  backup:"), compose.indexOf("  audit-log-retention:"));
  expect(backupService).toContain("RCLONE_REMOTE");
  expect(backupService).toMatch(/source:\s*\.\/rclone\.conf/);
  expect(backupService).toMatch(/target:\s*\/rclone\.conf/);
});

it("DEP-04: il mount di rclone.conf non crea una directory vuota se il file manca (create_host_path: false)", () => {
  const backupService = compose.slice(compose.indexOf("  backup:"), compose.indexOf("  audit-log-retention:"));
  expect(backupService).toMatch(/create_host_path:\s*false/);
});
