import { Card } from "#components/ui/card";

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-linear-to-tl from-accent-soft via-bg to-surface-2 px-4 py-6">
      <Card className="w-full max-w-sm space-y-4 p-6 shadow-sm">{children}</Card>
    </main>
  );
}
