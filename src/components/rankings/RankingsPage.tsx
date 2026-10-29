import { CHALLENGE_GAMES, getGame, isSolo, type ChallengeGameId } from "@/lib/data/games";
import { getRankings, getStructureStandings } from "@/lib/data/repo";
import { initialChallenges } from "@/lib/data/challenges";
import { canChallenge, getRole } from "@/lib/session";
import { rankLabel } from "@/lib/rules/standings";
import { ClassementTabs } from "@/components/ClassementTabs";
import { GameSelect } from "./GameSelect";
import { RankingsClient, type RankingsTab } from "./RankingsClient";

export async function RankingsPage({ tab, searchParams }: { tab: RankingsTab; searchParams: Promise<{ game?: string }> }) {
  const { game: gameParam } = await searchParams;
  const game = getGame(gameParam ?? "") ?? CHALLENGE_GAMES[0];
  const gameId = (game.kind === "challenge" ? game.id : "val") as ChallengeGameId;
  const role = await getRole();
  const solo = isSolo(game);
  const rows = getRankings(gameId);
  const me = rows.find((r) => r.isMe)!;
  const general = getStructureStandings().find((s) => s.structureId === me.structureId);

  return (
    <main className="container-rx pt-7 pb-16">
      <ClassementTabs active="rankings" />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[13px] font-semibold uppercase tracking-[.14em] text-grey">Classement permanent · mis à jour après chaque match validé</div>
          <h1 className="font-display mt-1 text-[clamp(40px,6vw,56px)] font-extrabold leading-none">RushXP Rankings</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <GameSelect value={gameId} options={CHALLENGE_GAMES.map((g) => ({ id: g.id, label: `${g.name} · ${isSolo(g) ? "Solo 1v1" : "Équipes " + g.format}` }))} />
          <select className="field" aria-label="Région" defaultValue="re">
            <option value="re">Océan Indien · La Réunion</option>
            <option disabled>France métropolitaine (bientôt)</option>
          </select>
        </div>
      </div>
      <RankingsClient
        key={gameId}
        tab={tab}
        game={{ id: gameId, name: game.name, solo, format: game.format }}
        role={role}
        canAct={canChallenge(role, solo)}
        rows={rows}
        initial={initialChallenges(gameId)}
        generalRank={general ? { label: rankLabel(general), structure: general.structure.name } : null}
      />
    </main>
  );
}
