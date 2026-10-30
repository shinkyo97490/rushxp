import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { db } from "@/lib/db";
import { getViewer } from "@/lib/auth/viewer";
import { getGame } from "@/lib/data/games";
import { EVENT_FORMATS } from "@/lib/data/content";
import { EVENT_DONE, EVENT_MONTHS, PRESEASON_MONTHS, eventStandings } from "@/lib/data/demo-competition";
import { LOBBY_SCALES } from "@/lib/rules/scales";
import { ensureNextEvent } from "@/lib/events/queries";
import { DemoNotice, PageHeader } from "@/components/PageHeader";
import { EventRegistration } from "@/components/EventRegistration";

export const metadata: Metadata = { title: "RDV mensuels" };

type LobbyGame = "tft" | "wz" | "apex";
const ordinal = (n: number) => (n === 1 ? "1er" : `${n}e`);
const LOBBY: LobbyGame[] = ["tft", "wz", "apex"];

export default async function RdvPage({ searchParams }: { searchParams: Promise<{ jeu?: string; mois?: string; vue?: string }> }) {
  const sp = await searchParams;
  const game = LOBBY.find((g) => g === sp.jeu) ?? "tft";
  const g = getGame(game)!;
  const f = EVENT_FORMATS[game];
  const solo = f.size === 1;
  const scale = LOBBY_SCALES[game];
  const viewer = await getViewer();
  const ev = await ensureNextEvent(game);
  const entries = await db.eventEntry.findMany({ where: { eventId: ev.id }, select: { entityId: true, members: true } });

  // Équipes que l'utilisateur peut inscrire (capitaine ou gestionnaire), et inscription existante.
  const rosters = viewer && !solo
    ? await db.roster.findMany({
        where: { game, OR: [{ captainId: viewer.id }, { structure: { staff: { some: { userId: viewer.id } } } }] },
        include: { structure: { select: { name: true } } },
      })
    : [];
  const mine = viewer ? entries.find((e) => e.entityId === viewer.id || rosters.some((r) => r.id === e.entityId) || e.members.includes(viewer.id)) : null;
  const deadline = new Date(ev.date.getTime() - 2 * 86_400_000);
  deadline.setHours(23, 59, 59, 0);
  const closed = entries.length >= ev.capacity ? "Complet : plus aucune place disponible." : new Date() > deadline ? "Inscriptions closes (jeudi précédent, 23:59)." : null;
  const dateFmt = new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "long" });
  const monthName = new Intl.DateTimeFormat("fr-FR", { month: "long" }).format(ev.date);

  const month = Math.min(EVENT_MONTHS.length - 1, Math.max(0, Number(sp.mois ?? EVENT_MONTHS.length - 1)));
  const shownMonth = EVENT_DONE.has(month) ? month : EVENT_MONTHS.length - 1;
  const view = sp.vue && /^[0-5]$/.test(sp.vue) ? Number(sp.vue) : -1;
  const standing = eventStandings(game, shownMonth);
  const q = (o: Record<string, string | number | undefined>) => {
    const p = new URLSearchParams({ jeu: game, mois: String(shownMonth) });
    for (const [k, v] of Object.entries(o)) if (v === undefined) p.delete(k); else p.set(k, String(v));
    return `/rdv?${p}`;
  };

  return (
    <main className="container-rx pt-7 pb-16">
      <PageHeader overline={`Formats en lobby · saison ${new Date().getFullYear()}`} title="Rendez-vous mensuels">
        Les jeux qui se jouent en lobby n’utilisent pas les défis. Un rendez-vous par mois et par jeu, en 6 manches. Les points de chaque manche s’additionnent, et le total décide du classement du mois.
      </PageHeader>
      <div className="mt-4 grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr))]">
        {LOBBY.map((id) => {
          const x = getGame(id)!;
          return (
            <Link key={id} href={`/rdv?jeu=${id}`} aria-current={id === game ? "page" : undefined} className={`flex items-center gap-3 border px-3 py-2.5 text-ink hover:text-ink ${id === game ? "border-orange bg-surface-2" : "border-line bg-surface hover:border-[#5a5a5a]"}`}>
              <Image src={x.logo} alt="" width={44} height={28} className="h-7 w-11 object-contain" />
              <span><span className="block font-display text-lg font-bold">{x.name}</span><span className="block text-xs text-grey">{EVENT_FORMATS[id].fmt}</span></span>
            </Link>
          );
        })}
      </div>

      <div className="mt-4 grid items-start gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,360px),1fr))]">
        <section className="relative overflow-hidden border border-line bg-black">
          <Image src="/assets/photo-dsc05753.jpg" alt="" fill className="object-cover opacity-30" sizes="600px" />
          <div className="relative grid gap-3 p-[18px]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="overline !text-orange">Prochain rendez-vous</span>
              <span className={`badge ${closed ? "text-grey" : "text-orange"}`}>{closed ? "Inscriptions fermées" : "Inscriptions ouvertes"}</span>
            </div>
            <div className="font-display text-[32px] font-extrabold leading-none first-letter:uppercase">{g.name} · {monthName}</div>
            <div className="grid grid-cols-3 border border-line bg-black/60">
              {[["Date", dateFmt.format(ev.date)], ["Check-in", f.checkIn], ["Format", `${f.fmt.split(" · ")[0]} · 6 manches`]].map(([k, v]) => (
                <div key={k} className="border-r border-line px-3 py-2 last:border-r-0"><div className="text-[11px] text-grey">{k}</div><div className="text-sm font-semibold first-letter:uppercase">{v}</div></div>
              ))}
            </div>
            <div>
              <div className="flex justify-between text-xs"><span>{entries.length} / {ev.capacity} {f.unit} inscrits</span><span className="text-grey">{ev.capacity - entries.length} places restantes</span></div>
              <div className="mt-1 h-1.5 bg-surface-2"><div className="h-full bg-orange" style={{ width: `${Math.round((entries.length / ev.capacity) * 100)}%` }} /></div>
            </div>
            <EventRegistration
              game={game}
              solo={solo}
              signedIn={!!viewer}
              registeredEntityId={mine?.entityId ?? null}
              closed={closed}
              rosters={rosters.map((r) => ({ id: r.id, label: `${r.structure.name} · ${r.name}` }))}
            />
          </div>
        </section>
        <section className="card">
          <div className="card-head"><span className="card-title">Format · {g.name}</span></div>
          {f.rules.map(([t, d], i) => (
            <div key={t} className="flex gap-3 border-b border-surface-2 px-[18px] py-2.5 text-sm">
              <span className="font-display font-bold text-orange">{i + 1}</span>
              <span><strong>{t}</strong> · <span className="text-silver">{d}</span></span>
            </div>
          ))}
          <div className="px-[18px] pt-3"><span className="overline">Points par manche</span></div>
          <div className="flex flex-wrap gap-1.5 px-[18px] py-2.5">
            {scale.placement.map((v, i) => (
              <div key={i} className={`min-w-[44px] border px-2 py-1 text-center ${i === 0 ? "border-yellow" : "border-line"}`}>
                <div className="text-[10px] text-grey">{ordinal(i + 1)}</div>
                <div className={`font-display font-bold ${i === 0 ? "text-yellow" : ""}`}>{v}</div>
              </div>
            ))}
          </div>
          <div className="px-[18px] pb-3 text-xs text-grey">
            {scale.pointPerKill ? `Au-delà de la ${scale.placement.length}e place : 0 point de placement. Chaque élimination ajoute ${scale.pointPerKill} point.` : "Points selon la place dans le lobby, de 8 points pour le 1er à 1 point pour le 8e."}{" "}
            Compte pour le <strong className="text-silver">classement général des structures</strong> : les points s’additionnent sur la saison, puis le rang de la structure rapporte des points selon le même barème que les autres jeux.
          </div>
        </section>
      </div>

      <nav className="mt-5 flex overflow-x-auto border border-line bg-surface" aria-label="Mois">
        {EVENT_MONTHS.map((m, i) => {
          const done = EVENT_DONE.has(i);
          const pre = i < PRESEASON_MONTHS;
          const cls = `min-w-[96px] flex-1 border-r border-b-2 border-r-line px-3 py-2 text-center ${i === shownMonth ? "border-b-orange bg-surface-2" : "border-b-transparent"}`;
          const inner = (
            <>
              <div className="font-display text-base font-bold">{m}</div>
              <div className="text-[11px] text-silver">{done ? "✓ Terminé" : ""}</div>
              <div className={`text-[10px] font-bold uppercase tracking-[.06em] ${pre ? "text-grey" : "text-orange"}`}>{pre ? "Pré-saison" : "Saison"}</div>
            </>
          );
          return done ? <Link key={m} href={`/rdv?jeu=${game}&mois=${i}`} className={`${cls} text-ink hover:text-ink`}>{inner}</Link> : <div key={m} className={cls}>{inner}</div>;
        })}
      </nav>

      <section className="card mt-4">
        <div className="card-head">
          <span className="card-title">Résultats · {EVENT_MONTHS[shownMonth]}{shownMonth < PRESEASON_MONTHS ? " · pré-saison, hors classement général" : ""}</span>
          <span className="flex flex-wrap gap-1">
            <Link href={q({ vue: undefined })} className={`btn btn-sm !min-h-8 !px-2.5 ${view < 0 ? "btn-secondary" : "btn-tertiary"}`}>Classement</Link>
            {[0, 1, 2, 3, 4, 5].map((r) => <Link key={r} href={q({ vue: r })} className={`btn btn-sm !min-h-8 !px-2.5 ${view === r ? "btn-secondary" : "btn-tertiary"}`}>M{r + 1}</Link>)}
          </span>
        </div>
        <div className="overflow-x-auto">
          {view < 0 ? (
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="overline !font-normal">
                  <th className="px-3 py-2 text-left font-normal">#</th>
                  <th className="px-3 py-2 text-left font-normal">{solo ? "Joueur" : game === "wz" ? "Duo" : "Trio"}</th>
                  {["M1", "M2", "M3", "M4", "M5", "M6"].map((c) => <th key={c} className="px-2 py-2 text-center font-normal">{c}</th>)}
                  <th className="px-2 py-2 text-center font-normal">{solo ? "Top 4" : "Kills"}</th>
                  <th className="px-3 py-2 text-right font-normal">Total</th>
                </tr>
              </thead>
              <tbody>
                {standing.slice(0, 16).map((e, i) => (
                  <tr key={e.name} className="border-t border-surface-2">
                    <td className={`px-3 py-2 font-display font-bold ${i === 0 ? "text-yellow" : ""}`}>{i + 1}</td>
                    <td className="px-3 py-2"><span className="font-semibold">{e.name}</span> <span className="text-xs text-grey">· {e.sub}</span></td>
                    {e.rounds.map((r, k) => (
                      <td key={k} className={`px-2 py-2 text-center ${r.placement === 1 ? "font-bold text-yellow" : solo && r.placement <= 4 ? "" : "text-grey"}`}>{solo ? ordinal(r.placement) : r.points}</td>
                    ))}
                    <td className="px-2 py-2 text-center text-silver">{solo ? e.top4 : e.kills}</td>
                    <td className="px-3 py-2 text-right font-display text-lg font-bold">{e.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="overline !font-normal">
                  <th className="px-3 py-2 text-left font-normal">Place</th>
                  <th className="px-3 py-2 text-left font-normal">{solo ? "Joueur" : game === "wz" ? "Duo" : "Trio"}</th>
                  <th className="px-3 py-2 text-center font-normal">Placement</th>
                  <th className="px-3 py-2 text-center font-normal">Kills</th>
                  <th className="px-3 py-2 text-right font-normal">Points</th>
                </tr>
              </thead>
              <tbody>
                {[...standing].sort((a, b) => a.rounds[view].placement - b.rounds[view].placement || b.rounds[view].points - a.rounds[view].points).slice(0, solo ? 8 : 10).map((e) => {
                  const r = e.rounds[view];
                  return (
                    <tr key={e.name} className="border-t border-surface-2">
                      <td className={`px-3 py-2 font-display font-bold ${r.placement === 1 ? "text-yellow" : ""}`}>{ordinal(r.placement)}</td>
                      <td className="px-3 py-2"><span className="font-semibold">{e.name}</span> <span className="text-xs text-grey">· {e.sub}</span></td>
                      <td className="px-3 py-2 text-center text-silver">+{scale.placement[r.placement - 1] ?? 0}</td>
                      <td className="px-3 py-2 text-center text-silver">{r.kills}</td>
                      <td className="px-3 py-2 text-right font-display text-lg font-bold">{r.points}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        <div className="border-t border-line px-[18px] py-2.5 text-xs text-grey">
          {view < 0
            ? `${solo ? "Place obtenue à chaque manche" : "Points obtenus à chaque manche"}, 16 premiers. Résultats lus automatiquement sur l’écran de fin de partie, puis validés par un arbitre.`
            : solo ? "Manche jouée en lobbys de 8 : chaque lobby attribue les places 1 à 8. Lobbys recomposés selon le classement cumulé." : "Les 10 premières places de la manche. Placement et kills lus sur l’écran de fin de partie, puis vérifiés par un arbitre."}
        </div>
      </section>
      <DemoNotice>Les résultats des mois passés sont des exemples. Le prochain rendez-vous et les inscriptions sont réels.</DemoNotice>
    </main>
  );
}
