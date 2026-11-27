type Tone = "ok" | "danger" | "neutral" | "accent";

const TONES: Record<Tone, string> = {
  ok: "bg-ok-soft text-ok",
  danger: "bg-danger-soft text-danger",
  neutral: "bg-surface-2 text-muted",
  accent: "bg-accent-soft text-accent",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-sm px-2 py-0.5 font-mono text-xs ${TONES[tone]}`}>
      {children}
    </span>
  );
}

/** Status de conexão: ponto + texto, nunca só cor. */
export function OnlineBadge({ online }: { online: boolean }) {
  return (
    <Badge tone={online ? "ok" : "danger"}>
      <span className={`size-1.5 rounded-full ${online ? "bg-ok" : "bg-danger"}`} />
      {online ? "online" : "offline"}
    </Badge>
  );
}
