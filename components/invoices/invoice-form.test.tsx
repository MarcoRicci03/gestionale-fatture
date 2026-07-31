import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InvoiceForm } from "./invoice-form";
import type { PayerOption, PatientOption } from "@/lib/data/invoice-contact-options-select";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

// createInvoice/updateInvoice/getNextInvoiceNumberForYear sono Server Action
// ("use server"): mockate come già fa invoices-manager.test.tsx per
// refreshInvoicePdfLayout/refreshInvoiceAnagrafica, altrimenti trascinano
// prisma solo per essere importate.
vi.mock("@/lib/actions/invoices", () => ({
  createInvoice: vi.fn(async () => ({ success: true })),
  updateInvoice: vi.fn(async () => ({ success: true })),
  getNextInvoiceNumberForYear: vi.fn(async () => 1),
}));

const payerRoma: PayerOption = {
  id: 1,
  nome: "Mario",
  cognome: "Rossi",
  citta: "Roma",
  cap: "00100",
  archiviato: false,
};

const payerMilano: PayerOption = {
  id: 2,
  nome: "Luca",
  cognome: "Verdi",
  citta: "Milano",
  cap: "20100",
  archiviato: false,
};

const patient: PatientOption = {
  id: 10,
  nome: "Giulia",
  cognome: "Bianchi",
  id_Pagante: 1,
  archiviato: false,
};

const basePayers: PayerOption[] = [payerRoma, payerMilano];
const basePatients: PatientOption[] = [patient];

// InvoiceForm.invoice richiede più campi di InvoiceWithRelations di quanti
// LOG-02 ne eserciti: qui bastano quelli letti dal form (id_Pagante,
// citta/cap salvati, mesi vuoti per restare fuori dalla validazione bollo).
function makeSavedInvoice(overrides: Partial<Parameters<typeof InvoiceForm>[0]["invoice"]> = {}) {
  return {
    id: 99,
    id_Utente: 1,
    id_Pagante: 1,
    id_Paziente: 10,
    prezzo_totale: 50,
    mod_pag: "BONIFICO" as const,
    sedute: null,
    commento: null,
    n_fattura: 5,
    data: new Date("2024-03-10"),
    // Città/CAP SALVATI sulla fattura, deliberatamente diversi dall'indirizzo
    // attuale del pagante (Roma/00100): è esattamente lo scenario di LOG-02,
    // un pagante che ha cambiato indirizzo dopo l'emissione.
    citta: "Napoli",
    cap: "80100",
    pdfLayoutSnapshot: null,
    bolloCodice: null,
    mesi: [],
    ...overrides,
  };
}

describe("InvoiceForm — LOG-02: autocompilazione città/CAP dal pagante", () => {
  it("in modifica, al mount NON sovrascrive città/CAP salvati con l'indirizzo attuale del pagante", () => {
    render(
      <InvoiceForm
        invoice={makeSavedInvoice()}
        payers={basePayers}
        patients={basePatients}
        nextInvoiceNumber={6}
      />
    );

    expect(screen.getByLabelText("Città")).toHaveValue("Napoli");
    expect(screen.getByLabelText("CAP")).toHaveValue("80100");
  });

  it("in modifica, cambiare esplicitamente il pagante autocompila città/CAP del NUOVO pagante", async () => {
    const user = userEvent.setup();
    render(
      <InvoiceForm
        invoice={makeSavedInvoice()}
        payers={basePayers}
        patients={basePatients}
        nextInvoiceNumber={6}
      />
    );

    await user.selectOptions(screen.getByLabelText("Pagante"), "2");

    expect(screen.getByLabelText("Città")).toHaveValue("Milano");
    expect(screen.getByLabelText("CAP")).toHaveValue("20100");
  });

  it("in creazione, selezionare un pagante autocompila città/CAP (comportamento invariato)", async () => {
    const user = userEvent.setup();
    render(
      <InvoiceForm
        payers={basePayers}
        patients={basePatients}
        nextInvoiceNumber={1}
      />
    );

    expect(screen.getByLabelText("Città")).toHaveValue("");

    await user.selectOptions(screen.getByLabelText("Pagante"), "1");

    expect(screen.getByLabelText("Città")).toHaveValue("Roma");
    expect(screen.getByLabelText("CAP")).toHaveValue("00100");
  });
});
