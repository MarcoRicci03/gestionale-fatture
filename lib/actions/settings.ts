"use server";

import { snapshotPdfLayoutForInvoice } from "@/lib/pdf/invoices";
import { requireSession } from "@/lib/auth/session";
import { getClientIp } from "@/lib/auth/client-ip";
import { upsertPdfSettings } from "@/lib/data/settings";
import { pdfSettingsSchema } from "@/lib/validations/pdf-settings";
import type { PdfSettingsInput } from "@/lib/pdf/types";
import { logAudit } from "@/lib/audit/log";
import { AUDIT_ACTIONS } from "@/lib/audit/actions";

export type PdfSettingsActionState = { success: true } | { success: false; error: string };

export async function updatePdfSettings(
  data: unknown
): Promise<PdfSettingsActionState> {
  const session = await requireSession();

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

  let settingsId: number;
  try {
    const settings = await upsertPdfSettings(input);
    settingsId = settings.id;
  } catch (e) {
    console.error("updatePdfSettings error", e);
    return { success: false, error: "Errore durante il salvataggio delle impostazioni PDF" };
  }

  await logAudit({
    azione: AUDIT_ACTIONS.PDF_SETTINGS_UPDATE,
    userId: session.id,
    entita: "ImpostazioniPdf",
    entitaId: settingsId,
    ip: await getClientIp(),
  });

  return { success: true };
}

export async function refreshInvoicePdfLayout(
  invoiceId: number
): Promise<PdfSettingsActionState> {
  const session = await requireSession();

  try {
    await snapshotPdfLayoutForInvoice(invoiceId, session.id);
  } catch (e) {
    console.error("refreshInvoicePdfLayout error", e);
    return { success: false, error: "Errore durante l'aggiornamento del layout" };
  }

  await logAudit({
    azione: AUDIT_ACTIONS.PDF_SETTINGS_REFRESH_LAYOUT,
    userId: session.id,
    entita: "Pagamento",
    entitaId: invoiceId,
    ip: await getClientIp(),
  });

  return { success: true };
}
