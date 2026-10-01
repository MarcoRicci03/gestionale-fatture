import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DevBanner } from "./dev-banner";

describe("DevBanner", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("renderizza il banner con il testo appropriato in ambiente non di produzione", () => {
    vi.stubEnv("NODE_ENV", "development");
    render(<DevBanner />);

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText(/Ambiente di Sviluppo/i)).toBeInTheDocument();
    expect(screen.getByText(/Sistema TS/i)).toBeInTheDocument();
  });

  it("non renderizza nulla (restituisce null) in ambiente di produzione", () => {
    vi.stubEnv("NODE_ENV", "production");
    const { container } = render(<DevBanner />);

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
