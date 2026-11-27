import { Thermometer } from "lucide-react";

/** Avatar do sensor: o emoji escolhido ou, sem ele, o termômetro padrão. */
export function DeviceIcon({ icon, className = "size-9 text-lg" }: { icon: string | null; className?: string }) {
  return (
    <span aria-hidden className={`grid shrink-0 place-items-center rounded-full bg-accent-soft text-accent ${className}`}>
      {icon ? <span className="leading-none">{icon}</span> : <Thermometer className="size-[55%]" />}
    </span>
  );
}
