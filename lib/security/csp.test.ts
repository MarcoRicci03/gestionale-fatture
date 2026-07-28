import { describe, it, expect } from "vitest";
import { buildCspHeader } from "./csp";

describe("buildCspHeader", () => {
  it("include il nonce su script-src insieme a 'strict-dynamic', senza 'unsafe-inline'", () => {
    const csp = buildCspHeader("abc123");

    expect(csp).toContain("script-src 'self' 'nonce-abc123' 'strict-dynamic'");
    expect(csp).not.toMatch(/script-src[^;]*unsafe-inline/);
  });

  it("lascia style-src invariato con 'unsafe-inline' (l'editor PDF usa style inline per il posizionamento a pixel)", () => {
    const csp = buildCspHeader("abc123");

    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
  });

  it("mantiene le altre direttive di sicurezza già presenti oggi", () => {
    const csp = buildCspHeader("abc123");

    for (const directive of [
      "default-src 'self'",
      "img-src 'self' data:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ]) {
      expect(csp).toContain(directive);
    }
  });
});
