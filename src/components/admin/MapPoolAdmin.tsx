"use client";

import { useState } from "react";
import { createCycleAction, deleteCycleAction } from "@/lib/mappool/actions";
import { CDL_ALL, CDL_MODES, POOL_SIZE, VAL_ALL, type CdlMode, type VetoPool } from "@/lib/rules/veto";
import { useServerAction } from "@/components/useServerAction";
import { Field, FormError, TextInput } from "@/components/forms";

/** Création d'un cycle : sélection des cartes (tailles imposées), nom et date d'activation. */
export function CycleEditor({ game, current, tomorrow }: { game: "val" | "cod"; current: VetoPool; tomorrow: string }) {
  const [name, setName] = useState("");
  const [startsOn, setStartsOn] = useState(tomorrow);
  const [val, setVal] = useState<string[]>(game === "val" ? (current as string[]) : []);
  const [cod, setCod] = useState<Record<CdlMode, string[]>>(game === "cod" ? (current as Record<CdlMode, string[]>) : { HP: [], SND: [], CTRL: [] });
  const a = useServerAction(createCycleAction);
  const toggle = (list: string[], m: string) => (list.includes(m) ? list.filter((x) => x !== m) : [...list, m]);
  const chip = (on: boolean, label: string, click: () => void, full: boolean) => (
    <button key={label} type="button" aria-pressed={on} onClick={click} disabled={!on && full} className={`h-9 cursor-pointer border px-3 text-[13px] disabled:cursor-not-allowed disabled:opacity-40 ${on ? "border-orange bg-active-tint text-ink" : "border-line text-silver hover:border-[#5a5a5a]"}`}>
      {on ? "✓ " : ""}{label}
    </button>
  );
  const prev = game === "val" ? (current as string[]) : Object.values(current as Record<CdlMode, string[]>).flat();
  const next = game === "val" ? val : Object.values(cod).flat();
  const inn = [...new Set(next.filter((m) => !prev.includes(m)))];
  const out = [...new Set(prev.filter((m) => !next.includes(m)))];
  return (
    <form className="grid gap-3 px-[18px] py-4" onSubmit={(e) => { e.preventDefault(); a.run({ game, name, startsOn, maps: game === "val" ? val : cod }); }}>
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr))]">
        <Field label="Nom du cycle" error={a.errors.name}>{(p) => <TextInput {...p} value={name} onChange={(e) => setName(e.target.value)} placeholder="ex. Cycle Playoffs" />}</Field>
        <Field label="Activation (00:00, heure de La Réunion)" error={a.errors.startsOn}>{(p) => <TextInput {...p} type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} />}</Field>
      </div>
      {game === "val" ? (
        <div>
          <div className="overline mb-1.5">Pool · {val.length} / {POOL_SIZE.val}</div>
          <div className="flex flex-wrap gap-1.5">{VAL_ALL.map((m) => chip(val.includes(m), m, () => setVal(toggle(val, m)), val.length >= POOL_SIZE.val))}</div>
        </div>
      ) : (
        (Object.keys(CDL_MODES) as CdlMode[]).map((mode) => (
          <div key={mode}>
            <div className="overline mb-1.5">{CDL_MODES[mode]} · {cod[mode].length} / {POOL_SIZE.cod[mode]}</div>
            <div className="flex flex-wrap gap-1.5">{CDL_ALL[mode].map((m) => chip(cod[mode].includes(m), m, () => setCod({ ...cod, [mode]: toggle(cod[mode], m) }), cod[mode].length >= POOL_SIZE.cod[mode]))}</div>
          </div>
        ))
      )}
      {(inn.length > 0 || out.length > 0) && <p className="text-[13px] text-silver">Changements : {[...inn.map((m) => `+ ${m}`), ...out.map((m) => `− ${m}`)].join(", ")}</p>}
      {a.errors.maps && <span className="text-[13px] text-red">{a.errors.maps}</span>}
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn btn-primary btn-sm" disabled={a.pending}>Programmer le cycle</button>
        {a.message && <span role="status" className="text-[13px] text-orange">✓ {a.message}</span>}
        <FormError message={a.errors._} />
      </div>
      <p className="text-xs text-grey">Un veto déjà commencé garde le pool figé à son début ; les nouveaux matchs prennent le cycle actif.</p>
    </form>
  );
}

export function DeleteCycle({ id }: { id: string }) {
  const a = useServerAction(deleteCycleAction);
  return (
    <span className="flex items-center gap-2">
      <button className="btn btn-tertiary btn-sm !min-h-8" disabled={a.pending} onClick={() => a.run(id)}>Annuler</button>
      <FormError message={a.errors._} />
    </span>
  );
}
