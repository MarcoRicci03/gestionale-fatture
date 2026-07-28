import { describe, it, expect, vi } from "vitest";
import { ThemeProvider } from "next-themes";
import type { ReactElement } from "react";

// app/layout.tsx importa next/font/google, che fuori dalla pipeline di build
// di Next.js (qui: Vite via @vitejs/plugin-react) non è una funzione
// invocabile — mock scoped a questo solo file, non al setup globale di
// Vitest, per non introdurre un mock condiviso più ampio del necessario.
vi.mock("next/font/google", () => ({
  Geist: () => ({ variable: "--font-geist-sans" }),
  Geist_Mono: () => ({ variable: "--font-geist-mono" }),
}));

const headersGetMock = vi.fn();
vi.mock("next/headers", () => ({
  headers: async () => ({ get: headersGetMock }),
}));

function findByType(element: ReactElement, type: unknown): ReactElement | null {
  if (element.type === type) return element;
  const children = (element.props as { children?: unknown }).children;
  const candidates = Array.isArray(children) ? children : [children];
  for (const child of candidates) {
    if (child && typeof child === "object" && "type" in child) {
      const found = findByType(child as ReactElement, type);
      if (found) return found;
    }
  }
  return null;
}

describe("RootLayout — propagazione del nonce a ThemeProvider (SEC-08)", () => {
  it("passa l'header x-nonce come prop nonce a ThemeProvider", async () => {
    headersGetMock.mockImplementation((name: string) =>
      name === "x-nonce" ? "test-nonce-123" : null
    );
    const { default: RootLayout } = await import("./layout");

    const html = await RootLayout({ children: <div>test</div> });
    const themeProvider = findByType(html, ThemeProvider);

    expect(themeProvider).not.toBeNull();
    expect((themeProvider!.props as { nonce?: string }).nonce).toBe("test-nonce-123");
  });

  it("passa undefined a ThemeProvider quando l'header x-nonce non è impostato (sviluppo)", async () => {
    headersGetMock.mockImplementation(() => null);
    const { default: RootLayout } = await import("./layout");

    const html = await RootLayout({ children: <div>test</div> });
    const themeProvider = findByType(html, ThemeProvider);

    expect(themeProvider).not.toBeNull();
    expect((themeProvider!.props as { nonce?: string }).nonce).toBeUndefined();
  });
});
