import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySession } from "@/lib/auth/jwt";

export const config = {
  matcher: [
    "/((?!login|api|_next/static|_next/image|favicon.ico|robots.txt).*)",
  ],
};

export async function proxy(request: NextRequest) {
  // Lascia passare richieste non-GET (es. Server Actions) senza interferire:
  // ogni Server Action verifica autonomamente la sessione.
  if (request.method !== "GET") {
    return NextResponse.next();
  }

  const token = request.cookies.get("session_token")?.value;
  const session = token ? await verifySession(token) : null;

  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}
