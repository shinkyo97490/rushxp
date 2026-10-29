"use client";

import { useState, useTransition } from "react";

export type Result = { ok: true; message?: string } | { ok: false; errors: Record<string, string> };

/** Exécute une server action, expose l'état en cours, les erreurs par champ et le message de succès. */
export function useServerAction<A extends unknown[]>(fn: (...args: A) => Promise<Result>, opts?: { onDone?: (r: Result) => void }) {
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const run = (...args: A) =>
    new Promise<boolean>((resolve) =>
      start(async () => {
        setMessage(null);
        try {
          const r = await fn(...args);
          opts?.onDone?.(r);
          if (r.ok) {
            setErrors({});
            setMessage(r.message ?? null);
          } else setErrors(r.errors);
          resolve(r.ok);
        } catch {
          setErrors({ _: "Erreur inattendue. Réessayez." });
          resolve(false);
        }
      }),
    );
  return { run, pending, errors, message, setErrors };
}
