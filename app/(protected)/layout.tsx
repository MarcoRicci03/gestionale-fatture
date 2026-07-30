import { requireSession } from "@/lib/auth/session";
import { Sidebar } from "@/components/layout/sidebar";
import { MobileHeader } from "@/components/layout/mobile-header";
import { TemporaryPasswordNotice } from "@/components/account/temporary-password-notice";

export default async function ProtectedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await requireSession();

  return (
    <div className="flex h-dvh">
      <Sidebar session={session} />
      <div className="flex min-h-0 flex-1 flex-col">
        <MobileHeader session={session} />
        {/*
          flex-col + min-h-0 + overflow-y-auto: lo scroll di pagina si sposta
          da document/body a questo <main>, così la sidebar (h-screen/sticky)
          resta sempre a piena altezza. Le pagine che non hanno bisogno di
          nient'altro (Dashboard, Account, ...) si comportano esattamente
          come prima (main scrolla per intero se il contenuto eccede lo
          spazio). Le pagine con tabella (Pazienti/Paganti/Fatture) possono
          invece far sì che la propria root riempia lo spazio disponibile
          (flex-1 min-h-0) e scrollare SOLO al proprio interno, lasciando
          main inerte (nulla da scrollare lì) — vedi i rispettivi Manager.
        */}
        <main className="flex min-h-0 flex-1 flex-col overflow-y-auto p-6 lg:p-8">
          {session.mustChangePassword && <TemporaryPasswordNotice />}
          {children}
        </main>
      </div>
    </div>
  );
}
