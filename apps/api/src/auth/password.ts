import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const KEY_LEN = 64;
// Parâmetros do scrypt gravados no hash para permitir evoluir o custo depois.
const N = 16384;
const R = 8;
const P = 1;

function derive(password: string, salt: Buffer, n: number, r: number, p: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_LEN, { N: n, r, p }, (err, key) => (err ? reject(err) : resolve(key)));
  });
}

/** Formato: scrypt$N$r$p$salt(base64)$hash(base64). */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, N, R, P);
  return ["scrypt", N, R, P, salt.toString("base64"), key.toString("base64")].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [n, r, p] = [Number(parts[1]), Number(parts[2]), Number(parts[3])];
  if (![n, r, p].every(Number.isInteger)) return false;
  const expected = Buffer.from(parts[5]!, "base64");
  const key = await derive(password, Buffer.from(parts[4]!, "base64"), n, r, p);
  return key.length === expected.length && timingSafeEqual(key, expected);
}
