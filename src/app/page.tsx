import Image from "next/image";
import Link from "next/link";
import { GAMES } from "@/lib/data/games";
import { getStructureStandings } from "@/lib/data/repo";
import { rankLabel } from "@/lib/rules/standings";
import { getViewer } from "@/lib/auth/viewer";
import { isStaff } from "@/lib/session-shared";
import { getSeasonContext } from "@/lib/season";
import { db } from "@/lib/db";
import { SeasonTimeline } from "@/components/SeasonTimeline";

const PARTNERS = ["partner-orange.png", "partner-mcdo.png", "partner-easygym.png", "partner-ocorner.png", "partner-saintpaul.png"];

export default async function Home() {
  const viewer = await getViewer();
  const role = viewer?.role ?? "visiteur";
  const now = new Date();
  const { season, phase, next } = await getSeasonContext(now);
  const structures = await db.structure.count({ where: { status: "VERIFIED" } }).catch(() => 0);
  const dayFmt = new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "long", year: "numeric", timeZone: "Indian/Reunion" });
  const top5 = getStructureStandings().slice(0, 5);
  const member = role !== "visiteur";

  return (
    <main>
      <section className="relative overflow-hidden border-b border-line bg-black">
        <Image src="/assets/photo-dsc07373.jpg" alt="" fill priority className="object-cover opacity-50" sizes="100vw" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,#000_0%,rgba(0,0,0,.92)_38%,rgba(0,0,0,.45)_75%,rgba(0,0,0,.7)_100%)]" />
        <div className="absolute inset-x-0 bottom-0 h-[120px] bg-[linear-gradient(0deg,#0A0A0A,transparent)]" />
        <div className="container-rx relative grid items-center gap-12 py-14 md:py-16 [grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr))]">
          <div>
            <div className="mb-5 flex items-center gap-2.5">
              <span className="h-2 w-2 animate-rxpulse bg-orange" />
              <span className="text-[13px] font-semibold uppercase tracking-[.14em] text-silver">{season.name} · {phase?.label ?? "intersaison"}</span>
            </div>
            <h1 className="font-display text-[clamp(52px,8vw,86px)] font-extrabold leading-[.9] tracking-[-.01em]">
              Chaque match
              <br />
              compte <span className="text-orange">au classement.</span>
            </h1>
            <p className="mt-5 max-w-[540px] text-lg leading-normal text-pretty text-silver">
              RushXP réunit cinq jeux compétitifs dans un classement permanent. Défiez les équipes proches de vous, montez en division et visez les Playoffs : 2 500 € pour le top de la Division 1.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              {member ? (
                <Link href="/rankings/defis" className="btn btn-primary clip-corner-sm !min-h-[52px] !px-[26px] !text-lg">Lancer un défi</Link>
              ) : (
                <Link href="/inscription" className="btn btn-primary clip-corner-sm !min-h-[52px] !px-[26px] !text-lg">Créer un compte</Link>
              )}
              <Link href="/le-circuit" className="btn !min-h-[52px] border-silver bg-black/40 !px-[26px] !text-lg text-ink hover:border-orange hover:text-orange">Comment ça marche</Link>
            </div>
          </div>
          <div className="grid justify-items-end gap-4">
            <Image src="/assets/rushxp-logo.png" alt="RushXP" width={190} height={190} className="hidden md:block" />
            <div className="w-full max-w-[380px] border border-line bg-[rgba(20,20,20,.92)] backdrop-blur-sm">
              <div className="overline border-b border-line px-[18px] py-3 !tracking-[.12em]">Saison active</div>
              <div className="grid grid-cols-3 gap-3 px-[18px] py-3.5">
                <div><div className="text-xs text-grey">Phase</div><div className="font-display text-xl font-bold text-orange">{phase?.label ?? "Intersaison"}</div></div>
                <div><div className="text-xs text-grey">Jeux</div><div className="font-display text-xl font-bold">{GAMES.length}</div></div>
                <div><div className="text-xs text-grey">Structures</div><div className="font-display text-xl font-bold">{structures}</div></div>
              </div>
              <div className="border-t border-line px-[18px] py-3">
                <div className="text-xs text-grey">Prochaine étape</div>
                <div className="mt-0.5 text-[15px] font-semibold">{next ? next.label : "Calendrier à venir"}</div>
                {next && <div className="text-[13px] text-orange first-letter:uppercase">{dayFmt.format(next.startsAt)}</div>}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="container-rx pt-8" aria-label="Pour vous">
        {isStaff(role) ? (
          <div className="card flex flex-wrap items-center gap-6 px-[22px] py-5">
            <div className="flex-1">
              <div className="overline !text-orange">Équipe RushXP</div>
              <div className="font-display text-[26px] font-extrabold">À traiter aujourd’hui</div>
              <div className="text-sm text-silver">Contestations, captures à faible confiance OCR, signalements.</div>
            </div>
            <Link href="/arbitrage" className="btn btn-primary">Ouvrir l’espace arbitre</Link>
          </div>
        ) : member ? (
          <div className="card flex flex-wrap items-center gap-6 border-t-[3px] !border-t-orange px-[22px] py-5">
            <div className="flex-1">
              <div className="overline !text-orange">Votre situation</div>
              <div className="font-display text-[26px] font-extrabold">
                {viewer!.pseudo} · {viewer!.structure?.name ?? "Sans structure"}
              </div>
              <div className="text-sm text-silver">
                {!viewer!.onboarded
                  ? "Terminez votre inscription pour choisir vos jeux et votre structure."
                  : viewer!.structure?.status === "PENDING"
                    ? "Votre structure est en cours de vérification par l’équipe RushXP (24 à 48 h)."
                    : viewer!.structure
                      ? "Complétez vos rosters pour entrer en placement dans les RushXP Rankings."
                      : "Rejoignez une structure ou créez la vôtre pour participer aux défis en équipe."}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {!viewer!.onboarded ? (
                <Link href="/inscription" className="btn btn-primary">Terminer mon inscription</Link>
              ) : viewer!.structure ? (
                <Link href="/rankings/defis" className="btn btn-primary">Centre des défis</Link>
              ) : (
                <Link href="/structure/nouvelle" className="btn btn-primary">Créer une structure</Link>
              )}
              <Link href="/recrutement" className="btn btn-tertiary">Recrutement</Link>
            </div>
          </div>
        ) : (
          <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr))]">
            {[
              ["Joueur", "Rejoignez une équipe", "Créez votre profil, liez vos comptes de jeu et répondez aux annonces de recrutement.", "Créer mon profil", "/inscription", "border-t-orange"],
              ["Structure", "Engagez vos équipes", "Inscrivez vos rosters sur un ou plusieurs jeux et grimpez au classement général.", "Créer une structure", "/structure/nouvelle", "border-t-yellow"],
              ["Spectateur", "Suivez la saison", "Classements, calendrier, résultats et diffusions des matchs officiels.", "Voir les classements", "/classement", "border-t-silver"],
            ].map(([who, title, text, cta, href, c]) => (
              <Link key={who} href={href} className={`grid gap-1.5 border border-line border-t-[3px] ${c} bg-surface px-[22px] py-5 text-ink transition-colors duration-150 hover:border-orange hover:text-ink`}>
                <span className="overline !tracking-[.12em]">{who}</span>
                <span className="font-display text-[26px] font-extrabold leading-[1.05]">{title}</span>
                <span className="text-sm leading-snug text-silver">{text}</span>
                <span className="mt-1.5 text-sm font-semibold text-orange">{cta} →</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="container-rx pt-10" aria-labelledby="saison">
        <div className="mb-3.5 flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="saison" className="font-display text-[34px] font-extrabold">{season.name} · toute l’année</h2>
          <span className="text-[13px] text-grey">Un seul calendrier pour tous les jeux · les défis restent ouverts toute l’année</span>
        </div>
        <SeasonTimeline phases={season.phases} now={now} />
      </section>

      <section className="container-rx pt-10" aria-labelledby="jeux">
        <div className="mb-3.5 flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="jeux" className="font-display flex items-center gap-2.5 text-[34px] font-extrabold"><span className="h-6 w-1.5 bg-orange" />Les jeux</h2>
          <Link href="/competitions" className="text-sm font-semibold">Toutes les compétitions →</Link>
        </div>
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(min(100%,200px),1fr))]">
          {GAMES.map((g) => (
            <Link key={g.id} href={g.kind === "challenge" ? `/rankings?game=${g.id}` : "/rdv"} className="card group grid text-ink transition-colors duration-150 hover:border-[#5a5a5a] hover:text-ink">
              <div className="relative grid h-[110px] place-items-center border-b border-line bg-black">
                <Image src={g.logo} alt={g.name} width={150} height={70} className="max-h-[70px] w-auto object-contain" />
                <span className="badge absolute top-2 right-2 bg-black text-silver !border-line">{g.format}</span>
              </div>
              <div className="px-4 py-3">
                <div className={`text-[11px] font-bold uppercase tracking-[.1em] ${g.kind === "challenge" ? "text-orange" : "text-yellow"}`}>{g.kind === "challenge" ? "RushXP Rankings" : "RDV mensuel"}</div>
                <div className="font-display text-lg font-bold">{g.name}</div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="container-rx pt-10" aria-labelledby="general">
        <div className="card">
          <div className="card-head">
            <h2 id="general" className="card-title">Classement général</h2>
            <Link href="/classement" className="text-[13px] font-semibold">Classement complet →</Link>
          </div>
          {top5.map((s) => (
            <Link key={s.structureId} href="/classement" className="list-row grid grid-cols-[48px_minmax(0,1fr)_80px_60px] items-center gap-3 text-ink hover:text-ink">
              <span className={`font-display text-xl font-extrabold ${s.rank === 1 ? "text-yellow" : ""}`}>{rankLabel(s)}</span>
              <span className="flex min-w-0 items-center gap-2.5">
                <span className="clip-corner-sm grid h-8 w-8 flex-none place-items-center bg-surface-2 font-mono text-[10px] text-silver">{s.structure.tag}</span>
                <span className="truncate font-semibold">{s.structure.name}</span>
              </span>
              <span className="text-right font-display text-lg font-bold">{s.total}</span>
              <span className="text-right text-xs text-grey">{Object.keys(s.perGame).length}/{GAMES.length} jeux</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="container-rx pt-10" aria-labelledby="partenaires">
        <div className="mb-3.5 flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="partenaires" className="font-display text-[34px] font-extrabold">Partenaires</h2>
          <Link href="/partenaires#devenir-partenaire" className="text-sm font-semibold">Devenir partenaire →</Link>
        </div>
        <div className="grid border border-line bg-surface [grid-template-columns:repeat(auto-fit,minmax(min(100%,160px),1fr))]">
          {PARTNERS.map((p) => (
            <div key={p} className="grid h-24 place-items-center border-r border-b border-line px-4">
              <Image src={`/assets/${p}`} alt={p.replace("partner-", "").replace(".png", "")} width={120} height={60} className="max-h-[56px] w-auto object-contain" />
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
