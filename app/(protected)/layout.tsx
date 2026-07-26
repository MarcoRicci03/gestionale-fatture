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
    <div className="flex min-h-full">
      <Sidebar session={session} />
      <div className="flex flex-1 flex-col">
        <MobileHeader session={session} />
        <main className="flex-1 p-6 lg:p-8">
          {session.mustChangePassword && <TemporaryPasswordNotice />}
          {children}
        </main>
      </div>
    </div>
  );
}
