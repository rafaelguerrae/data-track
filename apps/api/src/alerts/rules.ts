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

export const KIND_SUBJECT: Record<string, string> = {
  temp_above: "temperatura acima do limite",
  temp_below: "temperatura abaixo do limite",
  offline: "sensor offline",
  fault: "falha do sensor",
};

const fmt = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

/** Texto do evento de alerta (guardado no histórico e enviado por e-mail). */
export function buildMessage(
  kind: string,
  d: { tempC?: number; threshold?: number | null; code?: string },
): string {
  switch (kind) {
    case "temp_above":
      return `Temperatura de ${fmt(d.tempC ?? 0)} °C, acima do limite de ${fmt(d.threshold ?? 0)} °C.`;
    case "temp_below":
      return `Temperatura de ${fmt(d.tempC ?? 0)} °C, abaixo do limite de ${fmt(d.threshold ?? 0)} °C.`;
    case "offline":
      return "O sensor ficou offline.";
    case "fault":
      return `O sensor reportou uma falha (código ${d.code ?? "desconhecido"}).`;
    default:
      return "Alerta disparado.";
  }
}
