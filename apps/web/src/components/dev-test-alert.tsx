"use client";
import { FlaskConical } from "lucide-react";

export const TEST_ALERT_EVENT = "dt:test-alert";

// Só para testar o aviso em tela (toast, ping e bolinha); some fora de `next dev`.
export function DevTestAlert() {
  if (process.env.NODE_ENV !== "development") return null;
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(TEST_ALERT_EVENT))}
      className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-line px-2.5 py-1.5 text-xs font-medium text-muted transition hover:text-ink"
    >
      <FlaskConical className="size-3.5" aria-hidden />
      Testar alerta
    </button>
  );
}
