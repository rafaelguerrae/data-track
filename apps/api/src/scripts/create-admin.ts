import { parseArgs } from "node:util";
import { createInterface } from "node:readline/promises";
import { eq } from "drizzle-orm";
import { hashPassword } from "#auth/password";
import { db, pool } from "#db/client";
import { memberships, teams, users } from "#db/schema";

// Cria (ou reaproveita, pelo nome) a equipe e o primeiro admin. O cadastro é só por convite,
// então este script é o ponto de partida. A senha vem de ADMIN_PASSWORD ou de um prompt.
const { values } = parseArgs({
  options: { email: { type: "string" }, name: { type: "string" }, team: { type: "string" } },
});
const email = values.email?.trim().toLowerCase();
const name = values.name?.trim();
const teamName = values.team?.trim();
if (!email || !name || !teamName) {
  console.error('uso: create-admin --email <e-mail> --name "<nome>" --team "<equipe>"  (senha em ADMIN_PASSWORD)');
  process.exit(1);
}

let password = process.env.ADMIN_PASSWORD;
if (!password) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  password = await rl.question("Senha (mín. 8 caracteres): ");
  rl.close();
}
if (password.length < 8) {
  console.error("a senha precisa ter ao menos 8 caracteres");
  process.exit(1);
}

const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
if (existing) {
  console.error(`já existe um usuário com o e-mail ${email}`);
  process.exit(1);
}

// Reaproveita a equipe "Padrão" criada no backfill da migration, se for o caso.
let [team] = await db.select().from(teams).where(eq(teams.name, teamName)).limit(1);
team ??= (await db.insert(teams).values({ name: teamName }).returning())[0]!;

const [user] = await db
  .insert(users)
  .values({ email, name, passwordHash: await hashPassword(password) })
  .returning({ id: users.id });
await db.insert(memberships).values({ userId: user!.id, teamId: team.id, role: "admin" });

console.log(`admin ${email} criado na equipe "${team.name}"`);
await pool.end();
