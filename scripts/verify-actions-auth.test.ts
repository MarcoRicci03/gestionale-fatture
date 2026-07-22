import { it, expect } from "vitest";
import { readdirSync, readFileSync } from "fs";
import { join } from "path";

// In una Server Action (file "use server") OGNI funzione esportata è un
// endpoint RPC richiamabile direttamente dal client, anche quella pensata
// come helper interno. proxy.ts non protegge le richieste non-GET (vedi
// commento in proxy.ts): l'unica rete di sicurezza è che ciascuna funzione
// esportata verifichi la sessione. Questo test rende l'invariante
// verificabile invece che affidata alla disciplina di chi scrive nuove action.
const ACTIONS_DIR = join(__dirname, "..", "lib", "actions");
const AUTH_CALLS = ["requireUserId(", "requireSession(", "requireAdmin("];
const PUBLIC_ACTIONS = new Set(["login", "logout"]);

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

it("tutte le Server Action esportate verificano la sessione", () => {
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
      if (PUBLIC_ACTIONS.has(name)) continue;

      const body = extractFunctionBody(source, match.index);
      const hasAuthCheck = AUTH_CALLS.some((call) => body.includes(call));
      if (!hasAuthCheck) {
        violations.push(`${file}: ${name}()`);
      }
    }
  }

  expect(
    violations,
    "Ogni funzione esportata da un file \"use server\" è richiamabile dal client: " +
      "aggiungi requireUserId()/requireSession()/requireAdmin() o, se è " +
      "intenzionalmente pubblica, aggiungila a PUBLIC_ACTIONS in questo test."
  ).toEqual([]);
});
