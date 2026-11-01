import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getViewer } from "@/lib/auth/viewer";
import { getGame } from "@/lib/data/games";
import { calendarItems, type CalendarItem } from "@/lib/matches/queries";
import { getMatchRoom } from "@/lib/matches/room";
import { MatchRoom } from "@/components/match/MatchRoom";
import { Empty, PageHeader } from "@/components/PageHeader";

export const metadata: Metadata = { title: "Match Center" };

const fmt = (d: Date) => new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Indian/Reunion" }).format(d);

function MatchList({ title, list }: { title: string; list: CalendarItem[] }) {
  return (
    <section className="card">
      <div className="card-head"><span className="card-title">{title}</span><span className="card-meta">{list.length} match(s)</span></div>
      {list.length === 0 && <Empty>Aucun match.</Empty>}
      {list.map((m) => {
        const g = getGame(m.game);
        return (
          <Link key={m.id} href={m.href} className="list-row grid items-center gap-3 text-ink hover:text-ink [grid-template-columns:32px_minmax(0,1fr)_auto]">
            {g && <Image src={g.logo} alt={g.name} width={30} height={20} className="h-5 w-[30px] object-contain" />}
            <span className="min-w-0"><span className="block truncate font-semibold">{m.a} <span className="text-grey">vs</span> {m.b}</span><span className="block truncate text-xs text-grey first-letter:uppercase">{fmt(m.when)} · {m.comp}</span></span>
            <span className={`text-xs font-bold ${m.state === "En direct" || m.state === "Contesté" ? "text-red" : "text-orange"}`}>{m.state}</span>
          </Link>
        );
      })}
    </section>
  );
}

export default async function MatchPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const sp = await searchParams;
  const viewer = await getViewer();
  if (sp.m) {
    const room = await getMatchRoom(sp.m, viewer);
    if (!room) notFound();
    return (
      <main className="mx-auto max-w-[1440px] px-[clamp(16px,3vw,32px)] pt-4 pb-12">
        <Link href="/match" className="mb-3 inline-block text-[13px]">← Tous les matchs</Link>
        <MatchRoom m={room} />
      </main>
    );
  }
  // Sans match précisé : vos matchs, puis les matchs en cours et à venir.
  const now = new Date();
  const items = (await calendarItems({ viewer, from: new Date(now.getTime() - 3 * 36e5), to: new Date(now.getTime() + 14 * 86_400_000) })).filter((i) => i.type === "Défi" || i.type === "Playoffs");
  const mine = items.filter((i) => i.mine);
  const others = items.filter((i) => !i.mine);
  return (
    <main className="container-rx pt-7 pb-16">
      <PageHeader title="Match Center" actions={<Link href="/calendrier" className="btn btn-secondary">Calendrier</Link>}>
        Check-in, veto des cartes, diffusion, déclaration du résultat et salon du match. Un match apparaît ici dès qu’un défi est planifié.
      </PageHeader>
      <div className="mt-5 grid gap-4">
        {viewer && <MatchList title="Vos matchs" list={mine} />}
        <MatchList title="En cours et à venir" list={others} />
      </div>
    </main>
  );
}
