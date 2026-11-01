import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getViewer } from "@/lib/auth/viewer";
import { getGame } from "@/lib/data/games";
import { calendarItems } from "@/lib/matches/queries";
import { getMatchRoom } from "@/lib/matches/room";
import { playedMaps } from "@/lib/rules/veto";
import { Empty, PageHeader } from "@/components/PageHeader";

export const metadata: Metadata = { title: "Feuille de match" };

const fmt = (iso: string) => new Intl.DateTimeFormat("fr-FR", { dateStyle: "full", timeStyle: "short", timeZone: "Indian/Reunion" }).format(new Date(iso));
const hm = (iso: string) => new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Indian/Reunion" }).format(new Date(iso));

export default async function FeuillePage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const sp = await searchParams;
  const viewer = await getViewer();
  if (!sp.m) {
    const now = new Date();
    const done = (await calendarItems({ viewer, from: new Date(now.getTime() - 60 * 86_400_000), to: now })).filter((i) => i.state === "Terminé" && (i.type === "Défi" || i.type === "Playoffs")).reverse();
    return (
      <main className="container-rx pt-7 pb-16">
        <PageHeader title="Feuilles de match">Résultats officiels des 60 derniers jours : score, cartes jouées, compositions et journal du match.</PageHeader>
        <section className="card mt-5">
          {done.length === 0 && <Empty>Aucun match terminé pour le moment.</Empty>}
          {done.map((m) => {
            const g = getGame(m.game);
            return (
              <Link key={m.id} href={m.href} className="list-row grid items-center gap-3 text-ink hover:text-ink [grid-template-columns:32px_minmax(0,1fr)_auto]">
                {g && <Image src={g.logo} alt={g.name} width={30} height={20} className="h-5 w-[30px] object-contain" />}
                <span className="min-w-0"><span className="block truncate font-semibold">{m.a} <span className="text-grey">vs</span> {m.b}</span><span className="block truncate text-xs text-grey">{m.comp}</span></span>
                <span className="font-display text-lg font-bold">{m.score}</span>
              </Link>
            );
          })}
        </section>
      </main>
    );
  }
  const m = await getMatchRoom(sp.m, viewer);
  if (!m) notFound();
  const official = m.status === "DONE" && m.score;
  const maps = m.veto ? playedMaps(m.veto.steps) : [];
  const journal = m.events.filter((e) => e.kind !== "CHAT");

  return (
    <main className="mx-auto max-w-[1100px] px-[clamp(16px,3vw,40px)] pt-7 pb-16">
      <PageHeader overline={m.comp} title="Feuille de match" actions={<Link href={`/match?m=${m.id}`} className="btn btn-secondary">Match Center</Link>}>
        <span className="first-letter:uppercase">{fmt(m.scheduledAt)}</span> · {m.series}
      </PageHeader>

      <section className="card mt-5">
        <div className="grid items-center gap-4 px-[18px] py-6 [grid-template-columns:minmax(0,1fr)_auto_minmax(0,1fr)]">
          {(["a", "b"] as const).map((k, i) => {
            const win = m.winner === k;
            const el = (
              <div key={k} className={i === 0 ? "text-right" : ""}>
                <div className={`font-display text-[clamp(22px,3.5vw,36px)] font-extrabold leading-tight ${win ? "text-orange" : ""}`}>{m[k].name}</div>
                <div className={`text-[11px] font-bold tracking-[.08em] ${win ? "text-orange" : "text-grey"}`}>{official ? (win ? "VICTOIRE" : "DÉFAITE") : ""}</div>
                {m.deltas && m.counted && <div className="text-sm text-silver">{m.deltas[i] >= 0 ? "+" : "−"}{Math.abs(m.deltas[i])} pts</div>}
              </div>
            );
            return i === 0 ? [el, <div key="s" className="text-center"><div className="font-display text-[clamp(40px,6vw,64px)] font-extrabold leading-none">{m.score ? `${m.score[0]} – ${m.score[1]}` : "–"}</div><div className="mt-1 text-[11px] font-bold tracking-[.08em] text-silver">{official ? "OFFICIEL" : m.state.toUpperCase()}</div></div>] : [el];
          }).flat()}
        </div>
        {official && !m.counted && <div className="border-t border-line px-[18px] py-2.5 text-xs text-grey">Non compté au classement : 3e match de la paire en 30 jours glissants.</div>}
        {m.submission?.decision && <div className="border-t border-line px-[18px] py-2.5 text-sm"><span className="font-bold text-yellow">Décision d’arbitre :</span> {m.submission.decision}</div>}
      </section>

      <div className="mt-4 grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr))]">
        {maps.length > 0 && (
          <section className="card">
            <div className="card-head"><span className="card-title">Cartes</span><span className="card-meta">Veto</span></div>
            {maps.map((s, i) => (
              <div key={i} className="flex justify-between border-b border-surface-2 px-[18px] py-2 text-sm">
                <span>Carte {i + 1} · <strong>{s.map}</strong>{s.mode ? <span className="text-grey"> · {s.mode}</span> : null}</span>
                <span className="text-xs text-grey">{s.action === "decider" ? "décisive" : `choix ${s.actor === "A" ? m.a.tag : m.b.tag}`}</span>
              </div>
            ))}
          </section>
        )}
        {(m.a.lineup.length > 0 || m.b.lineup.length > 0) && (
          <section className="card">
            <div className="card-head"><span className="card-title">Compositions</span></div>
            <div className="grid grid-cols-2">
              {(["a", "b"] as const).map((k) => (
                <div key={k} className="border-r border-surface-2 px-[18px] py-3 last:border-r-0">
                  <div className="overline mb-1">{m[k].tag}</div>
                  {m[k].lineup.map((p) => <div key={p.pseudo} className="py-0.5 text-sm"><Link href={`/joueur/${encodeURIComponent(p.pseudo)}`} className="text-ink">{p.pseudo}</Link>{p.sub && <span className="text-xs text-grey"> · rempl.</span>}</div>)}
                </div>
              ))}
            </div>
          </section>
        )}
        <section className="card">
          <div className="card-head"><span className="card-title">Journal officiel</span><span className="card-meta">{journal.length} entrée(s)</span></div>
          {journal.length === 0 && <Empty>Aucune entrée.</Empty>}
          {journal.map((e) => (
            <div key={e.id} className="grid grid-cols-[52px_minmax(0,1fr)] gap-3 border-b border-surface-2 px-[18px] py-2 text-[13px]">
              <span className="font-mono text-xs text-grey">{hm(e.at)}</span>
              <span className={e.kind === "REFEREE" ? "text-yellow" : ""}>{e.text}</span>
            </div>
          ))}
        </section>
      </div>
      <p className="mt-4 text-xs text-grey">Les statistiques individuelles (éliminations, notes, compositions TFT) s’ajouteront ici dès que la lecture des captures ou l’API de l’éditeur du jeu sera branchée.</p>
    </main>
  );
}
