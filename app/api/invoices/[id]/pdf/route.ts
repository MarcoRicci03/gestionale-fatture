import { requireUserId } from "@/lib/auth/session";
import { getInvoiceById } from "@/lib/data/invoices";
import { generateInvoicePdf } from "@/lib/pdf/invoices";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await requireUserId();

  const { id } = await params;
  const invoiceId = Number(id);

  if (Number.isNaN(invoiceId)) {
    return new Response("ID fattura non valido", { status: 400 });
  }

  const invoice = await getInvoiceById(invoiceId);
  if (!invoice || !invoice.pagante || !invoice.paziente || !invoice.utente) {
    return new Response("Fattura non trovata", { status: 404 });
  }

  const buffer = await generateInvoicePdf(invoice);

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="fattura-${invoice.n_fattura}.pdf"`,
    },
  });
}
