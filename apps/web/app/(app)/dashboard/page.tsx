"use client";
import type { AlertRuleDto, Bucket, DeviceStatsDto } from "@data-track/shared";
import Link from "next/link";
import { useState } from "react";
import { DeviceIcon } from "#components/device-icon";
import { HourlyHeatmap } from "#components/hourly-heatmap";
import { Sparkline } from "#components/sparkline";
import { TempChart } from "#components/temp-chart";
import { OnlineBadge } from "#components/ui/badge";
import { Card, SectionTitle } from "#components/ui/card";
import { useUser } from "#components/user-context";
import { useAlertMarkers, useDeviceStats, useDevices, useHourly, useReadings, useRules, useSparklines } from "#lib/queries";

const RANGES: { label: string; hours: number; bucket: Bucket }[] = [
  { label: "1h", hours: 1, bucket: "1m" },
  { label: "6h", hours: 6, bucket: "5m" },
  { label: "24h", hours: 24, bucket: "15m" },
  { label: "7d", hours: 168, bucket: "1h" },
];

/** Faixa aceitável do sensor: o menor teto e o maior piso entre as regras de temperatura ativas. */
function limitsFor(rules: AlertRuleDto[] | undefined, deviceId: string | null) {
  const mine = (rules ?? []).filter((r) => r.deviceId === deviceId && r.enabled && r.threshold != null);
  const highs = mine.filter((r) => r.kind === "temp_above").map((r) => r.threshold!);
  const lows = mine.filter((r) => r.kind === "temp_below").map((r) => r.threshold!);
  return {
    high: highs.length ? Math.min(...highs) : undefined,
    low: lows.length ? Math.max(...lows) : undefined,
  };
}

const num = (v: number | null | undefined, digits = 1) => (v == null ? "—" : v.toFixed(digits));

function Stat({ label, value, unit, hint }: { label: string; value: string; unit?: string; hint?: string }) {
  return (
    <div className="bg-surface p-3">
      <dt className="font-mono text-[11px] tracking-wider text-muted uppercase">{label}</dt>
      <dd className="mt-1 font-mono text-xl font-medium">
        {value}
        {unit && value !== "—" && <span className="text-sm text-muted"> {unit}</span>}
      </dd>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}

function StatsStrip({ stats, hasLimits }: { stats: DeviceStatsDto | undefined; hasLimits: boolean }) {
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-4">
      <Stat label="Mínima" value={num(stats?.min)} unit="°C" />
      <Stat label="Máxima" value={num(stats?.max)} unit="°C" />
      <Stat label="Média" value={num(stats?.avg)} unit="°C" />
      <Stat label="Leituras" value={stats ? stats.count.toLocaleString("pt-BR") : "—"} />
      <Stat
        label="Dentro da faixa"
        value={num(stats?.inRangePct, 1)}
        unit="%"
        hint={hasLimits ? undefined : "Crie uma regra de temperatura"}
      />
      <Stat label="Disponibilidade" value={num(stats?.coveragePct, 1)} unit="%" hint="Estimada pelas leituras" />
      <Stat label="Alertas" value={stats ? String(stats.alerts) : "—"} />
      <Stat
        label="Falhas"
        value={stats ? String(stats.faults) : "—"}
        hint={stats?.lastFault ? `Última: ${stats.lastFault.code}` : undefined}
      />
    </dl>
  );
}

export default function Dashboard() {
  const user = useUser();
  const [selected, setSelected] = useState<string | null>(null);
  const [range, setRange] = useState(RANGES[2]!);

  const devices = useDevices();
  const deviceId = selected ?? devices.data?.[0]?.id ?? null;
  const device = devices.data?.find((d) => d.id === deviceId);
  const series = useReadings(deviceId, range);
  const rules = useRules();
  const limits = limitsFor(rules.data, deviceId);
  const stats = useDeviceStats(deviceId, range, limits);
  const markers = useAlertMarkers(deviceId, range);
  const hourly = useHourly(deviceId);
  const sparks = useSparklines();
  const sparkOf = (id: string) => sparks.data?.find((s) => s.deviceId === id)?.points ?? [];

  if (devices.isError) return <p className="text-danger">Não foi possível carregar os sensores.</p>;
  if (!devices.data) {
    return (
      <div aria-busy className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => <div key={i} className="h-28 animate-pulse rounded-xl border border-line bg-surface-2" />)}
      </div>
    );
  }
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
              className={`rounded-xl border p-4 text-left transition ${d.id === deviceId ? "border-ink bg-surface shadow-[inset_3px_0_0_var(--accent)]" : "border-line bg-surface hover:border-muted"}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
                  <DeviceIcon icon={d.icon} className="size-7 text-sm" />
                  <span className="truncate">{d.name ?? d.id}</span>
                </span>
                <OnlineBadge online={d.online} />
              </div>
              <div className="mt-2 flex items-end justify-between gap-3">
                <div className="font-mono text-3xl font-medium tracking-tight">
                  {d.lastTempC?.toFixed(1) ?? "--"}<span className="text-lg text-muted"> °C</span>
                </div>
                <Sparkline points={sparkOf(d.id)} />
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
          <div className="flex gap-2 border-b border-line">
            {RANGES.map((r) => (
              <button
                key={r.label}
                onClick={() => setRange(r)}
                aria-pressed={r === range}
                className={`-mb-px border-b-2 px-2 py-2 font-mono text-xs sm:py-1 transition ${r === range ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink"}`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
        <StatsStrip stats={stats.data} hasLimits={limits.low != null || limits.high != null} />
        <Card className="p-4">
          <TempChart data={series.data ?? []} limits={limits} alerts={markers.data} />
        </Card>
      </section>

      <section>
        <SectionTitle>Temperatura por hora · 7 dias</SectionTitle>
        <Card className="p-4">
          {hourly.data ? <HourlyHeatmap cells={hourly.data} /> : <div className="h-24 animate-pulse rounded-sm bg-surface-2" />}
        </Card>
      </section>
    </div>
  );
}
