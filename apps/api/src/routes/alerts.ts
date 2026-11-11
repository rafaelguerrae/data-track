import { alertRuleInputSchema, type AlertEventDto, type AlertKind, type AlertRuleDto } from "@data-track/shared";
import { and, desc, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { requireAuth } from "#auth/session";
import { db } from "#db/client";
import { alertEvents, alertRules, devices } from "#db/schema";

const toDto = (r: typeof alertRules.$inferSelect): AlertRuleDto => ({
  id: r.id,
  deviceId: r.deviceId,
  kind: r.kind as AlertKind,
  threshold: r.threshold,
  cooldownMin: r.cooldownMin,
  email: r.email,
  enabled: r.enabled,
  lastTriggeredAt: r.lastTriggeredAt?.toISOString() ?? null,
});

export async function alertRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();
  app.addHook("preHandler", requireAuth);

  r.get("/alert-rules", async (req) =>
    (await db.select().from(alertRules).where(eq(alertRules.teamId, req.auth!.teamId)).orderBy(alertRules.id)).map(toDto),
  );

  r.post("/alert-rules", { schema: { body: alertRuleInputSchema } }, async (req, reply) => {
    const b = req.body;
    if ((b.kind === "temp_above" || b.kind === "temp_below") && b.threshold == null) {
      return reply.code(400).send({ error: "threshold is required for temperature rules" });
    }
    const { teamId, user } = req.auth!;
    const [owned] = await db
      .select({ id: devices.id })
      .from(devices)
      .where(and(eq(devices.id, b.deviceId), eq(devices.teamId, teamId)))
      .limit(1);
    if (!owned) return reply.code(404).send({ error: "device not found" });
    const [row] = await db
      .insert(alertRules)
      .values({ ...b, threshold: b.threshold ?? null, teamId, createdBy: user.id })
      .returning();
    return reply.code(201).send(toDto(row!));
  });

  r.patch(
    "/alert-rules/:id",
    { schema: { params: z.object({ id: z.coerce.number() }), body: z.object({ enabled: z.boolean() }) } },
    async (req, reply) => {
      const [row] = await db
        .update(alertRules)
        .set({ enabled: req.body.enabled })
        .where(and(eq(alertRules.id, req.params.id), eq(alertRules.teamId, req.auth!.teamId)))
        .returning();
      return row ? toDto(row) : reply.code(404).send({ error: "not found" });
    },
  );

  r.delete("/alert-rules/:id", { schema: { params: z.object({ id: z.coerce.number() }) } }, async (req, reply) => {
    await db
      .delete(alertRules)
      .where(and(eq(alertRules.id, req.params.id), eq(alertRules.teamId, req.auth!.teamId)));
    return reply.code(204).send();
  });

  r.get("/alerts", async (req): Promise<AlertEventDto[]> => {
    const rows = await db
      .select({ e: alertEvents })
      .from(alertEvents)
      .innerJoin(alertRules, eq(alertRules.id, alertEvents.ruleId))
      .where(eq(alertRules.teamId, req.auth!.teamId))
      .orderBy(desc(alertEvents.createdAt))
      .limit(100);
    return rows.map(({ e }) => ({
      id: e.id,
      ruleId: e.ruleId,
      deviceId: e.deviceId,
      kind: e.kind as AlertKind,
      message: e.message,
      createdAt: e.createdAt.toISOString(),
    }));
  });
}
