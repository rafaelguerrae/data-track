"use client";
import type { AlertRuleInput, Bucket, InviteInput } from "@data-track/shared";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "#lib/api";

const POLL_MS = 5000;

export const keys = {
  me: ["me"] as const,
  devices: ["devices"] as const,
  readings: (id: string | null, range: string) => ["readings", id, range] as const,
  rules: ["alert-rules"] as const,
  alerts: ["alerts"] as const,
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

export const useRules = () => useQuery({ queryKey: keys.rules, queryFn: api.rules, refetchInterval: POLL_MS });
export const useAlerts = () => useQuery({ queryKey: keys.alerts, queryFn: api.alerts, refetchInterval: POLL_MS });
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
export const useToggleRule = () =>
  useInvalidating((v: { id: number; enabled: boolean }) => api.toggleRule(v.id, v.enabled), [keys.rules]);
export const useDeleteRule = () => useInvalidating((id: number) => api.deleteRule(id), [keys.rules, keys.alerts]);

export const useCreateInvite = () => useInvalidating((b: InviteInput) => api.createInvite(b), [keys.team]);
export const useDeleteInvite = () => useInvalidating((id: string) => api.deleteInvite(id), [keys.team]);
export const useRemoveMember = () => useInvalidating((id: string) => api.removeMember(id), [keys.team]);
export const useClaimDevice = () =>
  useInvalidating((v: { deviceId: string; name?: string }) => api.claimDevice(v.deviceId, v.name), [keys.devices]);
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
