import { describe, expect, it } from "vitest";
import { getSogeiErrorHelper, SOGEI_ERROR_CATALOG } from "./error-catalog";

describe("lib/sistemats/error-catalog", () => {
  it("restituisce l'helper censito per codici noti (S017, S050, S003, S022, S004, W003)", () => {
    const s017 = getSogeiErrorHelper("S017");
    expect(s017.codice).toBe("S017");
    expect(s017.gravita).toBe("INFO");
    expect(s017.titolo).toContain("già presente");
    expect(s017.azioneConsigliata).toContain("non occorre reinviarla");

    const s050 = getSogeiErrorHelper("S050");
    expect(s050.codice).toBe("S050");
    expect(s050.gravita).toBe("ERRORE");
    expect(s050.titolo).toContain("Codice Fiscale formalmente errato");
    expect(s050.azioneConsigliata).toContain("CIN");

    const s003 = getSogeiErrorHelper("S003");
    expect(s003.codice).toBe("S003");
    expect(s003.gravita).toBe("ERRORE");
    expect(s003.azioneConsigliata).toContain("Opposizione del paziente");

    const s022 = getSogeiErrorHelper("S022");
    expect(s022.codice).toBe("S022");
    expect(s022.gravita).toBe("ERRORE");
    expect(s022.titolo).toContain("Pagamento anticipato");

    const s036 = getSogeiErrorHelper("S036");
    expect(s036.codice).toBe("S036");
    expect(s036.gravita).toBe("ERRORE");
    expect(s036.titolo).toContain("futura");
    expect(s036.azioneConsigliata).toContain("data di incasso sia trascorsa");

    const w003 = getSogeiErrorHelper("W003");
    expect(w003.codice).toBe("W003");
    expect(w003.gravita).toBe("WARNING");
    expect(w003.azioneConsigliata).toContain("Nessuna azione richiesta");
  });

  it("normalizza spazi e maiuscole/minuscole", () => {
    const helper = getSogeiErrorHelper("  s050  ");
    expect(helper.codice).toBe("S050");
    expect(helper.titolo).toBe(SOGEI_ERROR_CATALOG.S050.titolo);
  });

  it("restituisce un fallback appropriato per scarti con codici non censiti", () => {
    const fallback = getSogeiErrorHelper("S999", "Descrizione sconosciuta da Sogei", "ERRORE");
    expect(fallback.codice).toBe("S999");
    expect(fallback.gravita).toBe("ERRORE");
    expect(fallback.titolo).toBe("Scarto ministeriale [S999]");
    expect(fallback.significato).toBe("Descrizione sconosciuta da Sogei");
    expect(fallback.azioneConsigliata).toContain("Consulta la descrizione");
  });

  it("restituisce un fallback appropriato per warning con codici non censiti o prefisso W", () => {
    const fallback = getSogeiErrorHelper("W999", "Avviso sconosciuto da Sogei");
    expect(fallback.codice).toBe("W999");
    expect(fallback.gravita).toBe("WARNING");
    expect(fallback.titolo).toBe("Segnalazione ministeriale [W999]");
    expect(fallback.significato).toBe("Avviso sconosciuto da Sogei");
    expect(fallback.azioneConsigliata).toContain("La spesa è stata acquisita regolarmente");
  });

  it("gestisce codice nullo o vuoto con valori di default", () => {
    const errFallback = getSogeiErrorHelper(null, "Errore generico", "ERRORE");
    expect(errFallback.codice).toBe("ERRORE");
    expect(errFallback.gravita).toBe("ERRORE");

    const warnFallback = getSogeiErrorHelper("", null, "WARNING");
    expect(warnFallback.codice).toBe("AVVISO");
    expect(warnFallback.gravita).toBe("WARNING");
  });
});
