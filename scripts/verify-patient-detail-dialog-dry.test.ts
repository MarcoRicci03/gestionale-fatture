import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

// DRY-06: Verifica statica della modularizzazione e riutilizzo
// del modale Dettagli Paziente in patients-manager.tsx.

const PATIENTS_MANAGER_PATH = join(
  __dirname,
  "..",
  "components",
  "patients",
  "patients-manager.tsx"
);
const PATIENT_DIALOG_PATH = join(
  __dirname,
  "..",
  "components",
  "patients",
  "patient-detail-dialog.tsx"
);
const INVOICES_PATIENT_DIALOG_PATH = join(
  __dirname,
  "..",
  "components",
  "invoices",
  "patient-detail-dialog.tsx"
);

describe("DRY-06: Analisi statica su PatientDetailDialog", () => {
  it("il modulo autonomo components/patients/patient-detail-dialog.tsx esiste ed esporta PatientDetailDialog", () => {
    expect(existsSync(PATIENT_DIALOG_PATH)).toBe(true);
    const source = readFileSync(PATIENT_DIALOG_PATH, "utf-8");
    expect(source).toMatch(/export\s+function\s+PatientDetailDialog\s*\(/);
    expect(source).toMatch(/export\s+type\s+PatientDetailDialogProps\s*=/);
  });

  it("patients-manager.tsx importa ed utilizza PatientDetailDialog", () => {
    const source = readFileSync(PATIENTS_MANAGER_PATH, "utf-8");
    expect(source).toMatch(/import\s+\{\s*PatientDetailDialog\s*\}\s+from\s+["']\.\/patient-detail-dialog["']/);
    expect(source).toMatch(/<PatientDetailDialog/);
  });

  it("patients-manager.tsx non contiene più la definizione inline del dialog Dettagli Paziente", () => {
    const source = readFileSync(PATIENTS_MANAGER_PATH, "utf-8");
    expect(source).not.toContain("<DialogTitle>Dettagli Paziente</DialogTitle>");
  });

  it("components/invoices/patient-detail-dialog.tsx re-esporta il componente per retrocompatibilità", () => {
    const source = readFileSync(INVOICES_PATIENT_DIALOG_PATH, "utf-8");
    expect(source).toMatch(/export\s+\{\s*PatientDetailDialog/);
    expect(source).toContain("@/components/patients/patient-detail-dialog");
  });
});
