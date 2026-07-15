import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Login",
};

export default function LoginPage() {
  return (
    <div className="flex min-h-full flex-col items-center justify-center bg-muted/30 p-4">
      <LoginForm />
    </div>
  );
}
