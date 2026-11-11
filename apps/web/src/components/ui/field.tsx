export const inputClass =
  "rounded-lg border border-line bg-surface px-3 py-2 text-base text-ink sm:text-sm placeholder:text-muted/70";

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5 [&>input]:w-full">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}
