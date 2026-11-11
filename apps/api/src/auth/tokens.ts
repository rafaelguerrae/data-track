import { createHash, randomBytes } from "node:crypto";

/** Token opaco para cookie de sessão e link de convite (32 bytes aleatórios). */
export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Só o hash vai para o banco; o token em si fica apenas com quem o recebeu. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function isExpired(expiresAt: Date, now = new Date()): boolean {
  return expiresAt.getTime() <= now.getTime();
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}
