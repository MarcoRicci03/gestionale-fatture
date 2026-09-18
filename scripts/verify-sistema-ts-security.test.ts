import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import ts from "typescript";
import { buildSistemaTsXml } from "@/lib/sistemats/xml-builder";
import { encryptCredential, decryptCredential } from "@/lib/sistemats/vault";
import type { SpesaSanitariaPayload } from "@/lib/sistemats/types";

const SISTEMA_TS_ACTIONS_PATH = join(__dirname, "..", "lib", "actions", "sistema-ts.ts");

export type ExportedActionInfo = {
  name: string;
  hasRequireUserId: boolean;
};

export type LogAuditViolation = {
  callIndex: number;
  reason: string;
  snippet: string;
};

/**
 * Analizza l'AST TypeScript di un file per individuare tutte le funzioni esportate
 * (dichiarazioni di funzione, arrow functions, function expressions ed export dichiarati)
 * e verificare in modo semanticamente solido che ciascuna invochi requireUserId().
 *
 * A differenza di parser a conteggio manuale di graffe o regex, questa implementazione:
 * 1. È completamente immune a graffe in stringhe, template literals e regex quantificate (es. {3}, {5,6}).
 * 2. Ignora i commenti: non è ingannata da `// await requireUserId()`.
 * 3. Ignora stringhe: non è ingannata da `console.log("await requireUserId()")`.
 */
