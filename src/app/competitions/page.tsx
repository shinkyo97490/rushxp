import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { db } from "@/lib/db";
import { GAMES, getGame } from "@/lib/data/games";
import { RULES_GAME } from "@/lib/data/content";
import { demoMatches, topOf } from "@/lib/data/demo-competition";
import { getSeason } from "@/lib/season";
import { SeasonTimeline } from "@/components/SeasonTimeline";
import { DemoNotice, Empty, TabLinks } from "@/components/PageHeader";
import type { ChallengeGameId } from "@/lib/data/games";

export const metadata: Metadata = { title: "Compétitions" };

const DESC: Record<string, { comp: string; photo: string; desc: string }> = {
  val: { comp: "RushXP Valorant Series", photo: "/assets/photo-dsc07373.jpg", desc: "Ligue 5v5 en divisions de 8. Défis toute l’année, veto BO3 directement dans le Match Center, Playoffs pour le top 8 de la Division 1." },
  rl: { comp: "RushXP Rocket Cup", photo: "/assets/photo-dsc06369.jpg", desc: "Classement 3v3 permanent. Séries BO5, BO7 en finale. Le lobby est créé par l’équipe la mieux classée." },
  cod: { comp: "RushXP CDL Challengers", photo: "/assets/photo-dsc05885.jpg", desc: "Circuit 4v4 au format CDL : séries BO5 alternant Hardpoint, Recherche & Destruction et Contrôle, veto mode par mode." },
  fc: { comp: "RushXP FUT Ladder", photo: "/assets/photo-dsc06256.jpg", desc: "Ladder individuel FUT en aller simple. Le meilleur joueur de chaque structure compte au classement général." },
  tek: { comp: "RushXP Tekken Clash", photo: "/assets/photo-dsc06256.jpg", desc: "Ligue 1v1 en sets FT3, finale des Playoffs en FT5. Le perdant d’une manche peut changer de personnage." },
  tft: { comp: "RDV mensuel TFT", photo: "/assets/photo-dsc05753.jpg", desc: "Un rendez-vous par mois en 6 manches, lobbys de 8 recomposés selon le classement cumulé." },
  wz: { comp: "RDV mensuel Warzone", photo: "/assets/photo-dsc05885.jpg", desc: "Un rendez-vous par mois en duo, 6 manches, placement + 1 point par élimination." },
  apex: { comp: "RDV mensuel Apex Legends", photo: "/assets/photo-dsc06369.jpg", desc: "Un rendez-vous par mois en trio, 6 manches, placement + 1 point par élimination." },
};

