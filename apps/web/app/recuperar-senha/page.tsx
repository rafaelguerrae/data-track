"use client";
import { ArrowLeft, KeyRound, LogIn, Mail, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Brand } from "#components/brand";
import { Button } from "#components/ui/button";
import { Card } from "#components/ui/card";
import { Field, inputClass } from "#components/ui/field";
import { PasswordInput } from "#components/ui/password-input";
import { api, errorMessage } from "#lib/api";

type Step = "email" | "code" | "password" | "done";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");

  const request = useMutation({
    mutationFn: () => api.resetRequest({ email }),
    onSuccess: () => setStep("code"),
  });
  const validate = useMutation({
    mutationFn: () => api.validateTwoFactor({ email, code }),
    onSuccess: () => setStep("password"),
  });
  const reset = useMutation({
    mutationFn: () => api.resetPassword({ email, code, password }),
    onSuccess: () => setStep("done"),
  });

  const rateLimited = { 429: "Muitas tentativas. Aguarde um minuto." };
  const error =
    step === "email" && request.error
      ? errorMessage(request.error, rateLimited)
      : step === "code" && validate.error
        ? errorMessage(validate.error, { ...rateLimited, 400: "Código incorreto." })
        : step === "password" && reset.error
          ? errorMessage(reset.error, { ...rateLimited, 400: "Código expirado. Volte e informe o código de novo." })
          : null;

  function back(to: Step) {
    validate.reset();
    reset.reset();
    setStep(to);
  }

  function onSubmit(action: () => void) {
    return (e: React.FormEvent) => {
      e.preventDefault();
      action();
    };
  }

  return (
    <main className="grid min-h-screen place-items-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex justify-center">
          <Brand height={120} />
        </div>
        <Card className="space-y-4 p-6 shadow-sm">
          {step === "email" && (
            <>
              <div>
                <h1 className="text-xl font-semibold tracking-tight">Recuperar senha</h1>
                <p className="text-sm text-muted">Informe o e-mail da sua conta para receber um código de verificação.</p>
              </div>
              <form onSubmit={onSubmit(() => request.mutate())} className="space-y-4">
                <Field label="E-mail">
                  <input className={inputClass} type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </Field>
                {error && <p role="alert" className="text-sm text-danger">{error}</p>}
                <Button className="w-full" disabled={request.isPending}>{!request.isPending && <Mail className="size-4" aria-hidden />}{request.isPending ? "Enviando…" : "Enviar código"}</Button>
              </form>
            </>
          )}

          {step === "code" && (
            <>
              <div>
                <h1 className="text-xl font-semibold tracking-tight">Verificação</h1>
                <p className="text-sm text-muted">Informe o código de 4 dígitos enviado para {email}.</p>
              </div>
              <form onSubmit={onSubmit(() => validate.mutate())} className="space-y-4">
                <Field label="Código">
                  <input
                    className={`${inputClass} text-center font-mono tracking-[0.5em]`}
                    required
                    inputMode="numeric"
                    pattern="\d{4}"
                    maxLength={4}
                    autoComplete="one-time-code"
                    autoFocus
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  />
                </Field>
                {error && <p role="alert" className="text-sm text-danger">{error}</p>}
                <Button className="w-full" disabled={validate.isPending || code.length !== 4}>{!validate.isPending && <ShieldCheck className="size-4" aria-hidden />}{validate.isPending ? "Verificando…" : "Verificar"}</Button>
                <Button type="button" variant="secondary" className="w-full" onClick={() => { setCode(""); back("email"); }}><ArrowLeft className="size-4" aria-hidden />Voltar</Button>
              </form>
            </>
          )}

          {step === "password" && (
            <>
              <div>
                <h1 className="text-xl font-semibold tracking-tight">Nova senha</h1>
                <p className="text-sm text-muted">Escolha a nova senha de {email}.</p>
              </div>
              <form onSubmit={onSubmit(() => reset.mutate())} className="space-y-4">
                <PasswordInput label="Nova senha (mínimo 8 caracteres)" required minLength={8} maxLength={200} autoComplete="new-password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} />
                {error && <p role="alert" className="text-sm text-danger">{error}</p>}
                <Button className="w-full" disabled={reset.isPending}>{!reset.isPending && <KeyRound className="size-4" aria-hidden />}{reset.isPending ? "Salvando…" : "Redefinir senha"}</Button>
                <Button type="button" variant="secondary" className="w-full" onClick={() => back("code")}><ArrowLeft className="size-4" aria-hidden />Voltar</Button>
              </form>
            </>
          )}

          {step === "done" && (
            <>
              <h1 className="text-xl font-semibold tracking-tight">Senha redefinida</h1>
              <p className="text-sm text-muted">Já pode entrar com a nova senha. Sessões abertas em outros dispositivos foram encerradas.</p>
              <Button className="w-full" onClick={() => router.push("/")}><LogIn className="size-4" aria-hidden />Ir para o login</Button>
            </>
          )}
        </Card>
        {step !== "done" && (
          <p className="text-center text-sm text-muted">
            <Link href="/" className="hover:text-ink hover:underline">Voltar ao login</Link>
          </p>
        )}
      </div>
    </main>
  );
}
