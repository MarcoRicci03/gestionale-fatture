// Elenco chiuso delle azioni auditate (SEC-15 in SECURITY_AUDIT.md). Stringa
// libera, non un enum Prisma: l'elenco crescerà con le feature future e un
// enum richiederebbe una migration per ogni nuova voce. La validità è
// garantita lato TypeScript da questo union type e da
// scripts/verify-audit-log-coverage.ts (verifica che ogni Server Action
// mutante chiami logAudit, non il valore esatto passato).
export const AUDIT_ACTIONS = {
  AUTH_LOGIN_SUCCESS: "auth.login_success",
  AUTH_LOGIN_FAILURE: "auth.login_failure",
  AUTH_LOGOUT: "auth.logout",
  ACCOUNT_PASSWORD_CHANGE: "account.password_change",
  ACCOUNT_PROFILE_UPDATE: "account.profile_update",
  USER_CREATE: "user.create",
  USER_UPDATE: "user.update",
  USER_PASSWORD_RESET: "user.password_reset",
  USER_ENABLE: "user.enable",
  USER_DISABLE: "user.disable",
  INVOICE_CREATE: "invoice.create",
  INVOICE_UPDATE: "invoice.update",
  INVOICE_DELETE: "invoice.delete",
  PATIENT_CREATE: "patient.create",
  PATIENT_UPDATE: "patient.update",
  PATIENT_DELETE: "patient.delete",
  PAYER_CREATE: "payer.create",
  PAYER_UPDATE: "payer.update",
  PAYER_DELETE: "payer.delete",
  PDF_SETTINGS_UPDATE: "pdf_settings.update",
  PDF_SETTINGS_REFRESH_LAYOUT: "pdf_settings.refresh_layout",
  INVOICE_EXPORT: "invoice.export",
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

// Etichette italiane usate solo dalla UI di consultazione (/audit-log).
export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  [AUDIT_ACTIONS.AUTH_LOGIN_SUCCESS]: "Login riuscito",
  [AUDIT_ACTIONS.AUTH_LOGIN_FAILURE]: "Login fallito",
  [AUDIT_ACTIONS.AUTH_LOGOUT]: "Logout",
  [AUDIT_ACTIONS.ACCOUNT_PASSWORD_CHANGE]: "Cambio password",
  [AUDIT_ACTIONS.ACCOUNT_PROFILE_UPDATE]: "Aggiornamento profilo",
  [AUDIT_ACTIONS.USER_CREATE]: "Creazione utente",
  [AUDIT_ACTIONS.USER_UPDATE]: "Modifica utente",
  [AUDIT_ACTIONS.USER_PASSWORD_RESET]: "Reset password (admin)",
  [AUDIT_ACTIONS.USER_ENABLE]: "Abilitazione utente",
  [AUDIT_ACTIONS.USER_DISABLE]: "Disabilitazione utente",
  [AUDIT_ACTIONS.INVOICE_CREATE]: "Creazione fattura",
  [AUDIT_ACTIONS.INVOICE_UPDATE]: "Modifica fattura",
  [AUDIT_ACTIONS.INVOICE_DELETE]: "Eliminazione fattura",
  [AUDIT_ACTIONS.PATIENT_CREATE]: "Creazione paziente",
  [AUDIT_ACTIONS.PATIENT_UPDATE]: "Modifica paziente",
  [AUDIT_ACTIONS.PATIENT_DELETE]: "Eliminazione paziente",
  [AUDIT_ACTIONS.PAYER_CREATE]: "Creazione pagante",
  [AUDIT_ACTIONS.PAYER_UPDATE]: "Modifica pagante",
  [AUDIT_ACTIONS.PAYER_DELETE]: "Eliminazione pagante",
  [AUDIT_ACTIONS.PDF_SETTINGS_UPDATE]: "Aggiornamento template PDF",
  [AUDIT_ACTIONS.PDF_SETTINGS_REFRESH_LAYOUT]: "Riallineamento layout PDF fattura",
  [AUDIT_ACTIONS.INVOICE_EXPORT]: "Esportazione fatture in Excel",
};
