"use client";
import { BellRing, LayoutDashboard, Users } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Brand } from "#components/brand";
import { UserContext } from "#components/user-context";
import { UserMenu } from "#components/user-menu";
import { useLogout, useMe } from "#lib/queries";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/alertas", label: "Alertas", icon: BellRing },
  { href: "/equipe", label: "Equipe", icon: Users },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  // Em 401 o cliente da API redireciona para o login.
  const me = useMe();
  const logout = useLogout();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-line bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-1 px-4 pt-3 pb-1 sm:py-3">
          <Link href="/dashboard" aria-label="Data Track"><Brand height={52} /></Link>
          {/* No celular a navegação desce para uma segunda linha, rolável se faltar espaço. */}
          <nav className="order-3 -mx-1 flex w-full gap-1 overflow-x-auto pb-2 sm:order-none sm:mx-0 sm:w-auto sm:pb-0">
            {NAV.map((n) => {
              const active = pathname.startsWith(n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  aria-current={active ? "page" : undefined}
                  className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition sm:py-1.5 ${active ? "bg-accent-soft text-accent" : "text-muted hover:text-ink"}`}
                >
                  <n.icon className="size-4" aria-hidden />
                  {n.label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto">
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
      <main className="mx-auto max-w-5xl px-4 py-6 sm:py-8">
        {me.data ? (
          <UserContext.Provider value={me.data}>{children}</UserContext.Provider>
        ) : me.isError ? (
          <p className="text-sm text-danger">Não foi possível carregar sua conta.</p>
        ) : (
          <p className="text-sm text-muted">Carregando…</p>
        )}
      </main>
    </div>
  );
}
