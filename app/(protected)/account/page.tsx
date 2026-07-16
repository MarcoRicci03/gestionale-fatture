import type { Metadata } from "next";
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { ChangePasswordForm } from "@/components/account/change-password-form";
import { ProfileForm } from "@/components/account/profile-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Account",
};

export default async function AccountPage() {
  const session = await requireSession();
  const user = await prisma.utente.findUnique({
    where: { id: session.id },
  });

  if (!user) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">Account</h1>
        <p className="text-destructive">Utente non trovato.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Account</h1>
        <p className="text-muted-foreground">
          Gestisci il tuo profilo e la sicurezza del tuo account.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informazioni account</CardTitle>
          <CardDescription>Dati di accesso e identità.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-sm text-muted-foreground">Username</p>
            <p className="font-medium">{session.username}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Nome completo</p>
            <p className="font-medium">
              {[user.nome, user.cognome].filter(Boolean).join(" ") || "-"}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Profilo professionale</CardTitle>
            <CardDescription>
              Questi dati vengono utilizzati come mittente sulle tue fatture.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ProfileForm user={user} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sicurezza</CardTitle>
            <CardDescription>Aggiorna la password di accesso.</CardDescription>
          </CardHeader>
          <CardContent>
            <ChangePasswordForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
