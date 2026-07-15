import { renderToStream } from "@react-pdf/renderer";
import { InvoicePDFDocument } from "@/components/invoices/invoice-pdf-document";
import type { FatturaMese, Pagamento, Pagante, Paziente } from "@prisma/client";

type InvoiceWithRelations = Pagamento & {
  pagante: Pagante;
  paziente: Paziente;
  mesi: FatturaMese[];
};

export async function generateInvoicePdf(
  invoice: InvoiceWithRelations
): Promise<Buffer> {
  const stream = (await renderToStream(
    <InvoicePDFDocument invoice={invoice} />
  )) as AsyncIterable<Buffer>;
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
