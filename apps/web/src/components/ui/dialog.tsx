"use client";
import { X } from "lucide-react";
import { useEffect, useRef } from "react";

/**
 * Modal sobre o <dialog> nativo: foco preso, Esc fecha e o fundo bloqueia cliques.
 * O conteúdo só existe enquanto aberto, então o estado dos formulários zera a cada abertura.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      // showModal() foca o primeiro elemento focável (o X); o campo marcado tem prioridade.
      d.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    }
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      // Clique no fundo (o próprio <dialog>, fora do conteúdo) fecha.
      onClick={(e) => e.target === ref.current && onClose()}
      className="m-auto w-[calc(100vw-2rem)] max-w-md rounded-xl border border-line bg-surface p-0 text-ink shadow-xl backdrop:bg-ink/40"
    >
      {open && (
        <div className="max-h-[calc(100dvh-2rem)] space-y-4 overflow-y-auto p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
              {description && <p className="text-sm text-muted">{description}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              className="-mt-1 -mr-1 grid size-8 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-ink"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}
