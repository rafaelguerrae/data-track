"use client";
import type { AlertEventDto, SeriesPoint } from "@data-track/shared";
import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const TICK = { fill: "var(--muted)", fontSize: 12, fontFamily: "var(--font-mono)" };

export interface Limits {
  low?: number;
  high?: number;
}

export function TempChart({ data, limits = {}, alerts = [] }: { data: SeriesPoint[]; limits?: Limits; alerts?: AlertEventDto[] }) {
  const rows = data.map((p) => ({
    ...p,
    t: new Date(p.time).getTime(),
    band: [p.min, p.max] as [number, number],
    label: new Date(p.time).toLocaleString("pt-BR", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", hour12: false }),
  }));
  // O rótulo completo ("26/11 22:15") vai no tooltip; no eixo basta a hora, ou o dia quando a janela passa de 36h.
  const multiDay = rows.length > 1 && rows.at(-1)!.t - rows[0]!.t > 36 * 3_600_000;
  const shortLabel = (label: string) => (multiDay ? label.split(/,?\s+/)[0]! : label.split(/,?\s+/).at(-1)!);

  // O eixo X é categórico (um rótulo por bucket): cada alerta vai para o bucket mais próximo, sem repetir.
  const bucketMs = rows.length > 1 ? rows[1]!.t - rows[0]!.t : 0;
  const markers = new Map<string, AlertEventDto>();
  if (rows.length > 0) {
    for (const a of alerts) {
      const t = new Date(a.createdAt).getTime();
      const nearest = rows.reduce((best, r) => (Math.abs(r.t - t) < Math.abs(best.t - t) ? r : best));
      if (t >= rows[0]!.t && t <= rows.at(-1)!.t + bucketMs) markers.set(nearest.label, a);
    }
  }

  return (
    <div className="h-64 w-full sm:h-80">
      <ResponsiveContainer>
        <ComposedChart data={rows} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--line)" vertical={false} />
          <XAxis dataKey="label" tickFormatter={shortLabel} minTickGap={40} padding={{ left: 4, right: 16 }} tick={TICK} stroke="var(--line)" />
          <YAxis unit="°" domain={["auto", "auto"]} tick={TICK} stroke="var(--line)" width={36} />
          <Tooltip
            contentStyle={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 3, color: "var(--ink)", fontSize: 12 }}
            formatter={(v, name) => (name === "faixa" ? [`${(v as number[])[0]!.toFixed(2)} – ${(v as number[])[1]!.toFixed(2)} °C`, "mín – máx"] : [`${Number(v).toFixed(2)} °C`, "média"])}
          />
          <Area dataKey="band" name="faixa" stroke="none" fill="var(--chart-range)" fillOpacity={0.14} isAnimationActive={false} />
          <Line type="monotone" dataKey="avg" name="média" stroke="var(--chart-avg)" strokeWidth={1.5} dot={false} isAnimationActive={false} />
          {limits.high != null && <ReferenceLine y={limits.high} stroke="var(--danger)" strokeDasharray="4 3" label={{ value: `máx ${limits.high}°`, fill: "var(--danger)", fontSize: 11, position: "insideTopLeft" }} />}
          {limits.low != null && <ReferenceLine y={limits.low} stroke="var(--danger)" strokeDasharray="4 3" label={{ value: `mín ${limits.low}°`, fill: "var(--danger)", fontSize: 11, position: "insideBottomLeft" }} />}
          {[...markers].map(([label, a]) => (
            <ReferenceLine key={a.id} x={label} stroke="var(--danger)" strokeWidth={1} label={{ value: "▼", fill: "var(--danger)", fontSize: 10, position: "top" }} />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
