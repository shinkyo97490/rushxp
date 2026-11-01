"use client";

import { useState } from "react";
import { closeEventAction, saveRoundAction } from "@/lib/events/actions";
import { useServerAction } from "@/components/useServerAction";
import { FormError } from "@/components/forms";

type Cell = { placement: string; kills: string };

/** Saisie arbitre d'un RDV mensuel : manche par manche, placement et éliminations, brouillon puis publication. */
export function RoundEntry({
  eventId,
  solo,
  kills,
  entries,
  rounds,
  published,
  lobbies,
  canClose,
}: {
  eventId: string;
  solo: boolean;
  kills: boolean;
  entries: { id: string; name: string; sub: string }[];
  rounds: Record<number, Record<string, { placement: number; kills: number }>>;
  published: number[];
  lobbies: string[][] | null;
  canClose: boolean;
}) {
  const [round, setRound] = useState(() => Math.min(6, (published.at(-1) ?? 0) + 1));
  const init = (n: number) => Object.fromEntries(entries.map((e) => [e.id, { placement: String(rounds[n]?.[e.id]?.placement ?? ""), kills: String(rounds[n]?.[e.id]?.kills ?? "") }]));
  const [cells, setCells] = useState<Record<string, Cell>>(() => init(round));
  const save = useServerAction(saveRoundAction);
  const close = useServerAction(closeEventAction);
  const pick = (n: number) => {
    setRound(n);
    setCells(init(n));
  };
  const set = (id: string, k: keyof Cell, v: string) => setCells((c) => ({ ...c, [id]: { ...c[id], [k]: v.replace(/\D/g, "").slice(0, 3) } }));
  const submit = (publish: boolean) =>
    save.run({
      eventId,
      round,
      publish,
      rows: entries.map((e) => ({ entryId: e.id, placement: Number(cells[e.id]?.placement || 0), kills: Number(cells[e.id]?.kills || 0) })),
    });
  const groups = lobbies ?? [entries.map((e) => e.id)];
  const byId = new Map(entries.map((e) => [e.id, e]));

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-1" role="tablist" aria-label="Manche">
        {[1, 2, 3, 4, 5, 6].map((n) => (
          <button key={n} type="button" aria-pressed={round === n} onClick={() => pick(n)} className={`btn btn-sm !min-h-8 !px-2.5 ${round === n ? "btn-secondary" : "btn-tertiary"}`}>
            M{n}{published.includes(n) ? " ✓" : rounds[n] ? " ·" : ""}
          </button>
        ))}
      </div>
      {entries.length === 0 && <p className="text-sm text-grey">Aucun inscrit.</p>}
      {groups.map((ids, gi) => (
        <div key={gi} className="border border-line">
          {lobbies && <div className="overline border-b border-line px-3 py-1.5">Lobby {String.fromCharCode(65 + gi)} · places 1 à 8</div>}
          {ids.map((id) => {
            const e = byId.get(id)!;
            return (
              <div key={id} className="flex flex-wrap items-center gap-2 border-b border-surface-2 px-3 py-1.5 text-sm last:border-b-0">
                <span className="min-w-0 flex-1 truncate">{e.name} <span className="text-xs text-grey">· {e.sub}</span></span>
                <input className="field !h-8 w-16 text-center" inputMode="numeric" aria-label={`Place · ${e.name}`} placeholder="Place" value={cells[id]?.placement ?? ""} onChange={(x) => set(id, "placement", x.target.value)} />
                {kills && <input className="field !h-8 w-16 text-center" inputMode="numeric" aria-label={`Éliminations · ${e.name}`} placeholder="Kills" value={cells[id]?.kills ?? ""} onChange={(x) => set(id, "kills", x.target.value)} />}
              </div>
            );
          })}
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn btn-tertiary btn-sm" disabled={save.pending} onClick={() => submit(false)}>Enregistrer le brouillon</button>
        <button className="btn btn-primary btn-sm" disabled={save.pending} onClick={() => submit(true)}>Publier la manche {round}</button>
        {canClose && <button className="btn btn-secondary btn-sm" disabled={close.pending} onClick={() => close.run(eventId)}>Clôturer le RDV</button>}
        {(save.message || close.message) && <span role="status" className="text-[13px] text-orange">✓ {save.message ?? close.message}</span>}
      </div>
      <FormError message={save.errors._ ?? close.errors._} />
      <p className="text-xs text-grey">{solo ? "Laissez vide un joueur absent sur la manche." : "Laissez vide une équipe absente sur la manche."} Une manche publiée apparaît aussitôt sur la page RDV mensuels.</p>
    </div>
  );
}
