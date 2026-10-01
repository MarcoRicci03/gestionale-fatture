import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { ThemeToggle } from "@/components/theme-toggle";
import { DevBanner } from "@/components/layout/dev-banner";
import { getSession } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Login",
};

export default async function LoginPage() {
  const session = await getSession();
  if (session) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <DevBanner />
      <div className="relative flex flex-1 flex-col items-center justify-center bg-muted/30 p-4">
        <ThemeToggle className="absolute right-4 top-4" />
        <LoginForm />
      </div>
    </div>
  );
}
