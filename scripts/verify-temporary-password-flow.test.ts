import { it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

// Il flag Utente.mustChangePassword alimenta l'avviso non bloccante di
// "password temporanea" (components/account/temporary-password-notice.tsx):
// deve essere impostato a true ogni volta che un admin sceglie la password al
// posto dell'utente (createUser, resetUserPassword) e riportato a false
// quando l'utente sceglie la propria (changePassword). Il type system non può
// esprimere questa invariante — dimenticare il flag in una nuova action
// compila benissimo e rompe la funzionalità in silenzio. Stesso approccio di
// verify-actions-auth.test.ts e verify-audit-log-coverage.test.ts.

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

function functionBody(filePath: string, functionName: string): string {
  const source = readFileSync(filePath, "utf-8");
  const fnRegex = new RegExp(
    `export\\s+async\\s+function\\s+${functionName}\\s*\\(`
  );
  const match = fnRegex.exec(source);
  if (!match) {
    throw new Error(`Funzione ${functionName} non trovata in ${filePath}`);
  }
  return extractFunctionBody(source, match.index);
}

const USERS_ACTIONS_PATH = join(__dirname, "..", "lib", "actions", "users.ts");
const ACCOUNT_ACTIONS_PATH = join(
  __dirname,
  "..",
  "lib",
  "actions",
  "account.ts"
);

it("createUser imposta mustChangePassword a true", () => {
  const body = functionBody(USERS_ACTIONS_PATH, "createUser");
  expect(body).toContain("mustChangePassword: true");
});

it("resetUserPassword imposta mustChangePassword a true", () => {
  const body = functionBody(USERS_ACTIONS_PATH, "resetUserPassword");
  expect(body).toContain("mustChangePassword: true");
});

it("changePassword azzera mustChangePassword", () => {
  const body = functionBody(ACCOUNT_ACTIONS_PATH, "changePassword");
  expect(body).toContain("mustChangePassword: false");
});

it("updateProfile e updateUser non toccano mustChangePassword", () => {
  const updateProfileBody = functionBody(ACCOUNT_ACTIONS_PATH, "updateProfile");
  expect(updateProfileBody).not.toContain("mustChangePassword");

  const updateUserBody = functionBody(USERS_ACTIONS_PATH, "updateUser");
  expect(updateUserBody).not.toContain("mustChangePassword");
});
