"use client";
import type { SeriesPoint } from "@data-track/shared";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function TempChart({ data }: { data: SeriesPoint[] }) {
  const rows = data.map((p) => ({ ...p, label: new Date(p.time).toLocaleString([], { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" }) }));
  return (
    <div className="h-80 w-full">
      <ResponsiveContainer>
        <LineChart data={rows}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="label" minTickGap={40} />
          <YAxis unit="°" domain={["auto", "auto"]} />
          <Tooltip formatter={(v) => `${Number(v).toFixed(2)} °C`} />
          <Line type="monotone" dataKey="max" stroke="#fca5a5" dot={false} name="máx" />
          <Line type="monotone" dataKey="avg" stroke="#2563eb" dot={false} strokeWidth={2} name="média" />
          <Line type="monotone" dataKey="min" stroke="#93c5fd" dot={false} name="mín" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
