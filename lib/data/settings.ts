import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth/session";
import { LAYOUT_DEFAULT } from "@/lib/pdf/layout-default";
import type { ImpostazioniPdf, PdfLayout } from "@/lib/pdf/types";

function now() {
  return new Date();
}

function rowToImpostazioniPdf(
  row: Record<string, unknown>
): ImpostazioniPdf {
  return {
    id: row.id as number,
    id_Utente: row.id_Utente as number,
    pageWidth: row.pageWidth as number,
    pageHeight: row.pageHeight as number,
    marginTop: row.marginTop as number,
    marginRight: row.marginRight as number,
    marginBottom: row.marginBottom as number,
    marginLeft: row.marginLeft as number,
    fontFamily: row.fontFamily as string,
    fontSizeBase: row.fontSizeBase as number,
    blocchi: row.blocchi as PdfLayout["blocchi"],
    createdAt: row.createdAt as Date,
    updatedAt: row.updatedAt as Date,
  };
}

export async function getPdfSettings(): Promise<ImpostazioniPdf> {
  const userId = await requireUserId();

  const row = await prisma.impostazioniPdf.findUnique({
    where: { id_Utente: userId },
  });

  if (!row) {
    return {
      ...LAYOUT_DEFAULT,
      id: 0,
      id_Utente: userId,
      createdAt: now(),
      updatedAt: now(),
    };
  }

  return rowToImpostazioniPdf(row as unknown as Record<string, unknown>);
}

export async function upsertPdfSettings(
  data: PdfLayout
): Promise<ImpostazioniPdf> {
  const userId = await requireUserId();

  const row = await prisma.impostazioniPdf.upsert({
    where: { id_Utente: userId },
    update: {
      pageWidth: data.pageWidth,
      pageHeight: data.pageHeight,
      marginTop: data.marginTop,
      marginRight: data.marginRight,
      marginBottom: data.marginBottom,
      marginLeft: data.marginLeft,
      fontFamily: data.fontFamily,
      fontSizeBase: data.fontSizeBase,
      blocchi: data.blocchi as unknown as Prisma.InputJsonValue,
    },
    create: {
      id_Utente: userId,
      pageWidth: data.pageWidth,
      pageHeight: data.pageHeight,
      marginTop: data.marginTop,
      marginRight: data.marginRight,
      marginBottom: data.marginBottom,
      marginLeft: data.marginLeft,
      fontFamily: data.fontFamily,
      fontSizeBase: data.fontSizeBase,
      blocchi: data.blocchi as unknown as Prisma.InputJsonValue,
    },
  });

  return rowToImpostazioniPdf(row as unknown as Record<string, unknown>);
}

export async function getPdfSettingsForUser(userId: number): Promise<PdfLayout> {
  const row = await prisma.impostazioniPdf.findUnique({
    where: { id_Utente: userId },
  });

  if (!row) {
    return LAYOUT_DEFAULT;
  }

  const typed = rowToImpostazioniPdf(row as unknown as Record<string, unknown>);
  return typed;
}

export async function refreshInvoiceLayoutSnapshot(
  invoiceId: number,
  userId: number
): Promise<void> {
  const layout = await getPdfSettingsForUser(userId);

  await prisma.pagamento.update({
    where: { id: invoiceId, id_Utente: userId },
    data: { pdfLayoutSnapshot: layout as unknown as Prisma.InputJsonValue },
  });
}
