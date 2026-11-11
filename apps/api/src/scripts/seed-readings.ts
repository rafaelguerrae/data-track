import { parseArgs } from "node:util";
import { sql } from "drizzle-orm";
import { db, pool } from "#db/client";
import { devices, teams } from "#db/schema";
import { env } from "#env";

// Popula o banco de DEV com sensores e leituras sintéticas, para ver o dashboard com volume.
// Uso: pnpm seed [--days 7] [--interval 30] [--sensors 3] [--team "Nome da equipe"]
// Idempotente: a cada execução, TODAS as leituras dos sensores sensor-1..N são apagadas e recriadas.

interface Profile {
  id: string;
  name: string;
  base: number; // temperatura média (°C)
  daily: number; // amplitude do ciclo diário
  compressor: number; // amplitude da oscilação curta (liga/desliga)
  noise: number; // ruído do sensor
  spike: number; // pico de "porta aberta" (0 = sem picos)
  spikeEveryMin: number;
  online: boolean;
}

const PROFILES: Profile[] = [
  { id: "sensor-1", name: "Câmara fria", base: 4, daily: 1.2, compressor: 0.4, noise: 0.3, spike: 4, spikeEveryMin: 750, online: true },
  { id: "sensor-2", name: "Freezer", base: -18, daily: 1.5, compressor: 0.6, noise: 0.3, spike: 5, spikeEveryMin: 1080, online: true },
  { id: "sensor-3", name: "Sala de armazenamento", base: 22, daily: 2.5, compressor: 0.3, noise: 0.2, spike: 0, spikeEveryMin: 0, online: true },
  { id: "sensor-4", name: "Estufa", base: 30, daily: 3, compressor: 0.5, noise: 0.4, spike: 0, spikeEveryMin: 0, online: false },
];

const { values } = parseArgs({
  options: {
    days: { type: "string", default: "7" },
    interval: { type: "string", default: "30" },
    sensors: { type: "string", default: "3" },
    team: { type: "string" },
  },
});
const days = Number(values.days);
const interval = Number(values.interval);
const count = Number(values.sensors);
if (![days, interval, count].every(Number.isInteger) || days < 1 || interval < 1 || count < 1 || count > PROFILES.length) {
  console.error(`uso: pnpm seed [--days N] [--interval segundos] [--sensors 1-${PROFILES.length}] [--team "Nome"]`);
  process.exit(1);
}

// Trava de segurança: dados falsos só em banco local.
const host = new URL(env.DATABASE_URL).hostname;
if (!["localhost", "127.0.0.1", "::1", "[::1]", "timescaledb"].includes(host)) {
  console.error(`recusado: DATABASE_URL aponta para "${host}". O seed só roda em banco local.`);
  process.exit(1);
}

const all = await db.select().from(teams).orderBy(teams.createdAt);
const team = values.team ? all.find((t) => t.name === values.team) : all.length === 1 ? all[0] : undefined;
if (!team) {
  console.error(
    all.length === 0
      ? "nenhuma equipe: rode antes `pnpm --filter @data-track/api create-admin`"
      : `informe a equipe com --team. Existentes: ${all.map((t) => `"${t.name}"`).join(", ")}`,
  );
  process.exit(1);
}

let total = 0;
for (const p of PROFILES.slice(0, count)) {
  await db
    .insert(devices)
    .values({ id: p.id, name: p.name, teamId: team.id, online: p.online, lastSeenAt: new Date() })
    .onConflictDoUpdate({
      target: devices.id,
      set: { name: p.name, teamId: team.id, online: p.online, lastSeenAt: new Date() },
    });

  const spikeSteps = Math.max(1, Math.round((4 * 60) / interval)); // pico dura ~4 min
  const spikePeriod = p.spikeEveryMin > 0 ? Math.round((p.spikeEveryMin * 60) / interval) : 0;
  await db.execute(sql`DELETE FROM readings WHERE device_id = ${p.id}`);
  const res = await db.execute(sql`
    WITH s AS (
      SELECT t, extract(epoch FROM t) AS e, (extract(epoch FROM t)::bigint / ${interval}::int) AS step
      FROM generate_series(now() - ${days}::int * interval '1 day', now() - interval '1 minute', ${interval}::int * interval '1 second') AS t
    )
    INSERT INTO readings (time, device_id, temp_c, device_uptime_ms)
    SELECT t, ${p.id},
      round((
        ${p.base}::float8
        + ${p.daily}::float8 * sin(2*pi()*e/86400)
        + ${p.compressor}::float8 * sin(2*pi()*e/2400)
        + (random() - 0.5) * ${p.noise}::float8
        + CASE WHEN ${spikePeriod}::int > 0 AND step % NULLIF(${spikePeriod}::int, 0) < ${spikeSteps}::int
               THEN ${p.spike}::float8 * (1 - (step % NULLIF(${spikePeriod}::int, 0)) / ${spikeSteps}::float8) ELSE 0 END
      )::numeric, 2),
      ((extract(epoch FROM t - (now() - ${days}::int * interval '1 day')) * 1000)::bigint % 2147483647)::int
    FROM s
    ON CONFLICT DO NOTHING`);
  total += res.rowCount ?? 0;
  console.log(`${p.id} (${p.name}): ${res.rowCount} leituras`);
}

console.log(`${total} leituras em ${count} sensor(es), ${days} dia(s), a cada ${interval}s, na equipe "${team.name}"`);
await pool.end();
