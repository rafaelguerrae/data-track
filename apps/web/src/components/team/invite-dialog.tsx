"use client";
import type { Role } from "@data-track/shared";
import { Copy, Check, UserPlus, X } from "lucide-react";
import { useState } from "react";
import { Button } from "#components/ui/button";
import { Dialog } from "#components/ui/dialog";
import { Field, inputClass } from "#components/ui/field";
import { errorMessage } from "#lib/api";
import { useCreateInvite, useDeleteInvite, useTeam } from "#lib/queries";

const ROLE_LABEL: Record<Role, string> = { admin: "admin", member: "membro" };
const ROLE_HELP: Record<Role, string> = {
  member: "Vê todos os sensores e cria regras de alerta.",
  admin: "Também convida pessoas, remove membros e gerencia sensores.",
};

export function InviteDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} title="Convidar para a equipe" description="A pessoa recebe um link por e-mail (válido por 7 dias) para criar a conta.">
      <InviteForm />
    </Dialog>
  );
}

function InviteForm() {
  const team = useTeam();
  const createInvite = useCreateInvite();
  const deleteInvite = useDeleteInvite();
  const [form, setForm] = useState({ email: "", role: "member" as Role });
  const [copied, setCopied] = useState(false);

  const pending = team.data?.invites ?? [];
  const error = createInvite.error
    ? errorMessage(createInvite.error, { 409: "Este e-mail já tem cadastro." })
    : deleteInvite.error
      ? errorMessage(deleteInvite.error)
      : null;

  return (
    <div className="space-y-5">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          setCopied(false);
          createInvite.mutate(form, { onSuccess: () => setForm({ ...form, email: "" }) });
        }}
      >
        <Field label="E-mail">
          <input className={inputClass} type="email" required data-autofocus placeholder="email@exemplo.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
        <Field label="Papel">
          <select className={`${inputClass} w-full`} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
            <option value="member">Membro</option>
            <option value="admin">Admin</option>
          </select>
        </Field>
        <p className="-mt-2 text-xs text-muted">{ROLE_HELP[form.role]}</p>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <Button className="w-full" disabled={createInvite.isPending}>
          <UserPlus className="size-4" aria-hidden />
          {createInvite.isPending ? "Enviando…" : "Enviar convite"}
        </Button>
      </form>

      {createInvite.data && (
        <div className="space-y-2 rounded-lg bg-surface-2 p-3 text-sm">
          <p>{createInvite.data.emailSent ? "Convite enviado por e-mail. Se preferir, repasse o link:" : "Não foi possível enviar o e-mail. Repasse o link manualmente:"}</p>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded bg-surface px-2 py-1.5 font-mono text-xs">{createInvite.data.link}</code>
            <Button
              type="button"
              variant="secondary"
              className="px-3 py-1.5"
              onClick={() => navigator.clipboard.writeText(createInvite.data.link).then(() => setCopied(true))}
            >
              {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
              {copied ? "Copiado" : "Copiar"}
            </Button>
          </div>
        </div>
      )}

      {pending.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">Convites pendentes</h3>
          <ul className="divide-y divide-line rounded-lg border border-line">
            {pending.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <div className="min-w-0 text-sm">
                  <div className="truncate">{i.email}</div>
                  <div className="text-xs text-muted">{ROLE_LABEL[i.role]} · expira {new Date(i.expiresAt).toLocaleDateString()}</div>
                </div>
                <Button type="button" variant="danger" className="px-2.5 py-1.5" aria-label={`Cancelar convite de ${i.email}`} onClick={() => deleteInvite.mutate(i.id)}>
                  <X className="size-4" aria-hidden />
                  Cancelar
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
