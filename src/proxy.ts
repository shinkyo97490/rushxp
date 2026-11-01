import { NextResponse, type NextRequest } from "next/server";

/** Transmet le chemin demandé au rendu (mode maintenance : la page de connexion reste accessible). */
export function proxy(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.set("x-pathname", request.nextUrl.pathname);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|assets|favicon.ico).*)"],
};
