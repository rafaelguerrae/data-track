import { z } from "zod";

export const TOPIC_ROOT_DEFAULT = "data-track";

/** Payload publicado pelo firmware: {"temp_c":23.47,"ts":123456} (ts = uptime em ms). */
export const readingPayloadSchema = z.object({
  temp_c: z.number().finite(),
  ts: z.number().int().nonnegative().optional(),
});
export type ReadingPayload = z.infer<typeof readingPayloadSchema>;

export type ParsedTopic =
  | { kind: "telemetry"; deviceId: string }
  | { kind: "status"; deviceId: string }
  | { kind: "fault"; deviceId: string };

/**
 * Tópicos: <root>/<deviceId>/temperature            -> telemetria
 *          <root>/<deviceId>/temperature/status     -> online | offline (retido, LWT)
 *          <root>/<deviceId>/temperature/fault      -> "0x04"
 */
export function parseTopic(topic: string, root = TOPIC_ROOT_DEFAULT): ParsedTopic | null {
  const parts = topic.split("/");
  if (parts[0] !== root || parts[2] !== "temperature" || !parts[1]) return null;
  const deviceId = parts[1];
  if (parts.length === 3) return { kind: "telemetry", deviceId };
  if (parts.length === 4 && parts[3] === "status") return { kind: "status", deviceId };
  if (parts.length === 4 && parts[3] === "fault") return { kind: "fault", deviceId };
  return null;
}

export const alertKindSchema = z.enum(["temp_above", "temp_below", "offline", "fault"]);
export type AlertKind = z.infer<typeof alertKindSchema>;

export const alertRuleInputSchema = z.object({
  deviceId: z.string().min(1),
  kind: alertKindSchema,
  threshold: z.number().nullable().optional(),
  cooldownMin: z.number().int().min(1).default(30),
  email: z.string().email(),
  enabled: z.boolean().default(true),
});
export type AlertRuleInput = z.infer<typeof alertRuleInputSchema>;

export const bucketSchema = z.enum(["1m", "5m", "15m", "1h", "1d"]);
export type Bucket = z.infer<typeof bucketSchema>;
export const BUCKET_INTERVAL: Record<Bucket, string> = {
  "1m": "1 minute",
  "5m": "5 minutes",
  "15m": "15 minutes",
  "1h": "1 hour",
  "1d": "1 day",
};

export interface DeviceDto {
  id: string;
  name: string | null;
  online: boolean;
  lastSeenAt: string | null;
  lastTempC: number | null;
}
export interface SeriesPoint {
  time: string;
  avg: number;
  min: number;
  max: number;
}
export interface AlertRuleDto extends AlertRuleInput {
  id: number;
  lastTriggeredAt: string | null;
}
export interface AlertEventDto {
  id: number;
  ruleId: number;
  deviceId: string;
  kind: AlertKind;
  message: string;
  createdAt: string;
}

// --- Autenticação e equipes ---

export const roleSchema = z.enum(["admin", "member"]);
export type Role = z.infer<typeof roleSchema>;

export const loginInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginInputSchema>;

export const acceptInviteInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  password: z.string().min(8).max(200),
});
export type AcceptInviteInput = z.infer<typeof acceptInviteInputSchema>;

export const inviteInputSchema = z.object({
  email: z.string().email(),
  role: roleSchema.default("member"),
});
export type InviteInput = z.infer<typeof inviteInputSchema>;

export const claimDeviceInputSchema = z.object({
  deviceId: z.string().trim().min(1).max(100),
  name: z.string().trim().max(80).optional(),
});
export type ClaimDeviceInput = z.infer<typeof claimDeviceInputSchema>;

/** Nome vazio limpa o nome (o sensor volta a aparecer pelo ID). */
export const updateDeviceInputSchema = z.object({ name: z.string().trim().max(80) });
export type UpdateDeviceInput = z.infer<typeof updateDeviceInputSchema>;

export interface TeamDto {
  id: string;
  name: string;
}
export interface UserDto {
  id: string;
  email: string;
  name: string;
  role: Role;
  team: TeamDto;
}
export interface MemberDto {
  id: string;
  email: string;
  name: string;
  role: Role;
}
export interface InviteDto {
  id: string;
  email: string;
  role: Role;
  expiresAt: string;
}
export interface InvitePreviewDto {
  email: string;
  teamName: string;
}
export interface TeamDetailDto {
  team: TeamDto;
  members: MemberDto[];
  invites: InviteDto[];
}
