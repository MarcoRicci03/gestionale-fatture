import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { buildSistemaTsXml } from "@/lib/sistemats/xml-builder";
import { encryptCredential, decryptCredential } from "@/lib/sistemats/vault";
import type { SpesaSanitariaPayload } from "@/lib/sistemats/types";

const SISTEMA_TS_ACTIONS_PATH = join(__dirname, "..", "lib", "actions", "sistema-ts.ts");

describe("Layer 3: Invarianti di Sicurezza, Anti-PII e Cifratura Sistema TS", () => {
  describe("Static Invariants: lib/actions/sistema-ts.ts", () => {
    const source = readFileSync(SISTEMA_TS_ACTIONS_PATH, "utf-8");

    it("tutte le Server Action esportate richiamano requireUserId()", () => {
      const exportedFns: string[] = [];
      const fnRegex = /export\s+async\s+function\s+(\w+)\s*\(/g;
      let match: RegExpExecArray | null;

      while ((match = fnRegex.exec(source)) !== null) {
        exportedFns.push(match[1]);
      }

      expect(exportedFns.length).toBeGreaterThan(0);

      // Per ogni funzione esportata verifichiamo che il corpo contenga requireUserId
      for (const fnName of exportedFns) {
        const fnIndex = source.indexOf(`export async function ${fnName}`);
        const openBrace = source.indexOf("{", fnIndex);
        let depth = 0;
        let body = "";
        for (let i = openBrace; i < source.length; i++) {
          if (source[i] === "{") depth++;
          else if (source[i] === "}") {
            depth--;
            if (depth === 0) {
              body = source.slice(openBrace, i + 1);
              break;
            }
          }
        }

        expect(
          body.includes("await requireUserId()"),
          `Action ${fnName}() in lib/actions/sistema-ts.ts deve invocare requireUserId() per bloccare accessi non autenticati`
        ).toBe(true);
      }
    });

    it("nessun log di audit registra credenziali in chiaro (password/pincode) o PII assistiti", () => {
      // Estrae tutti i blocchi details / meta di logAudit in sistema-ts.ts
      const logAuditRegex = /await\s+logAudit\(\s*\{[\s\S]*?\}\s*\);/g;
      const auditCalls = source.match(logAuditRegex) || [];

      expect(auditCalls.length).toBeGreaterThan(0);

      const BANNED_AUDIT_TERMS = [
        "data.password",
        "data.pincode",
        "passwordEncrypted",
        "pincodeEncrypted",
        "cfCittadino",
        "paziente.nome",
        "paziente.cognome",
        "pagante.nome",
        "pagante.cognome",
      ];

      for (const call of auditCalls) {
        for (const term of BANNED_AUDIT_TERMS) {
          expect(
            call.includes(term),
            `Violazione Anti-PII/Credenziali in logAudit: trovato '${term}' in: \n${call}`
          ).toBe(false);
        }
      }
    });
  });

  describe("Enforcement Chiave di Cifratura in Produzione (vault.ts)", () => {
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it("blocca l'esecuzione se TS_ENCRYPTION_SECRET è mancante in produzione", () => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("TS_ENCRYPTION_SECRET", "");

      expect(() => {
        encryptCredential("secret_password");
      }).toThrow(/TS_ENCRYPTION_SECRET non è definita in ambiente di produzione/i);
    });

    it("blocca l'esecuzione se TS_ENCRYPTION_SECRET è un segnaposto noto", () => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("TS_ENCRYPTION_SECRET", "change-me");

      expect(() => {
        encryptCredential("secret_password");
      }).toThrow(/usa un valore segnaposto noto/i);
    });

    it("blocca l'esecuzione se TS_ENCRYPTION_SECRET è inferiore a 32 byte", () => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("TS_ENCRYPTION_SECRET", "short-secret-less-than-32-chars");

      expect(() => {
        encryptCredential("secret_password");
      }).toThrow(/troppo corta/i);
    });

    it("cifra e decifra correttamente con AES-256-GCM quando la chiave di produzione è valida", () => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("TS_ENCRYPTION_SECRET", "ultra-secure-random-key-with-at-least-32-bytes-length!!");

      const plain = "MinisteroTS_P@ssw0rd_2026!";
      const encrypted = encryptCredential(plain);

      expect(encrypted).not.toBe(plain);
      expect(encrypted.split(":")).toHaveLength(3); // iv:authTag:ciphertext

      const decrypted = decryptCredential(encrypted);
      expect(decrypted).toBe(plain);
    });
  });

  describe("Sanitizzazione XML & Protezione Injection (xml-builder.ts)", () => {
    it("esegue l'escape di caratteri speciali XML (<, >, &, \", ') prevenendo manipolazioni del payload", () => {
      const maliciousPayload: SpesaSanitariaPayload = {
        proprietario: {
          cfProprietario: "RSSMRA85M01H501Q",
          codiceRegione: '080"><injected>true</injected>',
          codiceAsl: "105&foo",
          codiceStruttura: "STRUTT'URA",
        },
        documenti: [
          {
            idSpesa: {
              pIva: '01234567890" malicious="attr',
              dataEmissione: new Date("2026-03-15"),
              numDocumento: '<alert>10/B</alert>&test="val"',
              dispositivo: 1,
            },
            dataPagamento: new Date("2026-03-15"),
            flagOperazione: "I",
            cfCittadino: "",
            pagamentoTracciato: "SI",
            tipoDocumento: "F",
            flagOpposizione: 1,
            vociSpesa: [
              {
                tipoSpesa: "SP",
                importo: 100,
                naturaIva: 'N2.2<evilTag>test</evilTag>&"quote"',
              },
            ],
          },
        ],
      };

      const xml = buildSistemaTsXml(maliciousPayload);

      // Verifica che nessun tag malevolo non escapato sia presente nell'XML
      expect(xml).not.toContain("<injected>");
      expect(xml).not.toContain("<alert>");
      expect(xml).not.toContain("<evilTag>");

      // Verifica l'effettivo escaping XML
      expect(xml).toContain("&lt;injected&gt;true&lt;/injected&gt;");
      expect(xml).toContain("105&amp;foo");
      expect(xml).toContain("STRUTT&apos;URA");
      expect(xml).toContain("01234567890&quot; malicious=&quot;attr");
      expect(xml).toContain("&lt;alert&gt;10/B&lt;/alert&gt;&amp;test=&quot;val&quot;");
      expect(xml).toContain("N2.2&lt;evilTag&gt;test&lt;/evilTag&gt;&amp;&quot;quote&quot;");
    });
  });
});
