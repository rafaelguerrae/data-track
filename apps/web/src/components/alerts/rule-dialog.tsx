"use client";
import { alertKindSchema, type AlertKind, type AlertRuleDto, type DeviceDto } from "@data-track/shared";
import { Plus } from "lucide-react";
import { useState } from "react";
import { useUser } from "#components/user-context";
import { Button } from "#components/ui/button";
import { Dialog } from "#components/ui/dialog";
import { Field, inputClass } from "#components/ui/field";
import { KIND_LABEL, needsThreshold } from "#lib/alert-kinds";
import { errorMessage } from "#lib/api";
import { useCreateRule, useUpdateRule } from "#lib/queries";

/** `rule` = regra em edição; `null` = criando. */
export function RuleDialog({
  open,
  rule,
  devices,
  onClose,
}: {
  open: boolean;
  rule: AlertRuleDto | null;
  devices: DeviceDto[];
  onClose: () => void;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={rule ? "Editar regra" : "Nova regra"}
      description="Você recebe um e-mail quando a condição for atendida, respeitando o intervalo mínimo entre avisos."
    >
      <RuleForm rule={rule} devices={devices} onDone={onClose} />
    </Dialog>
  );
}

function RuleForm({ rule, devices, onDone }: { rule: AlertRuleDto | null; devices: DeviceDto[]; onDone: () => void }) {
  const me = useUser();
  const create = useCreateRule();
  const update = useUpdateRule();
  const [form, setForm] = useState({
    deviceId: rule?.deviceId ?? devices[0]?.id ?? "",
    kind: (rule?.kind ?? "temp_above") as AlertKind,
    threshold: String(rule?.threshold ?? 8),
    cooldownMin: String(rule?.cooldownMin ?? 30),
    email: rule?.email ?? me.email,
  });

  const mutation = rule ? update : create;
  const error = mutation.error
    ? errorMessage(mutation.error, { 400: "Informe o limite de temperatura.", 404: "Sensor não encontrado na equipe." })
    : null;
  const withThreshold = needsThreshold(form.kind);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const threshold = withThreshold ? Number(form.threshold) : null;
    const common = { kind: form.kind, threshold, cooldownMin: Number(form.cooldownMin), email: form.email };
    if (rule) update.mutate({ id: rule.id, patch: common }, { onSuccess: onDone });
    else create.mutate({ ...common, deviceId: form.deviceId, enabled: true }, { onSuccess: onDone });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Sensor">
        <select
          className={`${inputClass} w-full disabled:bg-surface-2`}
          value={form.deviceId}
          disabled={rule != null}
          onChange={(e) => setForm({ ...form, deviceId: e.target.value })}
        >
          {devices.map((d) => <option key={d.id} value={d.id}>{d.name ?? d.id}</option>)}
        </select>
      </Field>
      <Field label="Quando">
        <select className={`${inputClass} w-full`} value={form.kind} data-autofocus onChange={(e) => setForm({ ...form, kind: e.target.value as AlertKind })}>
          {alertKindSchema.options.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        {withThreshold && (
          <Field label="Limite (°C)">
            <input className={inputClass} type="number" step="0.1" required value={form.threshold} onChange={(e) => setForm({ ...form, threshold: e.target.value })} />
          </Field>
        )}
        <Field label="Intervalo (min)">
          <input className={inputClass} type="number" min={1} required value={form.cooldownMin} onChange={(e) => setForm({ ...form, cooldownMin: e.target.value })} />
        </Field>
      </div>
      <p className="-mt-2 text-xs text-muted">O intervalo é o tempo mínimo entre dois e-mails da mesma regra.</p>
      <Field label="Enviar para">
        <input className={inputClass} type="email" required placeholder="email@exemplo.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
      </Field>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <Button className="w-full" disabled={mutation.isPending || !form.deviceId}>
        {!rule && <Plus className="size-4" aria-hidden />}
        {mutation.isPending ? "Salvando…" : rule ? "Salvar" : "Criar regra"}
      </Button>
    </form>
  );
}
