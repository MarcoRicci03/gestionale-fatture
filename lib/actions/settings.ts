"use server";

import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/session";
import { upsertPdfSettings } from "@/lib/data/settings";
import { pdfSettingsSchema } from "@/lib/validations/pdf-settings";
import type { PdfSettingsInput } from "@/lib/pdf/types";

export type PdfSettingsActionState = { success: true } | { success: false; error: string };

export async function updatePdfSettings(
  data: unknown
): Promise<PdfSettingsActionState> {
  await requireSession();

  const parsed = pdfSettingsSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: "Dati non validi" };
  }

  const input: PdfSettingsInput = {
    pageWidth: parsed.data.pageWidth,
    pageHeight: parsed.data.pageHeight,
    marginTop: parsed.data.marginTop,
    marginRight: parsed.data.marginRight,
    marginBottom: parsed.data.marginBottom,
    marginLeft: parsed.data.marginLeft,
    fontFamily: parsed.data.fontFamily,
    fontSizeBase: parsed.data.fontSizeBase,
    // richContent/descrizioneRichContent/valoreRichContent sono blob opachi
    // (z.unknown() in Zod) non validati in profondità: cast al confine di
    // validazione, coerente con la scelta di non accoppiarli allo schema TipTap.
    blocchi: parsed.data.blocchi as unknown as PdfSettingsInput["blocchi"],
  };

  try {
    await upsertPdfSettings(input);
  } catch (e) {
    console.error("updatePdfSettings error", e);
    return { success: false, error: "Errore durante il salvataggio delle impostazioni PDF" };
  }

  return { success: true };
}

export async function refreshInvoicePdfLayout(
  invoiceId: number
): Promise<PdfSettingsActionState> {
  const session = await requireSession();

  try {
    await prisma.pagamento.update({
      where: { id: invoiceId, id_Utente: session.id },
      data: { pdfLayoutSnapshot: { set: null } },
    });
  } catch (e) {
    console.error("refreshInvoicePdfLayout error", e);
    return { success: false, error: "Errore durante l'aggiornamento del layout" };
  }

  return { success: true };
}
