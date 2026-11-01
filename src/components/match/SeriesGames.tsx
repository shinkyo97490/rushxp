"use client";

import { useState } from "react";
import { CDL_ALL, VAL_ALL, type CdlMode } from "@/lib/rules/veto";
import { cdlModeAt, gameLabel, gameUnit, seriesShape, type GameScore } from "@/lib/rules/series";

type Row = { map: string; mode?: string; a: string; b: string };
const num = (v: string) => (v.trim() === "" ? NaN : Number(v));

/** Lignes visibles : jusqu'à la première partie incomplète, ou jusqu'à ce qu'un camp ait gagné la série. */
function visible(rows: Row[], series: string) {
  const { toWin, max } = seriesShape(series);
  let a = 0;
  let b = 0;
  let n = 0;
  for (let i = 0; i < max; i++) {
    n = i + 1;
    const x = num(rows[i]?.a ?? "");
    const y = num(rows[i]?.b ?? "");
    if (!Number.isInteger(x) || !Number.isInteger(y) || x === y) break;
    if (x > y) a++;
    else b++;
    if (a === toWin || b === toWin) break;
  }
  return { n, a, b, done: a === toWin || b === toWin };
}

/** Saisie du score de chaque partie / carte d'une série (BO3, BO5, FT3…), côté A–B. */
export function SeriesEditor({
  game,
  series,
  names,
  planned,
  initial,
  onChange,
}: {
  game: string;
  series: string;
  names: { a: string; b: string };
  planned: { map: string; mode?: string }[];
  initial?: GameScore[];
  onChange: (games: GameScore[]) => void;
}) {
  const { max } = seriesShape(series);
  const [rows, setRows] = useState<Row[]>(() =>
    Array.from({ length: max }, (_, i) => {
      const g = initial?.[i];
      const mode = g?.mode ?? planned[i]?.mode ?? (game === "cod" ? cdlModeAt(i) : undefined);
      return { map: g?.map ?? planned[i]?.map ?? "", mode, a: g ? String(g.a) : "", b: g ? String(g.b) : "" };
    }),
  );
  const v = visible(rows, series);

  const update = (i: number, patch: Partial<Row>) => {
    const next = rows.map((r, j) => (j === i ? { ...r, ...patch } : r));
    setRows(next);
    const vis = visible(next, series);
    onChange(
      next.slice(0, vis.n).flatMap((r) => {
        const a = num(r.a);
        const b = num(r.b);
        if (!Number.isInteger(a) || !Number.isInteger(b)) return [];
        return [{ a, b, ...(r.map ? { map: r.map } : {}), ...(r.mode ? { mode: r.mode } : {}) }];
      }),
    );
  };

  const mapChoices = (r: Row) => (game === "val" ? VAL_ALL : game === "cod" && r.mode ? CDL_ALL[r.mode as CdlMode] ?? [] : []);
  const unit = gameUnit(game);

  return (
    <div className="grid gap-1.5">
      <div className="grid grid-cols-[minmax(0,1fr)_64px_64px] gap-2 text-[11px] font-bold uppercase tracking-[.08em] text-grey">
        <span>Partie · score en {unit}</span>
        <span className="truncate text-center" title={names.a}>{names.a}</span>
        <span className="truncate text-center" title={names.b}>{names.b}</span>
      </div>
      {rows.slice(0, v.n).map((r, i) => {
        const choices = mapChoices(r);
        const x = num(r.a);
        const y = num(r.b);
        const tie = Number.isInteger(x) && Number.isInteger(y) && x === y;
        return (
          <div key={i} className="grid grid-cols-[minmax(0,1fr)_64px_64px] items-center gap-2">
            <div className="min-w-0 text-sm">
              {choices.length > 0 && !planned[i] ? (
                <select className="field !h-9 w-full" aria-label={`Carte ${i + 1}`} value={r.map} onChange={(e) => update(i, { map: e.target.value })}>
                  <option value="">{gameLabel(game, i, { mode: r.mode })} · carte ?</option>
                  {choices.map((c) => <option key={c} value={c}>{gameLabel(game, i, { map: c, mode: r.mode })}</option>)}
                </select>
              ) : (
                <span className="block truncate">{gameLabel(game, i, r.map ? { map: r.map, mode: r.mode } : { mode: r.mode })}</span>
              )}
              {tie && <span className="block text-xs text-red">Il faut un vainqueur.</span>}
            </div>
            {(["a", "b"] as const).map((k) => (
              <input
                key={k}
                type="number"
                inputMode="numeric"
                min={0}
                max={999}
                className="field !h-9 w-full text-center"
                aria-label={`${gameLabel(game, i)} · ${names[k]}`}
                value={r[k]}
                onChange={(e) => update(i, { [k]: e.target.value })}
              />
            ))}
          </div>
        );
      })}
      <div className="mt-1 text-sm">
        Série : <strong>{v.a}–{v.b}</strong>
        {v.done ? <span className="text-orange"> · victoire {v.a > v.b ? names.a : names.b}</span> : <span className="text-grey"> · en cours de saisie</span>}
      </div>
    </div>
  );
}

/** Affichage du détail d'une série : une ligne par partie, vainqueur en évidence. */
export function SeriesTable({ game, games, names, compact = false }: { game: string; games: GameScore[]; names: { a: string; b: string }; compact?: boolean }) {
  if (!games.length) return null;
  return (
    <div className={compact ? "" : "card"}>
      {!compact && (
        <div className="card-head">
          <span className="card-title">Détail de la série</span>
          <span className="card-meta">{games.length} partie(s) · {gameUnit(game)}</span>
        </div>
      )}
      <div className={`grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 ${compact ? "text-[13px]" : "px-[18px] py-1 text-sm"}`}>
        {games.map((g, i) => {
          const aWon = g.a > g.b;
          return (
            <div key={i} className="col-span-2 grid grid-cols-subgrid items-center border-b border-surface-2 py-1.5 last:border-b-0">
              <span className="min-w-0 truncate">
                {gameLabel(game, i, g)}
                <span className="text-xs text-grey"> · {aWon ? names.a : names.b}</span>
              </span>
              <span className="font-display text-base font-bold tabular-nums">
                <span className={aWon ? "text-orange" : "text-grey"}>{g.a}</span>
                <span className="text-grey"> – </span>
                <span className={!aWon ? "text-orange" : "text-grey"}>{g.b}</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
