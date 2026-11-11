"use client";
import { Bell, BellOff, Plus, Trash2 } from "lucide-react";
import { alertKindSchema, type AlertKind } from "@data-track/shared";
import { useState } from "react";
import { Badge } from "#components/ui/badge";
import { Button } from "#components/ui/button";
import { Card, SectionTitle } from "#components/ui/card";
import { inputClass } from "#components/ui/field";
import { ApiError } from "#lib/api";
import { useAlerts, useCreateRule, useDeleteRule, useDevices, useRules, useToggleRule } from "#lib/queries";

const KIND_LABEL: Record<AlertKind, string> = {
  temp_above: "Temperatura acima de",
  temp_below: "Temperatura abaixo de",
  offline: "Dispositivo offline",
  fault: "Falha do sensor",
};

export default function AlertsPage() {
  const devices = useDevices(15000);
  const rules = useRules();
  const events = useAlerts();
  const createRule = useCreateRule();
  const toggleRule = useToggleRule();
  const deleteRule = useDeleteRule();
  const [form, setForm] = useState({ deviceId: "", kind: "temp_above" as AlertKind, threshold: "30", cooldownMin: "30", email: "" });

  const needsThreshold = form.kind === "temp_above" || form.kind === "temp_below";
  const deviceId = form.deviceId || devices.data?.[0]?.id || "";
  const error = createRule.error ? (createRule.error instanceof ApiError ? createRule.error.message : "Algo deu errado.") : null;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    createRule.mutate({
      deviceId,
      kind: form.kind,
      threshold: needsThreshold ? Number(form.threshold) : null,
      cooldownMin: Number(form.cooldownMin),
      email: form.email,
      enabled: true,
    });
  }

  return (
    <div className="space-y-10">
      <section>
        <SectionTitle>Nova regra</SectionTitle>
        {devices.data?.length === 0 ? (
          <Card className="p-4 text-sm text-muted">Vincule um sensor à equipe para criar regras.</Card>
        ) : (
          <Card className="p-4">
            <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
              <select aria-label="Sensor" className={`${inputClass} sm:w-auto`} value={deviceId} onChange={(e) => setForm({ ...form, deviceId: e.target.value })}>
                {devices.data?.map((d) => <option key={d.id} value={d.id}>{d.name ?? d.id}</option>)}
              </select>
              <select aria-label="Tipo" className={`${inputClass} sm:w-auto`} value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as AlertKind })}>
                {alertKindSchema.options.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-3 sm:contents">
                {needsThreshold && (
                  <label className="space-y-1">
                    <span className="block text-xs text-muted">Limite (°C)</span>
                    <input className={`${inputClass} w-full sm:w-24`} type="number" step="0.1" value={form.threshold} onChange={(e) => setForm({ ...form, threshold: e.target.value })} />
                  </label>
                )}
                <label className="space-y-1">
                  <span className="block text-xs text-muted">Intervalo (min)</span>
                  <input className={`${inputClass} w-full sm:w-24`} type="number" min={1} value={form.cooldownMin} onChange={(e) => setForm({ ...form, cooldownMin: e.target.value })} title="Intervalo mínimo entre e-mails (min)" />
                </label>
              </div>
              <input aria-label="E-mail do destinatário" className={`${inputClass} sm:w-56`} type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@exemplo.com" />
              <Button disabled={createRule.isPending}><Plus className="size-4" aria-hidden />Criar</Button>
            </form>
            {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
          </Card>
        )}
      </section>

      <section>
        <SectionTitle>Regras</SectionTitle>
        <Card className="divide-y divide-line">
          {rules.data?.length === 0 && <p className="p-4 text-sm text-muted">Nenhuma regra.</p>}
          {rules.data?.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center justify-between gap-4 p-4">
              <div>
                <div className="flex flex-wrap items-center gap-x-2 text-sm font-medium">
                  <span className="font-mono">{r.deviceId}</span> · {KIND_LABEL[r.kind]} {r.threshold != null && <span className="font-mono">{r.threshold} °C</span>}
                  {!r.enabled && <Badge>desativada</Badge>}
                </div>
                <div className="text-xs text-muted">{r.email} · intervalo {r.cooldownMin} min</div>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" className="px-3 py-1.5" onClick={() => toggleRule.mutate({ id: r.id, enabled: !r.enabled })}>
                  {r.enabled ? <BellOff className="size-4" aria-hidden /> : <Bell className="size-4" aria-hidden />}
                  {r.enabled ? "Desativar" : "Ativar"}
                </Button>
                <Button variant="danger" className="px-3 py-1.5" onClick={() => deleteRule.mutate(r.id)}><Trash2 className="size-4" aria-hidden />Excluir</Button>
              </div>
            </div>
          ))}
        </Card>
      </section>

      <section>
        <SectionTitle>Histórico</SectionTitle>
        <Card className="divide-y divide-line">
          {events.data?.length === 0 && <p className="p-4 text-sm text-muted">Nenhum alerta disparado.</p>}
          {events.data?.map((e) => (
            <div key={e.id} className="p-4">
              <div className="font-mono text-xs text-muted">{new Date(e.createdAt).toLocaleString()}</div>
              <div className="text-sm">{e.message}</div>
            </div>
          ))}
        </Card>
      </section>
    </div>
  );
}
