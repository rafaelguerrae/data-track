/** Linha mínima, sem eixos nem biblioteca: só mostra a forma das últimas 24h. */
export function Sparkline({ points, className = "h-8 w-24" }: { points: number[]; className?: string }) {
  if (points.length < 2) return <div aria-hidden className={className} />;
  const min = Math.min(...points);
  const span = Math.max(...points) - min || 1;
  const d = points
    .map((v, i) => `${i ? "L" : "M"}${((i / (points.length - 1)) * 100).toFixed(2)},${(28 - ((v - min) / span) * 26).toFixed(2)}`)
    .join(" ");
  return (
    <svg aria-hidden viewBox="0 0 100 30" preserveAspectRatio="none" className={className}>
      <path d={d} fill="none" stroke="var(--ink)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}
