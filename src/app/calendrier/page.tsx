import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getGame } from "@/lib/data/games";
import { getViewer } from "@/lib/auth/viewer";
import { calendarItems } from "@/lib/matches/queries";
import { Empty, PageHeader } from "@/components/PageHeader";

export const metadata: Metadata = { title: "Calendrier" };

const FILTERS = [
  ["tout", "Tout"],
  ["mes-matchs", "Mes matchs"],
  ["defis", "Défis"],
  ["playoffs", "Playoffs"],
  ["rdv", "RDV mensuels"],
  ["lan", "LAN"],
  ["passes", "Résultats récents"],
] as const;

export default async function CalendrierPage({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const { f } = await searchParams;
  const filter = FILTERS.some(([k]) => k === f) ? f! : "tout";
  const viewer = await getViewer();
  const now = new Date();
  const past = filter === "passes";
  const DAY = 86_400_000;
  const all = await calendarItems({ viewer, from: new Date(now.getTime() - (past ? 30 : 1) * DAY), to: past ? now : new Date(now.getTime() + 120 * DAY) });
  const list = all
    .filter((m) =>
      filter === "mes-matchs" ? m.mine : filter === "defis" ? m.type === "Défi" : filter === "playoffs" ? m.type === "Playoffs" : filter === "rdv" ? m.type === "RDV mensuel" : filter === "lan" ? m.type === "LAN" : past ? m.state === "Terminé" : m.state !== "Terminé" || m.when.getTime() > now.getTime() - DAY,
    )
    .sort((a, b) => (past ? +b.when - +a.when : +a.when - +b.when));
  const dayKey = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Indian/Reunion" }).format(d);
  const today = dayKey(now);
  const tomorrow = dayKey(new Date(now.getTime() + DAY));
  const days = [...new Set(list.map((m) => dayKey(m.when)))];
  const dayLabel = (k: string) => {
    const base = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "Indian/Reunion" }).format(new Date(`${k}T12:00:00+04:00`));
    return k === today ? `Aujourd’hui · ${base}` : k === tomorrow ? `Demain · ${base}` : base;
  };
  const time = (d: Date) => new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Indian/Reunion" }).format(d);

  return (
    <main className="container-rx pt-7 pb-16">
      <PageHeader title="Calendrier" actions={<Link href="/rankings/defis" className="btn btn-secondary">Centre des défis</Link>}>
        Défis confirmés dans RushXP Rankings, rendez-vous mensuels, matchs de Playoffs et LAN, au même endroit (heure de La Réunion). Un défi apparaît ici dès qu’un créneau est choisi.
      </PageHeader>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {FILTERS.filter(([k]) => k !== "mes-matchs" || viewer).map(([k, l]) => (
          <Link key={k} href={k === "tout" ? "/calendrier" : `/calendrier?f=${k}`} className={`btn btn-sm ${filter === k ? "btn-secondary" : "btn-tertiary"}`}>{l}</Link>
        ))}
      </div>
      <div className="mt-4 grid gap-4">
        {days.map((k) => {
          const items = list.filter((m) => dayKey(m.when) === k);
          return (
            <section key={k} className="card">
              <div className="card-head">
                <span className={`card-title first-letter:uppercase ${k === today ? "text-orange" : ""}`}>{dayLabel(k)}</span>
                <span className="card-meta">{items.length} match(s)</span>
              </div>
              {items.map((m) => {
                const g = getGame(m.game);
                const done = m.state === "Terminé";
                const live = m.state === "Check-in" || m.state === "En direct";
                return (
                  <Link
                    key={m.id}
                    href={m.href}
                    className={`list-row grid items-center gap-3 text-ink hover:text-ink [grid-template-columns:56px_32px_minmax(0,1fr)_auto] sm:[grid-template-columns:56px_32px_minmax(0,1fr)_110px_130px_110px] ${m.mine ? "bg-active-tint" : ""}`}
                  >
                    <span className="font-display text-lg font-bold">{time(m.when)}</span>
                    {g ? <Image src={g.logo} alt={g.name} width={30} height={20} className="h-5 w-[30px] object-contain" /> : <span className="text-center text-[10px] font-bold text-yellow">LAN</span>}
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{m.a} <span className="text-grey">vs</span> {m.b}</span>
                      <span className="block truncate text-xs text-grey">{m.comp}</span>
                    </span>
                    <span className="hidden text-xs font-bold uppercase tracking-[.06em] text-silver sm:block">{m.type}</span>
                    <span className={`hidden text-xs font-bold sm:block ${live ? "text-red" : done ? "text-grey" : "text-silver"}`}>{live ? "● " : ""}{m.state}{m.score ? ` · ${m.score}` : ""}</span>
                    <span className="text-right text-[13px] font-semibold text-orange">{m.type === "LAN" ? "LAN →" : done ? "Feuille →" : m.type === "RDV mensuel" ? "RDV →" : "Match Center →"}</span>
                  </Link>
                );
              })}
            </section>
          );
        })}
        {days.length === 0 && <div className="card"><Empty>Aucun match pour ce filtre. Lancez un défi depuis le Centre des défis.</Empty></div>}
      </div>
    </main>
  );
}
