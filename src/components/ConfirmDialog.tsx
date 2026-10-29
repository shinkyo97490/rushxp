"use client";

import { useEffect, useRef } from "react";

export interface ConfirmRequest {
  title: string;
  text: string;
  confirm: string;
  danger?: boolean;
  run: () => void;
}

export function ConfirmDialog({ req, onClose }: { req: ConfirmRequest | null; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (req && !d.open) d.showModal();
    if (!req && d.open) d.close();
  }, [req]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      className="m-auto w-[min(480px,calc(100vw-32px))] border border-line bg-surface p-0 text-ink backdrop:bg-black/70"
    >
      {req && (
        <div>
          <div className="card-head">
            <span className="card-title">{req.title}</span>
          </div>
          <p className="px-[18px] py-4 text-sm leading-relaxed text-silver">{req.text}</p>
          <div className="flex justify-end gap-2 border-t border-line px-[18px] py-3">
            <button className="btn btn-tertiary btn-sm" onClick={onClose}>Annuler</button>
            <button
              className={`btn btn-sm ${req.danger ? "btn-danger" : "btn-primary"}`}
              onClick={() => {
                req.run();
                onClose();
              }}
            >
              {req.confirm}
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}
