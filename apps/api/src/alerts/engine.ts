import type { AlertKind } from "@data-track/shared";
import { and, eq } from "drizzle-orm";
import { db } from "#db/client";
import { alertEvents, alertRules, devices } from "#db/schema";
import { sendAlertEmail } from "#alerts/mailer";
import { KIND_SUBJECT, buildMessage, inCooldown, matchesTemp } from "#alerts/rules";

async function trigger(rule: typeof alertRules.$inferSelect, message: string) {
  const [device] = await db.select({ name: devices.name }).from(devices).where(eq(devices.id, rule.deviceId)).limit(1);
  const sensor = device?.name ?? rule.deviceId;
  const subject = `[Data Track] ${sensor}: ${KIND_SUBJECT[rule.kind] ?? rule.kind}`;
  await db.insert(alertEvents).values({
    ruleId: rule.id,
    deviceId: rule.deviceId,
    kind: rule.kind,
    message,
  });
  await db.update(alertRules).set({ lastTriggeredAt: new Date() }).where(eq(alertRules.id, rule.id));
  try {
    await sendAlertEmail(rule.email, subject, `Sensor: ${sensor}\n${message}`);
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
      await trigger(rule, buildMessage(rule.kind, { tempC, threshold: rule.threshold }));
    }
  }
}

export async function onStatus(deviceId: string, online: boolean) {
  if (online) return;
  for (const rule of await rulesFor(deviceId, ["offline"])) {
    await trigger(rule, buildMessage(rule.kind, {}));
  }
}

export async function onFault(deviceId: string, code: string) {
  for (const rule of await rulesFor(deviceId, ["fault"])) {
    await trigger(rule, buildMessage(rule.kind, { code }));
  }
}
