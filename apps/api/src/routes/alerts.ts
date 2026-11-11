import {
  ALERT_PAGE_SIZE,
  alertKindSchema,
  alertRuleInputSchema,
  alertRuleUpdateSchema,
  type AlertEventDto,
  type AlertKind,
  type AlertRuleDto,
} from "@data-track/shared";
import { and, desc, eq, lt, type SQL } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { sendAlertEmail } from "#alerts/mailer";
import { buildMessage } from "#alerts/rules";
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
      .values({ ...b, email: b.email.trim().toLowerCase(), threshold: b.threshold ?? null, teamId, createdBy: user.id })
      .returning();
    return reply.code(201).send(toDto(row!));
  });

  r.patch(
    "/alert-rules/:id",
    { schema: { params: z.object({ id: z.coerce.number() }), body: alertRuleUpdateSchema } },
    async (req, reply) => {
      const where = and(eq(alertRules.id, req.params.id), eq(alertRules.teamId, req.auth!.teamId));
      const [cur] = await db.select().from(alertRules).where(where).limit(1);
      if (!cur) return reply.code(404).send({ error: "not found" });

      const next = { ...cur, ...req.body };
      const isTemp = next.kind === "temp_above" || next.kind === "temp_below";
      if (isTemp && next.threshold == null) {
        return reply.code(400).send({ error: "threshold is required for temperature rules" });
      }
      // Mudou a condição: zera o último disparo para o intervalo antigo não silenciar a regra nova.
      const conditionChanged = next.kind !== cur.kind || (isTemp && next.threshold !== cur.threshold);
      const [row] = await db
        .update(alertRules)
        .set({
          kind: next.kind,
          threshold: isTemp ? next.threshold : null,
          cooldownMin: next.cooldownMin,
          email: next.email.trim().toLowerCase(),
          enabled: next.enabled,
          ...(conditionChanged ? { lastTriggeredAt: null } : {}),
        })
        .where(where)
        .returning();
      return toDto(row!);
    },
  );

  // Envia um e-mail de teste ao destinatário da regra, para validar o SMTP e o endereço.
  r.post(
    "/alert-rules/:id/test",
    {
      schema: { params: z.object({ id: z.coerce.number() }) },
      config: { rateLimit: { max: 5, timeWindow: "1 minute" } },
    },
    async (req, reply) => {
      const [rule] = await db
        .select()
        .from(alertRules)
        .where(and(eq(alertRules.id, req.params.id), eq(alertRules.teamId, req.auth!.teamId)))
        .limit(1);
      if (!rule) return reply.code(404).send({ error: "not found" });
      const [device] = await db.select({ name: devices.name }).from(devices).where(eq(devices.id, rule.deviceId)).limit(1);
      const sensor = device?.name ?? rule.deviceId;
      try {
        await sendAlertEmail(
          rule.email,
          `[Data Track] Teste de alerta: ${sensor}`,
          `Este é um e-mail de teste da regra do sensor ${sensor}.\nExemplo de aviso: ${buildMessage(rule.kind, { tempC: (rule.threshold ?? 0) + 1, threshold: rule.threshold, code: "0x04" })}`,
        );
      } catch (err) {
        req.log.error({ err }, "falha ao enviar e-mail de teste");
        return reply.code(502).send({ error: "email delivery failed" });
      }
      return { ok: true };
    },
  );

  r.delete("/alert-rules/:id", { schema: { params: z.object({ id: z.coerce.number() }) } }, async (req, reply) => {
    await db
      .delete(alertRules)
      .where(and(eq(alertRules.id, req.params.id), eq(alertRules.teamId, req.auth!.teamId)));
    return reply.code(204).send();
  });

  // Histórico paginado por cursor (`before` = id do último item já carregado), com filtros opcionais.
  r.get(
    "/alerts",
    {
      schema: {
        querystring: z.object({
          deviceId: z.string().optional(),
          kind: alertKindSchema.optional(),
          before: z.coerce.number().int().optional(),
          limit: z.coerce.number().int().min(1).max(100).default(ALERT_PAGE_SIZE),
        }),
      },
    },
    async (req): Promise<AlertEventDto[]> => {
      const q = req.query;
      const filters: SQL[] = [eq(alertRules.teamId, req.auth!.teamId)];
      if (q.deviceId) filters.push(eq(alertEvents.deviceId, q.deviceId));
      if (q.kind) filters.push(eq(alertEvents.kind, q.kind));
      if (q.before) filters.push(lt(alertEvents.id, q.before));
      const rows = await db
        .select({ e: alertEvents })
        .from(alertEvents)
        .innerJoin(alertRules, eq(alertRules.id, alertEvents.ruleId))
        .where(and(...filters))
        .orderBy(desc(alertEvents.id))
        .limit(q.limit);
      return rows.map(({ e }) => ({
        id: e.id,
        ruleId: e.ruleId,
        deviceId: e.deviceId,
        kind: e.kind as AlertKind,
        message: e.message,
        createdAt: e.createdAt.toISOString(),
      }));
    },
  );
}
