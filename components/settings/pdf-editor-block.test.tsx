import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Block } from "./pdf-editor-block";
import type { Blocco } from "@/lib/pdf/types";

function makeBlocco(overrides: Partial<Blocco> = {}): Blocco {
  return {
    id: "b1",
    tipo: "testo",
    x: 10,
    y: 10,
    width: 200,
    height: 60,
    fontSize: 12,
    align: "left",
    visible: true,
    testo: "Ciao mondo",
    ...overrides,
  };
}

const noop = () => {};

function renderBlock(overrides: Partial<Parameters<typeof Block>[0]> = {}) {
  return render(
    <Block
      blocco={makeBlocco()}
      isSelected={false}
      isEditing={false}
      isPreview={false}
      zoom={1}
      onSelect={noop}
      onStartEditing={noop}
      onExitEditing={noop}
      onEditorReady={noop}
      onUpdate={noop}
      {...overrides}
    />
  );
}

describe("Block", () => {
  it("renderizza il testo statico di un blocco testo (non in editing, non in preview)", () => {
    renderBlock({ blocco: makeBlocco({ testo: "Ciao mondo" }) });
    expect(screen.getByText("Ciao mondo")).toBeInTheDocument();
  });

  it("mostra l'etichetta del tipo per i blocchi diversi da 'testo'", () => {
    renderBlock({ blocco: makeBlocco({ tipo: "mittente", testo: "x" }) });
    expect(screen.getByText("Mittente")).toBeInTheDocument();
  });

  it("non mostra l'etichetta del tipo per i blocchi 'testo'", () => {
    renderBlock({ blocco: makeBlocco({ tipo: "testo" }) });
    expect(screen.queryByText("Testo libero")).not.toBeInTheDocument();
  });

  it("renderizza il titolo e il template di un blocco mesi senza dati di preview", () => {
    renderBlock({
      blocco: makeBlocco({
        tipo: "mesi",
        testo: undefined,
        meseConfig: {
          titolo: "Dettaglio mesi",
          descrizioneTemplate: "Gennaio",
          valoreTemplate: "50 EUR",
          mostraTotale: false,
        },
      }),
    });
    expect(screen.getByText("Dettaglio mesi")).toBeInTheDocument();
    expect(screen.getByText("Gennaio")).toBeInTheDocument();
    expect(screen.getByText("50 EUR")).toBeInTheDocument();
  });

  it("non renderizza nulla in modalità anteprima se il blocco non è visibile", () => {
    const { container } = renderBlock({
      isPreview: true,
      blocco: makeBlocco({ visible: false }),
    });
    expect(container).toBeEmptyDOMElement();
  });

  it("mostra la maniglia di ridimensionamento solo fuori dalla modalità anteprima", () => {
    const { rerender } = renderBlock({ isPreview: false });
    expect(screen.getByLabelText("Ridimensiona blocco")).toBeInTheDocument();
    rerender(
      <Block
        blocco={makeBlocco({ visible: true })}
        isSelected={false}
        isEditing={false}
        isPreview={true}
        zoom={1}
        onSelect={noop}
        onStartEditing={noop}
        onExitEditing={noop}
        onEditorReady={noop}
        onUpdate={noop}
      />
    );
    expect(screen.queryByLabelText("Ridimensiona blocco")).not.toBeInTheDocument();
  });

  it("chiama onStartEditing al doppio click su un blocco non-mesi fuori preview", async () => {
    const onStartEditing = vi.fn();
    const { getByRole } = renderBlock({ onStartEditing });
    const user = userEvent.setup();
    await user.dblClick(getByRole("button", { name: /Blocco Testo libero/ }));
    expect(onStartEditing).toHaveBeenCalled();
  });
});
