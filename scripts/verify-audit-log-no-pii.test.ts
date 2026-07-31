import { it, expect } from "vitest";
import { readdirSync, readFileSync } from "fs";
import { join } from "path";

// getAuditLog() (lib/data/audit-log.ts) non applica scoping per id_Utente:
// scelta voluta, un admin deve vedere gli eventi di tutti gli utenti. In un
// deployment multi-studio (ogni logopedista ha il proprio Utente) l'admin non
// è però titolare del trattamento sui pazienti degli altri: se il `meta` di
// una Server Action porta nome/cognome/CF/PIVA di pazienti o paganti, quei
// dati sanitari (art. 9 GDPR: l'associazione paziente↔logopedista è già un
// dato relativo alla salute) finiscono comunque visibili nella colonna JSON
// che AuditLogManager mostra senza filtri (SEC-04). Questo test rende
// l'invariante verificabile invece che affidata alla disciplina di chi scrive
// la prossima action — stesso principio di verify-actions-auth.test.ts.
const ACTIONS_DIR = join(__dirname, "..", "lib", "actions");

const BANNED_META_KEYS = [
  "nome",
  "cognome",
  "cf",
  "piva",
  "ragioneSociale",
  "via",
  "indirizzo",
  "telefono",
  "email",
  "codiceFiscale",
  "partitaIva",
];

function extractBalanced(source: string, openIndex: number): string {
  let depth = 0;
  for (let i = openIndex; i < source.length; i++) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}") {
      depth--;
      if (depth === 0) return source.slice(openIndex, i + 1);
    }
  }
  return source.slice(openIndex);
}

function findMetaBlocks(source: string): string[] {
  const blocks: string[] = [];
  const metaRegex = /meta:\s*\{/g;
  let match: RegExpExecArray | null;
  while ((match = metaRegex.exec(source)) !== null) {
    const openBrace = match.index + match[0].length - 1;
    blocks.push(extractBalanced(source, openBrace));
  }
  return blocks;
}

it("il meta degli eventi di audit non porta anagrafica di pazienti/paganti", () => {
  const files = readdirSync(ACTIONS_DIR).filter((f) => f.endsWith(".ts"));
  const violations: string[] = [];

  for (const file of files) {
    const source = readFileSync(join(ACTIONS_DIR, file), "utf-8");
    for (const block of findMetaBlocks(source)) {
      for (const key of BANNED_META_KEYS) {
        const keyRegex = new RegExp(`(^|[{,\\s])${key}\\s*:`, "m");
        if (keyRegex.test(block)) {
          violations.push(`${file}: chiave "${key}" trovata in un blocco meta`);
        }
      }
    }
  }

  expect(
    violations,
    "Il meta di logAudit() non deve contenere dati anagrafici identificanti " +
      "di pazienti/paganti (nome, cognome, cf, piva, indirizzo, ...): " +
      "getAuditLog() non è scoped per id_Utente, quindi in un deployment " +
      "multi-studio un admin diverso dal titolare del trattamento li " +
      "leggerebbe comunque (SEC-04). Usa id numerici o conteggi non " +
      "identificanti al loro posto."
  ).toEqual([]);
});
