import type { Metadata } from "next";
import {
  getInvoices,
  getNextInvoiceNumber,
  getPayersAndPatients,
} from "@/lib/data/invoices";
import { InvoicesManager } from "@/components/invoices/invoices-manager";

export const metadata: Metadata = {
  title: "Fatture",
};

export default async function InvoicesPage() {
  const currentYear = new Date().getFullYear();
  const [invoices, { payers, patients }, nextInvoiceNumber] = await Promise.all([
    getInvoices(),
    getPayersAndPatients(),
    getNextInvoiceNumber(currentYear),
  ]);

  return (
    <InvoicesManager
      invoices={invoices}
      payers={payers}
      patients={patients}
      nextInvoiceNumber={nextInvoiceNumber}
    />
  );
}
