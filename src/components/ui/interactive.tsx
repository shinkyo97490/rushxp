"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

// ─── Modale ──────────────────────────────────────────────────────

/** Modale accessible (élément <dialog> natif : piège du focus, Échap pour fermer). */
export function Modal({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} onClose={onClose} aria-label={title} className="m-auto w-[min(520px,calc(100vw-32px))] border border-line bg-surface p-0 text-ink backdrop:bg-black/70">
      {open && (
        <>
          <div className="card-head">
            <span className="card-title flex-1">{title}</span>
            <button className="btn btn-tertiary btn-sm !min-h-9" onClick={onClose} aria-label="Fermer">✕</button>
          </div>
          <div className="px-[18px] py-4 text-sm text-silver">{children}</div>
          {footer && <div className="flex justify-end gap-2 border-t border-line px-[18px] py-3">{footer}</div>}
        </>
      )}
    </dialog>
  );
}

// ─── Toasts ──────────────────────────────────────────────────────

type ToastKind = "success" | "error" | "warning" | "info";
interface ToastItem {
  id: number;
  kind: ToastKind;
  text: string;
}
const ToastCtx = createContext<(kind: ToastKind, text: string) => void>(() => {});

/** Pile de toasts (coin bas droit), annoncés par les lecteurs d'écran, fermeture automatique après 5 s. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const push = useCallback((kind: ToastKind, text: string) => {
    const id = Date.now() + Math.random();
    setItems((l) => [...l.slice(-3), { id, kind, text }]);
    setTimeout(() => setItems((l) => l.filter((t) => t.id !== id)), 5000);
  }, []);
  const LABEL: Record<ToastKind, [string, string]> = {
    success: ["border-orange", "✓ Succès"],
    error: ["border-red", "Erreur"],
    warning: ["border-yellow", "▲ Attention"],
    info: ["border-line", "Info"],
  };
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div aria-live="polite" className="fixed right-4 bottom-4 z-50 grid w-[min(360px,calc(100vw-32px))] gap-2">
        {items.map((t) => (
          <div key={t.id} role={t.kind === "error" ? "alert" : "status"} className={`flex animate-rxtoast items-start gap-3 border bg-surface px-4 py-3 text-sm ${LABEL[t.kind][0]}`}>
            <span className={`text-[11px] font-bold uppercase tracking-[.08em] ${t.kind === "error" ? "text-red" : t.kind === "warning" ? "text-yellow" : "text-orange"}`}>{LABEL[t.kind][1]}</span>
            <span className="flex-1">{t.text}</span>
            <button className="cursor-pointer text-grey hover:text-ink" aria-label="Fermer" onClick={() => setItems((l) => l.filter((x) => x.id !== t.id))}>✕</button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  return useContext(ToastCtx);
}

// ─── Onglets locaux (sans changement d'URL) ──────────────────────

export function Tabs({ tabs, initial, children }: { tabs: { key: string; label: string; badge?: number }[]; initial?: string; children: (active: string) => ReactNode }) {
  const [active, setActive] = useState(initial ?? tabs[0]?.key);
  return (
    <div>
      <div role="tablist" className="flex overflow-x-auto border-b border-line">
        {tabs.map((t) => (
          <button key={t.key} role="tab" aria-selected={t.key === active} aria-current={t.key === active ? "page" : undefined} onClick={() => setActive(t.key)} className="tab cursor-pointer">
            {t.label}
            {t.badge ? <span className="grid h-[18px] min-w-[18px] place-items-center bg-orange px-1 font-sans text-[11px] text-bg">{t.badge}</span> : null}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="pt-4">{children(active)}</div>
    </div>
  );
}
