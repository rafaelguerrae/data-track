"use client";
import { LogIn } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Brand } from "#components/brand";
import { Button } from "#components/ui/button";
import { Card } from "#components/ui/card";
import { Field, inputClass } from "#components/ui/field";
import { ApiError, api } from "#lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const login = useMutation({
    mutationFn: api.login,
    onSuccess: () => router.replace("/dashboard"),
  });

  const error = !login.error
    ? null
    : login.error instanceof ApiError && login.error.status === 401
      ? "E-mail ou senha incorretos."
      : login.error instanceof ApiError && login.error.status === 429
        ? "Muitas tentativas. Aguarde um minuto."
        : "Não foi possível entrar. Tente novamente.";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    login.mutate({ email, password });
  }

  return (
    <main className="grid min-h-screen place-items-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex justify-center">
          <Brand height={120} />
        </div>
        <Card className="space-y-4 p-6 shadow-sm">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Entrar</h1>
          </div>
          <form onSubmit={submit} className="space-y-4">
            <Field label="E-mail">
              <input className={inputClass} type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field label="Senha">
              <input className={inputClass} type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
            {error && <p role="alert" className="text-sm text-danger">{error}</p>}
            <Button className="w-full" disabled={login.isPending || login.isSuccess}>{!login.isPending && <LogIn className="size-4" aria-hidden />}{login.isPending ? "Entrando…" : "Entrar"}</Button>
          </form>
        </Card>
      </div>
    </main>
  );
}
