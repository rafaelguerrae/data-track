const rtf = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["day", 86_400_000],
  ["hour", 3_600_000],
  ["minute", 60_000],
];

/** "há 5 minutos", "ontem"... Abaixo de 1 minuto: "agora". */
export function timeAgo(iso: string, now = Date.now()): string {
  const diff = new Date(iso).getTime() - now; // negativo = passado
  for (const [unit, ms] of UNITS) {
    if (Math.abs(diff) >= ms) return rtf.format(Math.round(diff / ms), unit);
  }
  return "agora";
}
