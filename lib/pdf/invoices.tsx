import { renderToStream } from "@react-pdf/renderer";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { InvoicePDFDocument } from "@/components/invoices/invoice-pdf-document";
import { getPdfSettingsForUser } from "@/lib/data/settings";
import { isPdfLayout } from "@/lib/pdf/types";
import type { InvoiceWithRelations, PdfLayout } from "@/lib/pdf/types";

export async function generateInvoicePdf(
  invoice: InvoiceWithRelations
): Promise<Buffer> {
  let layout: PdfLayout | null = isPdfLayout(invoice.pdfLayoutSnapshot)
    ? invoice.pdfLayoutSnapshot
    : null;

  if (!layout) {
    layout = await getPdfSettingsForUser(invoice.id_Utente);
    await prisma.pagamento.update({
      where: { id: invoice.id },
      data: { pdfLayoutSnapshot: layout as unknown as Prisma.InputJsonValue },
    });
  }

  const stream = (await renderToStream(
    <InvoicePDFDocument invoice={invoice} settings={layout} />
  )) as AsyncIterable<Buffer>;
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
