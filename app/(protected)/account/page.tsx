import type { Metadata } from "next";
import { requireSession } from "@/lib/auth/session";
import { ChangePasswordForm } from "@/components/account/change-password-form";

export const metadata: Metadata = {
  title: "Account",
};

export default async function AccountPage() {
  const session = await requireSession();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Account</h1>
        <p className="text-muted-foreground">
          Gestisci la tua password
        </p>
      </div>

      <div className="rounded-lg border p-4 max-w-md">
        <p className="text-sm text-muted-foreground">Username</p>
        <p className="font-medium">{session.username}</p>
        {[session.nome, session.cognome].filter(Boolean).join(" ") && (
          <>
            <p className="mt-2 text-sm text-muted-foreground">Nome</p>
            <p className="font-medium">
              {[session.nome, session.cognome].filter(Boolean).join(" ")}
            </p>
          </>
        )}
      </div>

      <ChangePasswordForm />
    </div>
  );
}
