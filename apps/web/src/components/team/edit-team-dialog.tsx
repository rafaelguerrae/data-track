"use client";
import { Save } from "lucide-react";
import { useState } from "react";
import { Button } from "#components/ui/button";
import { Dialog } from "#components/ui/dialog";
import { Field, inputClass } from "#components/ui/field";
import { errorMessage } from "#lib/api";
import { useUpdateTeam } from "#lib/queries";

export function EditTeamDialog({ open, name, onClose }: { open: boolean; name: string; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} title="Editar equipe" description="O nome aparece para todos os membros.">
      <EditForm name={name} onDone={onClose} />
    </Dialog>
  );
}

function EditForm({ name: initial, onDone }: { name: string; onDone: () => void }) {
  const update = useUpdateTeam();
  const [name, setName] = useState(initial);
  const error = update.error ? errorMessage(update.error) : null;

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        update.mutate(name, { onSuccess: onDone });
      }}
    >
      <Field label="Nome da equipe">
        <input className={inputClass} required data-autofocus maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <Button className="w-full" disabled={update.isPending || !name.trim()}>
        <Save className="size-4" aria-hidden />
        {update.isPending ? "Salvando…" : "Salvar"}
      </Button>
    </form>
  );
}
