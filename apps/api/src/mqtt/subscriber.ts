import { parseTopic, readingPayloadSchema } from "@data-track/shared";
import mqtt from "mqtt";
import { onFault, onReading, onStatus } from "#alerts/engine";
import { db } from "#db/client";
import { devices, faults, readings } from "#db/schema";
import { env } from "#env";

async function touchDevice(deviceId: string, patch: { online?: boolean } = {}) {
  await db
    .insert(devices)
    .values({ id: deviceId, lastSeenAt: new Date(), ...patch })
    .onConflictDoUpdate({
      target: devices.id,
      set: { lastSeenAt: new Date(), ...patch },
    });
}

export async function handleMessage(topic: string, payload: Buffer) {
  const parsed = parseTopic(topic, env.MQTT_TOPIC_ROOT);
  if (!parsed) return;
  const text = payload.toString("utf8").trim();

  switch (parsed.kind) {
    case "telemetry": {
      let json: unknown;
      try {
        json = JSON.parse(text);
      } catch {
        console.warn(`[mqtt] invalid JSON on ${topic}: ${text}`);
        return;
      }
      const result = readingPayloadSchema.safeParse(json);
      if (!result.success) {
        console.warn(`[mqtt] bad payload on ${topic}: ${text}`);
        return;
      }
      await touchDevice(parsed.deviceId, { online: true });
      // O `ts` do firmware é uptime (millis), então carimbamos o horário de chegada no servidor.
      await db.insert(readings).values({
        deviceId: parsed.deviceId,
        tempC: result.data.temp_c,
        deviceUptimeMs: result.data.ts ?? null,
      });
      await onReading(parsed.deviceId, result.data.temp_c);
      return;
    }
    case "status": {
      const online = text === "online";
      await touchDevice(parsed.deviceId, { online });
      await onStatus(parsed.deviceId, online);
      return;
    }
    case "fault": {
      await touchDevice(parsed.deviceId);
      await db.insert(faults).values({ deviceId: parsed.deviceId, code: text });
      await onFault(parsed.deviceId, text);
      return;
    }
  }
}

export function startSubscriber() {
  const client = mqtt.connect(env.MQTT_URL, {
    username: env.MQTT_USERNAME || undefined,
    password: env.MQTT_PASSWORD || undefined,
    clientId: `data-track-api-${process.pid}`,
    reconnectPeriod: 3000,
  });

  client.on("connect", () => {
    const filter = `${env.MQTT_TOPIC_ROOT}/+/temperature/#`;
    // "a/b/#" também casa com "a/b", então uma assinatura cobre telemetria, status e falha.
    client.subscribe(filter, { qos: 1 }, (err) => {
      if (err) console.error("[mqtt] subscribe failed", err);
      else console.log(`[mqtt] connected, subscribed to ${filter}`);
    });
  });
  client.on("message", (topic, payload) => {
    handleMessage(topic, payload).catch((err) => console.error(`[mqtt] handler error on ${topic}`, err));
  });
  client.on("error", (err) => console.error("[mqtt] error", err.message));
  return client;
}

