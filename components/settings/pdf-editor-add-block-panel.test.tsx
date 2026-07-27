import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PdfEditorAddBlockPanel } from "./pdf-editor-add-block-panel";

describe("PdfEditorAddBlockPanel", () => {
  it("mostra un pulsante per ogni tipo di blocco disponibile", () => {
    render(<PdfEditorAddBlockPanel previewMode={false} onAddBlock={vi.fn()} />);
    ["Mittente", "Intestatario", "Paziente", "Pagamento", "Testo libero", "Mesi/Voci"].forEach(
      (label) => expect(screen.getByText(label)).toBeInTheDocument()
    );
  });

  it("chiama onAddBlock col tipo corretto al click", async () => {
    const onAddBlock = vi.fn();
    const user = userEvent.setup();
    render(<PdfEditorAddBlockPanel previewMode={false} onAddBlock={onAddBlock} />);
    await user.click(screen.getByText("Testo libero"));
    expect(onAddBlock).toHaveBeenCalledWith("testo");
  });

  it("disabilita tutti i pulsanti in modalità anteprima", () => {
    render(<PdfEditorAddBlockPanel previewMode={true} onAddBlock={vi.fn()} />);
    expect(screen.getByText("Testo libero").closest("button")).toBeDisabled();
  });
});
