import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PdfEditorBlockPropertiesPanel } from "./pdf-editor-block-properties-panel";
import type { Blocco } from "@/lib/pdf/types";

function makeBlocco(overrides: Partial<Blocco> = {}): Blocco {
  return {
    id: "b1",
    tipo: "testo",
    x: 10,
    y: 20,
    width: 200,
    height: 60,
    fontSize: 12,
    align: "left",
    visible: true,
    testo: "ciao",
    ...overrides,
  };
}

function renderPanel(overrides: Partial<Parameters<typeof PdfEditorBlockPropertiesPanel>[0]> = {}) {
  return render(
    <PdfEditorBlockPropertiesPanel
      selectedBlock={makeBlocco()}
      advancedMode={false}
      onToggleAdvancedMode={vi.fn()}
      activeEditor={null}
      testoRef={{ current: null }}
      wrapText={vi.fn()}
      insertPlaceholder={vi.fn()}
      insertPlaceholderChip={vi.fn()}
      toggleRichBold={vi.fn()}
      toggleRichItalic={vi.fn()}
      toggleRichNota={vi.fn()}
      updateBlock={vi.fn()}
      moveOrder={vi.fn()}
      duplicateBlock={vi.fn()}
      removeBlock={vi.fn()}
      {...overrides}
    />
  );
}

describe("PdfEditorBlockPropertiesPanel", () => {
  it("per un blocco non-mesi mostra i campi posizione/dimensione con i valori del blocco", () => {
    renderPanel({ selectedBlock: makeBlocco({ x: 42, y: 43, width: 44, height: 45 }) });
    expect(screen.getByLabelText("X")).toHaveValue(42);
    expect(screen.getByLabelText("Y")).toHaveValue(43);
    expect(screen.getByLabelText("Larghezza")).toHaveValue(44);
    expect(screen.getByLabelText("Altezza")).toHaveValue(45);
  });

  it("cambiare X chiama updateBlock con l'id del blocco selezionato e il valore clampato", () => {
    const updateBlock = vi.fn();
    renderPanel({ selectedBlock: makeBlocco({ id: "xyz", x: 10 }), updateBlock });
    const input = screen.getByLabelText("X");
    // fireEvent.change (non user.clear+user.type): l'input è controllato con
    // un value fisso in questo test (updateBlock è un mock, non aggiorna
    // davvero lo stato), quindi digitare carattere per carattere verrebbe
    // annullato ad ogni render da React che ripristina value=10 — un singolo
    // evento change con il valore finale evita il problema.
    fireEvent.change(input, { target: { value: "9999" } });
    expect(updateBlock).toHaveBeenLastCalledWith("xyz", { x: 595 });
  });

  it("cambiare l'interlinea chiama updateBlock con il valore clampato, default 1 se assente", () => {
    const updateBlock = vi.fn();
    renderPanel({ selectedBlock: makeBlocco({ id: "xyz" }), updateBlock });
    expect(screen.getByLabelText("Interlinea")).toHaveValue(1);
    fireEvent.change(screen.getByLabelText("Interlinea"), { target: { value: "9" } });
    expect(updateBlock).toHaveBeenLastCalledWith("xyz", { lineHeight: 3 });
  });

  it("il pulsante elimina chiama removeBlock con l'id del blocco selezionato", async () => {
    const removeBlock = vi.fn();
    const user = userEvent.setup();
    renderPanel({ selectedBlock: makeBlocco({ id: "xyz" }), removeBlock });
    await user.click(screen.getByTitle("Elimina"));
    expect(removeBlock).toHaveBeenCalledWith("xyz");
  });

  it("per un blocco mesi mostra il pannello mesi invece dei controlli di contenuto testo", () => {
    renderPanel({
      selectedBlock: makeBlocco({
        tipo: "mesi",
        testo: undefined,
        meseConfig: {
          titolo: "x",
          descrizioneTemplate: "a",
          valoreTemplate: "b",
          mostraTotale: false,
        },
      }),
    });
    expect(screen.getByLabelText("Titolo (opzionale)")).toBeInTheDocument();
    expect(screen.queryByText("Modalità avanzata")).not.toBeInTheDocument();
  });

  it("in modalità avanzata mostra la textarea, non i pulsanti dell'editor ricco", () => {
    renderPanel({ advancedMode: true });
    expect(screen.getByRole("textbox", { name: "" })).toBeInTheDocument();
    expect(screen.getByText("Modalità semplice")).toBeInTheDocument();
  });
});
