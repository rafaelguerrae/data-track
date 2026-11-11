"use client";
import { alertKindSchema, type AlertKind, type AlertRuleDto } from "@data-track/shared";
import { Bell, BellOff, Loader2, Pencil, Plus, Send, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { RuleDialog } from "#components/alerts/rule-dialog";
import { Badge } from "#components/ui/badge";
import { Button } from "#components/ui/button";
import { Card, SectionTitle } from "#components/ui/card";
import { inputClass } from "#components/ui/field";
import { KIND_ICON, KIND_SHORT, describeRule } from "#lib/alert-kinds";
import { errorMessage } from "#lib/api";
import { timeAgo } from "#lib/format";
import { useAlertHistory, useDeleteRule, useDevices, useRules, useTestRule, useUpdateRule } from "#lib/queries";

export default function AlertsPage() {
  const devices = useDevices(15000);
  const rules = useRules();
  const updateRule = useUpdateRule();
  const deleteRule = useDeleteRule();
  const testRule = useTestRule();

  // undefined = fechado; null = criando; regra = editando.
  const [dialogRule, setDialogRule] = useState<AlertRuleDto | null | undefined>(undefined);
  const [filters, setFilters] = useState<{ deviceId: string; kind: AlertKind | "" }>({ deviceId: "", kind: "" });
  const history = useAlertHistory({ deviceId: filters.deviceId || undefined, kind: filters.kind || undefined });

  const sensorList = devices.data ?? [];
  const nameOf = (id: string) => sensorList.find((d) => d.id === id)?.name ?? id;
  const events = history.data?.pages.flat() ?? [];
  const filtered = filters.deviceId !== "" || filters.kind !== "";
  const actionError = updateRule.error ?? deleteRule.error;

  return (
    <div className="space-y-10">
      <section>
        <SectionTitle
          action={
            sensorList.length > 0 && (
              <Button className="px-3 py-1.5" onClick={() => setDialogRule(null)}>
                <Plus className="size-4" aria-hidden />
                Nova regra
              </Button>
            )
          }
        >
          Regras
        </SectionTitle>
        {actionError && <p role="alert" className="mb-2 text-sm text-danger">{errorMessage(actionError)}</p>}
        <Card className="divide-y divide-line">
          {devices.data?.length === 0 && (
            <p className="p-4 text-sm text-muted">
              Vincule um sensor à equipe em <Link href="/equipe" className="text-accent underline">Equipe</Link> para criar regras.
            </p>
          )}
          {devices.data && devices.data.length > 0 && rules.data?.length === 0 && (
            <p className="p-4 text-sm text-muted">Nenhuma regra ainda. Crie a primeira em “Nova regra”.</p>
          )}
          {rules.data?.map((r) => {
            const Icon = KIND_ICON[r.kind];
            const testing = testRule.variables === r.id;
            return (
              <div key={r.id} className="space-y-3 p-4">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-surface-2 text-muted">
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium">
                      {nameOf(r.deviceId)}
                      {!r.enabled && <Badge>desativada</Badge>}
                    </div>
                    <div className="text-sm">{describeRule(r)}</div>
                    <div className="truncate text-xs text-muted">{r.email} · intervalo {r.cooldownMin} min</div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" className="px-3 py-1.5" onClick={() => setDialogRule(r)}>
                    <Pencil className="size-4" aria-hidden />
                    Editar
                  </Button>
                  <Button variant="secondary" className="px-3 py-1.5" disabled={testing && testRule.isPending} onClick={() => testRule.mutate(r.id)}>
                    {testing && testRule.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />}
                    Enviar teste
                  </Button>
                  <Button variant="secondary" className="px-3 py-1.5" onClick={() => updateRule.mutate({ id: r.id, patch: { enabled: !r.enabled } })}>
                    {r.enabled ? <BellOff className="size-4" aria-hidden /> : <Bell className="size-4" aria-hidden />}
                    {r.enabled ? "Desativar" : "Ativar"}
                  </Button>
                  <Button
                    variant="danger"
                    className="px-3 py-1.5"
                    onClick={() => confirm(`Excluir a regra de ${nameOf(r.deviceId)} (${describeRule(r)})? O histórico de alertas dela também será apagado.`) && deleteRule.mutate(r.id)}
                  >
                    <Trash2 className="size-4" aria-hidden />
                    Excluir
                  </Button>
                </div>
                {testing && testRule.isSuccess && <p role="status" className="text-xs text-ok">E-mail de teste enviado para {r.email}.</p>}
                {testing && testRule.isError && (
                  <p role="alert" className="text-xs text-danger">
                    {errorMessage(testRule.error, { 502: "Não foi possível enviar o e-mail. Verifique o SMTP.", 429: "Muitos testes seguidos. Aguarde um minuto." })}
                  </p>
                )}
              </div>
            );
          })}
        </Card>
      </section>

      <section>
        <SectionTitle>Histórico</SectionTitle>
        <div className="mb-3 flex flex-col gap-3 sm:flex-row">
          <select aria-label="Filtrar por sensor" className={`${inputClass} sm:w-auto`} value={filters.deviceId} onChange={(e) => setFilters({ ...filters, deviceId: e.target.value })}>
            <option value="">Todos os sensores</option>
            {sensorList.map((d) => <option key={d.id} value={d.id}>{d.name ?? d.id}</option>)}
          </select>
          <select aria-label="Filtrar por tipo" className={`${inputClass} sm:w-auto`} value={filters.kind} onChange={(e) => setFilters({ ...filters, kind: e.target.value as AlertKind | "" })}>
            <option value="">Todos os tipos</option>
            {alertKindSchema.options.map((k) => <option key={k} value={k}>{KIND_SHORT[k]}</option>)}
          </select>
          {filtered && (
            <Button variant="secondary" className="sm:ml-auto" onClick={() => setFilters({ deviceId: "", kind: "" })}>Limpar filtros</Button>
          )}
        </div>
        <Card className="divide-y divide-line">
          {history.isLoading && <p className="p-4 text-sm text-muted">Carregando…</p>}
          {history.isError && <p className="p-4 text-sm text-danger">Não foi possível carregar o histórico.</p>}
          {history.isSuccess && events.length === 0 && (
            <p className="p-4 text-sm text-muted">{filtered ? "Nenhum alerta com esses filtros." : "Nenhum alerta disparado."}</p>
          )}
          {events.map((e) => {
            const Icon = KIND_ICON[e.kind];
            return (
              <div key={e.id} className="flex items-start gap-3 p-4">
                <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-warn-soft text-warn">
                  <Icon className="size-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium">
                    {nameOf(e.deviceId)}
                    <Badge>{KIND_SHORT[e.kind]}</Badge>
                  </div>
                  <div className="text-sm">{e.message}</div>
                </div>
                <time dateTime={e.createdAt} title={new Date(e.createdAt).toLocaleString()} className="shrink-0 text-xs text-muted">
                  {timeAgo(e.createdAt)}
                </time>
              </div>
            );
          })}
          {history.hasNextPage && (
            <div className="p-3 text-center">
              <Button variant="secondary" disabled={history.isFetchingNextPage} onClick={() => history.fetchNextPage()}>
                {history.isFetchingNextPage ? "Carregando…" : "Carregar mais"}
              </Button>
            </div>
          )}
        </Card>
      </section>

      <RuleDialog open={dialogRule !== undefined} rule={dialogRule ?? null} devices={sensorList} onClose={() => setDialogRule(undefined)} />
    </div>
  );
}
