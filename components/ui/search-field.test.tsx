// components/ui/search-field.test.tsx
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SearchField } from "./search-field";

function renderField(value: string, onValueChange = vi.fn()) {
  const utils = render(
    <SearchField id="q" label="Cerca" value={value} onValueChange={onValueChange} />
  );
  const rerenderWithValue = (nextValue: string) =>
    utils.rerender(
      <SearchField id="q" label="Cerca" value={nextValue} onValueChange={onValueChange} />
    );
  return { onValueChange, rerenderWithValue };
}

describe("SearchField", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("non chiama onValueChange finché l'utente digita entro 300ms", async () => {
    const user = userEvent.setup({ delay: null });
    const onValueChange = vi.fn();
    renderField("", onValueChange);
    await user.type(screen.getByLabelText("Cerca"), "Rossi");
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("chiama onValueChange con l'ultimo valore dopo 300ms di inattività", async () => {
    const user = userEvent.setup({ delay: null });
    const onValueChange = vi.fn();
    renderField("", onValueChange);
    await user.type(screen.getByLabelText("Cerca"), "Rossi");
    vi.advanceTimersByTime(300);
    expect(onValueChange).toHaveBeenCalledExactlyOnceWith("Rossi");
  });

  it("flush immediato al blur, anche prima dei 300ms", async () => {
    const user = userEvent.setup({ delay: null });
    const onValueChange = vi.fn();
    renderField("", onValueChange);
    const input = screen.getByLabelText("Cerca");
    await user.type(input, "Rossi");
    await user.tab();
    expect(onValueChange).toHaveBeenCalledExactlyOnceWith("Rossi");
  });

  it("un cambio esterno del valore durante il debounce vince: non richiama onValueChange con il valore digitato stale", async () => {
    const user = userEvent.setup({ delay: null });
    const { onValueChange, rerenderWithValue } = renderField("Mario");

    const input = screen.getByLabelText("Cerca");
    await user.type(input, "X");
    vi.advanceTimersByTime(100);
    rerenderWithValue("");

    vi.advanceTimersByTime(300);

    expect(onValueChange).not.toHaveBeenCalledWith("MarioX");
  });
});
