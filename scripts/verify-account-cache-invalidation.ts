import { readFileSync } from "fs";
import { join } from "path";

// Regressione LOG-10: updateProfile (lib/actions/account.ts) mutava
// Utente.nome/cognome/pIva/cf/via/citta/cap/provincia/titolo/specializzazione
// senza mai chiamare revalidatePath(), a differenza di tutte le altre action
// di mutazione del codebase. Questi campi sono renderizzati nella sidebar/
// header (Session in lib/auth/session.ts) e come "mittente" nell'anteprima
// PDF: potevano restare stantii nelle pagine già visitate. Verificato via
// analisi statica (stesso approccio di verify-audit-log-coverage.ts) che il
// corpo di updateProfile chiami sia revalidatePath("/account") sia
// revalidatePath("/", "layout") (quest'ultimo invalida l'intero albero
// condiviso, non solo /account).

const ACCOUNT_ACTIONS_PATH = join(__dirname, "..", "lib", "actions", "account.ts");

function extractFunctionBody(source: string, fnName: string): string {
  const fnRegex = new RegExp(`export\\s+async\\s+function\\s+${fnName}\\s*\\(`);
  const match = fnRegex.exec(source);
  if (!match) {
    throw new Error(`Funzione ${fnName} non trovata in ${ACCOUNT_ACTIONS_PATH}`);
  }
  const openBrace = source.indexOf("{", match.index);
  let depth = 0;
  for (let i = openBrace; i < source.length; i++) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}") {
      depth--;
      if (depth === 0) return source.slice(openBrace, i + 1);
    }
  }
  return source.slice(openBrace);
}

const source = readFileSync(ACCOUNT_ACTIONS_PATH, "utf-8");
const body = extractFunctionBody(source, "updateProfile");

const failures: string[] = [];

if (!body.includes('revalidatePath("/account")')) {
  failures.push('updateProfile deve chiamare revalidatePath("/account")');
}
if (!body.includes('revalidatePath("/", "layout")')) {
  failures.push(
    'updateProfile deve chiamare revalidatePath("/", "layout") per invalidare sidebar/header'
  );
}

if (failures.length > 0) {
  console.error("verify-account-cache-invalidation: FALLITO");
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

console.log("updateProfile invalida correttamente la cache di /account e del layout condiviso.");
