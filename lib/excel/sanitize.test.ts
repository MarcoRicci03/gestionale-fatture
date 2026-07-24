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
});
