import { phaseState, phaseWhen, type SeasonPhaseDef } from "@/lib/rules/season";

/** Frise de saison (accueil, Le circuit, compétitions) : phases lues en base, état calculé à la date du jour. */
export function SeasonTimeline({ phases, now, compact = false }: { phases: SeasonPhaseDef[]; now: Date; compact?: boolean }) {
  return (
    <div className="grid border border-line bg-surface [grid-template-columns:repeat(auto-fit,minmax(min(100%,210px),1fr))]">
      {phases.map((p) => {
        const st = phaseState(p, now);
        return (
          <div key={p.kind + +p.startsAt} className={`border-r border-b border-line px-[18px] py-4 ${st === "current" ? "border-t-2 !border-t-orange bg-active-tint" : ""}`}>
            <div className={`text-[11px] font-bold uppercase tracking-[.1em] ${st === "current" ? "text-orange" : "text-grey"}`}>
              {st === "done" ? "✓ Terminé" : st === "current" ? "● En cours" : "À venir"} · {phaseWhen(p)}
            </div>
            <div className="font-display mt-1 text-xl font-bold">{p.label}</div>
            {!compact && <div className="mt-1 text-[13px] leading-snug text-silver">{p.description}</div>}
            {!p.countsForGeneral && <div className="mt-1.5 text-[11px] font-bold uppercase tracking-[.06em] text-silver">Hors classement général</div>}
          </div>
        );
      })}
    </div>
  );
}
