import type { InvoiceWithRelations } from "./types";

export type PlaceholderContext = {
  invoice: InvoiceWithRelations;
};

function formatCurrency(amount: number): string {
  return amount.toLocaleString("it-IT", {
    style: "currency",
    currency: "EUR",
  });
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function resolvePlaceholders(
  template: string,
  invoice: InvoiceWithRelations
): string {
  const u = invoice.utente;
  const p = invoice.pagante;
  const z = invoice.paziente;

  const replacements: Record<string, string> = {
    // Mittente
    "{{mittente.nome}}": u.nome ?? "",
    "{{mittente.cognome}}": u.cognome ?? "",
    "{{mittente.nomeCognome}}": [u.nome, u.cognome].filter(Boolean).join(" "),
    "{{mittente.titolo}}": u.titolo ?? "",
    "{{mittente.specializzazione}}": u.specializzazione ?? "",
    "{{mittente.titoloNomeCognomeSpec}}": [
      u.titolo,
      u.nome,
      u.cognome,
      u.specializzazione ? `– ${u.specializzazione}` : "",
    ]
      .filter(Boolean)
      .join(" ")
      .trim(),
    "{{mittente.pIva}}": u.pIva ?? "",
    "{{mittente.cf}}": u.cf ?? "",
    "{{mittente.via}}": u.via ?? "",
    "{{mittente.cap}}": u.cap ?? "",
    "{{mittente.citta}}": u.citta ?? "",
    "{{mittente.provincia}}": u.provincia ?? "",
    "{{mittente.cittaProvincia}}": [
      u.citta,
      u.provincia ? `(${u.provincia})` : "",
    ]
      .filter(Boolean)
      .join(" ")
      .trim(),
    "{{mittente.capCittaProvincia}}": [
      u.cap,
      u.citta,
      u.provincia ? `(${u.provincia})` : "",
    ]
      .filter(Boolean)
      .join(" ")
      .trim(),

    // Intestatario / pagante
    "{{intestatario.nome}}": p.nome,
    "{{intestatario.cognome}}": p.cognome,
    "{{intestatario.cognomeNome}}": `${p.cognome} ${p.nome}`,
    "{{intestatario.nomeCognome}}": `${p.nome} ${p.cognome}`,
    "{{intestatario.via}}": p.via,
    "{{intestatario.citta}}": p.citta,
    "{{intestatario.cap}}": p.cap,
    "{{intestatario.capCitta}}": [p.cap, p.citta].filter(Boolean).join(" "),
    "{{intestatario.cf}}": p.cf ?? "",
    "{{intestatario.piva}}": p.piva ?? "",
    "{{intestatario.cfOppurePiva}}":
      p.cf && p.cf.trim() !== ""
        ? `CF: ${p.cf}`
        : p.piva && p.piva.trim() !== ""
          ? `P.IVA: ${p.piva}`
          : "",

    // Paziente
    "{{paziente.nome}}": z.nome,
    "{{paziente.cognome}}": z.cognome,
    "{{paziente.cognomeNome}}": `${z.cognome} ${z.nome}`,
    "{{paziente.nomeCognome}}": `${z.nome} ${z.cognome}`,

    // Fattura
    "{{fattura.numero}}": String(invoice.n_fattura),
    "{{fattura.data}}": formatDate(invoice.data),
    "{{fattura.prezzoTotale}}": formatCurrency(invoice.prezzo_totale),
    "{{fattura.modalitaPagamento}}": invoice.mod_pag,
    "{{fattura.sedute}}": invoice.sedute != null ? String(invoice.sedute) : "",
    "{{fattura.commento}}": invoice.commento ?? "",
    "{{fattura.citta}}": invoice.citta,
    "{{fattura.cap}}": invoice.cap,
    "{{fattura.mesi}}": invoice.mesi.map((m) => m.mese).join(", "),

    // Mesi singoli (alias)
    "{{mese.nome}}": invoice.mesi.map((m) => m.mese).join(", "),
    "{{mese.anno}}": String(invoice.data.getFullYear()),
  };

  return template.replace(/\{\{[^}]+\}\}/g, (match) => {
    if (match in replacements) {
      return replacements[match];
    }
    // Placeholder sconosciuto → rimosso per evitare token visibili
    return "";
  });
}

export function buildMockInvoice(
  override?: Partial<InvoiceWithRelations>
): InvoiceWithRelations {
  const now = new Date();
  return {
    id: 1,
    id_Utente: 1,
    id_Pagante: 1,
    id_Paziente: 1,
    prezzo_totale: 150,
    mod_pag: "BONIFICO",
    sedute: 3,
    commento: "Esempio nota",
    n_fattura: 42,
    data: now,
    citta: "Roma",
    cap: "00100",
    pdfLayoutSnapshot: null,
    pagante: {
      id: 1,
      id_Utente: 1,
      nome: "Mario",
      cognome: "Rossi",
      via: "Via Roma 1",
      citta: "Roma",
      cap: "00100",
      cf: "RSSMRA80A01H501Z",
      piva: "12345678901",
      eliminato: false,
    },
    paziente: {
      id: 1,
      id_Utente: 1,
      id_Pagante: null,
      nome: "Giulia",
      cognome: "Rossi",
      eliminato: false,
    },
    mesi: [{ id: 1, id_Pagamento: 1, mese: "Giugno 2026" }],
    utente: {
      id: 1,
      username: "dottore",
      passwordHash: "",
      nome: "Antonio",
      cognome: "Bianchi",
      pIva: "09876543210",
      cf: "BNCNTN70A01H501Z",
      via: "Via Milano 10",
      citta: "Milano",
      cap: "20100",
      provincia: "MI",
      titolo: "Dott.",
      specializzazione: "Psicologo",
      isAdmin: false,
      abilitato: true,
      createdAt: now,
    },
    ...override,
  } as InvoiceWithRelations;
}
