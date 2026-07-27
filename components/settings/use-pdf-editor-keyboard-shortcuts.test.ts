import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";
import { usePdfEditorKeyboardShortcuts } from "./use-pdf-editor-keyboard-shortcuts";
import type { Blocco } from "@/lib/pdf/types";

function makeBlocco(overrides: Partial<Blocco> & Pick<Blocco, "id">): Blocco {
  return {
    tipo: "testo",
    x: 10,
    y: 10,
    width: 100,
    height: 50,
    fontSize: 12,
    align: "left",
    visible: true,
    ...overrides,
  };
}

function renderShortcuts(overrides: Partial<Parameters<typeof usePdfEditorKeyboardShortcuts>[0]> = {}) {
  const options = {
    blocchi: [makeBlocco({ id: "a" }), makeBlocco({ id: "b", x: 200 })],
    selectedIds: new Set<string>(),
    setSelectedIds: vi.fn(),
    clipboard: null,
    setClipboard: vi.fn(),
    pasteCountRef: { current: 0 },
    isMouseOverCanvas: { current: false },
    removeBlock: vi.fn(),
    undo: vi.fn(),
    redo: vi.fn(),
    pushSettings: vi.fn(),
    setAutoFit: vi.fn(),
    setZoom: vi.fn(),
    ...overrides,
  };
  const { unmount } = renderHook(() => usePdfEditorKeyboardShortcuts(options));
  return { options, unmount };
}

describe("usePdfEditorKeyboardShortcuts", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("Canc con blocchi selezionati chiama removeBlock per ognuno", () => {
    const { options } = renderShortcuts({ selectedIds: new Set(["a", "b"]) });
    fireEvent.keyDown(window, { key: "Delete" });
    expect(options.removeBlock).toHaveBeenCalledWith("a");
    expect(options.removeBlock).toHaveBeenCalledWith("b");
  });

  it("Canc senza selezione non chiama removeBlock", () => {
    const { options } = renderShortcuts({ selectedIds: new Set() });
    fireEvent.keyDown(window, { key: "Delete" });
    expect(options.removeBlock).not.toHaveBeenCalled();
  });

  it("Ctrl+Z chiama undo", () => {
    const { options } = renderShortcuts();
    fireEvent.keyDown(window, { key: "z", ctrlKey: true });
    expect(options.undo).toHaveBeenCalled();
  });

  it("Ctrl+Shift+Z chiama redo, non undo", () => {
    const { options } = renderShortcuts();
    fireEvent.keyDown(window, { key: "z", ctrlKey: true, shiftKey: true });
    expect(options.redo).toHaveBeenCalled();
    expect(options.undo).not.toHaveBeenCalled();
  });

  it("Ctrl+Y chiama redo", () => {
    const { options } = renderShortcuts();
    fireEvent.keyDown(window, { key: "y", ctrlKey: true });
    expect(options.redo).toHaveBeenCalled();
  });

  it("Ctrl+A seleziona tutti i blocchi quando non sono già tutti selezionati", () => {
    const setSelectedIds = vi.fn();
    renderShortcuts({ selectedIds: new Set(), setSelectedIds });
    fireEvent.keyDown(window, { key: "a", ctrlKey: true });
    const updater = setSelectedIds.mock.calls[0][0] as (prev: Set<string>) => Set<string>;
    expect(Array.from(updater(new Set()))).toEqual(["a", "b"]);
  });

  it("Ctrl+A deseleziona tutto quando erano già tutti selezionati", () => {
    const allSelected = new Set(["a", "b"]);
    const setSelectedIds = vi.fn();
    renderShortcuts({ selectedIds: allSelected, setSelectedIds });
    fireEvent.keyDown(window, { key: "a", ctrlKey: true });
    const updater = setSelectedIds.mock.calls[0][0] as (prev: Set<string>) => Set<string>;
    expect(Array.from(updater(allSelected))).toEqual([]);
  });

  it("Ctrl+C con selezione popola la clipboard con isCut: false", () => {
    const { options } = renderShortcuts({ selectedIds: new Set(["a"]) });
    fireEvent.keyDown(window, { key: "c", ctrlKey: true });
    expect(options.setClipboard).toHaveBeenCalledWith({
      blocks: [expect.objectContaining({ id: "a" })],
      isCut: false,
    });
  });

  it("Ctrl+X con selezione popola la clipboard con isCut: true e rimuove i blocchi", () => {
    const { options } = renderShortcuts({ selectedIds: new Set(["a"]) });
    fireEvent.keyDown(window, { key: "x", ctrlKey: true });
    expect(options.setClipboard).toHaveBeenCalledWith({
      blocks: [expect.objectContaining({ id: "a" })],
      isCut: true,
    });
    expect(options.removeBlock).toHaveBeenCalledWith("a");
  });

  it("Ctrl+V con una clipboard non vuota chiama pushSettings per incollare", () => {
    const clipboard = { blocks: [makeBlocco({ id: "a" })], isCut: false };
    const { options } = renderShortcuts({ clipboard });
    fireEvent.keyDown(window, { key: "v", ctrlKey: true });
    expect(options.pushSettings).toHaveBeenCalled();
    expect(options.setSelectedIds).toHaveBeenCalled();
  });

  it("Ctrl++ con il mouse sul canvas disattiva autoFit e aumenta lo zoom", () => {
    const isMouseOverCanvas = { current: true };
    const { options } = renderShortcuts({ isMouseOverCanvas });
    fireEvent.keyDown(window, { key: "+", ctrlKey: true });
    expect(options.setAutoFit).toHaveBeenCalledWith(false);
    expect(options.setZoom).toHaveBeenCalled();
  });

  it("i tasti non sono gestiti quando il focus è su un input, salvo lo zoom col mouse sul canvas", () => {
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();
    const { options } = renderShortcuts({ selectedIds: new Set(["a"]), isMouseOverCanvas: { current: false } });
    fireEvent.keyDown(input, { key: "Delete" });
    expect(options.removeBlock).not.toHaveBeenCalled();
  });
});
