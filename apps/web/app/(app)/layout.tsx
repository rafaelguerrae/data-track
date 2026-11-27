"use client";
import { BellRing, LayoutDashboard, Users } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { AlertToaster } from "#components/alert-toaster";
import { Brand } from "#components/brand";
import { DevTestAlert } from "#components/dev-test-alert";
import { UserContext } from "#components/user-context";
import { UserMenu } from "#components/user-menu";
import { useLogout, useMe } from "#lib/queries";
import { markAlertsRead, useAlertsUnread } from "#lib/unread-alerts";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/alertas", label: "Alertas", icon: BellRing },
  { href: "/equipe", label: "Equipe", icon: Users },
];

function UnreadDot() {
  return (
    <span className="absolute -top-0.5 -right-1 size-2 rounded-full bg-danger ring-2 ring-surface">
      <span className="sr-only">Há alertas novos</span>
    </span>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  // Em 401 o cliente da API redireciona para o login.
  const me = useMe();
  const logout = useLogout();
  const unread = useAlertsUnread();

  // Abrir a tela de Alertas (ou receber um alerta já estando nela) conta como "visto".
  useEffect(() => {
    if (pathname.startsWith("/alertas") && unread) markAlertsRead();
  }, [pathname, unread]);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-line bg-surface">
        <div className="mx-auto flex max-w-5xl items-center gap-6 px-4 py-2 sm:py-3">
          <Link href="/dashboard" aria-label="Data Track"><Brand height={52} /></Link>
          <nav aria-label="Principal" className="hidden gap-1 sm:flex">
            {NAV.map((n) => {
              const active = pathname.startsWith(n.href);
              const dot = n.href === "/alertas" && unread && !active;
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  aria-current={active ? "page" : undefined}
                  className={`inline-flex items-center gap-2 border-b-2 px-3 py-1.5 text-sm font-medium whitespace-nowrap transition ${active ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink"}`}
                >
                  <span className="relative">
                    <n.icon className="size-4" aria-hidden />
                    {dot && <UnreadDot />}
                  </span>
                  {n.label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <DevTestAlert />
            {me.data && (
              <UserMenu
                user={me.data}
                busy={logout.isPending}
                onLogout={() => logout.mutate(undefined, { onSettled: () => router.replace("/") })}
              />
            )}
          </div>
        </div>
      </header>

      {/* Reserva espaço para a barra inferior (altura + área segura do iOS) só no celular. */}
      <main className="mx-auto max-w-5xl px-4 py-6 pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:py-8 sm:pb-8">
        {me.data ? (
          <UserContext.Provider value={me.data}>
            {children}
            <AlertToaster />
          </UserContext.Provider>
        ) : me.isError ? (
          <p className="text-sm text-danger">Não foi possível carregar sua conta.</p>
        ) : (
          <p className="text-sm text-muted">Carregando…</p>
        )}
      </main>

      <nav
        aria-label="Principal"
        className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] sm:hidden"
      >
        <ul className="mx-auto flex max-w-md">
          {NAV.map((n) => {
            const active = pathname.startsWith(n.href);
            const dot = n.href === "/alertas" && unread && !active;
            return (
              <li key={n.href} className="flex-1">
                <Link
                  href={n.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex flex-col items-center gap-1 px-2 pt-2.5 pb-2 text-xs font-medium transition ${active ? "text-ink" : "text-muted"}`}
                >
                  <span className={`grid h-7 w-14 place-items-center border-t-2 transition ${active ? "border-accent" : "border-transparent"}`}>
                    <span className="relative">
                      <n.icon className="size-5" aria-hidden />
                      {dot && <UnreadDot />}
                    </span>
                  </span>
                  {n.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
