"use client";
import { LogOut, Mail, Users } from "lucide-react";
import type { UserDto } from "@data-track/shared";
import { useEffect, useRef, useState } from "react";
import { Badge } from "#components/ui/badge";

/** Avatar com a inicial; ao clicar abre um menu com os dados da conta e o botão de sair. */
export function UserMenu({ user, onLogout, busy }: { user: UserDto; onLogout: () => void; busy?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Conta de ${user.name}`}
        className="grid size-9 place-items-center rounded-full bg-accent text-sm font-semibold text-accent-ink transition hover:opacity-90"
      >
        {user.name.trim().charAt(0).toUpperCase() || "?"}
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-2 w-64 max-w-[calc(100vw-2rem)] rounded-xl border border-line bg-surface p-2 shadow-lg"
        >
          <div className="space-y-1 px-3 py-2">
            <div className="truncate text-sm font-semibold">{user.name}</div>
            <div className="flex items-center gap-1.5 truncate text-xs text-muted">
              <Mail className="size-3.5 shrink-0" aria-hidden />
              <span className="truncate">{user.email}</span>
            </div>
            <div className="flex items-center gap-2 pt-1 text-xs text-muted">
              <Users className="size-3.5 shrink-0" aria-hidden />
              <span className="truncate">{user.team.name}</span>
              <Badge tone={user.role === "admin" ? "accent" : "neutral"}>{user.role === "admin" ? "admin" : "membro"}</Badge>
            </div>
          </div>
          <div className="my-1 border-t border-line" />
          <button
            role="menuitem"
            type="button"
            onClick={onLogout}
            disabled={busy}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-danger transition hover:bg-danger-soft disabled:opacity-50"
          >
            <LogOut className="size-4" aria-hidden />
            Sair
          </button>
        </div>
      )}
    </div>
  );
}
