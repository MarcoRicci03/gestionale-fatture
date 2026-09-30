import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// CR-14: coppia certificato/chiave di prova generata al volo per i test, in
// una cartella temporanea. Prima i test leggevano certs/mock_sanitelcf.*, che
// non sono versionati: in CI, con un checkout pulito, fallivano.
// Richiede `openssl`, presente sui runner GitHub e sulle macchine di sviluppo.
export function creaCertificatoMock(): { cert: string; key: string } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sanitelcf-mock-"));
  const cert = path.join(dir, "mock_sanitelcf.cer");
  const key = path.join(dir, "mock_sanitelcf.key");
  execFileSync(
    "openssl",
    ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", key, "-out", cert, "-days", "1", "-subj", "/CN=SanitelCF mock"],
    { stdio: "ignore" }
  );
  return { cert, key };
}
