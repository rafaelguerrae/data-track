import type {
  AcceptInviteInput,
  AlertEventDto,
  AlertRuleDto,
  AlertRuleInput,
  Bucket,
  DeviceDto,
  InviteDto,
  InviteInput,
  InvitePreviewDto,
  LoginInput,
  SeriesPoint,
  TeamDetailDto,
  UserDto,
} from "@data-track/shared";

// Mesma origem: o Next reescreve /api/* para a API (veja next.config.ts).
const BASE = "/api";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

interface ReqOptions extends RequestInit {
  /** false = 401 é resposta esperada (ex.: senha errada) e não derruba a sessão. */
  redirectOn401?: boolean;
}

async function req<T>(path: string, { redirectOn401 = true, ...init }: ReqOptions = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    // Fastify rejeita content-type JSON sem corpo (400), então o header só vai com body.
    headers: { ...(init.body ? { "content-type": "application/json" } : {}), ...init.headers },
  });
  if (res.status === 401 && redirectOn401 && typeof window !== "undefined") {
    // A API já limpou o cookie; sem ele o proxy deixa a tela de login abrir.
    window.location.href = "/";
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(res.status, body?.error ?? `erro ${res.status}`);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

const json = (method: string, body?: unknown): ReqOptions => ({
  method,
  body: body === undefined ? undefined : JSON.stringify(body),
});

export const api = {
  login: (body: LoginInput) => req<{ ok: true }>("/auth/login", { ...json("POST", body), redirectOn401: false }),
  logout: () => req<void>("/auth/logout", json("POST")),
  me: () => req<UserDto>("/auth/me"),
  invitePreview: (token: string) =>
    req<InvitePreviewDto>(`/auth/invites/${token}`, { redirectOn401: false }),
  acceptInvite: (token: string, body: AcceptInviteInput) =>
    req<{ ok: true }>(`/auth/invites/${token}/accept`, { ...json("POST", body), redirectOn401: false }),

  team: () => req<TeamDetailDto>("/team"),
  createInvite: (body: InviteInput) =>
    req<{ invite: InviteDto; link: string; emailSent: boolean }>("/team/invites", json("POST", body)),
  deleteInvite: (id: string) => req<void>(`/team/invites/${id}`, json("DELETE")),
  removeMember: (id: string) => req<void>(`/team/members/${id}`, json("DELETE")),
  claimDevice: (deviceId: string, name?: string) =>
    req<{ id: string }>("/team/devices", json("POST", { deviceId, name: name || undefined })),
  unclaimDevice: (id: string) => req<void>(`/team/devices/${encodeURIComponent(id)}`, json("DELETE")),

  devices: () => req<DeviceDto[]>("/devices"),
  readings: (id: string, from: Date, bucket: Bucket) =>
    req<SeriesPoint[]>(`/devices/${encodeURIComponent(id)}/readings?from=${from.toISOString()}&bucket=${bucket}`),
  rules: () => req<AlertRuleDto[]>("/alert-rules"),
  createRule: (body: AlertRuleInput) => req<AlertRuleDto>("/alert-rules", json("POST", body)),
  toggleRule: (id: number, enabled: boolean) => req<AlertRuleDto>(`/alert-rules/${id}`, json("PATCH", { enabled })),
  deleteRule: (id: number) => req<void>(`/alert-rules/${id}`, json("DELETE")),
  alerts: () => req<AlertEventDto[]>("/alerts"),
};
