import type { AlertEventDto, AlertRuleDto, AlertRuleInput, Bucket, DeviceDto, SeriesPoint } from "@data-track/shared";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.status === 204 ? (undefined as T) : res.json();
}

export const api = {
  devices: () => req<DeviceDto[]>("/devices"),
  readings: (id: string, from: Date, bucket: Bucket) =>
    req<SeriesPoint[]>(`/devices/${id}/readings?from=${from.toISOString()}&bucket=${bucket}`),
  rules: () => req<AlertRuleDto[]>("/alert-rules"),
  createRule: (body: AlertRuleInput) => req<AlertRuleDto>("/alert-rules", { method: "POST", body: JSON.stringify(body) }),
  toggleRule: (id: number, enabled: boolean) =>
    req<AlertRuleDto>(`/alert-rules/${id}`, { method: "PATCH", body: JSON.stringify({ enabled }) }),
  deleteRule: (id: number) => req<void>(`/alert-rules/${id}`, { method: "DELETE" }),
  alerts: () => req<AlertEventDto[]>("/alerts"),
};
