import { describe, it, expect } from "vitest";
import {
  hasRedirectBasedAuthCheck,
  hasExplicit401AuthCheck,
  hasApiRouteAuthCheck,
} from "./lib/api-route-auth-checks";

// scripts/verify-api-routes-auth.test.ts ora accetta
// anche il pattern getUserIdOrNull() + 401 esplicito (oltre a
// requireUserId/requireSession/requireAdmin, che restano validi da soli
// perché fanno redirect strutturalmente). Questo test verifica che il
// riconoscimento non sia diventato un timbro di gomma: getUserIdOrNull()
// SENZA un controllo esplicito del null e una risposta 401 non deve bastare,
// altrimenti l'invariante "ogni route API verifica la sessione" si
// indebolirebbe silenziosamente.

describe("api-route-auth-checks", () => {
  it("requireUserId()/requireAdmin() da soli bastano (fanno redirect strutturalmente)", () => {
    expect(hasApiRouteAuthCheck("const userId = await requireUserId();")).toBe(true);
    expect(hasApiRouteAuthCheck("await requireAdmin();")).toBe(true);
  });

  it("getUserIdOrNull() da solo non basta", () => {
    expect(hasExplicit401AuthCheck("const userId = await getUserIdOrNull();")).toBe(false);
    expect(
      hasApiRouteAuthCheck(
        "const userId = await getUserIdOrNull(); doSomething(userId);"
      )
    ).toBe(false);
  });

  it("un controllo === null senza risposta 401 non basta", () => {
    expect(
      hasExplicit401AuthCheck(
        "const userId = await getUserIdOrNull(); if (userId === null) { throw new Error('no'); }"
      )
    ).toBe(false);
  });

  it("getUserIdOrNull() con controllo === null e status 401 basta", () => {
    const body =
      "const userId = await getUserIdOrNull();\n" +
      "if (userId === null) {\n" +
      '  return new Response("Non autenticato", { status: 401 });\n' +
      "}\n";
    expect(hasExplicit401AuthCheck(body)).toBe(true);
    expect(hasApiRouteAuthCheck(body)).toBe(true);
  });

  it("la lista redirect-based riconosce solo gli helper noti", () => {
    expect(hasRedirectBasedAuthCheck("await requireSession();")).toBe(true);
    expect(hasRedirectBasedAuthCheck("doSomethingElse();")).toBe(false);
  });
});
