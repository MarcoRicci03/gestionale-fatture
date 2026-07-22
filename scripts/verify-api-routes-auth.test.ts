import { it, expect } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { join, relative } from "path";
import { hasApiRouteAuthCheck } from "./lib/api-route-auth-checks";

// Equivalente di verify-actions-auth.test.ts per le route API: proxy.ts
// esclude esplicitamente "api" dal matcher (vedi commento in proxy.ts), quindi
// ogni handler HTTP esportato da app/api/**/route.ts è raggiungibile da un
// client non autenticato a meno che non verifichi la sessione da sé. Questo
// test rende l'invariante verificabile invece che affidata alla disciplina di
// chi aggiunge una nuova route. I predicati che definiscono "verifica la
// sessione" sono in ./lib/api-route-auth-checks.ts (condivisi con
// scripts/verify-api-route-auth-checker.test.ts, che li testa direttamente).
const API_DIR = join(__dirname, "..", "app", "api");
const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"] as const;
// Chiave "percorso/relativo/route.ts:METHOD" per handler intenzionalmente
// pubblici (nessuno al momento).
const PUBLIC_ROUTES = new Set<string>([]);

function extractFunctionBody(source: string, startIndex: number): string {
  // Find the closing paren of the function signature first
  let parenDepth = 0;
  let parenClosing = -1;
  for (let i = startIndex; i < source.length; i++) {
    if (source[i] === "(") parenDepth++;
    else if (source[i] === ")") {
      parenDepth--;
      if (parenDepth === 0) {
        parenClosing = i;
        break;
      }
    }
  }
  if (parenClosing === -1) return "";

  // Now find the opening brace after the closing paren
  const openBrace = source.indexOf("{", parenClosing);
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

function findRouteFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...findRouteFiles(fullPath));
    } else if (entry.name === "route.ts") {
      files.push(fullPath);
    }
  }
  return files;
}

it("tutte le route API verificano la sessione", () => {
  const violations: string[] = [];

  for (const path of findRouteFiles(API_DIR)) {
    const source = readFileSync(path, "utf-8");
    const relPath = relative(join(__dirname, ".."), path);

    for (const method of HTTP_METHODS) {
      const regex = new RegExp(`export\\s+async\\s+function\\s+${method}\\s*\\(`);
      const match = regex.exec(source);
      if (!match) continue;
      if (PUBLIC_ROUTES.has(`${relPath}:${method}`)) continue;

      const body = extractFunctionBody(source, match.index);
      if (!hasApiRouteAuthCheck(body)) {
        violations.push(`${relPath}: ${method}()`);
      }
    }
  }

  expect(
    violations,
    "Ogni handler HTTP esportato da app/api/**/route.ts è raggiungibile senza " +
      "passare dal proxy (vedi proxy.ts): aggiungi requireUserId()/requireSession()/" +
      "requireAdmin() direttamente nell'handler (redirect a /login), oppure " +
      "getUserIdOrNull() con un controllo esplicito `=== null` che risponda con " +
      "status 401 (preferibile per una route API — vedi SEC-13 in " +
      "SECURITY_AUDIT.md), oppure, se è intenzionalmente pubblico, aggiungilo a " +
      "PUBLIC_ROUTES in questo test."
  ).toEqual([]);
});
