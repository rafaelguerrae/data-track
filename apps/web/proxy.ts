import { NextResponse, type NextRequest } from "next/server";

// Barreira otimista: só olha se o cookie existe. A validação real é feita pela API (401 derruba
// a sessão e limpa o cookie), então um cookie vencido nunca causa loop de redirecionamento.
export function proxy(req: NextRequest) {
  const hasSession = req.cookies.has("dt_session");
  const { pathname } = req.nextUrl;

  if (pathname === "/" && hasSession) return NextResponse.redirect(new URL("/dashboard", req.url));
  if (pathname !== "/" && !hasSession) return NextResponse.redirect(new URL("/", req.url));
  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/dashboard/:path*", "/alertas/:path*", "/equipe/:path*"],
};
