import {
  hasRedirectBasedAuthCheck,
  hasExplicit401AuthCheck,
  hasApiRouteAuthCheck,
} from "./lib/api-route-auth-checks";

// Regressione SEC-13: scripts/verify-api-routes-auth.ts ora accetta anche il
// pattern getUserIdOrNull() + 401 esplicito (oltre a
// requireUserId/requireSession/requireAdmin, che restano validi da soli
// perché fanno redirect strutturalmente). Questo test verifica che il
// riconoscimento non sia diventato un timbro di gomma: getUserIdOrNull()
// SENZA un controllo esplicito del null e una risposta 401 non deve bastare,
// altrimenti l'invariante "ogni route API verifica la sessione" si
// indebolirebbe silenziosamente.

const failures: string[] = [];

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    failures.push(
      `${message} — atteso ${JSON.stringify(expected)}, ottenuto ${JSON.stringify(actual)}`
    );
  }
}

function testRedirectBasedCallsAloneAreSufficient(): void {
  assertEqual(
    hasApiRouteAuthCheck("const userId = await requireUserId();"),
    true,
    "requireUserId() da solo deve bastare (fa redirect strutturalmente)"
  );
  assertEqual(
    hasApiRouteAuthCheck("await requireAdmin();"),
    true,
    "requireAdmin() da solo deve bastare"
  );
}

function testGetUserIdOrNullAloneIsNotSufficient(): void {
  assertEqual(
    hasExplicit401AuthCheck("const userId = await getUserIdOrNull();"),
    false,
    "getUserIdOrNull() senza controllo del null non deve bastare da solo"
  );
  assertEqual(
    hasApiRouteAuthCheck(
      "const userId = await getUserIdOrNull(); doSomething(userId);"
    ),
    false,
    "getUserIdOrNull() usato senza mai controllare null non deve superare il check"
  );
}

function testGetUserIdOrNullNullCheckWithoutResponseIsNotSufficient(): void {
  assertEqual(
    hasExplicit401AuthCheck(
      "const userId = await getUserIdOrNull(); if (userId === null) { throw new Error('no'); }"
    ),
    false,
    "un controllo === null che non risponde con status 401 non deve bastare"
  );
}

function testGetUserIdOrNullWithExplicit401IsSufficient(): void {
  const body =
    "const userId = await getUserIdOrNull();\n" +
    "if (userId === null) {\n" +
    '  return new Response("Non autenticato", { status: 401 });\n' +
    "}\n";
  assertEqual(
    hasExplicit401AuthCheck(body),
    true,
    "getUserIdOrNull() con controllo === null e status 401 deve bastare"
  );
  assertEqual(
    hasApiRouteAuthCheck(body),
    true,
    "lo stesso corpo deve passare anche il check combinato usato dallo scanner"
  );
}

function testRedirectBasedListIsExhaustiveForKnownHelpers(): void {
  assertEqual(
    hasRedirectBasedAuthCheck("await requireSession();"),
    true,
    "requireSession() deve essere riconosciuto"
  );
  assertEqual(
    hasRedirectBasedAuthCheck("doSomethingElse();"),
    false,
    "una chiamata qualsiasi non correlata non deve essere riconosciuta come auth check"
  );
}

testRedirectBasedCallsAloneAreSufficient();
testGetUserIdOrNullAloneIsNotSufficient();
testGetUserIdOrNullNullCheckWithoutResponseIsNotSufficient();
testGetUserIdOrNullWithExplicit401IsSufficient();
testRedirectBasedListIsExhaustiveForKnownHelpers();

if (failures.length > 0) {
  console.error("verify-api-route-auth-checker: FALLITO");
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

console.log(
  "Il checker di verify-api-routes-auth.ts riconosce correttamente entrambi i pattern di auth e non è un timbro di gomma."
);
