// components/settings/use-pdf-layout-history.test.ts
import { describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePdfLayoutHistory } from "./use-pdf-layout-history";
import type { ImpostazioniPdf } from "@/lib/pdf/types";

function makeSettings(overrides: Partial<ImpostazioniPdf> = {}): ImpostazioniPdf {
  return {
    id: 1,
    id_Utente: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    pageWidth: 595,
    pageHeight: 842,
    marginTop: 40,
    marginRight: 40,
    marginBottom: 40,
    marginLeft: 40,
    fontFamily: "Helvetica",
    fontSizeBase: 11,
    blocchi: [],
    ...overrides,
  };
}

describe("usePdfLayoutHistory", () => {
  it("parte con lo stato iniziale, senza undo/redo disponibili", () => {
    const initial = makeSettings();
    const { result } = renderHook(() => usePdfLayoutHistory({ initialSettings: initial }));
    expect(result.current.settings).toBe(initial);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it("pushSettings aggiunge una nuova voce e abilita canUndo", () => {
    const initial = makeSettings();
    const { result } = renderHook(() => usePdfLayoutHistory({ initialSettings: initial }));
    const next = makeSettings({ fontSizeBase: 14 });
    act(() => result.current.pushSettings(next));
    expect(result.current.settings).toBe(next);
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);
  });

  it("pushSettings con un updater riceve lo stato corrente", () => {
    const initial = makeSettings({ fontSizeBase: 11 });
    const { result } = renderHook(() => usePdfLayoutHistory({ initialSettings: initial }));
    act(() => result.current.pushSettings((prev) => ({ ...prev, fontSizeBase: prev.fontSizeBase + 1 })));
    expect(result.current.settings.fontSizeBase).toBe(12);
  });

  it("pushSettings con un valore identico (===) non crea una nuova voce di history", () => {
    const initial = makeSettings();
    const { result } = renderHook(() => usePdfLayoutHistory({ initialSettings: initial }));
    act(() => result.current.pushSettings(initial));
    expect(result.current.canUndo).toBe(false);
  });

  it("undo torna allo stato precedente e chiama onNavigate con quello stato", () => {
    const initial = makeSettings({ fontSizeBase: 11 });
    const second = makeSettings({ fontSizeBase: 14 });
    const onNavigate = vi.fn();
    const { result } = renderHook(() => usePdfLayoutHistory({ initialSettings: initial, onNavigate }));
    act(() => result.current.pushSettings(second));
    act(() => result.current.undo());
    expect(result.current.settings).toBe(initial);
    expect(result.current.canRedo).toBe(true);
    expect(onNavigate).toHaveBeenCalledWith(initial);
  });

  it("undo all'inizio della history è un no-op e non chiama onNavigate", () => {
    const initial = makeSettings();
    const onNavigate = vi.fn();
    const { result } = renderHook(() => usePdfLayoutHistory({ initialSettings: initial, onNavigate }));
    act(() => result.current.undo());
    expect(result.current.settings).toBe(initial);
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it("redo dopo undo ripristina lo stato successivo", () => {
    const initial = makeSettings({ fontSizeBase: 11 });
    const second = makeSettings({ fontSizeBase: 14 });
    const onNavigate = vi.fn();
    const { result } = renderHook(() => usePdfLayoutHistory({ initialSettings: initial, onNavigate }));
    act(() => result.current.pushSettings(second));
    act(() => result.current.undo());
    act(() => result.current.redo());
    expect(result.current.settings).toBe(second);
    expect(result.current.canRedo).toBe(false);
    expect(onNavigate).toHaveBeenLastCalledWith(second);
  });

  it("redo alla fine della history è un no-op", () => {
    const initial = makeSettings();
    const { result } = renderHook(() => usePdfLayoutHistory({ initialSettings: initial }));
    act(() => result.current.redo());
    expect(result.current.settings).toBe(initial);
  });

  it("la history è limitata a 50 voci: dopo 60 push, sono possibili solo 49 undo", () => {
    const initial = makeSettings();
    const { result } = renderHook(() => usePdfLayoutHistory({ initialSettings: initial }));
    for (let i = 0; i < 60; i++) {
      act(() => result.current.pushSettings(makeSettings({ fontSizeBase: i })));
    }
    let undoCount = 0;
    while (result.current.canUndo) {
      act(() => result.current.undo());
      undoCount++;
      if (undoCount > 100) break; // guardia anti-loop-infinito in caso di regressione
    }
    expect(undoCount).toBe(49);
  });
});
