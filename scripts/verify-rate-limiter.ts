import { readFileSync } from "fs";
import { join } from "path";
import { createRateLimiter } from "../lib/auth/rate-limiter";

// Regressione SEC-08: changePassword (lib/actions/account.ts),
// resetUserPassword (lib/actions/users.ts) e la generazione PDF
// (app/api/invoices/[id]/pdf/route.ts) devono avere un limite di richieste,
// altrimenti chi ottiene una sessione può forzare in loop la password
// attuale, resettare in massa le password di altri utenti, o saturare la
// CPU generando PDF senza sosta.

const failures: string[] = [];

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    failures.push(
      `${message} — atteso ${JSON.stringify(expected)}, ottenuto ${JSON.stringify(actual)}`
    );
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function testRateLimiterCoreLogic(): Promise<void> {
  const limiter = createRateLimiter({ maxRequests: 3, windowMs: 60 });

  assertEqual(limiter.consume("a").allowed, true, "1a richiesta deve essere consentita");
  assertEqual(limiter.consume("a").allowed, true, "2a richiesta deve essere consentita");
  assertEqual(limiter.consume("a").allowed, true, "3a richiesta deve essere consentita");

  const fourth = limiter.consume("a");
  assertEqual(fourth.allowed, false, "la 4a richiesta nella stessa finestra deve essere bloccata");
  if (fourth.retryAfterSeconds === undefined) {
    failures.push("una richiesta bloccata deve indicare retryAfterSeconds");
  }

  assertEqual(
    limiter.consume("b").allowed,
    true,
    "una chiave diversa non deve risentire del limite raggiunto da un'altra chiave"
  );

  await sleep(70);
  assertEqual(
    limiter.consume("a").allowed,
    true,
    "dopo la scadenza della finestra, la stessa chiave deve tornare consentita"
  );
}

function testChangePasswordIsRateLimited(): void {
  const source = readFileSync(
    join(__dirname, "..", "lib", "actions", "account.ts"),
    "utf-8"
  );
  const hasLimiter =
    source.includes("createRateLimiter") &&
    /changePasswordLimiter\.consume/.test(source);
  assertEqual(
    hasLimiter,
    true,
    "changePassword deve consumare un rate limiter prima di verificare la password attuale"
  );
}

function testResetUserPasswordIsRateLimited(): void {
  const source = readFileSync(
    join(__dirname, "..", "lib", "actions", "users.ts"),
    "utf-8"
  );
  const hasLimiter =
    source.includes("createRateLimiter") &&
    /resetPasswordLimiter\.consume/.test(source);
  assertEqual(
    hasLimiter,
    true,
    "resetUserPassword deve consumare un rate limiter prima di resettare la password"
  );
}

function testPdfRouteIsRateLimited(): void {
  const source = readFileSync(
    join(__dirname, "..", "app", "api", "invoices", "[id]", "pdf", "route.ts"),
    "utf-8"
  );
  const hasLimiter =
    source.includes("createRateLimiter") &&
    /pdfGenerationLimiter\.consume/.test(source);
  assertEqual(
    hasLimiter,
    true,
    "la route di generazione PDF deve consumare un rate limiter prima di generare il PDF"
  );
}

async function main(): Promise<void> {
  await testRateLimiterCoreLogic();
  testChangePasswordIsRateLimited();
  testResetUserPasswordIsRateLimited();
  testPdfRouteIsRateLimited();

  if (failures.length > 0) {
    console.error("verify-rate-limiter: FALLITO");
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }

  console.log(
    "Rate limiter generico corretto; changePassword, resetUserPassword e la generazione PDF lo usano tutti."
  );
}

main();
