import cors from "@fastify/cors";
import Fastify from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import { env } from "#env";
import { startSubscriber } from "#mqtt/subscriber";
import { alertRoutes } from "#routes/alerts";
import { deviceRoutes } from "#routes/devices";

const app = Fastify({ logger: true });
app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);

await app.register(cors, { origin: env.CORS_ORIGIN, methods: ["GET", "POST", "PATCH", "DELETE"] });
app.get("/health", async () => ({ ok: true }));
await app.register(deviceRoutes);
await app.register(alertRoutes);

const mqttClient = startSubscriber();
app.addHook("onClose", async () => {
  await mqttClient.endAsync();
});

await app.listen({ port: env.API_PORT, host: "0.0.0.0" });
