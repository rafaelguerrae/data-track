/** Círculo com a inicial do nome, o mesmo visual do menu da conta no header. */
export function Avatar({ name, className = "size-9 text-sm" }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center rounded-full bg-accent font-semibold text-accent-ink ${className}`}
    >
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}
