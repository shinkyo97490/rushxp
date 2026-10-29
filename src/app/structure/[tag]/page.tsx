import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getViewer } from "@/lib/auth/viewer";
import { GAMES, getGame } from "@/lib/data/games";
import { Empty, TabLinks } from "@/components/PageHeader";

type Params = { params: Promise<{ tag: string }>; searchParams: Promise<{ tab?: string }> };

async function load(tag: string) {
  return db.structure.findFirst({
    where: { tag: { equals: decodeURIComponent(tag), mode: "insensitive" } },
    include: {
      staff: { include: { user: { select: { pseudo: true } } } },
      members: { where: { leftAt: null }, select: { userId: true } },
      rosters: {
        orderBy: [{ game: "asc" }, { createdAt: "asc" }],
        include: { gameRef: { select: { rosterSize: true } }, members: { where: { leftAt: null }, include: { user: { select: { pseudo: true } } } } },
      },
      transfersTo: { where: { status: "APPROVED" }, include: { user: { select: { pseudo: true } } }, orderBy: { createdAt: "desc" }, take: 20 },
    },
  });
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const s = await load((await params).tag);
  return { title: s ? s.name : "Structure introuvable" };
}

const fmt = (d: Date) => new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" }).format(d);

export default async function StructurePage({ params, searchParams }: Params) {
  const s = await load((await params).tag);
  const { tab: t } = await searchParams;
  if (!s) notFound();
  const viewer = await getViewer();
  const isStaff = !!viewer && s.staff.some((x) => x.userId === viewer.id);
  const isMember = !!viewer && s.members.some((m) => m.userId === viewer.id);
  // Une structure n'est publique qu'après vérification RushXP.
  if (s.status !== "VERIFIED" && !isStaff && !isMember && viewer?.role !== "admin" && viewer?.role !== "arbitre") notFound();
  const tab = t === "rosters" || t === "historique" ? t : "apercu";
  const games = [...new Set(s.rosters.map((r) => r.game))].map((g) => getGame(g)!).filter(Boolean);
  const players = new Set(s.rosters.flatMap((r) => r.members.map((m) => m.userId))).size;
  const base = `/structure/${s.tag}`;

  return (
    <main className="pb-16">
      <section className="relative border-b border-line bg-black">
        <div className="relative h-[180px] overflow-hidden">
          <Image src="/assets/photo-dsc05800.jpg" alt="" fill className="object-cover opacity-40" sizes="100vw" />
          <div className="absolute inset-0 bg-[linear-gradient(0deg,#000,transparent)]" />
          <div className="hero-pattern absolute inset-0" />
        </div>
        <div className="container-rx relative -mt-16 flex flex-wrap items-end gap-5 pb-5">
          <div className="clip-corner grid h-[120px] w-[120px] flex-none place-items-center border-2 border-orange bg-bg font-display text-4xl font-extrabold">{s.tag}</div>
          <div className="min-w-0 flex-[1_1_320px]">
            <div className="flex flex-wrap items-center gap-2 text-[13px]">
              {s.status === "VERIFIED" ? <span className="badge text-orange">✓ Structure vérifiée</span> : <span className="badge text-silver">En vérification · visible par la structure uniquement</span>}
              <span className="text-silver">{games.length > 1 ? "Multigaming" : games[0]?.name ?? "—"} · {s.region} · fondée en {s.createdAt.getFullYear()}</span>
            </div>
            <h1 className="font-display mt-1 text-[clamp(44px,7vw,68px)] font-extrabold leading-[.92]">{s.name}</h1>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {games.map((g) => (
                <span key={g.id} title={g.name} className="grid h-9 w-9 place-items-center border border-line bg-bg p-1">
                  <Image src={g.logo} alt={g.name} width={28} height={28} className="max-h-full w-auto object-contain" />
                </span>
              ))}
            </div>
          </div>
          {isStaff && <Link href="/recrutement" className="btn btn-secondary">Gérer la structure</Link>}
        </div>
        <div className="container-rx grid border-t border-line [grid-template-columns:repeat(auto-fit,minmax(min(100%,160px),1fr))]">
          {[
            ["Rosters", String(s.rosters.length), games.map((g) => g.short).join(" · ") || "—"],
            ["Joueurs", String(players), `${s.members.length} sous contrat`],
            ["Points validés", "0", "classement général"],
            ["Palmarès", "—", "saison en cours"],
          ].map(([k, v, sub]) => (
            <div key={k} className="border-r border-line px-4 py-3">
              <div className="overline !font-normal">{k}</div>
              <div className="font-display text-[26px] font-extrabold">{v}</div>
              <div className="text-xs text-grey">{sub}</div>
            </div>
          ))}
        </div>
      </section>

      <div className="container-rx">
        <TabLinks
          active={tab}
          tabs={[
            { key: "apercu", label: "Aperçu", href: base },
            { key: "rosters", label: "Rosters", href: `${base}?tab=rosters` },
            { key: "historique", label: "Historique des points", href: `${base}?tab=historique` },
          ]}
        />

        {tab === "apercu" && (
          <div className="mt-4 grid items-start gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr))] lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="grid min-w-0 gap-4">
              {s.bio && <section className="card p-[18px] text-sm text-silver whitespace-pre-line">{s.bio}</section>}
              <section className="card">
                <div className="card-head"><span className="card-title">Points par jeu</span><span className="card-meta">Points validés · barème du classement général</span></div>
                {GAMES.filter((g) => games.some((x) => x.id === g.id)).map((g) => (
                  <div key={g.id} className="grid grid-cols-[36px_minmax(0,1fr)_minmax(80px,1.5fr)_60px] items-center gap-3 border-b border-surface-2 px-[18px] py-2.5 text-sm">
                    <Image src={g.logo} alt="" width={30} height={20} className="h-5 w-8 object-contain" />
                    <span>{g.name}</span>
                    <span className="h-1.5 bg-bg" />
                    <span className="text-right font-display text-lg font-bold text-grey">0</span>
                  </div>
                ))}
                <div className="px-[18px] py-2.5 text-xs text-grey">Les points s’affichent dès qu’un roster complet a joué ses matchs de placement.</div>
              </section>
              <section className="card">
                <div className="card-head"><span className="card-title">Derniers résultats</span></div>
                <Empty>Aucun match validé pour l’instant.</Empty>
              </section>
            </div>
            <div className="grid gap-4">
              <section className="card">
                <div className="card-head"><span className="card-title">Staff</span></div>
                {s.staff.map((m) => (
                  <div key={m.userId} className="flex items-center gap-3 border-b border-surface-2 px-[18px] py-2.5">
                    <span className="grid h-8 w-8 place-items-center bg-surface-2 font-display text-sm font-bold">{m.user.pseudo.slice(0, 2).toUpperCase()}</span>
                    <Link href={`/joueur/${encodeURIComponent(m.user.pseudo)}`} className="flex-1 font-semibold text-ink hover:text-orange">{m.user.pseudo}</Link>
                    <span className="text-xs text-grey">{m.role === "OWNER" ? "Fondateur" : "Gestionnaire"}</span>
                  </div>
                ))}
              </section>
              <section className="card">
                <div className="card-head"><span className="card-title">Palmarès</span></div>
                <Empty>Pas encore de titre.</Empty>
              </section>
            </div>
          </div>
        )}

        {tab === "rosters" && (
          <div className="mt-4 grid gap-4">
            {s.rosters.map((r) => {
              const g = getGame(r.game);
              const starters = r.members.filter((m) => m.role === "STARTER").length;
              return (
                <section key={r.id} className="card">
                  <div className="flex flex-wrap items-center gap-3 border-b border-line px-[18px] py-3">
                    {g && <Image src={g.logo} alt="" width={36} height={24} className="h-6 w-9 object-contain" />}
                    <span className="font-display text-xl font-bold">{r.name}</span>
                    <span className="text-xs text-grey">{g?.name} · {g?.format}</span>
                    <span className={`badge ml-auto ${starters >= r.gameRef.rosterSize ? "text-orange" : "text-red"}`}>{starters >= r.gameRef.rosterSize ? "✓ Complet" : `Incomplet · ${starters}/${r.gameRef.rosterSize}`}</span>
                  </div>
                  <div className="grid gap-2 p-[18px] [grid-template-columns:repeat(auto-fill,minmax(150px,1fr))]">
                    {r.members.map((m) => (
                      <Link key={m.userId} href={`/joueur/${encodeURIComponent(m.user.pseudo)}`} className="group border border-line bg-bg text-ink hover:border-orange hover:text-ink">
                        <div className="img-placeholder relative h-[110px]">
                          <span className="font-display text-3xl font-extrabold text-ink">{m.user.pseudo.slice(0, 2).toUpperCase()}</span>
                          {r.captainId === m.userId && <span className="badge absolute top-2 left-2 bg-bg text-yellow">Capitaine</span>}
                        </div>
                        <div className="px-3 py-2">
                          <div className="font-semibold">{m.user.pseudo}</div>
                          <div className="text-xs text-grey">{m.role === "SUB" ? "Remplaçant" : "Titulaire"}</div>
                        </div>
                      </Link>
                    ))}
                    {r.members.length === 0 && <span className="text-[13px] text-grey">Aucun joueur pour le moment.</span>}
                  </div>
                </section>
              );
            })}
            {s.rosters.length === 0 && <div className="card"><Empty>Aucun roster.</Empty></div>}
            <section className="card">
              <div className="card-head"><span className="card-title">Historique des arrivées</span></div>
              {s.transfersTo.filter((x) => x.kind !== "RELEASE").map((x) => (
                <div key={x.id} className="grid grid-cols-[100px_minmax(0,1fr)] gap-3 border-b border-surface-2 px-[18px] py-2.5 text-sm">
                  <span className="text-xs text-grey">{fmt(x.createdAt)}</span>
                  <span><strong>{x.user.pseudo}</strong> <span className="text-grey">· {x.kind === "SIGNING" ? "signature (agent libre)" : "transfert"}</span></span>
                </div>
              ))}
              {s.transfersTo.filter((x) => x.kind !== "RELEASE").length === 0 && <Empty>Aucun mouvement.</Empty>}
            </section>
          </div>
        )}

        {tab === "historique" && (
          <section className="card mt-4">
            <div className="card-head"><span className="card-title">Détail des points attribués</span><span className="card-meta">Seuls les résultats validés comptent · corrections affichées en rouge</span></div>
            <Empty>Aucun point attribué pour le moment.</Empty>
            <div className="flex justify-between border-t border-line px-[18px] py-3 font-display text-lg font-bold">
              <span>Total validé</span>
              <span>0 pt</span>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
