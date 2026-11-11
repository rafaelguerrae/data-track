import { and, eq, lt } from "drizzle-orm";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { Role, UserDto } from "@data-track/shared";
import { db } from "#db/client";
import { memberships, sessions, teams, users } from "#db/schema";
import { env } from "#env";
import { addDays, generateToken, hashToken, isExpired } from "./tokens";

export const SESSION_COOKIE = "dt_session";

export interface AuthContext {
  user: UserDto;
  teamId: string;
  sessionId: string;
}

declare module "fastify" {
  interface FastifyRequest {
    auth?: AuthContext;
  }
}

export function setSessionCookie(reply: FastifyReply, token: string, expiresAt: Date) {
  reply.setCookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.COOKIE_SECURE,
    path: "/",
    expires: expiresAt,
  });
}

export function clearSessionCookie(reply: FastifyReply) {
  reply.clearCookie(SESSION_COOKIE, { path: "/" });
}

export async function createSession(reply: FastifyReply, userId: string) {
  const token = generateToken();
  const expiresAt = addDays(new Date(), env.SESSION_TTL_DAYS);
  await db.insert(sessions).values({ id: hashToken(token), userId, expiresAt });
  setSessionCookie(reply, token, expiresAt);
  // Aproveita para limpar sessões vencidas.
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
}

export async function destroySession(token: string) {
  await db.delete(sessions).where(eq(sessions.id, hashToken(token)));
}

async function loadAuth(token: string, reply: FastifyReply): Promise<AuthContext | null> {
  const id = hashToken(token);
  const [row] = await db
    .select({
      sessionExpires: sessions.expiresAt,
      userId: users.id,
      email: users.email,
      name: users.name,
      role: memberships.role,
      teamId: teams.id,
      teamName: teams.name,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .innerJoin(memberships, eq(memberships.userId, users.id))
    .innerJoin(teams, eq(teams.id, memberships.teamId))
    .where(eq(sessions.id, id))
    .limit(1);
  if (!row || isExpired(row.sessionExpires)) return null;

  // Renovação deslizante: estende quando passou da metade da validade.
  const ttlMs = env.SESSION_TTL_DAYS * 24 * 3600_000;
  if (row.sessionExpires.getTime() - Date.now() < ttlMs / 2) {
    const expiresAt = addDays(new Date(), env.SESSION_TTL_DAYS);
    await db.update(sessions).set({ expiresAt }).where(and(eq(sessions.id, id)));
    setSessionCookie(reply, token, expiresAt);
  }

  return {
    sessionId: id,
    teamId: row.teamId,
    user: {
      id: row.userId,
      email: row.email,
      name: row.name,
      role: row.role as Role,
      team: { id: row.teamId, name: row.teamName },
    },
  };
}

/** preHandler: exige sessão válida e preenche `req.auth`. */
export async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  const token = req.cookies[SESSION_COOKIE];
  const auth = token ? await loadAuth(token, reply) : null;
  if (!auth) {
    clearSessionCookie(reply);
    return reply.code(401).send({ error: "unauthorized" });
  }
  req.auth = auth;
}

/** preHandler: além de autenticado, exige papel de admin da equipe. */
export async function requireAdmin(req: FastifyRequest, reply: FastifyReply) {
  const denied = await requireAuth(req, reply);
  if (denied) return denied;
  if (req.auth!.user.role !== "admin") return reply.code(403).send({ error: "forbidden" });
}
