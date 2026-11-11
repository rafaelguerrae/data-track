"use client";
import type { SeriesPoint } from "@data-track/shared";
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const TICK = { fill: "var(--muted)", fontSize: 12 };

export function TempChart({ data }: { data: SeriesPoint[] }) {
  const rows = data.map((p) => ({
    ...p,
    band: [p.min, p.max] as [number, number],
    label: new Date(p.time).toLocaleString([], { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" }),
  }));
  return (
    <div className="h-80 w-full">
      <ResponsiveContainer>
        <ComposedChart data={rows}>
          <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" minTickGap={48} tick={TICK} stroke="var(--line)" />
          <YAxis unit="°" domain={["auto", "auto"]} tick={TICK} stroke="var(--line)" width={48} />
          <Tooltip
            contentStyle={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 8, color: "var(--ink)" }}
            formatter={(v, name) => (name === "faixa" ? [`${(v as number[])[0]!.toFixed(2)} – ${(v as number[])[1]!.toFixed(2)} °C`, "mín – máx"] : [`${Number(v).toFixed(2)} °C`, "média"])}
          />
          <Area dataKey="band" name="faixa" stroke="none" fill="var(--chart-range)" fillOpacity={0.22} isAnimationActive={false} />
          <Line type="monotone" dataKey="avg" name="média" stroke="var(--chart-avg)" strokeWidth={2} dot={false} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
