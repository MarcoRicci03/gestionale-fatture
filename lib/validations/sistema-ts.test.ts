import { describe, it, expect } from "vitest";
import { sistemaTsSettingsSchema } from "./sistema-ts";

describe("sistemaTsSettingsSchema validation", () => {
  const baseValidInput = {
    username: "RSSMRA80A01H501Z",
    password: "Password123!",
    pincode: "PIN12345",
    codiceRegione: "080",
    codiceAsl: "105",
    codiceStruttura: "SSA001",
    naturaIvaDefault: "N2.2" as const,
  };

  describe("codiceRegione", () => {
    it("accetta un codice regione valido di 3 caratteri alfanumerici", () => {
      const result = sistemaTsSettingsSchema.safeParse({
        ...baseValidInput,
        codiceRegione: "030",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.codiceRegione).toBe("030");
      }
    });

    it("converte automaticamente in maiuscolo e rimuove gli spazi", () => {
      const result = sistemaTsSettingsSchema.safeParse({
        ...baseValidInput,
        codiceRegione: " 08a ",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.codiceRegione).toBe("08A");
      }
    });

    it("imposta il default '000' se vuoto, non definito, null o solo spazi", () => {
      for (const val of ["", "   ", null, undefined]) {
        const result = sistemaTsSettingsSchema.safeParse({
          ...baseValidInput,
          codiceRegione: val,
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.codiceRegione).toBe("000");
        }
      }
    });

    it("rifiuta codici con lunghezza inferiore a 3 caratteri", () => {
      for (const val of ["1", "08", "AB"]) {
        const result = sistemaTsSettingsSchema.safeParse({
          ...baseValidInput,
          codiceRegione: val,
        });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toContain(
            "Il codice regione deve essere composto da 3 caratteri alfanumerici"
          );
        }
      }
    });

    it("rifiuta codici con lunghezza superiore a 3 caratteri", () => {
      const result = sistemaTsSettingsSchema.safeParse({
        ...baseValidInput,
        codiceRegione: "0800",
      });
      expect(result.success).toBe(false);
    });

    it("rifiuta codici con caratteri speciali o punteggiatura", () => {
      for (const val of ["0-8", "0 8", "08.", "08_"]) {
        const result = sistemaTsSettingsSchema.safeParse({
          ...baseValidInput,
          codiceRegione: val,
        });
        expect(result.success).toBe(false);
      }
    });
  });

  describe("codiceAsl", () => {
    it("accetta un codice ASL valido di 3 caratteri alfanumerici", () => {
      const result = sistemaTsSettingsSchema.safeParse({
        ...baseValidInput,
        codiceAsl: "101",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.codiceAsl).toBe("101");
      }
    });

    it("converte automaticamente in maiuscolo e rimuove gli spazi", () => {
      const result = sistemaTsSettingsSchema.safeParse({
        ...baseValidInput,
        codiceAsl: " 01b ",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.codiceAsl).toBe("01B");
      }
    });

    it("imposta il default '000' se vuoto, non definito, null o solo spazi", () => {
      for (const val of ["", "   ", null, undefined]) {
        const result = sistemaTsSettingsSchema.safeParse({
          ...baseValidInput,
          codiceAsl: val,
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.codiceAsl).toBe("000");
        }
      }
    });

    it("rifiuta codici ASL con lunghezza != 3 o caratteri non validi", () => {
      for (const val of ["1", "10", "1010", "1_1", "10-"]) {
        const result = sistemaTsSettingsSchema.safeParse({
          ...baseValidInput,
          codiceAsl: val,
        });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toContain(
            "Il codice ASL deve essere composto da 3 caratteri alfanumerici"
          );
        }
      }
    });
  });

  describe("codiceStruttura (SSA)", () => {
    it("accetta un codice struttura SSA valido di 5 caratteri alfanumerici", () => {
      const result = sistemaTsSettingsSchema.safeParse({
        ...baseValidInput,
        codiceStruttura: "12345",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.codiceStruttura).toBe("12345");
      }
    });

    it("accetta un codice struttura SSA valido di 6 caratteri alfanumerici", () => {
      const result = sistemaTsSettingsSchema.safeParse({
        ...baseValidInput,
        codiceStruttura: "SSA001",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.codiceStruttura).toBe("SSA001");
      }
    });

    it("converte automaticamente in maiuscolo e rimuove gli spazi", () => {
      const result = sistemaTsSettingsSchema.safeParse({
        ...baseValidInput,
        codiceStruttura: "  ssa01  ",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.codiceStruttura).toBe("SSA01");
      }
    });

    it("imposta a null se vuoto, non fornito o soli spazi", () => {
      for (const val of ["", "   ", null, undefined]) {
        const result = sistemaTsSettingsSchema.safeParse({
          ...baseValidInput,
          codiceStruttura: val,
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.codiceStruttura).toBeNull();
        }
      }
    });

    it("rifiuta codici con lunghezza inferiore a 5 caratteri", () => {
      for (const val of ["1", "12", "123", "1234", "SSA1"]) {
        const result = sistemaTsSettingsSchema.safeParse({
          ...baseValidInput,
          codiceStruttura: val,
        });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toContain(
            "Il codice struttura (SSA) deve contenere 5 o 6 caratteri alfanumerici"
          );
        }
      }
    });

    it("rifiuta codici con lunghezza superiore a 6 caratteri", () => {
      for (const val of ["1234567", "STRUTT_A", "CLINICAPODOLOGICA"]) {
        const result = sistemaTsSettingsSchema.safeParse({
          ...baseValidInput,
          codiceStruttura: val,
        });
        expect(result.success).toBe(false);
      }
    });

    it("rifiuta codici con caratteri speciali (es. underscore, trattini)", () => {
      for (const val of ["SSA_01", "SSA-01", "1234.5"]) {
        const result = sistemaTsSettingsSchema.safeParse({
          ...baseValidInput,
          codiceStruttura: val,
        });
        expect(result.success).toBe(false);
      }
    });
  });

  describe("altri campi delle impostazioni", () => {
    it("richiede obbligatoriamente username", () => {
      const result = sistemaTsSettingsSchema.safeParse({
        ...baseValidInput,
        username: "",
      });
      expect(result.success).toBe(false);
    });

    it("applica il default 'N2.2' per naturaIvaDefault se non specificata", () => {
      const { naturaIvaDefault: _, ...withoutNatura } = baseValidInput;
      const result = sistemaTsSettingsSchema.safeParse(withoutNatura);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.naturaIvaDefault).toBe("N2.2");
      }
    });

    it("accetta 'N4' per naturaIvaDefault", () => {
      const result = sistemaTsSettingsSchema.safeParse({
        ...baseValidInput,
        naturaIvaDefault: "N4",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.naturaIvaDefault).toBe("N4");
      }
    });
  });
});
