"use client";

import { useEffect } from "react";

export default function GlobalError({
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
    <html lang="it">
      <body className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="text-lg font-medium">Si è verificato un errore imprevisto</h1>
        <p className="text-sm text-gray-500">Riprova a ricaricare l&apos;applicazione.</p>
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-black/80"
        >
          Riprova
        </button>
      </body>
    </html>
  );
}
