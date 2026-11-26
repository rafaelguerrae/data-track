"use client";
import type { AlertEventDto } from "@data-track/shared";
import { BellRing, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { KIND_ICON, KIND_SHORT } from "#lib/alert-kinds";
import { useDevices, useNewAlerts } from "#lib/queries";

const TOAST_MS = 10_000;
const MAX_TOASTS = 3;

interface Toast {
  key: string;
  title: string;
  body: string;
  event?: AlertEventDto; // ausente no resumo "N novos alertas"
}

function ToastCard({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const [paused, setPaused] = useState(false);
  const Icon = toast.event ? KIND_ICON[toast.event.kind] : BellRing;

  // Ref para o timer não reiniciar a cada render do pai (onClose é recriado).
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  // Some em 10s; com o mouse em cima o relógio para e reinicia ao sair.
  useEffect(() => {
    if (paused) return;
    const t = setTimeout(() => closeRef.current(), TOAST_MS);
    return () => clearTimeout(t);
  }, [paused]);

  return (
    <div
      role="status"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className="pointer-events-auto flex w-full items-start gap-3 rounded-xl border border-line bg-surface p-3 shadow-lg sm:w-80"
    >
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-danger-soft text-danger">
        <Icon className="size-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">{toast.title}</p>
        <p className="mt-0.5 text-sm text-muted">{toast.body}</p>
        <Link href="/alertas" onClick={onClose} className="mt-2 inline-block text-sm font-medium text-accent hover:underline">
          Ver alertas
        </Link>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Fechar aviso"
        className="rounded p-1 text-muted transition hover:text-ink"
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}

export function AlertToaster() {
  const pathname = usePathname();
  const devices = useDevices();
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Refs para o callback do polling enxergar sempre o valor atual sem recriar a query.
  const onAlertsPage = useRef(false);
  onAlertsPage.current = pathname.startsWith("/alertas");
  const deviceNames = useRef(new Map<string, string>());
  for (const d of devices.data ?? []) if (d.name) deviceNames.current.set(d.id, d.name);

  const close = useCallback((key: string) => setToasts((t) => t.filter((x) => x.key !== key)), []);

  useNewAlerts((events) => {
    // Na tela de alertas a lista já se atualiza sozinha.
    if (onAlertsPage.current) return;
    const next: Toast[] =
      events.length > MAX_TOASTS
        ? [{ key: `many-${events[0]!.id}`, title: `${events.length} novos alertas`, body: "Abra a tela de alertas para ver todos." }]
        : [...events].reverse().map((e) => ({
            key: String(e.id),
            title: `${KIND_SHORT[e.kind]} · ${deviceNames.current.get(e.deviceId) ?? e.deviceId}`,
            body: e.message,
            event: e,
          }));
    setToasts((t) => [...next, ...t].slice(0, MAX_TOASTS));
  });

  if (!toasts.length) return null;
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-20 flex flex-col gap-2 sm:inset-x-auto sm:right-4 sm:bottom-4"
    >
      {toasts.map((t) => (
        <ToastCard key={t.key} toast={t} onClose={() => close(t.key)} />
      ))}
    </div>
  );
}
