// Simula o firmware do ESP32. Uso: pnpm simulate [deviceId]
import mqtt from "mqtt";

const deviceId = process.argv[2] ?? "esp32-01";
const url = process.env.MQTT_URL ?? "mqtt://localhost:1883";
const base = `data-track/${deviceId}/temperature`;

const client = mqtt.connect(url, {
  clientId: `sim-${deviceId}`,
  will: { topic: `${base}/status`, payload: Buffer.from("offline"), qos: 1, retain: true },
});

const started = Date.now();
client.on("connect", () => {
  console.log(`simulating ${deviceId} -> ${url}`);
  client.publish(`${base}/status`, "online", { retain: true });
  setInterval(() => {
    const t = 25 + 5 * Math.sin((Date.now() - started) / 30_000) + (Math.random() - 0.5);
    const payload = JSON.stringify({ temp_c: Number(t.toFixed(2)), ts: Date.now() - started });
    client.publish(base, payload);
    console.log(base, payload);
  }, 5000);
});
process.on("SIGINT", () => client.end(false, {}, () => process.exit(0)));
