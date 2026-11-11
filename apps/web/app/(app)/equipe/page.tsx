"use client";
import type { DeviceDto, Role } from "@data-track/shared";
import { Link2, Pencil, Unlink, UserMinus, UserPlus } from "lucide-react";
import { useState } from "react";
import { ClaimDeviceDialog } from "#components/team/claim-device-dialog";
import { EditDeviceDialog } from "#components/team/edit-device-dialog";
import { InviteDialog } from "#components/team/invite-dialog";
import { Badge, OnlineBadge } from "#components/ui/badge";
import { Button } from "#components/ui/button";
import { Card, SectionTitle } from "#components/ui/card";
import { useUser } from "#components/user-context";
import { errorMessage } from "#lib/api";
import { useDevices, useRemoveMember, useTeam, useUnclaimDevice } from "#lib/queries";

const ROLE_LABEL: Record<Role, string> = { admin: "admin", member: "membro" };

export default function TeamPage() {
  const me = useUser();
  const isAdmin = me.role === "admin";
  const team = useTeam();
  const devices = useDevices(15000);
  const removeMember = useRemoveMember();
  const unclaimDevice = useUnclaimDevice();

  const [inviteOpen, setInviteOpen] = useState(false);
  const [claimOpen, setClaimOpen] = useState(false);
  const [editing, setEditing] = useState<DeviceDto | null>(null);

  const failed = removeMember.error ?? unclaimDevice.error;
  const error = failed ? errorMessage(failed, { 400: "A equipe precisa ter ao menos um admin." }) : null;
  const resetErrors = () => {
    removeMember.reset();
    unclaimDevice.reset();
  };

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{me.team.name}</h1>
        <p className="text-sm text-muted">Pessoas e sensores desta equipe.</p>
      </div>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}

      <section>
        <SectionTitle
          action={
            isAdmin && (
              <Button className="px-3 py-1.5" onClick={() => setClaimOpen(true)}>
                <Link2 className="size-4" aria-hidden />
                Vincular sensor
              </Button>
            )
          }
        >
          Sensores
        </SectionTitle>
        <Card className="divide-y divide-line">
          {devices.data?.length === 0 && <p className="p-4 text-sm text-muted">Nenhum sensor vinculado.</p>}
          {devices.data?.map((d) => (
            <div key={d.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="text-sm font-medium">{d.name ?? d.id}</span>
                <span className="font-mono text-xs text-muted">{d.id}</span>
                <OnlineBadge online={d.online} />
              </div>
              {isAdmin && (
                <div className="flex gap-2">
                  <Button variant="secondary" className="px-3 py-1.5" onClick={() => setEditing(d)}>
                    <Pencil className="size-4" aria-hidden />
                    Editar
                  </Button>
                  <Button
                    variant="danger"
                    className="px-3 py-1.5"
                    onClick={() => {
                      if (!confirm(`Desvincular ${d.id}? As regras de alerta dele serão removidas.`)) return;
                      resetErrors();
                      unclaimDevice.mutate(d.id);
                    }}
                  >
                    <Unlink className="size-4" aria-hidden />
                    Desvincular
                  </Button>
                </div>
              )}
            </div>
          ))}
        </Card>
      </section>

      <section>
        <SectionTitle
          action={
            isAdmin && (
              <Button className="px-3 py-1.5" onClick={() => setInviteOpen(true)}>
                <UserPlus className="size-4" aria-hidden />
                Convidar
              </Button>
            )
          }
        >
          Membros
        </SectionTitle>
        <Card className="divide-y divide-line">
          {team.data?.members.map((m) => {
            const self = m.id === me.id;
            return (
              <div key={m.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <div className="text-sm font-medium">{m.name} {self && <span className="text-muted">(você)</span>}</div>
                  <div className="text-xs text-muted">{m.email}</div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge tone={m.role === "admin" ? "accent" : "neutral"}>{ROLE_LABEL[m.role]}</Badge>
                  {isAdmin && (
                    <Button
                      variant="danger"
                      className="px-3 py-1.5"
                      disabled={self}
                      title={self ? "Você não pode remover a si mesmo" : undefined}
                      onClick={() => {
                        if (!confirm(`Remover ${m.name} da equipe?`)) return;
                        resetErrors();
                        removeMember.mutate(m.id);
                      }}
                    >
                      <UserMinus className="size-4" aria-hidden />
                      Remover
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </Card>
      </section>

      <ClaimDeviceDialog open={claimOpen} onClose={() => setClaimOpen(false)} />
      <EditDeviceDialog device={editing} onClose={() => setEditing(null)} />
      <InviteDialog open={inviteOpen} onClose={() => setInviteOpen(false)} />
    </div>
  );
}
