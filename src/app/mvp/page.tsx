import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { db } from "@/lib/db";
import { getViewer } from "@/lib/auth/viewer";
import { GAMES, getGame } from "@/lib/data/games";
import { BADGES } from "@/lib/data/content";
import { mvpRows } from "@/lib/data/demo-competition";
import { ClassementTabs } from "@/components/ClassementTabs";
import { DemoNotice } from "@/components/PageHeader";

export const metadata: Metadata = { title: "Joueurs & MVP" };

export default async function MvpPage({ searchParams }: { searchParams: Promise<{ jeu?: string }> }) {
  const { jeu } = await searchParams;
  const game = getGame(jeu ?? "")?.id ?? "all";
  const rows = mvpRows(game);
  const viewer = await getViewer();
  // Progression réelle quand elle est calculable aujourd'hui (niveau XP, jeux pratiqués).
  const me = viewer ? await db.user.findUnique({ where: { id: viewer.id }, select: { level: true, memberships: { where: { leftAt: null }, select: { game: true } } } }) : null;
  const progress = (code: string): [number, number] | null => {
    if (!me) return null;
    if (code === "XP") return [me.level, 25];
    if (code === "MG") return [new Set(me.memberships.map((m) => m.game)).size, 3];
    return [0, code === "×10" ? 10 : code === "RDV" ? 3 : 1];
  };

  return (
    <main className="container-rx pt-7 pb-16">
      <ClassementTabs active="mvp" />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[clamp(40px,6vw,56px)] font-extrabold leading-none">Joueurs de la saison</h1>
          <p className="mt-2 max-w-[680px] text-[15px] text-silver">Classement individuel : titres de MVP élus après chaque match validé, puis note moyenne RushXP. Ce classement ne donne pas de points aux structures.</p>
        </div>
        <nav className="flex flex-wrap gap-1" aria-label="Jeu">
          <Link href="/mvp" className={`btn btn-sm ${game === "all" ? "btn-secondary" : "btn-tertiary"}`}>Tous</Link>
          {GAMES.map((g) => <Link key={g.id} href={`/mvp?jeu=${g.id}`} className={`btn btn-sm ${game === g.id ? "btn-secondary" : "btn-tertiary"}`}>{g.short}</Link>)}
        </nav>
      </div>

      <div className="mt-5 grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr))]">
        {rows.slice(0, 3).map((r, i) => (
          <div key={r.name + r.game} className={`flex items-center gap-4 border bg-surface px-[18px] py-4 ${i === 0 ? "border-yellow" : "border-line"}`}>
            <span className={`font-display text-[44px] font-extrabold leading-none ${i === 0 ? "text-yellow" : "text-silver"}`}>{i + 1}</span>
            <span className="min-w-0">
              <span className="block font-display text-2xl font-bold">{r.name}</span>
              <span className="block truncate text-xs text-grey">{r.team} · {getGame(r.game)?.short}</span>
              <span className="block text-[13px] text-silver">{r.mvp} MVP · note {r.note.toFixed(1).replace(".", ",")}</span>
            </span>
          </div>
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
              <th className="px-4 py-2.5 text-right font-normal">Note</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const g = getGame(r.game);
              return (
                <tr key={r.name + r.game} className="border-t border-surface-2 hover:bg-surface-2">
                  <td className={`px-4 py-2 font-display text-lg font-extrabold ${i === 0 ? "text-yellow" : i < 3 ? "text-silver" : ""}`}>{i + 1}</td>
                  <td className="px-3 py-2"><strong>{r.name}</strong> <span className="text-xs text-grey">· {r.team}</span></td>
                  <td className="px-3 py-2"><span className="flex items-center gap-1.5">{g && <Image src={g.logo} alt="" width={22} height={14} className="h-3.5 w-[22px] object-contain" />}{g?.short}</span></td>
                  <td className="px-3 py-2 text-center font-bold">{r.mvp}</td>
                  <td className="px-3 py-2 text-center text-silver">{r.matches}</td>
                  <td className="px-4 py-2 text-right font-display text-lg font-bold">{r.note.toFixed(1).replace(".", ",")}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
      <DemoNotice>Classement individuel de démonstration : les MVP seront élus après chaque match validé.</DemoNotice>

      <h2 className="font-display mt-10 text-[34px] font-extrabold">Succès à débloquer</h2>
      <p className="text-sm text-silver">Les succès rapportent de l’XP de profil.{viewer ? ` Progression affichée pour ${viewer.pseudo}.` : " Connectez-vous pour suivre votre progression."}</p>
      <div className="mt-3 grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(min(100%,260px),1fr))]">
        {BADGES.map(([code, t, d, xp]) => {
          const p = progress(code);
          const done = !!p && p[0] >= p[1];
          return (
            <div key={code} className={`border bg-surface p-4 ${done ? "border-orange" : "border-line"}`}>
              <div className="flex items-center gap-3">
                <span className={`clip-corner-sm grid h-11 w-11 flex-none place-items-center font-display text-sm font-extrabold ${done ? "bg-orange text-bg" : "border border-line bg-bg text-silver"}`}>{code}</span>
                <span className="min-w-0 flex-1"><span className="block font-semibold">{t}</span><span className="block text-xs text-grey">{d}</span></span>
                <span className="text-xs font-bold text-orange">+{xp} XP</span>
              </div>
              {p && (
                <>
                  <div className="mt-3 h-1 bg-bg"><div className={`h-full ${done ? "bg-orange" : "bg-[#6a6a6a]"}`} style={{ width: `${Math.min(100, (p[0] / p[1]) * 100)}%` }} /></div>
                  <div className={`mt-1 text-xs ${done ? "text-orange" : "text-grey"}`}>{done ? "✓ Débloqué" : `${p[0]} / ${p[1]}`}</div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}
