import {
  BUCKET_INTERVAL,
  bucketSchema, type DeviceDto,
  type DeviceStatsDto,
  type HourlyCell,
  type SeriesPoint,
  type SparklineDto,
} from "@data-track/shared";
import { and, count, desc, eq, gte, lte, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { requireAuth } from "#auth/session";
import { db } from "#db/client";
import { alertEvents, devices, faults, readings } from "#db/schema";

export async function deviceRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();
  app.addHook("preHandler", requireAuth);

  // Sensores de outra equipe (ou sem equipe) respondem 404, como se não existissem.
  app.addHook("preHandler", async (req, reply) => {
    const id = (req.params as { id?: string } | undefined)?.id;
    if (!id) return;
    const [d] = await db
      .select({ id: devices.id })
      .from(devices)
      .where(and(eq(devices.id, id), eq(devices.teamId, req.auth!.teamId)))
      .limit(1);
    if (!d) return reply.code(404).send({ error: "device not found" });
  });

  r.get("/devices", async (req): Promise<DeviceDto[]> => {
    const rows = await db.select().from(devices).where(eq(devices.teamId, req.auth!.teamId)).orderBy(devices.id);
    // Última leitura de cada sensor numa só consulta.
    const last = await db.execute<{ device_id: string; temp_c: number }>(sql`
      SELECT DISTINCT ON (device_id) device_id, temp_c
      FROM readings
      WHERE device_id IN (SELECT id FROM devices WHERE team_id = ${req.auth!.teamId})
      ORDER BY device_id, time DESC`);
    const lastTemp = new Map(last.rows.map((x) => [x.device_id, Number(x.temp_c)]));
    return rows.map((d) => ({
      id: d.id,
      name: d.name,
      icon: d.icon,
      online: d.online,
      lastSeenAt: d.lastSeenAt?.toISOString() ?? null,
      lastTempC: lastTemp.get(d.id) ?? null,
    }));
  });

  // Mini gráficos dos cards: média a cada 30 min nas últimas 24h, todos os sensores da equipe de uma vez.
  r.get("/devices/sparklines", async (req): Promise<SparklineDto[]> => {
    const result = await db.execute<{ device_id: string; avg: number }>(sql`
      SELECT device_id, time_bucket('30 minutes'::interval, time) AS bucket, avg(temp_c) AS avg
      FROM readings
      WHERE time >= now() - interval '24 hours'
        AND device_id IN (SELECT id FROM devices WHERE team_id = ${req.auth!.teamId})
      GROUP BY device_id, bucket ORDER BY device_id, bucket`);
    const byDevice = new Map<string, number[]>();
    for (const x of result.rows) byDevice.set(x.device_id, [...(byDevice.get(x.device_id) ?? []), Number(x.avg)]);
    return [...byDevice].map(([deviceId, points]) => ({ deviceId, points }));
  });

  r.get("/devices/:id/latest", { schema: { params: z.object({ id: z.string() }) } }, async (req, reply) => {
    const [row] = await db
      .select()
      .from(readings)
      .where(eq(readings.deviceId, req.params.id))
      .orderBy(desc(readings.time))
      .limit(1);
    if (!row) return reply.code(404).send({ error: "no readings" });
    return { time: row.time.toISOString(), tempC: row.tempC };
  });

  r.get(
    "/devices/:id/readings",
    {
      schema: {
        params: z.object({ id: z.string() }),
        querystring: z.object({
          from: z.coerce.date().optional(),
          to: z.coerce.date().optional(),
          bucket: bucketSchema.default("5m"),
        }),
      },
    },
    async (req): Promise<SeriesPoint[]> => {
      const to = req.query.to ?? new Date();
      const from = req.query.from ?? new Date(to.getTime() - 24 * 3600_000);
      const interval = BUCKET_INTERVAL[req.query.bucket];
      const result = await db.execute<{ bucket: Date; avg: number; min: number; max: number }>(sql`
        SELECT time_bucket(${interval}::interval, time) AS bucket,
               avg(temp_c) AS avg, min(temp_c) AS min, max(temp_c) AS max
        FROM readings
        WHERE device_id = ${req.params.id}
          AND time >= ${from.toISOString()}::timestamptz AND time <= ${to.toISOString()}::timestamptz
        GROUP BY bucket ORDER BY bucket`);
      return result.rows.map((x) => ({
        time: new Date(x.bucket).toISOString(),
        avg: Number(x.avg),
        min: Number(x.min),
        max: Number(x.max),
      }));
    },
  );

  r.get(
    "/devices/:id/stats",
    {
      schema: {
        params: z.object({ id: z.string() }),
        querystring: z.object({
          from: z.coerce.date(),
          to: z.coerce.date().optional(),
          // Faixa aceitável (das regras de alerta de temperatura) para o % dentro da faixa.
          low: z.coerce.number().optional(),
          high: z.coerce.number().optional(),
        }),
      },
    },
    async (req): Promise<DeviceStatsDto> => {
      const { id } = req.params;
      const { from, low, high } = req.query;
      const to = req.query.to ?? new Date();
      const hasRange = low != null || high != null;
      const [agg] = (
        await db.execute<{
          n: number;
          min: number | null;
          max: number | null;
          avg: number | null;
          inrange: number;
          first_time: Date | null;
          minutes: number;
        }>(sql`
          SELECT count(*)::int AS n, min(temp_c) AS min, max(temp_c) AS max, avg(temp_c) AS avg,
                 count(*) FILTER (WHERE (${low ?? null}::float8 IS NULL OR temp_c >= ${low ?? null}::float8)
                                    AND (${high ?? null}::float8 IS NULL OR temp_c <= ${high ?? null}::float8))::int AS inrange,
                 (SELECT min(time) FROM readings WHERE device_id = ${id}) AS first_time,
                 count(DISTINCT time_bucket('1 minute'::interval, time))::int AS minutes
          FROM readings
          WHERE device_id = ${id}
            AND time >= ${from.toISOString()}::timestamptz AND time <= ${to.toISOString()}::timestamptz`)
      ).rows;

      // Só conta o tempo desde que o sensor começou a enviar, para um sensor novo não parecer instável.
      const start = agg?.first_time ? Math.max(from.getTime(), new Date(agg.first_time).getTime()) : null;
      const expected = start == null ? 0 : Math.max(1, Math.ceil((to.getTime() - start) / 60_000));

      const inWindow = (col: typeof alertEvents.createdAt | typeof faults.time) => and(gte(col, from), lte(col, to));
      const [alertCount] = await db
        .select({ n: count() })
        .from(alertEvents)
        .where(and(eq(alertEvents.deviceId, id), inWindow(alertEvents.createdAt)));
      const faultWhere = and(eq(faults.deviceId, id), inWindow(faults.time));
      const [faultCount] = await db.select({ n: count() }).from(faults).where(faultWhere);
      const [lastFault] = await db.select().from(faults).where(faultWhere).orderBy(desc(faults.time)).limit(1);

      const n = agg?.n ?? 0;
      return {
        count: n,
        min: agg?.min != null ? Number(agg.min) : null,
        max: agg?.max != null ? Number(agg.max) : null,
        avg: agg?.avg != null ? Number(agg.avg) : null,
        inRangePct: hasRange && n > 0 ? (agg!.inrange / n) * 100 : null,
        coveragePct: expected > 0 ? Math.min(100, (agg!.minutes / expected) * 100) : null,
        alerts: alertCount?.n ?? 0,
        faults: faultCount?.n ?? 0,
        lastFault: lastFault ? { time: lastFault.time.toISOString(), code: lastFault.code } : null,
      };
    },
  );

  r.get(
    "/devices/:id/hourly",
    {
      schema: {
        params: z.object({ id: z.string() }),
        querystring: z.object({
          from: z.coerce.date(),
          to: z.coerce.date().optional(),
          // Fuso IANA do navegador, para as horas baterem com o relógio de quem olha.
          tz: z
            .string()
            .default("UTC")
            .refine((tz) => {
              try {
                new Intl.DateTimeFormat("en", { timeZone: tz });
                return true;
              } catch {
                return false;
              }
            }, "invalid timezone"),
        }),
      },
    },
    async (req): Promise<HourlyCell[]> => {
      const to = req.query.to ?? new Date();
      const result = await db.execute<{ day: string; hour: number; avg: number }>(sql`
        SELECT to_char(time AT TIME ZONE ${req.query.tz}, 'YYYY-MM-DD') AS day,
               extract(hour FROM time AT TIME ZONE ${req.query.tz})::int AS hour,
               avg(temp_c) AS avg
        FROM readings
        WHERE device_id = ${req.params.id}
          AND time >= ${req.query.from.toISOString()}::timestamptz AND time <= ${to.toISOString()}::timestamptz
        GROUP BY day, hour ORDER BY day, hour`);
      return result.rows.map((x) => ({ day: x.day, hour: Number(x.hour), avg: Number(x.avg) }));
    },
  );

  r.get("/devices/:id/faults", { schema: { params: z.object({ id: z.string() }) } }, async (req) => {
    const rows = await db
      .select()
      .from(faults)
      .where(eq(faults.deviceId, req.params.id))
      .orderBy(desc(faults.time))
      .limit(50);
    return rows.map((f) => ({ time: f.time.toISOString(), code: f.code }));
  });
}
