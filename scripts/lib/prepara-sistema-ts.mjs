// Logica dello script una tantum scripts/prepara-sistema-ts.mjs, separata per
// poterla testare su un Postgres reale (scripts/db-integration/).
//
// Le migration del Sistema TS aggiungono alle fatture esistenti colonne con
// un valore predefinito uguale per tutte, sbagliato per i dati storici:
// - stato_ts = DA_INVIARE: le fatture già comunicate al Sistema TS per altre
//   vie (portale) comparirebbero tra quelle da inviare;
// - pagamento_tracciato = true anche per i pagamenti in contanti;
// - bollo = 0 anche quando il codice bollo è presente.
// Le tre correzioni seguono le stesse regole che l'app applica alle fatture
// nuove (createInvoice, lib/fiscal/bollo.ts). Sono idempotenti: un rilancio
// non trova più righe da correggere.

const IMPORTO_BOLLO = 2.0;

// "AAAA-MM-GG" -> primo istante del giorno successivo, in ora locale: le date
// fattura sono a mezzogiorno locale (lib/utils/date.ts), quindi "fino al
// giorno X incluso" è "data < giorno X+1 alle 00:00".
export function limiteEsclusivo(inviateFinoAl) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(inviateFinoAl ?? "");
  if (!match) return null;
  const [anno, mese, giorno] = match.slice(1).map(Number);
  const data = new Date(anno, mese - 1, giorno);
  if (data.getFullYear() !== anno || data.getMonth() !== mese - 1 || data.getDate() !== giorno) {
    return null;
  }
  return new Date(anno, mese - 1, giorno + 1);
}

export function filtriCorrezioni(limite) {
  return {
    // Stessa regola di createInvoice: tracciato se non è in contanti.
    contantiNonTracciati: { mod_pag: "CONTANTI", pagamento_tracciato: true },
    // Stessa regola di calcolaTotaliFattura: bollo applicato se c'è il codice.
    bolloDaImpostare: { bolloCodice: { not: null }, NOT: { bolloCodice: "" }, bollo: 0 },
    // Già comunicate al Sistema TS fuori dall'app: non vanno reinviate.
    giaInviate: { stato_ts: "DA_INVIARE", data: { lt: limite } },
  };
}

export async function preparaDatiSistemaTs(prisma, { limite, apply }) {
  const filtri = filtriCorrezioni(limite);
  const conteggi = {
    contantiNonTracciati: await prisma.pagamento.count({ where: filtri.contantiNonTracciati }),
    bolloDaImpostare: await prisma.pagamento.count({ where: filtri.bolloDaImpostare }),
    giaInviate: await prisma.pagamento.count({ where: filtri.giaInviate }),
  };

  if (apply) {
    await prisma.$transaction([
      prisma.pagamento.updateMany({
        where: filtri.contantiNonTracciati,
        data: { pagamento_tracciato: false },
      }),
      prisma.pagamento.updateMany({
        where: filtri.bolloDaImpostare,
        data: { bollo: IMPORTO_BOLLO },
      }),
      prisma.pagamento.updateMany({
        where: filtri.giaInviate,
        data: { stato_ts: "INVIATA" },
      }),
    ]);
  }

  return conteggi;
}
