import { prisma } from "@/lib/prisma";
import { encryptCredential } from "@/lib/sistemats/vault";
import type { SistemaTsSettingsInput } from "@/lib/validations/sistema-ts";

export async function saveSistemaTsSettingsService(
  userId: number,
  data: SistemaTsSettingsInput
): Promise<{ success: true } | { success: false; error: string }> {
  const existing = await prisma.impostazioniSistemaTs.findUnique({
    where: { id_Utente: userId },
  });

  let passwordEncrypted = existing?.passwordEncrypted ?? "";
  if (data.password && data.password.trim() !== "") {
    passwordEncrypted = encryptCredential(data.password.trim());
  }

  let pincodeEncrypted = existing?.pincodeEncrypted ?? "";
  if (data.pincode && data.pincode.trim() !== "") {
    pincodeEncrypted = encryptCredential(data.pincode.trim());
  }

  if (!passwordEncrypted) {
    return { success: false, error: "La password del Sistema TS è obbligatoria." };
  }
  if (!pincodeEncrypted) {
    return { success: false, error: "Il PinCode del Sistema TS è obbligatorio." };
  }

  try {
    await prisma.impostazioniSistemaTs.upsert({
      where: { id_Utente: userId },
      create: {
        id_Utente: userId,
        username: data.username.trim(),
        passwordEncrypted,
        pincodeEncrypted,
        codiceRegione: data.codiceRegione,
        codiceAsl: data.codiceAsl,
        codiceStruttura: data.codiceStruttura,
        naturaIvaDefault: data.naturaIvaDefault,
      },
      update: {
        username: data.username.trim(),
        passwordEncrypted,
        pincodeEncrypted,
        codiceRegione: data.codiceRegione,
        codiceAsl: data.codiceAsl,
        codiceStruttura: data.codiceStruttura,
        naturaIvaDefault: data.naturaIvaDefault,
      },
    });

    return { success: true };
  } catch (error) {
    console.error("saveSistemaTsSettings error", error);
    return { success: false, error: "Errore durante il salvataggio delle impostazioni Sistema TS." };
  }
}
