import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PdfEditorPageSettingsPanel } from "./pdf-editor-page-settings-panel";

function renderPanel(overrides: Partial<Parameters<typeof PdfEditorPageSettingsPanel>[0]> = {}) {
  return render(
    <PdfEditorPageSettingsPanel
      open={false}
      onToggleOpen={vi.fn()}
      marginTop={40}
      marginRight={40}
      marginBottom={40}
      marginLeft={40}
      onChangeMargins={vi.fn()}
      {...overrides}
    />
  );
}

describe("PdfEditorPageSettingsPanel", () => {
  it("non mostra i campi dei margini quando chiuso", () => {
    renderPanel({ open: false });
    expect(screen.queryByLabelText("Alto")).not.toBeInTheDocument();
  });

  it("mostra i campi dei margini quando aperto", () => {
    renderPanel({ open: true });
    expect(screen.getByLabelText("Alto")).toHaveValue(40);
  });

  it("chiama onToggleOpen al click sull'intestazione", async () => {
    const onToggleOpen = vi.fn();
    const user = userEvent.setup();
    renderPanel({ onToggleOpen });
    await user.click(screen.getByText("Impostazioni pagina"));
    expect(onToggleOpen).toHaveBeenCalled();
  });

  it("cambiare il margine alto chiama onChangeMargins con il valore clampato", () => {
    const onChangeMargins = vi.fn();
    renderPanel({ open: true, onChangeMargins });
    const input = screen.getByLabelText("Alto");
    // fireEvent.change (non user.clear+user.type): l'input è controllato con
    // un value fisso in questo test (onChangeMargins è un mock, non
    // aggiorna davvero lo stato), quindi digitare carattere per carattere
    // verrebbe annullato ad ogni render da React che ripristina value=40 —
    // un singolo evento change con il valore finale evita il problema.
    fireEvent.change(input, { target: { value: "500" } });
    expect(onChangeMargins).toHaveBeenLastCalledWith({ marginTop: 400 });
  });
});