export function analyzeExportedActions(sourceCode: string, fileName = "source.ts"): ExportedActionInfo[] {
  const sourceFile = ts.createSourceFile(fileName, sourceCode, ts.ScriptTarget.Latest, true);
  const actions: ExportedActionInfo[] = [];

  function checkNodeForRequireUserId(rootNode: ts.Node): boolean {
    let found = false;
    function visit(node: ts.Node) {
      if (found) return;
      if (ts.isCallExpression(node)) {
        const expr = node.expression;
        if (ts.isIdentifier(expr) && expr.text === "requireUserId") {
          found = true;
          return;
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(rootNode);
    return found;
  }

  function registerAction(name: string, fnNode: ts.Node) {
    actions.push({
      name,
      hasRequireUserId: checkNodeForRequireUserId(fnNode),
    });
  }

  for (const stmt of sourceFile.statements) {
    const modifiers = ts.canHaveModifiers(stmt) ? ts.getModifiers(stmt) : undefined;
    const isExported = modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);

    if (isExported) {
      if (ts.isFunctionDeclaration(stmt) && stmt.name) {
        registerAction(stmt.name.text, stmt);
      } else if (ts.isVariableStatement(stmt)) {
        for (const decl of stmt.declarationList.declarations) {
          if (
            decl.initializer &&
            (ts.isArrowFunction(decl.initializer) || ts.isFunctionExpression(decl.initializer))
          ) {
            registerAction(decl.name.getText(sourceFile), decl.initializer);
          }
        }
      }
    } else if (ts.isExportDeclaration(stmt) && stmt.exportClause && ts.isNamedExports(stmt.exportClause)) {
      for (const element of stmt.exportClause.elements) {
        const exportedName = element.name.text;
        const targetName = (element.propertyName ?? element.name).text;
        for (const innerStmt of sourceFile.statements) {
          if (ts.isFunctionDeclaration(innerStmt) && innerStmt.name?.text === targetName) {
            registerAction(exportedName, innerStmt);
          } else if (ts.isVariableStatement(innerStmt)) {
            for (const decl of innerStmt.declarationList.declarations) {
              if (
                decl.name.getText(sourceFile) === targetName &&
                decl.initializer &&
                (ts.isArrowFunction(decl.initializer) || ts.isFunctionExpression(decl.initializer))
              ) {
                registerAction(exportedName, decl.initializer);
              }
            }
          }
        }
      }
    }
  }

  return actions;
}

/**
 * Ispeziona le chiamate a logAudit() tramite l'AST TypeScript per verificare che non
 * vengano passate credenziali (password, pincode) o dati sanitari/anagrafici identificanti
 * di pazienti o paganti (Anti-PII).
 */
export function analyzeAuditLogAntiPii(sourceCode: string, fileName = "source.ts"): LogAuditViolation[] {
  const sourceFile = ts.createSourceFile(fileName, sourceCode, ts.ScriptTarget.Latest, true);
  const auditCalls: ts.CallExpression[] = [];

  function findLogAuditCalls(node: ts.Node) {
    if (ts.isCallExpression(node)) {
      const expr = node.expression;
      if (ts.isIdentifier(expr) && expr.text === "logAudit") {
        auditCalls.push(node);
      }
    }
    ts.forEachChild(node, findLogAuditCalls);
  }
  findLogAuditCalls(sourceFile);

  const BANNED_KEYWORDS = [
    "password",
    "pincode",
    "passwordencrypted",
    "pincodeencrypted",
    "cfcittadino",
    "nome",
    "cognome",
    "indirizzo",
    "telefono",
    "email",
  ];

  const violations: LogAuditViolation[] = [];

  auditCalls.forEach((call, index) => {
    function inspectNode(node: ts.Node) {
      if (ts.isPropertyAssignment(node)) {
        const propName = node.name.getText(sourceFile).toLowerCase();
        if (BANNED_KEYWORDS.includes(propName)) {
          violations.push({
            callIndex: index,
            reason: `Banned property name in logAudit: '${propName}'`,
            snippet: node.getText(sourceFile),
          });
        }
      } else if (ts.isPropertyAccessExpression(node)) {
        const access = node.getText(sourceFile).toLowerCase();
        for (const term of BANNED_KEYWORDS) {
          if (access.includes(term)) {
            violations.push({
              callIndex: index,
              reason: `Banned property access in logAudit: '${access}'`,
              snippet: node.getText(sourceFile),
            });
            break;
          }
        }
      }
      ts.forEachChild(node, inspectNode);
    }
    inspectNode(call);
  });

  return violations;
}

describe("Layer 3: Invarianti di Sicurezza, Anti-PII e Cifratura Sistema TS", () => {
  describe("Static Invariants: lib/actions/sistema-ts.ts (AST Parser)", () => {
    const source = readFileSync(SISTEMA_TS_ACTIONS_PATH, "utf-8");

    it("tutte le Server Action esportate richiamano requireUserId() tramite AST reale", () => {
      const actions = analyzeExportedActions(source, SISTEMA_TS_ACTIONS_PATH);

      expect(actions.length).toBeGreaterThan(0);

      // Ogni funzione esportata da lib/actions/sistema-ts.ts è un endpoint RPC:
      // deve verificare l'identità dell'utente autenticato prima di qualunque operazione
      for (const action of actions) {
        expect(
          action.hasRequireUserId,
          `Action ${action.name}() in lib/actions/sistema-ts.ts non invoca requireUserId() nell'AST`
        ).toBe(true);
      }
    });

    it("nessun log di audit registra credenziali in chiaro (password/pincode) o PII assistiti nell'AST", () => {
      const violations = analyzeAuditLogAntiPii(source, SISTEMA_TS_ACTIONS_PATH);
      expect(violations).toEqual([]);
    });
  });

  describe("Metatest & Robustezza del Verificatore AST (L3 Regression)", () => {
    it("intercetta e rifiuta una Server Action con requireUserId() commentato", () => {
      const fakeSource = `
        "use server";
        export async function vulnerableAction() {
          // await requireUserId();
          return doSensitiveWork();
        }
      `;
      const actions = analyzeExportedActions(fakeSource);
      expect(actions).toHaveLength(1);
      expect(actions[0].name).toBe("vulnerableAction");
      expect(actions[0].hasRequireUserId).toBe(false);
    });

    it("intercetta e rifiuta una Server Action con requireUserId() solo in una stringa", () => {
      const fakeSource = `
        "use server";
        export async function fakeStringAction() {
          console.log("await requireUserId() bypass");
          return doSensitiveWork();
        }
      `;
      const actions = analyzeExportedActions(fakeSource);
      expect(actions).toHaveLength(1);
      expect(actions[0].name).toBe("fakeStringAction");
      expect(actions[0].hasRequireUserId).toBe(false);
    });

    it("riconosce correttamente requireUserId() in funzioni con regex quantificate {3}, template literals e graffe in commenti", () => {
      const fakeSource = `
        "use server";
        export async function complexAction() {
          const regex = /^[A-Z0-9]{3}$/; // graffa nel pattern
          const msg = \`test \${1 + 1} {curly}\`;
          /* commento con graffe { open } */
          const userId = await requireUserId();
          return { ok: true, userId };
        }
      `;
      const actions = analyzeExportedActions(fakeSource);
      expect(actions).toHaveLength(1);
      expect(actions[0].name).toBe("complexAction");
      expect(actions[0].hasRequireUserId).toBe(true);
    });

    it("analizza correttamente anche le arrow functions esportate (export const action = async () => ...)", () => {
      const fakeSource = `
        "use server";
        export const arrowAction = async () => {
          const uid = await requireUserId();
          return uid;
        };
        export const insecureArrow = async () => {
          return "unprotected";
        };
      `;
      const actions = analyzeExportedActions(fakeSource);
      expect(actions).toHaveLength(2);
      expect(actions.find((a) => a.name === "arrowAction")?.hasRequireUserId).toBe(true);
      expect(actions.find((a) => a.name === "insecureArrow")?.hasRequireUserId).toBe(false);
    });

    it("rileva violazioni PII nelle chiamate logAudit() artificiali", () => {
      const fakeSource = `
        await logAudit({
          azione: "TEST",
          meta: {
            cfCittadino: "RSSMRA85M01H501Q",
            password: "plain_password"
          }
        });
      `;
      const violations = analyzeAuditLogAntiPii(fakeSource);
      expect(violations.length).toBeGreaterThan(0);
      expect(violations.some((v) => v.reason.includes("cfcittadino"))).toBe(true);
      expect(violations.some((v) => v.reason.includes("password"))).toBe(true);
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
