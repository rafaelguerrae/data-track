import {
  acceptInviteInputSchema,
  loginInputSchema,
  resetPasswordInputSchema,
  resetRequestInputSchema,
  twoFactorInputSchema,
  type InvitePreviewDto,
  type Role,
  type UserDto,
} from "@data-track/shared";
import { and, eq, gt, isNull } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { hashPassword, verifyPassword } from "#auth/password";
import {
  SESSION_COOKIE,
  clearSessionCookie,
  createSession,
  destroySession,
  requireAuth,
} from "#auth/session";
import { hashToken } from "#auth/tokens";
import { db } from "#db/client";
import { invites, memberships, sessions, teams, users } from "#db/schema";

// Hash descartável para que login com e-mail inexistente custe o mesmo tempo de um existente.
const dummyHash = hashPassword("dummy-password-for-timing");

// MOCK do 2FA: o código é fixo. Trocar por verificação real do código enviado por e-mail
// (guardar hash + validade em tabela) quando o envio existir.
const MOCK_TWO_FACTOR_CODE = "6767";

function isValidTwoFactorCode(_email: string, code: string): boolean {
  return code === MOCK_TWO_FACTOR_CODE;
}

const tokenParams = z.object({ token: z.string().min(10).max(200) });

async function findOpenInvite(token: string) {
  const [row] = await db
    .select({
      id: invites.id,
      email: invites.email,
      role: invites.role,
      teamId: invites.teamId,
      teamName: teams.name,
    })
    .from(invites)
    .innerJoin(teams, eq(teams.id, invites.teamId))
    .where(
      and(eq(invites.tokenHash, hashToken(token)), isNull(invites.acceptedAt), gt(invites.expiresAt, new Date())),
    )
    .limit(1);
  return row;
}

export async function authRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.post(
    "/auth/login",
    {
      schema: { body: loginInputSchema },
      config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
    },
    async (req, reply) => {
      const email = req.body.email.trim().toLowerCase();
      const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
      const ok = await verifyPassword(req.body.password, user?.passwordHash ?? (await dummyHash));
      if (!user || !ok) return reply.code(401).send({ error: "invalid credentials" });
      await createSession(reply, user.id);
      return { ok: true };
    },
  );

  r.post("/auth/logout", async (req, reply) => {
    const token = req.cookies[SESSION_COOKIE];
    if (token) await destroySession(token);
    clearSessionCookie(reply);
    return reply.code(204).send();
  });

  // Recuperação de senha em 3 passos: pedir código, validar o 2FA, definir a nova senha.
  // Nenhuma resposta revela se o e-mail tem cadastro.
  r.post(
    "/auth/password-reset/request",
    {
      schema: { body: resetRequestInputSchema },
      config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
    },
    async () => {
      // MOCK: aqui entraria o envio do código por e-mail (sendEmail em #alerts/mailer).
      return { ok: true };
    },
  );

  r.post(
    "/auth/2fa/validate",
    {
      schema: { body: twoFactorInputSchema },
      config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
    },
    async (req, reply) => {
      if (!isValidTwoFactorCode(req.body.email, req.body.code)) {
        return reply.code(400).send({ error: "invalid code" });
      }
      return { ok: true };
    },
  );

  r.post(
    "/auth/password-reset",
    {
      schema: { body: resetPasswordInputSchema },
      config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
    },
    async (req, reply) => {
      // Revalida o código para que o passo final não possa ser chamado pulando o 2FA.
      if (!isValidTwoFactorCode(req.body.email, req.body.code)) {
        return reply.code(400).send({ error: "invalid code" });
      }
      const email = req.body.email.trim().toLowerCase();
      const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
      if (user) {
        const passwordHash = await hashPassword(req.body.password);
        await db.transaction(async (tx) => {
          await tx.update(users).set({ passwordHash }).where(eq(users.id, user.id));
          // Quem tinha a senha antiga não pode continuar logado.
          await tx.delete(sessions).where(eq(sessions.userId, user.id));
        });
      }
      return { ok: true };
    },
  );

  r.get("/auth/me", { preHandler: requireAuth }, async (req): Promise<UserDto> => req.auth!.user);

  r.get("/auth/invites/:token", { schema: { params: tokenParams } }, async (req, reply): Promise<InvitePreviewDto | void> => {
    const invite = await findOpenInvite(req.params.token);
    if (!invite) return reply.code(404).send({ error: "invite not found or expired" });
    return { email: invite.email, teamName: invite.teamName };
  });

  r.post(
    "/auth/invites/:token/accept",
    {
      schema: { params: tokenParams, body: acceptInviteInputSchema },
      config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
    },
    async (req, reply) => {
      const invite = await findOpenInvite(req.params.token);
      if (!invite) return reply.code(404).send({ error: "invite not found or expired" });

      const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, invite.email)).limit(1);
      if (existing) return reply.code(409).send({ error: "email already registered" });

      const passwordHash = await hashPassword(req.body.password);
      const userId = await db.transaction(async (tx) => {
        const [u] = await tx
          .insert(users)
          .values({ email: invite.email, name: req.body.name, passwordHash })
          .returning({ id: users.id });
        await tx.insert(memberships).values({ userId: u!.id, teamId: invite.teamId, role: invite.role as Role });
        await tx.update(invites).set({ acceptedAt: new Date() }).where(eq(invites.id, invite.id));
        return u!.id;
      });

      await createSession(reply, userId);
      return reply.code(201).send({ ok: true });
    },
  );
}
