"use client";
import { Link2 } from "lucide-react";
import { useState } from "react";
import { Button } from "#components/ui/button";
import { Dialog } from "#components/ui/dialog";
import { Field, inputClass } from "#components/ui/field";
import { errorMessage } from "#lib/api";
import { useClaimDevice } from "#lib/queries";

export function ClaimDeviceDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} title="Vincular sensor" description="Informe o ID do sensor. Ele precisa já ter enviado ao menos uma leitura e não pode pertencer a outra equipe.">
      <ClaimForm onDone={onClose} />
    </Dialog>
  );
}

function ClaimForm({ onDone }: { onDone: () => void }) {
  const claim = useClaimDevice();
  const [form, setForm] = useState({ deviceId: "", name: "" });
  const error = claim.error
    ? errorMessage(claim.error, { 404: "Sensor não encontrado ou já vinculado a outra equipe." })
    : null;

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        claim.mutate({ deviceId: form.deviceId, name: form.name || undefined }, { onSuccess: onDone });
      }}
    >
      <Field label="ID do sensor">
        <input className={`${inputClass} font-mono`} required data-autofocus placeholder="esp32-01" value={form.deviceId} onChange={(e) => setForm({ ...form, deviceId: e.target.value })} />
      </Field>
      <Field label="Nome (opcional)">
        <input className={inputClass} maxLength={80} placeholder="Câmara fria" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </Field>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <Button className="w-full" disabled={claim.isPending}>
        <Link2 className="size-4" aria-hidden />
        {claim.isPending ? "Vinculando…" : "Vincular sensor"}
      </Button>
    </form>
  );
}
