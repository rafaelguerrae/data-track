import type { HourlyCell } from "@data-track/shared";

const HOURS = Array.from({ length: 24 }, (_, h) => h);

/** Grade dia × hora com uma só cor (mais escuro = mais quente). Dias sem dado ficam vazios. */
export function HourlyHeatmap({ cells }: { cells: HourlyCell[] }) {
  if (cells.length === 0) return <p className="text-sm text-muted">Sem leituras nos últimos 7 dias.</p>;
  const days = [...new Set(cells.map((c) => c.day))].sort();
  const byKey = new Map(cells.map((c) => [`${c.day}|${c.hour}`, c.avg]));
  const values = cells.map((c) => c.avg);
  const min = Math.min(...values);
  const span = Math.max(...values) - min || 1;

  return (
    <div>
      <div className="space-y-1">
        {days.map((day) => (
          <div key={day} className="flex items-center gap-1.5 sm:gap-2">
            <span className="w-9 shrink-0 font-mono text-[11px] text-muted sm:w-12 sm:text-xs">
              {new Date(`${day}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
            </span>
            <div className="grid flex-1 grid-cols-24 gap-px">
              {HOURS.map((h) => {
                const v = byKey.get(`${day}|${h}`);
                return (
                  <div
                    key={h}
                    title={v == null ? `${h}h: sem dados` : `${h}h: ${v.toFixed(1)} °C`}
                    className="h-5 rounded-[2px] bg-surface-2 sm:h-6"
                    style={v == null ? undefined : { background: `color-mix(in srgb, var(--accent) ${Math.round(12 + ((v - min) / span) * 88)}%, var(--surface))` }}
                  />
                );
              })}
            </div>
          </div>
        ))}
        <div className="flex items-center gap-2" aria-hidden>
          <span className="w-9 shrink-0 sm:w-12" />
          <div className="grid flex-1 grid-cols-24 gap-px font-mono text-[10px] text-muted">
            {HOURS.map((h) => (
              <span key={h} className="text-center">{h % 6 === 0 ? h : ""}</span>
            ))}
          </div>
        </div>
        <p className="pt-2 text-xs text-muted">
          Média por hora, de {min.toFixed(1)} a {(min + span).toFixed(1)} °C. Mais escuro = mais quente.
        </p>
      </div>
    </div>
  );
}
