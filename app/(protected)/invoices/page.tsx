import type { Metadata } from "next";
import {
  getInvoices,
  getInvoiceYears,
  getNextInvoiceNumber,
  getPayersAndPatients,
} from "@/lib/data/invoices";
import { InvoicesManager } from "@/components/invoices/invoices-manager";
import { parseInvoiceListQuery } from "@/lib/validations/invoice-list-query";

export const metadata: Metadata = {
  title: "Fatture",
};

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const rawParams = await searchParams;
  const { filters, page } = parseInvoiceListQuery(rawParams, new Date());
  const currentYear = new Date().getFullYear();

  const [{ invoices, totalCount }, years, { payers, patients }, nextInvoiceNumber] =
    await Promise.all([
      getInvoices(filters, page),
      getInvoiceYears(),
      getPayersAndPatients(),
      getNextInvoiceNumber(currentYear),
    ]);

  return (
    <InvoicesManager
      invoices={invoices}
      totalCount={totalCount}
      page={page}
      years={years}
      filters={filters}
      payers={payers}
      patients={patients}
      nextInvoiceNumber={nextInvoiceNumber}
    />
  );
}
