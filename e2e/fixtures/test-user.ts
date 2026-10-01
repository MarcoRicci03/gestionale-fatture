export type E2eUser = { username: string; password: string; isAdmin: boolean };

export const TEST_USER: E2eUser = { username: "e2e_test", password: "E2ePassw0rd!", isAdmin: false };
// Secondo utente, per verificare che un utente non veda i dati di un altro.
export const TEST_USER_B: E2eUser = { username: "e2e_test_b", password: "E2ePassw0rd!B", isAdmin: false };
export const TEST_ADMIN: E2eUser = { username: "e2e_admin", password: "E2eAdminPassw0rd!", isAdmin: true };

export const E2E_USERS = [TEST_USER, TEST_USER_B, TEST_ADMIN];
