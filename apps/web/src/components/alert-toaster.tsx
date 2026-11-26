"use client";
import type { AlertEventDto } from "@data-track/shared";
import { BellRing, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { TEST_ALERT_EVENT } from "#components/dev-test-alert";
import { KIND_ICON, KIND_SHORT } from "#lib/alert-kinds";
import { useDevices, useNewAlerts } from "#lib/queries";
import { playPing } from "#lib/ping";
import { markAlertsUnread } from "#lib/unread-alerts";

const TOAST_MS = 10_000;
const LEAVE_MS = 200; // igual à duração de .toast-leave em globals.css
const MAX_TOASTS = 3;

interface Toast {
  key: string;
  title: string;
  body: string;
  event?: AlertEventDto; // ausente no resumo "N novos alertas"
}

function ToastCard({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const [paused, setPaused] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const Icon = toast.event ? KIND_ICON[toast.event.kind] : BellRing;

  // Ref para os timers não reiniciarem a cada render do pai (onClose é recriado).
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  // Anima a saída e só então remove o aviso da lista.
  const dismiss = useCallback(() => {
    setLeaving(true);
    setTimeout(() => closeRef.current(), LEAVE_MS);
  }, []);

  // Some em 10s; com o mouse em cima o relógio para e reinicia ao sair.
  useEffect(() => {
    if (paused || leaving) return;
    const t = setTimeout(dismiss, TOAST_MS);
    return () => clearTimeout(t);
  }, [paused, leaving, dismiss]);

  return (
    <div
      role="status"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className={`pointer-events-auto flex w-full items-start gap-4 rounded-2xl border border-line bg-surface p-5 shadow-xl ring-1 ring-danger/10 sm:w-[26rem] ${leaving ? "toast-leave" : "toast-enter"}`}
    >
      <span className="relative grid size-11 shrink-0 place-items-center rounded-full bg-danger-soft text-danger">
        <span aria-hidden className="toast-ring absolute inset-0 rounded-full bg-danger" />
        <Icon className="relative size-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-base font-semibold text-ink">{toast.title}</p>
        <p className="mt-1 text-sm text-muted">{toast.body}</p>
        <Link href="/alertas" onClick={dismiss} className="mt-3 inline-block text-sm font-semibold text-accent hover:underline">
          Ver alertas
        </Link>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Fechar aviso"
        className="rounded p-1 text-muted transition hover:text-ink"
      >
        <X className="size-5" aria-hidden />
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

  // Só em dev: simula a chegada de um alerta (botão "Testar alerta" do header).
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    const onTest = () => {
      if (!onAlertsPage.current) markAlertsUnread();
      playPing();
      const toast: Toast = {
        key: `test-${Date.now()}`,
        title: "Temperatura alta · Sensor de teste",
        body: "Alerta de teste: 8,5 °C, acima do limite de 8 °C.",
      };
      setToasts((t) => [toast, ...t].slice(0, MAX_TOASTS));
    };
    window.addEventListener(TEST_ALERT_EVENT, onTest);
    return () => window.removeEventListener(TEST_ALERT_EVENT, onTest);
  }, []);

  useNewAlerts((events) => {
    // Na tela de alertas a lista já se atualiza sozinha.
    if (onAlertsPage.current) return;
    markAlertsUnread();
    playPing();
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
