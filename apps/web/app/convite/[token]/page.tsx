"use client";
import { LogIn, UserPlus } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Brand } from "#components/brand";
import { Button } from "#components/ui/button";
import { Card } from "#components/ui/card";
import { Field, inputClass } from "#components/ui/field";
import { ApiError, api } from "#lib/api";

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");

  const preview = useQuery({ queryKey: ["invite", token], queryFn: () => api.invitePreview(token), retry: false });
  const accept = useMutation({
    mutationFn: () => api.acceptInvite(token, { name, password }),
    onSuccess: () => router.replace("/dashboard"),
  });

  const invite = preview.data;
  const invalid = preview.isError;
  const error = !accept.error
    ? null
    : accept.error instanceof ApiError && accept.error.status === 409
      ? "Este e-mail já tem cadastro."
      : "Não foi possível criar a conta.";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    accept.mutate();
  }

  return (
    <main className="grid min-h-screen place-items-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex justify-center">
          <Brand height={120} />
        </div>
        <Card className="space-y-4 p-6 shadow-sm">
          {invalid ? (
            <>
              <h1 className="text-xl font-semibold tracking-tight">Convite inválido</h1>
              <p className="text-sm text-muted">O link expirou ou já foi usado. Peça um novo convite ao administrador da equipe.</p>
              <Button variant="secondary" className="w-full" onClick={() => router.push("/")}><LogIn className="size-4" aria-hidden />Ir para o login</Button>
            </>
          ) : !invite ? (
            <p className="text-sm text-muted">Verificando convite…</p>
          ) : (
            <>
              <div>
                <h1 className="text-xl font-semibold tracking-tight">Entrar na equipe {invite.teamName}</h1>
                <p className="text-sm text-muted">Crie sua conta para {invite.email}.</p>
              </div>
              <form onSubmit={submit} className="space-y-4">
                <Field label="Nome">
                  <input className={inputClass} required maxLength={80} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
                </Field>
                <Field label="Senha (mínimo 8 caracteres)">
                  <input className={inputClass} type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
                </Field>
                {error && <p role="alert" className="text-sm text-danger">{error}</p>}
                <Button className="w-full" disabled={accept.isPending || accept.isSuccess}>{!accept.isPending && <UserPlus className="size-4" aria-hidden />}{accept.isPending ? "Criando…" : "Criar conta e entrar"}</Button>
              </form>
            </>
          )}
        </Card>
      </div>
    </main>
  );
}
