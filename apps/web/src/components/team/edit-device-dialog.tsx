"use client";
import type { DeviceDto } from "@data-track/shared";
import { useState } from "react";
import { Button } from "#components/ui/button";
import { Dialog } from "#components/ui/dialog";
import { Field, inputClass } from "#components/ui/field";
import { errorMessage } from "#lib/api";
import { useUpdateDevice } from "#lib/queries";

/** `device` nulo = fechado. */
export function EditDeviceDialog({ device, onClose }: { device: DeviceDto | null; onClose: () => void }) {
  return (
    <Dialog open={device != null} onClose={onClose} title="Editar sensor" description="O ID vem do firmware e não pode ser alterado.">
      {device && <EditForm device={device} onDone={onClose} />}
    </Dialog>
  );
}

function EditForm({ device, onDone }: { device: DeviceDto; onDone: () => void }) {
  const update = useUpdateDevice();
  const [name, setName] = useState(device.name ?? "");
  const error = update.error ? errorMessage(update.error, { 404: "Este sensor não pertence mais à equipe." }) : null;

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        update.mutate({ id: device.id, name }, { onSuccess: onDone });
      }}
    >
      <Field label="ID">
        <input className={`${inputClass} bg-surface-2 font-mono`} value={device.id} readOnly />
      </Field>
      <Field label="Nome">
        <input className={inputClass} data-autofocus maxLength={80} placeholder="Sem nome (aparece pelo ID)" value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <Button className="w-full" disabled={update.isPending}>
        {update.isPending ? "Salvando…" : "Salvar"}
      </Button>
    </form>
  );
}
