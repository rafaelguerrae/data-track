export function Card({ className = "", ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={`rounded-xl border border-line bg-surface ${className}`} />;
}

export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  const title = <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">{children}</h2>;
  if (!action) return <div className="mb-3">{title}</div>;
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      {title}
      {action}
    </div>
  );
}
