"use client";

import { useState } from "react";
import { freezeSeedingAction, generateBracketAction, setMatchDateAction } from "@/lib/playoffs-admin/actions";
import { useServerAction } from "@/components/useServerAction";
import { FormError } from "@/components/forms";

export function PlayoffsGameActions({ game, frozen, generated }: { game: string; frozen: boolean; generated: boolean }) {
  const freeze = useServerAction(freezeSeedingAction);
  const gen = useServerAction(generateBracketAction);
  return (
    <div className="flex flex-wrap items-center gap-2">
      {!frozen && <button className="btn btn-primary btn-sm" disabled={freeze.pending} onClick={() => freeze.run(game)}>Figer le seeding maintenant</button>}
      {frozen && !generated && <button className="btn btn-secondary btn-sm" disabled={gen.pending} onClick={() => gen.run(game)}>Générer les quarts</button>}
      {(freeze.message || gen.message) && <span role="status" className="text-[13px] text-orange">✓ {freeze.message ?? gen.message}</span>}
      <FormError message={freeze.errors._ ?? gen.errors._} />
    </div>
  );
}

export function MatchDate({ matchId, value, label }: { matchId: string; value: string; label: string }) {
  const [at, setAt] = useState(value);
  const a = useServerAction(setMatchDateAction);
  return (
    <form className="flex flex-wrap items-center gap-1.5" onSubmit={(e) => { e.preventDefault(); a.run({ matchId, at }); }}>
      <input type="datetime-local" className="field !h-9" aria-label={`Date · ${label}`} value={at} onChange={(e) => setAt(e.target.value)} />
      <button className="btn btn-tertiary btn-sm" disabled={a.pending}>Enregistrer</button>
      {a.message && <span role="status" className="text-xs text-orange">✓</span>}
      <FormError message={a.errors._} />
    </form>
  );
}
