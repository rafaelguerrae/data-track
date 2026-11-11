"use client";
import { Thermometer } from "lucide-react";
import type { Bucket } from "@data-track/shared";
import Link from "next/link";
import { useState } from "react";
import { TempChart } from "#components/temp-chart";
import { OnlineBadge } from "#components/ui/badge";
import { Card, SectionTitle } from "#components/ui/card";
import { useUser } from "#components/user-context";
import { useDevices, useReadings } from "#lib/queries";

const RANGES: { label: string; hours: number; bucket: Bucket }[] = [
  { label: "1h", hours: 1, bucket: "1m" },
  { label: "6h", hours: 6, bucket: "5m" },
  { label: "24h", hours: 24, bucket: "15m" },
  { label: "7d", hours: 168, bucket: "1h" },
];

export default function Dashboard() {
  const user = useUser();
  const [selected, setSelected] = useState<string | null>(null);
  const [range, setRange] = useState(RANGES[2]!);

  const devices = useDevices();
  const deviceId = selected ?? devices.data?.[0]?.id ?? null;
  const device = devices.data?.find((d) => d.id === deviceId);
  const series = useReadings(deviceId, range);

  if (devices.isError) return <p className="text-danger">Não foi possível carregar os sensores.</p>;
  if (!devices.data) return <p className="text-sm text-muted">Carregando…</p>;
  if (devices.data.length === 0) {
    return (
      <Card className="p-8 text-center">
        <h1 className="text-lg font-semibold">Nenhum sensor na equipe</h1>
        <p className="mt-1 text-sm text-muted">
          {user.role === "admin" ? (
            <>Vincule um sensor pelo ID em <Link href="/equipe" className="text-accent underline">Equipe</Link>.</>
          ) : (
            "Peça a um administrador para vincular os sensores da equipe."
          )}
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      <section>
        <SectionTitle>Sensores</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {devices.data.map((d) => (
            <button
              key={d.id}
              onClick={() => setSelected(d.id)}
              aria-pressed={d.id === deviceId}
              className={`rounded-xl border p-4 text-left transition ${d.id === deviceId ? "border-accent bg-accent-soft" : "border-line bg-surface hover:bg-surface-2"}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-1.5 text-sm font-medium">
                  <Thermometer className="size-4 shrink-0 text-accent" aria-hidden />
                  <span className="truncate">{d.name ?? d.id}</span>
                </span>
                <OnlineBadge online={d.online} />
              </div>
              <div className="mt-2 font-mono text-3xl font-medium tracking-tight">
                {d.lastTempC?.toFixed(1) ?? "--"}<span className="text-lg text-muted"> °C</span>
              </div>
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold tracking-tight">{device?.name ?? device?.id}</h2>
            <p className="text-xs text-muted">
              Visto por último: {device?.lastSeenAt ? new Date(device.lastSeenAt).toLocaleString() : "--"}
            </p>
          </div>
          <div className="flex gap-1 rounded-lg bg-surface-2 p-1">
            {RANGES.map((r) => (
              <button
                key={r.label}
                onClick={() => setRange(r)}
                aria-pressed={r === range}
                className={`rounded-md px-3 py-1 font-mono text-xs transition ${r === range ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink"}`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
        <Card className="p-4">
          <TempChart data={series.data ?? []} />
        </Card>
      </section>
    </div>
  );
}
