import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { CHALLENGE_GAMES, getGame } from "@/lib/data/games";
import { getPlayoffs } from "@/lib/playoffs";

type BracketMatch = Awaited<ReturnType<typeof getPlayoffs>>["qf"][number];
const fmtWhen = (iso: string | null) => (iso ? new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Indian/Reunion" }).format(new Date(iso)) : "Date à fixer");

export const metadata: Metadata = { title: "Playoffs" };

function MatchBox({ m }: { m: BracketMatch }) {
  const box = (
    <div className={`border bg-surface ${m.state === "Contesté" ? "border-red" : "border-line"}`}>
      <div className="flex justify-between gap-2 border-b border-surface-2 px-3 py-1.5 text-[11px]">
        <span className="text-grey">{fmtWhen(m.when)}</span>
        <span className={m.state === "Terminé" ? "text-grey" : "text-orange"}>{m.state}</span>
      </div>
      {m.sides.map((s, i) => (
        <div key={i} className={`flex items-center gap-2 px-3 py-1.5 text-sm ${s.win === false ? "opacity-55" : ""}`}>
          <span className="w-4 font-mono text-[11px] text-grey">{s.seed ?? ""}</span>
          <span className={`min-w-0 flex-1 truncate ${s.win ? "font-extrabold text-orange" : s.seed ? "" : "italic text-grey"}`}>{s.name}</span>
          <span className="font-display font-bold">{s.score ?? ""}</span>
        </div>
      ))}
    </div>
  );
  return m.id ? <Link href={m.state === "Terminé" ? `/feuille-de-match?m=${m.id}` : `/match?m=${m.id}`} className="block text-ink hover:text-ink">{box}</Link> : box;
}

export default async function PlayoffsPage({ searchParams }: { searchParams: Promise<{ jeu?: string }> }) {
  const { jeu } = await searchParams;
  const g = CHALLENGE_GAMES.find((x) => x.id === jeu) ?? CHALLENGE_GAMES[0];
  const year = Number(new Intl.DateTimeFormat("en-CA", { timeZone: "Indian/Reunion", year: "numeric" }).format(new Date()));
  const { qf, sf, fi, seeds, champion, frozen } = await getPlayoffs(g.id, year);
  const rounds: [string, string, BracketMatch[]][] = [["Quarts", "septembre", qf], ["Demi-finales", "octobre", sf], ["Finale", "nov. → déc.", fi]];

  return (
    <main className="pb-16">
      <section className="relative overflow-hidden border-b border-line bg-black">
        <Image src="/assets/photo-dsc05885.jpg" alt="" fill priority className="object-cover opacity-45" sizes="100vw" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,#000_15%,rgba(0,0,0,.5))]" />
        <div className="container-rx relative flex flex-wrap items-end justify-between gap-6 py-12">
          <div className="max-w-[640px]">
            <div className="text-[13px] font-semibold uppercase tracking-[.14em] text-silver">Saison {year} · septembre → décembre</div>
            <h1 className="font-display mt-1 text-[clamp(56px,9vw,86px)] font-extrabold leading-[.9]">Playoffs</h1>
            <p className="mt-3 text-[16px] text-silver">Les 8 premiers de la Division 1 au seeding officiel du 31 août se qualifient. Élimination directe : 1er contre 8e, 2e contre 7e, etc.</p>
          </div>
          <div className="border border-yellow bg-black/70 px-6 py-4 text-right">
            <div className="overline !text-yellow">Cashprize</div>
            <div className="font-display text-[56px] font-extrabold leading-none text-yellow">2 500 €</div>
            <div className="text-xs text-silver">réparti entre les vainqueurs des 5 jeux</div>
          </div>
        </div>
      </section>

      <div className="container-rx mt-5 grid grid-cols-[minmax(0,1fr)] gap-4">
        <section className="card">
          <div className="card-head"><span className="card-title">Répartition du cashprize</span></div>
          <div className="grid [grid-template-columns:repeat(auto-fit,minmax(min(100%,180px),1fr))]">
            {CHALLENGE_GAMES.map((x) => (
              <div key={x.id} className="flex items-center gap-3 border-r border-b border-surface-2 px-[18px] py-3">
                <Image src={x.logo} alt="" width={36} height={24} className="h-6 w-9 object-contain" />
                <span><span className="block font-display text-xl font-bold text-yellow">500 €</span><span className="block text-xs text-grey">Vainqueur {x.short}</span></span>
              </div>
            ))}
          </div>
          <div className="px-[18px] py-2.5 text-xs text-grey">Répartition proposée, à valider par l’équipe RushXP. Versement après validation des résultats, contrôle d’identité et, pour les mineurs, autorisation parentale.</div>
        </section>

        <nav className="flex flex-wrap gap-1.5" aria-label="Jeu">
          {CHALLENGE_GAMES.map((x) => (
            <Link key={x.id} href={`/playoffs?jeu=${x.id}`} aria-current={x.id === g.id ? "page" : undefined} className={`flex h-10 items-center gap-1.5 border px-3 text-[13px] text-ink hover:text-ink ${x.id === g.id ? "border-orange bg-surface-2" : "border-line hover:border-[#5a5a5a]"}`}>
              <Image src={x.logo} alt="" width={24} height={16} className="h-4 w-6 object-contain" />
              {x.short}
            </Link>
          ))}
        </nav>

        <section className="card">
          <div className="card-head"><span className="card-title">Arbre · {getGame(g.id)?.name}</span><span className="card-meta">{g.series} · élimination directe · finale en LAN si confirmée</span></div>
          <div className="overflow-x-auto p-[18px]">
            <div className="grid min-w-[880px] grid-cols-[1fr_1fr_1fr_200px] items-center gap-6">
              {rounds.map(([name, when, ms]) => (
                <div key={name} className="grid gap-3">
                  <div className="overline">{name} · {when}</div>
                  <div className="grid h-full content-around gap-4">{ms.map((m, i) => <MatchBox key={i} m={m} />)}</div>
                </div>
              ))}
              <div className="grid justify-items-center gap-1 border border-yellow bg-[rgba(255,201,40,.06)] px-4 py-6 text-center">
                <span className="overline !text-yellow">Champion</span>
                <span className={`font-display text-xl font-bold ${champion ? "text-ink" : "italic text-grey"}`}>{champion?.name ?? "À déterminer"}</span>
                <span className="font-display text-2xl font-extrabold text-yellow">500 €</span>
              </div>
            </div>
          </div>
        </section>

        <div className="grid items-start gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr))]">
          <section className="card">
            <div className="card-head"><span className="card-title">{frozen ? "Qualifiés · seeding officiel" : "Aperçu · si la saison s’arrêtait aujourd’hui"}</span></div>
            {seeds.length === 0 && <div className="px-[18px] py-4 text-sm text-grey">Aucun qualifié : le classement {getGame(g.id)?.name} ne compte encore aucun participant hors placement.</div>}
            {seeds.map((s) => (
              <div key={s.seed} className="grid grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-3 border-b border-surface-2 px-[18px] py-2 text-sm">
                <span className={`font-display text-lg font-extrabold ${s.seed === 1 ? "text-yellow" : ""}`}>{s.seed}</span>
                <span className="truncate font-semibold">{s.name}</span>
                <span className={`text-xs font-bold ${s.state === "Éliminé" ? "text-grey" : s.state === "Champion" ? "text-yellow" : s.state === "En lice" ? "text-silver" : "text-orange"}`}>{frozen ? s.state : "Provisoire"}</span>
              </div>
            ))}
          </section>
          <section className="card">
            <div className="card-head"><span className="card-title">Dates clés</span></div>
            {[["31 août", "Seeding officiel figé, qualifiés connus", "text-silver"], ["Sept.", "Quarts de finale", "text-orange"], ["Oct.", "Demi-finales", "text-ink"], ["Nov. → déc.", "Finales de tous les jeux (LAN)", "text-yellow"], ["Déc.", "Versement du cashprize", "text-silver"]].map(([w, t, c]) => (
              <div key={w} className="grid grid-cols-[110px_minmax(0,1fr)] gap-3 border-b border-surface-2 px-[18px] py-2.5 text-sm">
                <span className={`font-bold ${c}`}>{w}</span><span>{t}</span>
              </div>
            ))}
            <div className="flex flex-wrap gap-2 px-[18px] py-3">
              <Link href="/reglement" className="btn btn-tertiary btn-sm">Règlement des Playoffs</Link>
              <Link href="/calendrier?f=playoffs" className="btn btn-tertiary btn-sm">Calendrier</Link>
            </div>
          </section>
        </div>
        <p className="text-xs text-grey">
          {frozen
            ? `Seeding officiel figé le ${new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "short", timeZone: "Indian/Reunion" }).format(new Date(frozen.at))} · empreinte SHA-256 ${frozen.hash.slice(0, 16)}…`
            : "Seeding pas encore figé : l’arbre affiché est un aperçu calculé sur le classement actuel."}
        </p>
      </div>
    </main>
  );
}
