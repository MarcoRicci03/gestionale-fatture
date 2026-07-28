import type { Metadata } from "next";
import { headers } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Gestionale Fatture",
    template: "%s | Gestionale Fatture",
  },
  description: "Gestionale di fatturazione per logopedisti",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Il no-flash script di next-themes usa dangerouslySetInnerHTML, quindi
  // NON rientra nell'auto-nonce che Next applica ai propri script (bootstrap
  // dell'hydration, bundle di pagina): va propagato esplicitamente, o la CSP
  // in produzione (SEC-08, vedi proxy.ts) lo bloccherebbe. In sviluppo
  // l'header non è impostato (nessuna CSP) e nonce resta undefined, che
  // ThemeProvider gestisce già correttamente.
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html
      lang="it"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full bg-background text-foreground">
        <ThemeProvider nonce={nonce} attribute="class" defaultTheme="system" enableSystem>
          <TooltipProvider>{children}</TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
