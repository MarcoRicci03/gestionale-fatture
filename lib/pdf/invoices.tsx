import { renderToStream } from "@react-pdf/renderer";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { InvoicePDFDocument } from "@/components/invoices/invoice-pdf-document";
import { getPdfSettingsForUser } from "@/lib/data/settings";
import { isPdfLayout } from "@/lib/pdf/types";
import type { InvoiceWithRelations, PdfLayout } from "@/lib/pdf/types";

// Scrive lo snapshot del layout PDF per una fattura. Chiamata solo da
// contesti di scrittura (createInvoice, refreshInvoicePdfLayout): MAI da
// generateInvoicePdf, che serve il rendering su richieste GET e non deve
// avere side-effect.
export async function snapshotPdfLayoutForInvoice(
  invoiceId: number,
  userId: number
): Promise<void> {
  const layout = await getPdfSettingsForUser(userId);
  await prisma.pagamento.update({
    where: { id: invoiceId, id_Utente: userId },
    data: { pdfLayoutSnapshot: layout as unknown as Prisma.InputJsonValue },
  });
}

export async function generateInvoicePdf(
  invoice: InvoiceWithRelations
): Promise<Buffer> {
  // Fallback di sola lettura per fatture create prima di questo fix (o il
  // cui snapshot è stato azzerato) — non persiste nulla: una GET non deve
  // scrivere. Il valore diventa stabile non appena viene chiamato
  // snapshotPdfLayoutForInvoice (alla creazione o al refresh esplicito).
  const layout: PdfLayout = isPdfLayout(invoice.pdfLayoutSnapshot)
    ? invoice.pdfLayoutSnapshot
    : await getPdfSettingsForUser(invoice.id_Utente);

  const stream = (await renderToStream(
    <InvoicePDFDocument invoice={invoice} settings={layout} />
  )) as AsyncIterable<Buffer>;
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
