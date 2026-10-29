import type { Metadata } from "next";
import Link from "next/link";
import { ClassementTabs } from "@/components/ClassementTabs";
import { GAMES } from "@/lib/data/games";
import { getStructureStandings } from "@/lib/data/repo";
import { rankLabel } from "@/lib/rules/standings";
import { structurePoints } from "@/lib/rules/scales";

export const metadata: Metadata = { title: "Classement général" };

export default async function ClassementPage({ searchParams }: { searchParams: Promise<{ sort?: string }> }) {
  const { sort } = await searchParams;
  const sortGame = GAMES.find((g) => g.id === sort);
  const all = getStructureStandings();
  const list = sortGame
    ? [...all].sort((a, b) => (b.perGame[sortGame.id]?.points ?? 0) - (a.perGame[sortGame.id]?.points ?? 0))
    : all;
  const cols = `48px minmax(180px,1fr) 70px repeat(${GAMES.length}, 58px)`;

  return (
    <main className="container-rx pt-7 pb-16">
      <ClassementTabs active="general" />
      <div className="text-[13px] font-semibold uppercase tracking-[.14em] text-grey">Toutes compétitions · saison en cours</div>
      <h1 className="font-display mt-1 text-[clamp(40px,6vw,56px)] font-extrabold leading-none">Classement général des structures</h1>
      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-silver">
        Les points viennent du barème appliqué au rang de chaque roster dans les RushXP Rankings : {[1, 2, 3, 4, 5, 6, 7, 8].map(structurePoints).join(" / ")}, puis −4 par rang (minimum 5).
        Seule l’équipe la mieux classée d’une structure compte. En 1v1, c’est le meilleur joueur. Pour les jeux en lobby, on prend le rang de la structure au cumul des RDV mensuels.
      </p>

      <div className="card mt-5 overflow-x-auto">
        <div style={{ minWidth: 48 + 180 + 70 + GAMES.length * 58 + 12 * (GAMES.length + 3) + 36 }}>
          <div className="grid items-end gap-3 border-b border-line px-[18px] py-2.5 overline !font-normal" style={{ gridTemplateColumns: cols }}>
            <span>Rang</span>
            <span>Structure</span>
            <Link href="/classement" className={`text-right ${!sortGame ? "text-orange" : "text-grey"}`} aria-current={!sortGame ? "true" : undefined}>Total</Link>
            {GAMES.map((g) => (
              <Link key={g.id} href={`/classement?sort=${g.id}`} title={`Trier par ${g.name}`} className={`text-center ${sortGame?.id === g.id ? "text-orange" : "text-grey"} hover:text-ink`}>
                {g.short}
              </Link>
            ))}
          </div>
          {list.map((s) => (
            <div key={s.structureId} className="list-row grid items-center gap-3 text-sm" style={{ gridTemplateColumns: cols }}>
              <span className={`font-display text-xl font-extrabold ${s.rank === 1 ? "text-yellow" : ""}`}>{rankLabel(s)}</span>
              <span className="flex min-w-0 items-center gap-2.5">
                <span className="clip-corner-sm grid h-8 w-8 flex-none place-items-center bg-surface-2 font-mono text-[10px] text-silver">{s.structure.tag}</span>
                <span className="truncate font-semibold">{s.structure.name}</span>
                {s.tied && <span className="badge text-silver">Égalité</span>}
              </span>
              <span className="text-right font-display text-lg font-bold">{s.total}</span>
              {GAMES.map((g) => {
                const pg = s.perGame[g.id];
                return (
                  <span key={g.id} className={`text-center ${pg ? "" : "text-grey"}`} title={pg ? `${g.name} : ${pg.rank}e → ${pg.points} pts` : `${g.name} : non classé`}>
                    {pg ? pg.points : "—"}
                  </span>
                );
              })}
            </div>
          ))}
        </div>
        <div className="border-t border-line px-[18px] py-2.5 text-xs leading-normal text-grey">
          Égalité : rang partagé (noté « = »). Départage pour les Playoffs et les récompenses : nombre de jeux classés, puis meilleur rang obtenu sur un jeu, puis résultat direct. Toute correction de résultat recalcule ce classement et est inscrite au journal d’audit.
        </div>
      </div>
    </main>
  );
}
