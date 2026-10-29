import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { GAMES, getGame } from "@/lib/data/games";
import { RULES_GAME, RULES_GENERAL, RULES_UPDATED, RULES_VERSION } from "@/lib/data/content";

export const metadata: Metadata = { title: "Règlement" };

export default async function ReglementPage({ searchParams }: { searchParams: Promise<{ jeu?: string; art?: string }> }) {
  const sp = await searchParams;
  const game = getGame(sp.jeu ?? "")?.id ?? "val";
  const art = sp.art && /^[1-6]$/.test(sp.art) ? Number(sp.art) : 0; // 0 = règles du jeu
  const cur = art ? { title: RULES_GENERAL[art - 1].title, scope: "Tous les jeux", n: String(art), items: RULES_GENERAL[art - 1].items } : { title: RULES_GAME[game].title, scope: getGame(game)!.name, n: "J", items: RULES_GAME[game].items };
  const q = (o: { jeu?: string; art?: number }) => `/reglement?jeu=${o.jeu ?? game}${o.art ? `&art=${o.art}` : ""}`;

  return (
    <main className="container-rx pt-7 pb-16">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[clamp(40px,6vw,56px)] font-extrabold leading-none">Règlement</h1>
          <p className="mt-2 max-w-[720px] text-[15px] text-silver">Version {RULES_VERSION} · mise à jour le {RULES_UPDATED}. Le règlement général s’applique à tous les jeux ; chaque jeu ajoute ses règles propres.</p>
        </div>
        <button className="btn btn-tertiary" disabled title="Export PDF : bientôt disponible">Télécharger le PDF</button>
      </div>
      <nav className="mt-4 flex flex-wrap gap-1.5" aria-label="Jeu">
        {GAMES.map((g) => (
          <Link key={g.id} href={q({ jeu: g.id })} aria-current={g.id === game && !art ? "page" : undefined} className={`flex h-9 items-center gap-1.5 border px-2.5 text-[13px] text-ink hover:text-ink ${g.id === game ? "border-orange bg-surface-2" : "border-line hover:border-[#5a5a5a]"}`}>
            <Image src={g.logo} alt="" width={22} height={14} className="h-3.5 w-[22px] object-contain" />
            {g.short}
          </Link>
        ))}
      </nav>
      <div className="mt-4 grid items-start gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr))] lg:grid-cols-[280px_minmax(0,1fr)]">
        <nav className="card lg:sticky lg:top-[88px]" aria-label="Sommaire">
          {RULES_GENERAL.map((s, i) => (
            <Link key={s.title} href={q({ art: i + 1 })} aria-current={art === i + 1 ? "page" : undefined} className={`flex gap-3 border-b border-l-[3px] border-b-surface-2 px-4 py-2.5 text-sm hover:text-ink ${art === i + 1 ? "border-l-orange bg-surface-2 text-ink" : "border-l-transparent text-silver"}`}>
              <span className="w-4 font-display font-bold text-orange">{i + 1}</span>{s.title}
            </Link>
          ))}
          <Link href={q({})} aria-current={!art ? "page" : undefined} className={`flex gap-3 border-l-[3px] px-4 py-2.5 text-sm hover:text-ink ${!art ? "border-l-orange bg-surface-2 text-ink" : "border-l-transparent text-silver"}`}>
            <span className="w-4 font-display font-bold text-orange">J</span>{RULES_GAME[game].title}
          </Link>
        </nav>
        <article className="card">
          <div className="flex flex-wrap justify-between gap-2 border-b border-line px-[18px] py-3 text-xs">
            <span className={`font-bold uppercase tracking-[.08em] ${art ? "text-silver" : "text-orange"}`}>{cur.scope}</span>
            <span className="text-grey">Article {cur.n}</span>
          </div>
          <h2 className="font-display px-[18px] pt-4 text-[28px] font-extrabold">{cur.title}</h2>
          <div className="grid gap-0 p-[18px]">
            {cur.items.map(([n, t]) => (
              <div key={n} id={`art-${n}`} className="grid grid-cols-[64px_minmax(0,1fr)] gap-3 border-b border-surface-2 py-3 text-[15px]">
                <span className="font-mono text-sm text-orange">{n}</span>
                <span className="text-silver">{t}</span>
              </div>
            ))}
          </div>
        </article>
      </div>
    </main>
  );
}
