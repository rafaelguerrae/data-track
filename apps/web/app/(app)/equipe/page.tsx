"use client";
import { Copy, Link2, Unlink, UserMinus, UserPlus, X } from "lucide-react";
import type { Role } from "@data-track/shared";
import { useState } from "react";
import { Badge, OnlineBadge } from "#components/ui/badge";
import { Button } from "#components/ui/button";
import { Card, SectionTitle } from "#components/ui/card";
import { inputClass } from "#components/ui/field";
import { useUser } from "#components/user-context";
import { ApiError } from "#lib/api";
import {
  useClaimDevice,
  useCreateInvite,
  useDeleteInvite,
  useDevices,
  useRemoveMember,
  useTeam,
  useUnclaimDevice,
} from "#lib/queries";

const ROLE_LABEL: Record<Role, string> = { admin: "admin", member: "membro" };

export default function TeamPage() {
  const me = useUser();
  const isAdmin = me.role === "admin";
  const team = useTeam();
  const devices = useDevices(15000);
  const createInvite = useCreateInvite();
  const deleteInvite = useDeleteInvite();
  const removeMember = useRemoveMember();
  const claimDevice = useClaimDevice();
  const unclaimDevice = useUnclaimDevice();

  const [invite, setInvite] = useState({ email: "", role: "member" as Role });
  const [claim, setClaim] = useState({ deviceId: "", name: "" });

  // Mostra o erro da última ação que falhou.
  const failed = [createInvite, deleteInvite, removeMember, claimDevice, unclaimDevice].find((m) => m.error)?.error;
  const error = failed ? (failed instanceof ApiError ? failed.message : "Algo deu errado.") : null;
  const reset = () => [createInvite, deleteInvite, removeMember, claimDevice, unclaimDevice].forEach((m) => m.reset());

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{me.team.name}</h1>
        <p className="text-sm text-muted">Pessoas e sensores desta equipe.</p>
      </div>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}

      <section>
        <SectionTitle>Sensores</SectionTitle>
        <Card className="divide-y divide-line">
          {devices.data?.length === 0 && <p className="p-4 text-sm text-muted">Nenhum sensor vinculado.</p>}
          {devices.data?.map((d) => (
            <div key={d.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">{d.name ?? d.id}</span>
                <span className="font-mono text-xs text-muted">{d.id}</span>
                <OnlineBadge online={d.online} />
              </div>
              {isAdmin && (
                <Button
                  variant="danger"
                  className="px-3 py-1.5"
                  onClick={() => confirm(`Desvincular ${d.id}? As regras de alerta dele serão removidas.`) && (reset(), unclaimDevice.mutate(d.id))}
                >
                  <Unlink className="size-4" aria-hidden />
                  Desvincular
                </Button>
              )}
            </div>
          ))}
        </Card>
        {isAdmin && (
          <form
            className="mt-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              reset();
              claimDevice.mutate(
                { deviceId: claim.deviceId, name: claim.name || undefined },
                { onSuccess: () => setClaim({ deviceId: "", name: "" }) },
              );
            }}
          >
            <input aria-label="ID do sensor" className={`${inputClass} sm:w-56 font-mono`} required placeholder="ID do sensor" value={claim.deviceId} onChange={(e) => setClaim({ ...claim, deviceId: e.target.value })} />
            <input aria-label="Nome (opcional)" className={`${inputClass} sm:w-56`} placeholder="Nome (opcional)" value={claim.name} onChange={(e) => setClaim({ ...claim, name: e.target.value })} />
            <Button disabled={claimDevice.isPending}><Link2 className="size-4" aria-hidden />Vincular sensor</Button>
          </form>
        )}
        {isAdmin && <p className="mt-2 text-xs text-muted">O sensor precisa já ter enviado ao menos uma leitura e não pode pertencer a outra equipe.</p>}
      </section>

      <section>
        <SectionTitle>Membros</SectionTitle>
        <Card className="divide-y divide-line">
          {team.data?.members.map((m) => (
            <div key={m.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <div className="text-sm font-medium">{m.name} {m.id === me.id && <span className="text-muted">(você)</span>}</div>
                <div className="text-xs text-muted">{m.email}</div>
              </div>
              <div className="flex items-center gap-3">
                <Badge tone={m.role === "admin" ? "accent" : "neutral"}>{ROLE_LABEL[m.role]}</Badge>
                {isAdmin && m.id !== me.id && (
                  <Button variant="danger" className="px-3 py-1.5" onClick={() => confirm(`Remover ${m.name} da equipe?`) && (reset(), removeMember.mutate(m.id))}>
                    <UserMinus className="size-4" aria-hidden />
                    Remover
                  </Button>
                )}
              </div>
            </div>
          ))}
        </Card>
      </section>

      {isAdmin && (
        <section>
          <SectionTitle>Convites</SectionTitle>
          <form
            className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              reset();
              createInvite.mutate(invite, { onSuccess: () => setInvite({ ...invite, email: "" }) });
            }}
          >
            <input aria-label="E-mail do convidado" className={`${inputClass} sm:w-64`} type="email" required placeholder="email@exemplo.com" value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} />
            <select aria-label="Papel" className={`${inputClass} sm:w-auto`} value={invite.role} onChange={(e) => setInvite({ ...invite, role: e.target.value as Role })}>
              <option value="member">Membro</option>
              <option value="admin">Admin</option>
            </select>
            <Button disabled={createInvite.isPending}><UserPlus className="size-4" aria-hidden />Convidar</Button>
          </form>
          {createInvite.data && (
            <Card className="mt-3 space-y-1 p-4 text-sm">
              <p>{createInvite.data.emailSent ? "Convite enviado por e-mail. Se preferir, repasse o link:" : "Não foi possível enviar o e-mail. Repasse o link manualmente:"}</p>
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded bg-surface-2 px-2 py-1 font-mono text-xs">{createInvite.data.link}</code>
                <Button variant="secondary" className="px-3 py-1.5" onClick={() => navigator.clipboard.writeText(createInvite.data.link)}><Copy className="size-4" aria-hidden />Copiar</Button>
              </div>
            </Card>
          )}
          {team.data && team.data.invites.length > 0 && (
            <Card className="mt-3 divide-y divide-line">
              {team.data.invites.map((i) => (
                <div key={i.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="text-sm">
                    {i.email} <span className="text-xs text-muted">· {ROLE_LABEL[i.role]} · expira {new Date(i.expiresAt).toLocaleDateString()}</span>
                  </div>
                  <Button variant="danger" className="px-3 py-1.5" onClick={() => (reset(), deleteInvite.mutate(i.id))}><X className="size-4" aria-hidden />Cancelar</Button>
                </div>
              ))}
            </Card>
          )}
        </section>
      )}
    </div>
  );
}
