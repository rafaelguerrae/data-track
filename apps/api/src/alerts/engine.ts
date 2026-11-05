import type { AlertKind } from "@data-track/shared";
import { and, eq } from "drizzle-orm";
import { db } from "#db/client";
import { alertEvents, alertRules } from "#db/schema";
import { sendAlertEmail } from "#alerts/mailer";
import { inCooldown, matchesTemp } from "#alerts/rules";

async function trigger(rule: typeof alertRules.$inferSelect, message: string) {
  const subject = `[Data Track] ${rule.deviceId}: ${rule.kind}`;
  await db.insert(alertEvents).values({
    ruleId: rule.id,
    deviceId: rule.deviceId,
    kind: rule.kind,
    message,
  });
  await db.update(alertRules).set({ lastTriggeredAt: new Date() }).where(eq(alertRules.id, rule.id));
  try {
    await sendAlertEmail(rule.email, subject, message);
  } catch (err) {
    console.error("failed to send alert email", err);
  }
}

async function rulesFor(deviceId: string, kinds: AlertKind[]) {
  const rows = await db
    .select()
    .from(alertRules)
    .where(and(eq(alertRules.deviceId, deviceId), eq(alertRules.enabled, true)));
  return rows.filter((r) => kinds.includes(r.kind as AlertKind) && !inCooldown(r));
}

export async function onReading(deviceId: string, tempC: number) {
  for (const rule of await rulesFor(deviceId, ["temp_above", "temp_below"])) {
    if (matchesTemp(rule, tempC)) {
      await trigger(rule, `Temperature ${tempC.toFixed(2)} °C crossed threshold ${rule.threshold} °C (${rule.kind}) on ${deviceId}.`);
    }
  }
}

export async function onStatus(deviceId: string, online: boolean) {
  if (online) return;
  for (const rule of await rulesFor(deviceId, ["offline"])) {
    await trigger(rule, `Device ${deviceId} went offline.`);
  }
}

export async function onFault(deviceId: string, code: string) {
  for (const rule of await rulesFor(deviceId, ["fault"])) {
    await trigger(rule, `Sensor fault ${code} reported by ${deviceId}.`);
  }
}
