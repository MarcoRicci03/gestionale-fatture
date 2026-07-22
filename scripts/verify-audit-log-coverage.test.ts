import { it, expect } from "vitest";
import { readdirSync, readFileSync } from "fs";
import { join } from "path";

// SEC-15: ogni Server Action mutante deve scrivere un evento di audit log
// tramite logAudit() (lib/audit/log.ts). Stesso pattern di
// verify-actions-auth.test.ts (extractFunctionBody + regex sulle funzioni
// esportate in lib/actions/*.ts): rende l'invariante verificabile invece che
// affidata alla disciplina di chi scrive una nuova action, così una nuova
// mutazione senza logAudit() viene segnalata invece di passare inosservata.
const ACTIONS_DIR = join(__dirname, "..", "lib", "actions");
const AUDIT_CALL = "logAudit(";
// Uniche funzioni esportate da lib/actions/*.ts che sono sola lettura (non
// mutano nulla): esentate perché non hanno nulla da auditare.
const READ_ONLY_ACTIONS = new Set(["getNextInvoiceNumberForYear"]);

function extractFunctionBody(source: string, startIndex: number): string {
  const openBrace = source.indexOf("{", startIndex);
  if (openBrace === -1) return "";
  let depth = 0;
  for (let i = openBrace; i < source.length; i++) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}") {
      depth--;
      if (depth === 0) return source.slice(openBrace, i + 1);
    }
  }
  return source.slice(openBrace);
}

it("tutte le Server Action mutanti registrano un evento di audit log", () => {
  const files = readdirSync(ACTIONS_DIR).filter((f) => f.endsWith(".ts"));
  const violations: string[] = [];

  for (const file of files) {
    const path = join(ACTIONS_DIR, file);
    const source = readFileSync(path, "utf-8");
    if (!source.includes('"use server"')) continue;

    const fnRegex = /export\s+async\s+function\s+(\w+)\s*\(/g;
    let match: RegExpExecArray | null;
    while ((match = fnRegex.exec(source)) !== null) {
      const name = match[1];
      if (READ_ONLY_ACTIONS.has(name)) continue;

      const body = extractFunctionBody(source, match.index);
      if (!body.includes(AUDIT_CALL)) {
        violations.push(`${file}: ${name}()`);
      }
    }
  }

  expect(
    violations,
    "Ogni Server Action che modifica dati deve registrare un evento con " +
      "logAudit() (vedi SEC-15 in SECURITY_AUDIT.md), oppure, se è " +
      "intenzionalmente di sola lettura, va aggiunta a READ_ONLY_ACTIONS in " +
      "questo test."
  ).toEqual([]);
});
