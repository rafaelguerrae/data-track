"use client";
import type { Bucket } from "@data-track/shared";
import { useState } from "react";
import { TempChart } from "#components/temp-chart";
import { api } from "#lib/api";
import { usePoll } from "#lib/use-poll";

const RANGES: { label: string; hours: number; bucket: Bucket }[] = [
  { label: "1h", hours: 1, bucket: "1m" },
  { label: "6h", hours: 6, bucket: "5m" },
  { label: "24h", hours: 24, bucket: "15m" },
  { label: "7d", hours: 168, bucket: "1h" },
];

export default function Dashboard() {
  const [selected, setSelected] = useState<string | null>(null);
  const [range, setRange] = useState(RANGES[2]!);

  const devices = usePoll(() => api.devices(), []);
  const deviceId = selected ?? devices.data?.[0]?.id ?? null;
  const device = devices.data?.find((d) => d.id === deviceId);

  const series = usePoll(
    async () => (deviceId ? api.readings(deviceId, new Date(Date.now() - range.hours * 3600_000), range.bucket) : []),
    [deviceId, range],
  );

  if (devices.error) return <p className="text-red-600">Não foi possível falar com a API: {devices.error}</p>;
  if (devices.data && devices.data.length === 0) return <p>Nenhum dispositivo ainda. Aguardando mensagens MQTT…</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <select
          className="rounded border bg-white px-3 py-2"
          value={deviceId ?? ""}
          onChange={(e) => setSelected(e.target.value)}
        >
          {devices.data?.map((d) => (
            <option key={d.id} value={d.id}>{d.name ?? d.id}</option>
          ))}
        </select>
        <div className="flex gap-1">
          {RANGES.map((r) => (
            <button
              key={r.label}
              onClick={() => setRange(r)}
              className={`rounded px-3 py-1 text-sm ${r === range ? "bg-slate-900 text-white" : "bg-white border"}`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {device && (
        <div className="flex items-center gap-6 rounded-lg border bg-white p-4">
          <div>
            <div className="text-sm text-slate-500">Temperatura atual</div>
            <div className="text-4xl font-semibold">{device.lastTempC?.toFixed(2) ?? "--"} °C</div>
          </div>
          <span className={`rounded-full px-3 py-1 text-sm ${device.online ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
            {device.online ? "online" : "offline"}
          </span>
          <div className="text-sm text-slate-500">
            Visto por último: {device.lastSeenAt ? new Date(device.lastSeenAt).toLocaleString() : "--"}
          </div>
        </div>
      )}

      <div className="rounded-lg border bg-white p-4">
        <TempChart data={series.data ?? []} />
      </div>
    </div>
  );
}
