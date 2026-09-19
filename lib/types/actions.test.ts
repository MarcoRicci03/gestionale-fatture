import { describe, it, expect } from "vitest";
import { actionSuccess, actionFailure, type ActionResult } from "./actions";

describe("lib/types/actions (ARCH-03)", () => {
  it("crea un ActionSuccess senza dati", () => {
    const res = actionSuccess();
    expect(res).toEqual({ success: true, message: undefined });
    expect(res.success).toBe(true);
  });

  it("crea un ActionSuccess con messaggio opzionale", () => {
    const res = actionSuccess(undefined, "Operazione completata");
    expect(res.success).toBe(true);
    expect(res.message).toBe("Operazione completata");
  });

  it("crea un ActionSuccess con dati e messaggio", () => {
    const res = actionSuccess({ id: 123 }, "Creato");
    expect(res.success).toBe(true);
    expect(res.data).toEqual({ id: 123 });
    expect(res.message).toBe("Creato");
  });

  it("crea un ActionFailure con messaggio di errore", () => {
    const res = actionFailure("Qualcosa è andato storto");
    expect(res).toEqual({
      success: false,
      error: "Qualcosa è andato storto",
      fieldErrors: undefined,
    });
    expect(res.success).toBe(false);
  });

  it("crea un ActionFailure con fieldErrors", () => {
    const res = actionFailure("Validazione fallita", {
      email: ["Email non valida"],
    });
    expect(res.success).toBe(false);
    expect(res.error).toBe("Validazione fallita");
    expect(res.fieldErrors).toEqual({ email: ["Email non valida"] });
  });

  it("garantisce la discriminated union corretta su ActionResult", () => {
    function processResult(result: ActionResult<{ count: number }>): string {
      if (result.success) {
        return `Successo con count: ${result.data.count}`;
      } else {
        return `Errore: ${result.error}`;
      }
    }

    expect(processResult(actionSuccess({ count: 5 }))).toBe(
      "Successo con count: 5"
    );
    expect(processResult(actionFailure("DB down"))).toBe("Errore: DB down");
  });
});
