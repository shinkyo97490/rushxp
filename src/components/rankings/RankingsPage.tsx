import { CHALLENGE_GAMES, getGame, isSolo } from "@/lib/data/games";
import { getViewer } from "@/lib/auth/viewer";
import { loadRankingsPage } from "@/lib/rankings/queries";
import { getGeneralStandings } from "@/lib/rankings/standings";
import { rankLabel } from "@/lib/rules/standings";
import { ClassementTabs } from "@/components/ClassementTabs";
import { GameSelect } from "./GameSelect";
import { RankingsClient, type RankingsTab } from "./RankingsClient";

export async function RankingsPage({ tab, searchParams }: { tab: RankingsTab; searchParams: Promise<{ game?: string }> }) {
  const { game: gameParam } = await searchParams;
  const found = getGame(gameParam ?? "");
  const game = found && found.kind === "challenge" ? found : CHALLENGE_GAMES[0];
  const viewer = await getViewer();
  const solo = isSolo(game);
  const data = await loadRankingsPage(game.id, viewer);
  const general = data.me?.structureId ? (await getGeneralStandings()).list.find((s) => s.structureId === data.me!.structureId) : undefined;

  return (
    <main className="container-rx pt-7 pb-16">
      <ClassementTabs active="rankings" />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[13px] font-semibold uppercase tracking-[.14em] text-grey">Classement permanent · mis à jour après chaque match validé</div>
          <h1 className="font-display mt-1 text-[clamp(40px,6vw,56px)] font-extrabold leading-none">RushXP Rankings</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <GameSelect value={game.id} options={CHALLENGE_GAMES.map((g) => ({ id: g.id, label: `${g.name} · ${isSolo(g) ? "Solo 1v1" : "Équipes " + g.format}` }))} />
          <select className="field" aria-label="Région" defaultValue="re">
            <option value="re">Océan Indien · La Réunion</option>
            <option disabled>France métropolitaine (bientôt)</option>
          </select>
        </div>
      </div>
      <RankingsClient
        key={game.id}
        tab={tab}
        game={{ id: game.id, name: game.name, solo, format: game.format }}
        role={viewer?.role ?? "visiteur"}
        canAct={data.canAct}
        rows={data.rows}
        challenges={data.challenges}
        enterable={data.enterable.map((e) => ({ id: e.id, label: e.label }))}
        generalRank={general ? { label: rankLabel(general), structure: general.structure.name } : null}
      />
    </main>
  );
}
