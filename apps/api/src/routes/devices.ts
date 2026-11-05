import { BUCKET_INTERVAL, bucketSchema, type DeviceDto, type SeriesPoint } from "@data-track/shared";
import { desc, eq, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { db } from "#db/client";
import { devices, faults, readings } from "#db/schema";

export async function deviceRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.get("/devices", async (): Promise<DeviceDto[]> => {
    const rows = await db.select().from(devices).orderBy(devices.id);
    return Promise.all(
      rows.map(async (d) => {
        const [last] = await db
          .select({ tempC: readings.tempC })
          .from(readings)
          .where(eq(readings.deviceId, d.id))
          .orderBy(desc(readings.time))
          .limit(1);
        return {
          id: d.id,
          name: d.name,
          online: d.online,
          lastSeenAt: d.lastSeenAt?.toISOString() ?? null,
          lastTempC: last?.tempC ?? null,
        };
      }),
    );
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
