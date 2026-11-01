import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getViewer } from "@/lib/auth/viewer";
import { GAMES, getGame } from "@/lib/data/games";
import { achievements, playerLeaderboard } from "@/lib/players";
import { ClassementTabs } from "@/components/ClassementTabs";
import { Empty } from "@/components/PageHeader";

export const metadata: Metadata = { title: "Joueurs & MVP" };

const pct = (w: number, n: number) => (n ? `${Math.round((w / n) * 100)} %` : "—");

export default async function MvpPage({ searchParams }: { searchParams: Promise<{ jeu?: string }> }) {
  const { jeu } = await searchParams;
  const game = getGame(jeu ?? "")?.id ?? "all";
  const year = Number(new Intl.DateTimeFormat("en-CA", { timeZone: "Indian/Reunion", year: "numeric" }).format(new Date()));
  const rows = (await playerLeaderboard(year, game === "all" ? undefined : game)).slice(0, 50);
  const viewer = await getViewer();
  const badges = viewer ? await achievements(viewer.id, year) : null;

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

      <h2 className="font-display mt-10 text-[34px] font-extrabold">Succès à débloquer</h2>
      <p className="text-sm text-silver">Les succès rapportent de l’XP de profil.{viewer ? ` Progression affichée pour ${viewer.pseudo}.` : " Connectez-vous pour suivre votre progression."}</p>
      <div className="mt-3 grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(min(100%,260px),1fr))]">
        {(badges ?? []).map((x) => (
          <div key={x.ico} className={`border bg-surface p-4 ${x.done ? "border-orange" : "border-line"}`}>
            <div className="flex items-center gap-3">
              <span className={`clip-corner-sm grid h-11 w-11 flex-none place-items-center font-display text-sm font-extrabold ${x.done ? "bg-orange text-bg" : "border border-line bg-bg text-silver"}`}>{x.ico}</span>
              <span className="min-w-0 flex-1"><span className="block font-semibold">{x.t}</span><span className="block text-xs text-grey">{x.d}</span></span>
              <span className="text-xs font-bold text-orange">+{x.xp} XP</span>
            </div>
            <div className="mt-3 h-1 bg-bg"><div className={`h-full ${x.done ? "bg-orange" : "bg-[#6a6a6a]"}`} style={{ width: `${Math.min(100, (x.cur / x.max) * 100)}%` }} /></div>
            <div className={`mt-1 text-xs ${x.done ? "text-orange" : "text-grey"}`}>{x.done ? "✓ Débloqué" : `${x.cur} / ${x.max}`}</div>
          </div>
        ))}
        {!badges && <p className="text-sm text-grey"><Link href="/connexion">Connectez-vous</Link> pour voir vos succès.</p>}
      </div>
    </main>
  );
}
