import {
  claimDeviceInputSchema,
  inviteInputSchema,
  updateDeviceInputSchema,
  type InviteDto,
  type MemberDto,
  type Role,
  type TeamDetailDto,
} from "@data-track/shared";
import { and, count, eq, isNull } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { sendEmail } from "#alerts/mailer";
import { requireAdmin, requireAuth } from "#auth/session";
import { addDays, generateToken, hashToken } from "#auth/tokens";
import { db } from "#db/client";
import { alertRules, devices, invites, memberships, users } from "#db/schema";
import { env } from "#env";

const INVITE_TTL_DAYS = 7;

export async function teamRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.get("/team", { preHandler: requireAuth }, async (req): Promise<TeamDetailDto> => {
    const { teamId, user } = req.auth!;
    const members = await db
      .select({ id: users.id, email: users.email, name: users.name, role: memberships.role })
      .from(memberships)
      .innerJoin(users, eq(users.id, memberships.userId))
      .where(eq(memberships.teamId, teamId))
      .orderBy(users.name);
    // Convites pendentes só aparecem para admins.
    const pending =
      user.role === "admin"
        ? await db
            .select()
            .from(invites)
            .where(and(eq(invites.teamId, teamId), isNull(invites.acceptedAt)))
            .orderBy(invites.createdAt)
        : [];
    return {
      team: user.team,
      members: members.map((m): MemberDto => ({ ...m, role: m.role as Role })),
      invites: pending.map(
        (i): InviteDto => ({ id: i.id, email: i.email, role: i.role as Role, expiresAt: i.expiresAt.toISOString() }),
      ),
    };
  });

  r.post("/team/invites", { preHandler: requireAdmin, schema: { body: inviteInputSchema } }, async (req, reply) => {
    const { teamId, user } = req.auth!;
    const email = req.body.email.trim().toLowerCase();

    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (existing) return reply.code(409).send({ error: "email already registered" });

    // Um convite pendente por e-mail: o novo substitui o anterior.
    await db
      .delete(invites)
      .where(and(eq(invites.teamId, teamId), eq(invites.email, email), isNull(invites.acceptedAt)));

    const token = generateToken();
    const expiresAt = addDays(new Date(), INVITE_TTL_DAYS);
    const [row] = await db
      .insert(invites)
      .values({ teamId, email, role: req.body.role, tokenHash: hashToken(token), expiresAt, createdBy: user.id })
      .returning();

    const link = `${env.WEB_URL}/convite/${token}`;
    let emailSent = true;
    try {
      await sendEmail(
        email,
        `Convite para a equipe ${user.team.name} no Data Track`,
        `${user.name} convidou você para a equipe ${user.team.name} no Data Track.\n\nAceite o convite em: ${link}\n\nO link vale por ${INVITE_TTL_DAYS} dias.`,
      );
    } catch (err) {
      emailSent = false;
      req.log.error({ err }, "falha ao enviar e-mail de convite");
    }
    // O link volta só para o admin que criou, para repasse manual se o e-mail falhar.
    return reply.code(201).send({
      invite: { id: row!.id, email, role: req.body.role, expiresAt: expiresAt.toISOString() },
      link,
      emailSent,
    });
  });

  r.delete(
    "/team/invites/:id",
    { preHandler: requireAdmin, schema: { params: z.object({ id: z.string().uuid() }) } },
    async (req, reply) => {
      await db.delete(invites).where(and(eq(invites.id, req.params.id), eq(invites.teamId, req.auth!.teamId)));
      return reply.code(204).send();
    },
  );

  r.delete(
    "/team/members/:userId",
    { preHandler: requireAdmin, schema: { params: z.object({ userId: z.string().uuid() }) } },
    async (req, reply) => {
      const { teamId, user } = req.auth!;
      if (req.params.userId === user.id) return reply.code(400).send({ error: "cannot remove yourself" });
      const [target] = await db
        .select()
        .from(memberships)
        .where(and(eq(memberships.userId, req.params.userId), eq(memberships.teamId, teamId)))
        .limit(1);
      if (!target) return reply.code(404).send({ error: "not found" });
      if (target.role === "admin") {
        const [admins] = await db
          .select({ n: count() })
          .from(memberships)
          .where(and(eq(memberships.teamId, teamId), eq(memberships.role, "admin")));
        if ((admins?.n ?? 0) <= 1) return reply.code(400).send({ error: "team needs at least one admin" });
      }
      await db.delete(users).where(eq(users.id, req.params.userId)); // cascata: membership e sessões
      return reply.code(204).send();
    },
  );

  // Reivindica um sensor pelo ID. O device já existe (criado pela ingestão MQTT) e não pode
  // pertencer a outra equipe; a resposta é a mesma nos dois casos para não vazar IDs alheios.
  r.post("/team/devices", { preHandler: requireAdmin, schema: { body: claimDeviceInputSchema } }, async (req, reply) => {
    const { deviceId, name } = req.body;
    const [row] = await db
      .update(devices)
      .set({ teamId: req.auth!.teamId, ...(name ? { name } : {}) })
      .where(and(eq(devices.id, deviceId), isNull(devices.teamId)))
      .returning({ id: devices.id });
    if (!row) return reply.code(404).send({ error: "device not found or already claimed" });
    return reply.code(201).send({ id: row.id });
  });

  r.patch(
    "/team/devices/:id",
    { preHandler: requireAdmin, schema: { params: z.object({ id: z.string() }), body: updateDeviceInputSchema } },
    async (req, reply) => {
      const [row] = await db
        .update(devices)
        .set({ name: req.body.name || null })
        .where(and(eq(devices.id, req.params.id), eq(devices.teamId, req.auth!.teamId)))
        .returning({ id: devices.id, name: devices.name });
      return row ?? reply.code(404).send({ error: "not found" });
    },
  );

  r.delete(
    "/team/devices/:id",
    { preHandler: requireAdmin, schema: { params: z.object({ id: z.string() }) } },
    async (req, reply) => {
      const { teamId } = req.auth!;
      const [row] = await db
        .update(devices)
        .set({ teamId: null })
        .where(and(eq(devices.id, req.params.id), eq(devices.teamId, teamId)))
        .returning({ id: devices.id });
      if (!row) return reply.code(404).send({ error: "not found" });
      // Regras de alerta do sensor desvinculado deixam de fazer sentido para a equipe.
      await db.delete(alertRules).where(and(eq(alertRules.teamId, teamId), eq(alertRules.deviceId, req.params.id)));
      return reply.code(204).send();
    },
  );
}
