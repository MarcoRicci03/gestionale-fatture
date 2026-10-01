import { describe, it, expect } from "vitest";
import { sanitizeCellValue } from "./sanitize";

describe("sanitizeCellValue", () => {
  it("lascia invariata una stringa senza prefisso pericoloso", () => {
    expect(sanitizeCellValue("Mario Rossi")).toBe("Mario Rossi");
  });

  it("lascia invariata la stringa vuota", () => {
    expect(sanitizeCellValue("")).toBe("");
  });

  it.each(["=", "+", "-", "@", "\t", "\r"])(
    "antepone un apice se la stringa inizia con %j",
    (prefix) => {
      const input = `${prefix}cmd|'/c calc'!A1`;
      expect(sanitizeCellValue(input)).toBe(`'${input}`);
    }
  );

  it("non altera un prefisso pericoloso non in prima posizione", () => {
    expect(sanitizeCellValue("Note: =non pericoloso")).toBe(
      "Note: =non pericoloso"
    );
  });

  it("antepone un solo apice, non ripetuto, anche se il valore inizia già con un apice", () => {
    expect(sanitizeCellValue("'già testo")).toBe("'già testo");
  });

  it.each(["=", "+", "-", "@", "\t", "\r"])(
    "antepone un apice se la stringa inizia con spazi seguiti da %j (SEC-09)",
    (prefix) => {
      const input = `   ${prefix}cmd|'/c calc'!A1`;
      expect(sanitizeCellValue(input)).toBe(`'${input}`);
    }
  );

  it("lascia invariata una stringa di soli spazi", () => {
    expect(sanitizeCellValue("   ")).toBe("   ");
  });

  it("non antepone un doppio apice se dopo gli spazi c'è già un apice", () => {
    expect(sanitizeCellValue("   'già testo")).toBe("   'già testo");
  });

  it("lascia invariata una stringa con spazi iniziali ma senza caratteri pericolosi", () => {
    expect(sanitizeCellValue("   Mario Rossi")).toBe("   Mario Rossi");
  });

  it("antepone un apice se la stringa inizia con newline prima di una formula", () => {
    expect(sanitizeCellValue("\n=cmd|'/c calc'!A1")).toBe("'\n=cmd|'/c calc'!A1");
  });

  it("antepone un apice se la stringa ha tabulazioni e spazi misti prima di una formula", () => {
    expect(sanitizeCellValue(" \t =cmd|'/c calc'!A1")).toBe("' \t =cmd|'/c calc'!A1");
  });
});

