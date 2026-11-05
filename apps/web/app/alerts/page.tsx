"use client";
import { alertKindSchema, type AlertKind } from "@data-track/shared";
import { useState } from "react";
import { api } from "#lib/api";
import { usePoll } from "#lib/use-poll";

const KIND_LABEL: Record<AlertKind, string> = {
  temp_above: "Temperatura acima de",
  temp_below: "Temperatura abaixo de",
  offline: "Dispositivo offline",
  fault: "Falha do sensor",
};

export default function AlertsPage() {
  const devices = usePoll(() => api.devices(), [], 15000);
  const rules = usePoll(() => api.rules(), []);
  const events = usePoll(() => api.alerts(), []);
  const [form, setForm] = useState({ deviceId: "", kind: "temp_above" as AlertKind, threshold: "30", cooldownMin: "30", email: "" });
  const [error, setError] = useState<string | null>(null);

  const needsThreshold = form.kind === "temp_above" || form.kind === "temp_below";
  const deviceId = form.deviceId || devices.data?.[0]?.id || "";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.createRule({
        deviceId,
        kind: form.kind,
        threshold: needsThreshold ? Number(form.threshold) : null,
        cooldownMin: Number(form.cooldownMin),
        email: form.email,
        enabled: true,
      });
      rules.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  const input = "rounded border bg-white px-3 py-2";
  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 text-lg font-semibold">Nova regra</h2>
        <form onSubmit={submit} className="flex flex-wrap items-end gap-3 rounded-lg border bg-white p-4">
          <select className={input} value={deviceId} onChange={(e) => setForm({ ...form, deviceId: e.target.value })}>
            {devices.data?.map((d) => <option key={d.id} value={d.id}>{d.id}</option>)}
          </select>
          <select className={input} value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as AlertKind })}>
            {alertKindSchema.options.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
          </select>
          {needsThreshold && (
            <input className={`${input} w-24`} type="number" step="0.1" value={form.threshold} onChange={(e) => setForm({ ...form, threshold: e.target.value })} placeholder="°C" />
          )}
          <input className={`${input} w-28`} type="number" min={1} value={form.cooldownMin} onChange={(e) => setForm({ ...form, cooldownMin: e.target.value })} title="Intervalo mínimo entre e-mails (min)" />
          <input className={input} type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@exemplo.com" />
          <button className="rounded bg-slate-900 px-4 py-2 text-white">Criar</button>
        </form>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Regras</h2>
        <ul className="divide-y rounded-lg border bg-white">
          {rules.data?.length === 0 && <li className="p-4 text-slate-500">Nenhuma regra.</li>}
          {rules.data?.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-4 p-4">
              <div>
                <div>{r.deviceId} · {KIND_LABEL[r.kind]} {r.threshold ?? ""}</div>
                <div className="text-sm text-slate-500">{r.email} · intervalo {r.cooldownMin} min</div>
              </div>
              <div className="flex gap-2 text-sm">
                <button className="rounded border px-3 py-1" onClick={() => api.toggleRule(r.id, !r.enabled).then(rules.refresh)}>
                  {r.enabled ? "Desativar" : "Ativar"}
                </button>
                <button className="rounded border px-3 py-1 text-red-700" onClick={() => api.deleteRule(r.id).then(rules.refresh)}>Excluir</button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Histórico</h2>
        <ul className="divide-y rounded-lg border bg-white">
          {events.data?.length === 0 && <li className="p-4 text-slate-500">Nenhum alerta disparado.</li>}
          {events.data?.map((e) => (
            <li key={e.id} className="p-4">
              <div className="text-sm text-slate-500">{new Date(e.createdAt).toLocaleString()}</div>
              <div>{e.message}</div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
