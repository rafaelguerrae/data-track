import type { AlertKind, AlertRuleDto } from "@data-track/shared";
import { ThermometerSnowflake, ThermometerSun, TriangleAlert, WifiOff, type LucideIcon } from "lucide-react";

export const KIND_LABEL: Record<AlertKind, string> = {
  temp_above: "Temperatura acima de",
  temp_below: "Temperatura abaixo de",
  offline: "Sensor offline",
  fault: "Falha do sensor",
};

/** Rótulo curto, para filtros e badges. */
export const KIND_SHORT: Record<AlertKind, string> = {
  temp_above: "Temperatura alta",
  temp_below: "Temperatura baixa",
  offline: "Offline",
  fault: "Falha",
};

export const KIND_ICON: Record<AlertKind, LucideIcon> = {
  temp_above: ThermometerSun,
  temp_below: ThermometerSnowflake,
  offline: WifiOff,
  fault: TriangleAlert,
};

export const needsThreshold = (kind: AlertKind) => kind === "temp_above" || kind === "temp_below";

/** "Temperatura acima de 8 °C", "Sensor offline"... */
export function describeRule(rule: Pick<AlertRuleDto, "kind" | "threshold">): string {
  return needsThreshold(rule.kind) && rule.threshold != null
    ? `${KIND_LABEL[rule.kind]} ${rule.threshold.toLocaleString("pt-BR")} °C`
    : KIND_LABEL[rule.kind];
}
