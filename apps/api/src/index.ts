import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import Fastify from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import { env } from "#env";
import { startSubscriber } from "#mqtt/subscriber";
import { alertRoutes } from "#routes/alerts";
import { authRoutes } from "#routes/auth";
import { deviceRoutes } from "#routes/devices";
import { teamRoutes } from "#routes/team";

// trustProxy: a API roda atrás do Caddy; sem isso o rate limit veria só o IP do proxy.
const app = Fastify({ logger: true, trustProxy: true });
app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);

await app.register(cors, {
  origin: env.CORS_ORIGIN,
  credentials: true,
  methods: ["GET", "POST", "PATCH", "DELETE"],
});
await app.register(cookie);
await app.register(rateLimit, { global: false });
app.get("/health", async () => ({ ok: true }));
await app.register(authRoutes);
await app.register(teamRoutes);
await app.register(deviceRoutes);
await app.register(alertRoutes);

const mqttClient = startSubscriber();
app.addHook("onClose", async () => {
  await mqttClient.endAsync();
});

await app.listen({ port: env.API_PORT, host: "0.0.0.0" });
