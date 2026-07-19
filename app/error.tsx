"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <AlertTriangle className="h-10 w-10 text-destructive" />
      <div className="space-y-1">
        <h1 className="text-lg font-medium">Si è verificato un errore imprevisto</h1>
        <p className="text-sm text-muted-foreground">
          Riprova, oppure torna alla dashboard se il problema persiste.
        </p>
      </div>
      <div className="flex gap-2">
        <Link href="/dashboard" className={buttonVariants({ variant: "outline" })}>
          Torna alla dashboard
        </Link>
        <Button onClick={() => reset()}>Riprova</Button>
      </div>
    </div>
  );
}
