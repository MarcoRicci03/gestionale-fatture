import { prisma } from "@/lib/prisma";
import { decryptCredential, encryptCredential, needsReencryption } from "@/lib/sistemats/vault";
import { SistemaTsClient } from "@/lib/sistemats/client";
import type { ProprietarioPayload } from "@/lib/sistemats/types";

export async function getClientForUser(userId: number): Promise<{
  client: SistemaTsClient;
  proprietario: ProprietarioPayload;
  user: { cf: string; pIva: string };
}> {
  const [settings, user] = await Promise.all([
    prisma.impostazioniSistemaTs.findUnique({ where: { id_Utente: userId } }),
    prisma.utente.findUnique({ where: { id: userId } }),
  ]);

  if (!settings || !settings.passwordEncrypted || !settings.pincodeEncrypted) {
    throw new Error(
      "Credenziali Sistema TS non configurate. Accedi a 'Impostazioni Sistema TS' per inserire Username, Password e PinCode."
    );
  }

  if (!user?.pIva || !user?.cf) {
    throw new Error(
      "Profilo utente incompleto: Codice Fiscale e Partita IVA sono obbligatori per l'invio TS. Aggiorna il tuo Account."
    );
  }

  const passwordDecrypted = decryptCredential(settings.passwordEncrypted);
  const pincodeDecrypted = decryptCredential(settings.pincodeEncrypted);

  // P026: credenziali in formato legacy o decifrabili solo con una chiave di
  // TS_ENCRYPTION_FALLBACK_SECRETS vengono ricifrate con la chiave primaria,
  // così dopo una rotazione le vecchie chiavi possono essere dismesse.
  // Best-effort: un errore qui non deve bloccare l'operazione Sistema TS.
  const ricifrate = {
    ...(needsReencryption(settings.passwordEncrypted)
      ? { passwordEncrypted: encryptCredential(passwordDecrypted) }
      : {}),
    ...(needsReencryption(settings.pincodeEncrypted)
      ? { pincodeEncrypted: encryptCredential(pincodeDecrypted) }
      : {}),
  };
  if (Object.keys(ricifrate).length > 0) {
    try {
      await prisma.impostazioniSistemaTs.update({
        where: { id_Utente: userId },
        data: ricifrate,
      });
    } catch (error) {
      console.error("Ricifratura credenziali Sistema TS fallita", error);
    }
  }

  const proprietario: ProprietarioPayload = {
    codiceRegione: settings.codiceRegione,
    codiceAsl: settings.codiceAsl,
    codiceStruttura: settings.codiceStruttura,
    cfProprietario: user.cf,
  };

  const client = new SistemaTsClient({
    username: settings.username,
    passwordDecrypted,
    pincodeDecrypted,
    codiceRegione: settings.codiceRegione,
    codiceAsl: settings.codiceAsl,
    codiceStruttura: settings.codiceStruttura,
    cfProprietario: user.cf,
  });

  return {
    client,
    proprietario,
    user: { cf: user.cf, pIva: user.pIva },
  };
}
