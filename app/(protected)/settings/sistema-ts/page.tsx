import type { Metadata } from "next";
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { getSistemaTsSettings } from "@/lib/data/sistema-ts";
import { SistemaTsForm } from "@/components/settings/sistema-ts-form";

export const metadata: Metadata = {
  title: "Impostazioni Sistema TS",
};

export default async function SistemaTsSettingsPage() {
  const session = await requireSession();
  const [settings, user] = await Promise.all([
    getSistemaTsSettings(session.id),
    prisma.utente.findUnique({
      where: { id: session.id },
      select: { cf: true, pIva: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Impostazioni Sistema TS</h1>
        <p className="text-muted-foreground">
          Configura i parametri di connessione e le credenziali di trasmissione al Sistema Tessera Sanitaria (730 precompilato).
        </p>
      </div>

      <SistemaTsForm
        settings={settings}
        userCf={user?.cf}
        userPiva={user?.pIva}
      />
    </div>
  );
}
