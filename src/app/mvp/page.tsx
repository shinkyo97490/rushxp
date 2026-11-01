import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getViewer } from "@/lib/auth/viewer";
import { db } from "@/lib/db";
import { seasonYearAt } from "@/lib/rules/season";
import { GAMES, getGame } from "@/lib/data/games";
import { playerLeaderboard } from "@/lib/players";
import { syncAchievements } from "@/lib/achievements";
import { ACHIEVEMENTS } from "@/lib/rules/achievements";
import { AchievementGrid } from "@/components/achievements/AchievementGrid";
import { ClassementTabs } from "@/components/ClassementTabs";
import { Empty } from "@/components/PageHeader";

export const metadata: Metadata = { title: "Joueurs & MVP" };

const pct = (w: number, n: number) => (n ? `${Math.round((w / n) * 100)} %` : "—");

export default async function MvpPage({ searchParams }: { searchParams: Promise<{ jeu?: string }> }) {
  const { jeu } = await searchParams;
  const game = getGame(jeu ?? "")?.id ?? "all";
  const year = seasonYearAt();
  const rows = (await playerLeaderboard(year, game === "all" ? undefined : game)).slice(0, 50);
  const viewer = await getViewer();
  const badges = viewer ? await syncAchievements(viewer.id) : null;
  const xp = viewer ? (await db.user.findUnique({ where: { id: viewer.id }, select: { xp: true } }))?.xp ?? 0 : null;

  return (
    <main className="container-rx pt-7 pb-16">
      <ClassementTabs active="mvp" />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[clamp(40px,6vw,56px)] font-extrabold leading-none">Joueurs de la saison</h1>
          <p className="mt-2 max-w-[680px] text-[15px] text-silver">Classement individuel : titres de MVP élus par les joueurs après chaque match validé, puis taux de victoire. Ce classement ne donne pas de points aux structures.</p>
        </div>
        <nav className="flex flex-wrap gap-1" aria-label="Jeu">
          <Link href="/mvp" className={`btn btn-sm ${game === "all" ? "btn-secondary" : "btn-tertiary"}`}>Tous</Link>
          {GAMES.map((g) => <Link key={g.id} href={`/mvp?jeu=${g.id}`} className={`btn btn-sm ${game === g.id ? "btn-secondary" : "btn-tertiary"}`}>{g.short}</Link>)}
        </nav>
      </div>

      <div className="mt-5 grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr))]">
        {rows.slice(0, 3).map((r, i) => (
          <Link href={`/joueur/${encodeURIComponent(r.pseudo)}`} key={r.id} className={`flex items-center gap-4 border bg-surface px-[18px] py-4 ${i === 0 ? "border-yellow" : "border-line"}`}>
            <span className={`font-display text-[44px] font-extrabold leading-none ${i === 0 ? "text-yellow" : "text-silver"}`}>{i + 1}</span>
            <span className="min-w-0">
              <span className="block font-display text-2xl font-bold text-ink">{r.pseudo}</span>
              <span className="block truncate text-xs text-grey">{r.team} · {r.games.map((g) => getGame(g)?.short).join(", ")}</span>
              <span className="block text-[13px] text-silver">{r.mvp} MVP · {pct(r.wins, r.played)} de victoires</span>
            </span>
          </Link>
        ))}
      </div>

      <section className="card mt-4 overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="overline !font-normal">
              <th className="px-4 py-2.5 text-left font-normal">#</th>
              <th className="px-3 py-2.5 text-left font-normal">Joueur</th>
              <th className="px-3 py-2.5 text-left font-normal">Jeu</th>
              <th className="px-3 py-2.5 text-center font-normal">MVP</th>
              <th className="px-3 py-2.5 text-center font-normal">Matchs</th>
              <th className="px-4 py-2.5 text-right font-normal">Victoires</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id} className="border-t border-surface-2 hover:bg-surface-2">
                <td className={`px-4 py-2 font-display text-lg font-extrabold ${i === 0 ? "text-yellow" : i < 3 ? "text-silver" : ""}`}>{i + 1}</td>
                <td className="px-3 py-2"><Link href={`/joueur/${encodeURIComponent(r.pseudo)}`} className="font-bold text-ink">{r.pseudo}</Link> <span className="text-xs text-grey">· {r.team}</span></td>
                <td className="px-3 py-2">
                  <span className="flex items-center gap-1.5">
                    {r.games.slice(0, 3).map((id) => {
                      const g = getGame(id);
                      return g ? <Image key={id} src={g.logo} alt={g.short} width={22} height={14} className="h-3.5 w-[22px] object-contain" /> : null;
                    })}
                  </span>
                </td>
                <td className="px-3 py-2 text-center font-bold">{r.mvp}</td>
                <td className="px-3 py-2 text-center text-silver">{r.played}</td>
                <td className="px-4 py-2 text-right font-display text-lg font-bold">{pct(r.wins, r.played)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <Empty>Aucun match validé cette saison{game !== "all" ? ` en ${getGame(game)?.name}` : ""}.</Empty>}
      </section>

      <h2 id="succes" className="font-display mt-10 scroll-mt-24 text-[34px] font-extrabold">Succès à débloquer</h2>
      <p className="mb-4 text-sm text-silver">{ACHIEVEMENTS.length} succès, calculés sur vos vrais résultats. Chaque succès débloqué est définitif et rapporte de l’XP : 250 XP = 1 niveau.{viewer ? "" : " "}{!viewer && <><Link href="/connexion">Connectez-vous</Link> pour suivre votre progression.</>}</p>
      <AchievementGrid list={badges ?? ACHIEVEMENTS.map((a) => ({ ...a, cur: 0, done: false, unlockedAt: null }))} xp={xp} />
    </main>
  );
}
