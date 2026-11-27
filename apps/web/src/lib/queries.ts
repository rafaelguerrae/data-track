"use client";
import { ALERT_PAGE_SIZE, type AlertEventDto, type AlertKind,type AlertRuleInput, type AlertRuleUpdate, type Bucket, type InviteInput } from "@data-track/shared";
import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { api } from "#lib/api";

const POLL_MS = 5000;

export const keys = {
  me: ["me"] as const,
  devices: ["devices"] as const,
  readings: (id: string | null, range: string) => ["readings", id, range] as const,
  rules: ["alert-rules"] as const,
  alerts: ["alerts"] as const, // prefixo: invalida todas as combinações de filtro
  team: ["team"] as const,
};

export const useMe = () => useQuery({ queryKey: keys.me, queryFn: api.me, staleTime: 60_000 });

export const useDevices = (intervalMs = POLL_MS) =>
  useQuery({ queryKey: keys.devices, queryFn: api.devices, refetchInterval: intervalMs });

export const useReadings = (deviceId: string | null, range: { label: string; hours: number; bucket: Bucket }) =>
  useQuery({
    queryKey: keys.readings(deviceId, range.label),
    queryFn: () => api.readings(deviceId!, new Date(Date.now() - range.hours * 3600_000), range.bucket),
    enabled: deviceId != null,
    refetchInterval: POLL_MS,
    placeholderData: keepPreviousData,
  });

export const useSparklines = () =>
  useQuery({ queryKey: ["sparklines"], queryFn: api.sparklines, refetchInterval: 60_000 });

export const useDeviceStats = (
  deviceId: string | null,
  range: { label: string; hours: number },
  limits: { low?: number; high?: number },
) =>
  useQuery({
    queryKey: ["stats", deviceId, range.label, limits.low, limits.high],
    queryFn: () => api.deviceStats(deviceId!, new Date(Date.now() - range.hours * 3600_000), limits),
    enabled: deviceId != null,
    refetchInterval: POLL_MS * 3,
    placeholderData: keepPreviousData,
  });

/** Alertas disparados na janela do gráfico, para marcar no eixo do tempo. */
export const useAlertMarkers = (deviceId: string | null, range: { label: string; hours: number }) =>
  useQuery({
    queryKey: ["alert-markers", deviceId, range.label],
    queryFn: () => api.alerts({ deviceId: deviceId!, from: new Date(Date.now() - range.hours * 3600_000), limit: 100 }),
    enabled: deviceId != null,
    refetchInterval: 15_000,
    placeholderData: keepPreviousData,
  });

/** Heatmap: sempre os últimos 7 dias, independente do intervalo escolhido no gráfico. */
export const useHourly = (deviceId: string | null) =>
  useQuery({
    queryKey: ["hourly", deviceId],
    queryFn: () => api.hourly(deviceId!, new Date(Date.now() - 7 * 86_400_000)),
    enabled: deviceId != null,
    refetchInterval: 60_000,
  });

export const useRules = () => useQuery({ queryKey: keys.rules, queryFn: api.rules, refetchInterval: POLL_MS });
export interface AlertFilters {
  deviceId?: string;
  kind?: AlertKind;
}

/** Histórico paginado por cursor: cada página começa no id do último item da anterior. */
export const useAlertHistory = (filters: AlertFilters) =>
  useInfiniteQuery({
    queryKey: [...keys.alerts, filters],
    queryFn: ({ pageParam }) => api.alerts({ ...filters, before: pageParam }),
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (last) => (last.length < ALERT_PAGE_SIZE ? undefined : last.at(-1)?.id),
    refetchInterval: 15_000,
  });

const LAST_ALERT_KEY = "dt_last_alert_id";

const readLastAlertId = (): number | null => {
  try {
    const v = sessionStorage.getItem(LAST_ALERT_KEY);
    return v == null ? null : Number(v);
  } catch {
    return null;
  }
};

const saveLastAlertId = (id: number) => {
  try {
    sessionStorage.setItem(LAST_ALERT_KEY, String(id));
  } catch {
  }
};

/**
 * Polling de alertas novos para o toast. O primeiro fetch só grava o id mais recente (sem avisar);
 * os seguintes pedem `after=<último id visto>` e chamam `onNew` com o que chegou.
 */
export function useNewAlerts(onNew: (events: AlertEventDto[]) => void) {
  const qc = useQueryClient();
  const lastId = useRef<number | null>(null);
  const handler = useRef(onNew);
  handler.current = onNew;

  return useQuery({
    queryKey: ["new-alerts"],
    refetchInterval: POLL_MS,
    queryFn: async () => {
      lastId.current ??= readLastAlertId();
      if (lastId.current == null) {
        const [latest] = await api.alerts({ limit: 1 });
        lastId.current = latest?.id ?? 0;
        saveLastAlertId(lastId.current);
        return null;
      }
      const events = await api.alerts({ after: lastId.current, limit: 20 });
      if (events.length) {
        lastId.current = Math.max(...events.map((e) => e.id));
        saveLastAlertId(lastId.current);
        qc.invalidateQueries({ queryKey: keys.alerts });
        handler.current(events);
      }
      return null;
    },
  });
}

export const useTeam = () => useQuery({ queryKey: keys.team, queryFn: api.team, refetchInterval: 15_000 });

/** Mutation que invalida as queries indicadas ao terminar com sucesso. */
function useInvalidating<TVars, TData>(fn: (v: TVars) => Promise<TData>, invalidate: (readonly unknown[])[]) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => Promise.all(invalidate.map((queryKey) => qc.invalidateQueries({ queryKey }))),
  });
}

export const useCreateRule = () => useInvalidating((b: AlertRuleInput) => api.createRule(b), [keys.rules]);
export const useUpdateRule = () =>
  useInvalidating((v: { id: number; patch: AlertRuleUpdate }) => api.updateRule(v.id, v.patch), [keys.rules]);
export const useTestRule = () => useMutation({ mutationFn: (id: number) => api.testRule(id) });
export const useDeleteRule = () => useInvalidating((id: number) => api.deleteRule(id), [keys.rules, keys.alerts]);

// O nome da equipe aparece no menu do usuário (me) e na página Equipe.
export const useUpdateTeam = () => useInvalidating((name: string) => api.updateTeam(name), [keys.me, keys.team]);
export const useCreateInvite = () => useInvalidating((b: InviteInput) => api.createInvite(b), [keys.team]);
export const useDeleteInvite = () => useInvalidating((id: string) => api.deleteInvite(id), [keys.team]);
export const useRemoveMember = () => useInvalidating((id: string) => api.removeMember(id), [keys.team]);
export const useClaimDevice = () =>
  useInvalidating((v: { deviceId: string; name?: string }) => api.claimDevice(v.deviceId, v.name), [keys.devices]);
export const useUpdateDevice = () =>
  useInvalidating((v: { id: string; name: string; icon: string | null }) => api.updateDevice(v.id, v.name, v.icon), [keys.devices]);
export const useUnclaimDevice = () =>
  useInvalidating((id: string) => api.unclaimDevice(id), [keys.devices, keys.rules, keys.alerts]);

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.logout,
    // Limpa tudo para a próxima sessão não ver dados em cache da anterior.
    onSettled: () => qc.clear(),
  });
}
