import { it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

// Regressione SEC-12: proxy.ts protegge tutte le route GET tranne quelle in
// allowlist (login, api, asset Next.js, favicon, robots.txt), tramite un
// negative lookahead nel matcher. Senza ancorare il lookahead a un confine di
// segmento (/ o fine stringa), qualunque percorso che INIZIA con una di
// quelle stringhe (es. "/loginhelp", "/api-docs") sfuggirebbe al controllo di
// sessione pur non essendo affatto la route pensata come pubblica.
//
// Il matcher è compilato da Next.js con path-to-regexp più wrapping interno
// (suffissi per le route dati/RSC, prefisso locale, basePath — nessuno
// rilevante per questa app, che non usa i18n né basePath). Replicare quella
// pipeline userebbe API interne di Next non pubbliche e fragili tra
// versioni. Questo test verifica invece direttamente, come RegExp standard,
// la stringa del matcher così com'è scritta in proxy.ts: è sufficiente a
// verificare la proprietà che conta qui — quali percorsi restano esclusi dal
// controllo di sessione e con quale confine — indipendentemente dal wrapping
// esterno che Next aggiunge.
const PROXY_PATH = join(__dirname, "..", "proxy.ts");

function extractMatcherSource(): string {
  const source = readFileSync(PROXY_PATH, "utf-8");
  const match = source.match(/matcher:\s*\[\s*"([^"]+)"/);
  if (!match) {
    throw new Error(`Impossibile individuare "matcher" in ${PROXY_PATH}`);
  }
  // La stringa nel sorgente TS ha "\\." per rappresentare un punto letterale
  // in una stringa JS: va "un-escapata" un livello per ottenere il pattern
  // regex vero e proprio (stesso valore che riceve new RegExp(...) a runtime).
  return match[1].replace(/\\\\/g, "\\");
}

// Ancorato all'inizio: senza "^", RegExp.test() cerca un match in QUALSIASI
// posizione della stringa, non solo dall'inizio del pathname — per un
// pathname come "/api/invoices/1/pdf" troverebbe (erroneamente per questo
// test) un match a partire dal secondo "/", saltando la porzione "/api" che
// invece deve determinare l'esclusione. Un vero path matcher (incluso quello
// compilato da Next.js da questo stesso matcher) valuta sempre a partire
// dall'inizio del pathname.
const regex = new RegExp(`^${extractMatcherSource()}`);

it.each([
  ["/login", false, "pagina di login, deve restare pubblica"],
  ["/api/invoices/1/pdf", false, "route API, si autentica da sola"],
  ["/_next/static/chunk.js", false, "asset statico Next.js"],
  ["/_next/image", false, "endpoint di ottimizzazione immagini Next.js"],
  ["/favicon.ico", false, "favicon"],
  ["/robots.txt", false, "robots.txt"],
  ["/dashboard", true, "pagina applicativa normale"],
  ["/", true, "root, redirige a /login o /dashboard mantenendo il controllo"],
  // Regressione SEC-12: un percorso che INIZIA con una voce dell'allowlist ma
  // non è quella route deve restare protetto, non sfuggire al proxy per un
  // matching di solo prefisso.
  ["/loginhelp", true, 'non è "/login": il prefisso da solo non basta a escluderlo'],
  ["/api-docs", true, 'non è sotto "/api/": il prefisso da solo non basta a escluderlo'],
  ["/_next/staticfoo", true, 'non è sotto "/_next/static/": confine di segmento richiesto'],
  ["/_next/imagefoo", true, 'non è "/_next/image": confine di segmento richiesto'],
  // Regressione sull'escaping del punto letterale in "favicon.ico"/"robots.txt":
  // un "." non escapato in regex è un wildcard che matcherebbe qualunque carattere.
  [
    "/faviconXico",
    true,
    '"." in "favicon.ico" deve essere letterale, non un wildcard per qualunque carattere',
  ],
] as const)("%s -> protetto=%s (%s)", (path, expectedProtected, reason) => {
  expect(regex.test(path), reason).toBe(expectedProtected);
});