export default async function CompetitionsPage({ searchParams }: { searchParams: Promise<{ jeu?: string; tab?: string }> }) {
  const sp = await searchParams;
  const g = getGame(sp.jeu ?? "") ?? GAMES[0];
  const d = DESC[g.id];
  const tab = sp.tab === "participants" || sp.tab === "reglement" ? sp.tab : "apercu";
  const lobby = g.kind === "lobby";
  const rosters = await db.roster.findMany({
    where: { game: g.id, structure: { status: "VERIFIED" } },
    include: { structure: { select: { name: true, tag: true } }, members: { where: { leftAt: null }, select: { role: true } } },
    orderBy: { createdAt: "asc" },
  });
  const now = new Date();
  const season = await getSeason(now.getFullYear());
  const matches = demoMatches().filter((m) => m.game === g.id);
  const base = `/competitions?jeu=${g.id}`;

  return (
    <main className="pb-16">
      <div className="container-rx flex flex-wrap items-center gap-1.5 pt-4">
        {GAMES.map((x) => (
          <Link key={x.id} href={`/competitions?jeu=${x.id}`} aria-current={x.id === g.id ? "page" : undefined} className={`flex h-9 items-center gap-1.5 border px-2.5 text-[13px] text-ink hover:text-ink ${x.id === g.id ? "border-orange bg-surface-2" : "border-line hover:border-[#5a5a5a]"}`}>
            <Image src={x.logo} alt="" width={22} height={14} className="h-3.5 w-[22px] object-contain" />
            {x.short}
          </Link>
        ))}
        <span className="flex-1" />
        <Link href="/playoffs" className="btn btn-secondary btn-sm">Playoffs · 2 500 €</Link>
        <Link href="/reglement" className="btn btn-tertiary btn-sm">Règlement</Link>
      </div>

      <section className="relative mt-4 overflow-hidden border-y border-line bg-black">
        <Image src={d.photo} alt="" fill className="object-cover opacity-40" sizes="100vw" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,#000_10%,rgba(0,0,0,.5))]" />
        <div className="container-rx relative flex flex-wrap items-center gap-6 py-10">
          <div className="grid h-[110px] w-[150px] flex-none place-items-center border border-line bg-black/60 p-3">
            <Image src={g.logo} alt={g.name} width={130} height={80} className="max-h-[80px] w-auto object-contain" />
          </div>
          <div className="min-w-0 flex-[1_1_360px]">
            <div className="flex flex-wrap items-center gap-2 text-[13px]">
              <span className="badge text-orange">{lobby ? "Inscriptions ouvertes" : "Phase en cours · Playoffs"}</span>
              <span className="text-silver">{g.name} · {g.format} · Saison {now.getFullYear()}</span>
            </div>
            <h1 className="font-display mt-1 text-[clamp(40px,6vw,60px)] font-extrabold leading-[.95]">{d.comp}</h1>
            <p className="mt-2 max-w-[640px] text-[15px] text-silver">{d.desc}</p>
          </div>
          <Link href={lobby ? "/rdv" : `/rankings?game=${g.id}`} className="btn btn-primary">{lobby ? "Voir les RDV mensuels" : "Voir le classement"}</Link>
        </div>
      </section>

      <div className="container-rx">
        {!lobby && (
          <div className="mt-4">
            <SeasonTimeline phases={season.phases} now={now} compact />
          </div>
        )}
        <TabLinks
          active={tab}
          tabs={[
            { key: "apercu", label: "Vue d’ensemble", href: base },
            { key: "participants", label: `Participants · ${rosters.length}`, href: `${base}&tab=participants` },
            { key: "reglement", label: "Règlement", href: `${base}&tab=reglement` },
          ]}
        />

        {tab === "apercu" && (
          <div className="mt-4 grid items-start gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr))] lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="grid min-w-0 gap-4">
              {!lobby && (
                <Link href={`/playoffs?jeu=${g.id}`} className="card flex flex-wrap items-center gap-3 px-[18px] py-3.5 text-ink hover:border-orange hover:text-ink">
                  <span className="font-display text-xl font-bold">Arbre des Playoffs</span>
                  <span className="flex-1 text-sm text-grey">Top 8 de la Division 1 au seeding du 31 août · élimination directe</span>
                  <span className="text-[13px] font-semibold text-orange">Voir l’arbre →</span>
                </Link>
              )}
              <section className="card">
                <div className="card-head"><span className="card-title">Matchs</span><span className="badge text-silver">Démo</span></div>
                {matches.map((m) => (
                  <Link key={m.id} href={m.state === "Terminé" ? `/feuille-de-match?m=${m.id}` : `/match?m=${m.id}`} className="list-row grid grid-cols-[120px_minmax(0,1fr)_auto] items-center gap-3 text-ink hover:text-ink">
                    <span className="text-xs text-orange">{new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(m.when)}</span>
                    <span className="truncate font-semibold">{m.a} <span className="text-grey">vs</span> {m.b}{m.score ? ` · ${m.score}` : ""}</span>
                    <span className="text-[13px] font-semibold text-orange">{m.state === "Terminé" ? "Détails →" : "Match Center →"}</span>
                  </Link>
                ))}
                {matches.length === 0 && <Empty>Le calendrier sera publié après la clôture des inscriptions.</Empty>}
              </section>
            </div>
            <div className="grid gap-4">
              <section className="card p-[18px]">
                <div className="overline">Inscrits</div>
                <div className="font-display text-[34px] font-extrabold">{rosters.length} <span className="text-base font-semibold text-grey">{g.rosterSize > 1 ? "équipes" : "joueurs"} vérifié(es)</span></div>
                <div className="text-xs text-grey">Inscriptions ouvertes toute l’année. Entrée en placement dès que le roster est complet.</div>
              </section>
              <section className="card">
                <div className="card-head"><span className="card-title">Format</span></div>
                {[
                  ["Format", g.format],
                  ["Série", g.series ?? "6 manches"],
                  ["Effectif", g.rosterSize > 1 ? `${g.rosterSize} titulaires + 2 remplaçants` : "Solo"],
                  ["Points", lobby ? "Barème de placement (RDV mensuels)" : "Elo · K = 40 puis 32"],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3 border-b border-surface-2 px-[18px] py-2.5 text-sm"><span className="text-grey">{k}</span><span className="text-right font-semibold">{v}</span></div>
                ))}
              </section>
              <section className="card flex items-center gap-3 px-[18px] py-3">
                <span className="overline">Partenaire</span>
                <Image src="/assets/partner-orange.png" alt="Orange" width={40} height={40} className="h-8 w-auto" />
                <span className="text-xs text-silver"><b className="text-ink">Orange</b> présente les compétitions RushXP</span>
              </section>
            </div>
          </div>
        )}

        {tab === "participants" && (
          <section className="card mt-4">
            {rosters.map((r) => {
              const starters = r.members.filter((m) => m.role === "STARTER").length;
              return (
                <Link key={r.id} href={`/structure/${r.structure.tag}?tab=rosters`} className="list-row flex items-center gap-3 text-ink hover:text-ink">
                  <span className="clip-corner-sm grid h-9 w-9 place-items-center bg-surface-2 font-mono text-[10px]">{r.structure.tag}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{r.name}</span>
                    <span className="block text-xs text-grey">{r.structure.name}</span>
                  </span>
                  <span className={`badge ${starters >= g.rosterSize ? "text-orange" : "text-red"}`}>{starters >= g.rosterSize ? "✓ Complet" : `Incomplet · ${starters}/${g.rosterSize}`}</span>
                </Link>
              );
            })}
            {rosters.length === 0 && <Empty>Aucune équipe vérifiée sur {g.name} pour l’instant. <Link href="/structure/nouvelle">Engager votre structure →</Link></Empty>}
            {!lobby && topOf(g.id as ChallengeGameId).length > 0 && (
              <div className="border-t border-line px-[18px] py-3 text-xs text-grey">Le classement de démonstration reste visible dans <Link href={`/rankings?game=${g.id}`}>RushXP Rankings</Link>.</div>
            )}
          </section>
        )}

        {tab === "reglement" && (
          <section className="card mt-4 max-w-3xl">
            <div className="card-head"><span className="card-title">{RULES_GAME[g.id].title}</span><Link href={`/reglement?jeu=${g.id}`} className="text-[13px] font-semibold">Règlement complet →</Link></div>
            {RULES_GAME[g.id].items.map(([n, t]) => (
              <div key={n} className="grid grid-cols-[52px_minmax(0,1fr)] gap-3 border-b border-surface-2 px-[18px] py-3 text-sm">
                <span className="font-mono text-xs text-orange">{n}</span>
                <span className="text-silver">{t}</span>
              </div>
            ))}
          </section>
        )}
        {tab === "apercu" && <DemoNotice>Les matchs affichés sont des exemples. Les inscrits sont réels (structures vérifiées).</DemoNotice>}
      </div>
    </main>
  );
}
