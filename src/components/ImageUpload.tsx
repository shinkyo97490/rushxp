"use client";

import { useRef, useState } from "react";

/** Bouton « Envoyer une image » : renvoie l'URL du média stocké (ou un message si le stockage n'est pas configuré). */
export function ImageUpload({ folder, onUploaded, label = "Envoyer une image" }: { folder: string; onUploaded: (url: string) => void; label?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const send = async (file: File) => {
    setBusy(true);
    setError(null);
    const body = new FormData();
    body.set("file", file);
    body.set("folder", folder);
    try {
      const res = await fetch("/api/upload", { method: "POST", body });
      const json = (await res.json()) as { url?: string; error?: string };
      if (json.url) onUploaded(json.url);
      else setError(json.error ?? "Envoi impossible.");
    } catch {
      setError("Envoi impossible. Réessayez.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };
  return (
    <span className="grid gap-1">
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" aria-label={label} onChange={(e) => e.target.files?.[0] && send(e.target.files[0])} />
      <button type="button" className="btn btn-tertiary btn-sm justify-self-start" disabled={busy} aria-busy={busy || undefined} onClick={() => input.current?.click()}>
        {busy ? "Envoi…" : label}
      </button>
      {error && <span className="text-[13px] text-red">{error}</span>}
    </span>
  );
}
