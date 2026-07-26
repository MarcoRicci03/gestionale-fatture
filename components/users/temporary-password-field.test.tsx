import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { TemporaryPasswordField } from "./temporary-password-field";
import { passwordSchema } from "@/lib/validations/user";

// Wrapper controllato: il componente non gestisce stato proprio, riceve
// value/onValueChange dal chiamante (react-hook-form nell'uso reale).
function ControlledField({
  autoGenerate = false,
}: {
  autoGenerate?: boolean;
}) {
  const [value, setValue] = useState("");
  return (
    <TemporaryPasswordField
      value={value}
      onValueChange={setValue}
      autoGenerate={autoGenerate}
    />
  );
}

describe("TemporaryPasswordField", () => {
  it("il bottone Genera riempie il campo con una password conforme alla policy", async () => {
    const user = userEvent.setup();
    render(<ControlledField />);

    await user.click(screen.getByLabelText("Genera password casuale"));

    const input = screen.getByLabelText("Password") as HTMLInputElement;
    expect(input.value).not.toBe("");
    expect(passwordSchema.safeParse(input.value).success).toBe(true);
  });

  it("autoGenerate compila il campo al mount", () => {
    render(<ControlledField autoGenerate />);
    const input = screen.getByLabelText("Password") as HTMLInputElement;
    expect(input.value).not.toBe("");
  });

  it("il bottone Copia è disabilitato a campo vuoto", () => {
    render(<ControlledField />);
    expect(screen.getByLabelText("Copia password negli appunti")).toBeDisabled();
  });

  it("il bottone Copia scrive negli appunti e mostra lo stato copiato", async () => {
    // @testing-library/user-event installa un proprio stub di
    // navigator.clipboard dentro setup() (jsdom non lo implementa): va spiato
    // il metodo già installato, non sostituito l'intero oggetto, che
    // verrebbe comunque rimpiazzato da userEvent.setup() subito dopo.
    const user = userEvent.setup();
    Object.defineProperty(window, "isSecureContext", {
      value: true,
      configurable: true,
    });
    const writeTextSpy = vi.spyOn(navigator.clipboard, "writeText");

    render(<ControlledField autoGenerate />);

    const copyButton = screen.getByLabelText("Copia password negli appunti");
    expect(copyButton).toBeEnabled();

    await user.click(copyButton);

    expect(writeTextSpy).toHaveBeenCalledTimes(1);
  });
});
