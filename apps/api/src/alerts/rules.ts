export interface Rule {
  kind: string;
  threshold: number | null;
  cooldownMin: number;
  lastTriggeredAt: Date | null;
}

export function inCooldown(rule: Pick<Rule, "cooldownMin" | "lastTriggeredAt">, now = new Date()) {
  if (!rule.lastTriggeredAt) return false;
  return now.getTime() - rule.lastTriggeredAt.getTime() < rule.cooldownMin * 60_000;
}

export function matchesTemp(rule: Pick<Rule, "kind" | "threshold">, tempC: number) {
  if (rule.threshold == null) return false;
  if (rule.kind === "temp_above") return tempC > rule.threshold;
  if (rule.kind === "temp_below") return tempC < rule.threshold;
  return false;
}
