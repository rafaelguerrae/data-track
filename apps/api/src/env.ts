import { z } from "zod";

const schema = z.object({
  API_PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.string().url(),
  MQTT_URL: z.string().default("mqtt://localhost:1883"),
  MQTT_USERNAME: z.string().optional(),
  MQTT_PASSWORD: z.string().optional(),
  MQTT_TOPIC_ROOT: z.string().default("data-track"),
  SMTP_HOST: z.string().default("localhost"),
  SMTP_PORT: z.coerce.number().default(1025),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().default("alerts@data-track.local"),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  // URL pública da web, usada nos links de convite.
  WEB_URL: z.string().url().default("http://localhost:3000"),
  SESSION_TTL_DAYS: z.coerce.number().int().positive().default(14),
  // "true" em produção (HTTPS) para o cookie de sessão levar o atributo Secure.
  COOKIE_SECURE: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
});

export const env = schema.parse(process.env);
