import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { db } from "@/lib/db";
import { getViewer } from "@/lib/auth/viewer";
import { getGame } from "@/lib/data/games";
import { demoMatches } from "@/lib/data/demo-competition";
import { Empty } from "@/components/PageHeader";
import { Poll, PostActions, type CommentView } from "@/components/feed/FeedClient";

export const metadata: Metadata = { title: "Actualités" };

const FILTERS = [
  ["tout", "Tout le fil", null],
  ["annonces", "Annonces", ["ANNONCE"]],
  ["resultats", "Résultats", ["RESULTAT"]],
  ["sondages", "Sondages", ["SONDAGE"]],
  ["medias", "Vidéos & galeries", ["VIDEO", "GALERIE"]],
  ["structures", "Structures", ["STRUCTURE"]],
] as const;
const KIND_LABEL: Record<string, string> = { ANNONCE: "Annonce", RESULTAT: "Résultat validé", VIDEO: "Vidéo", GALERIE: "Galerie", SONDAGE: "Sondage", STRUCTURE: "Actualité de structure" };
const fmt = (d: Date) => new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(d);
const ago = (d: Date) => {
  const m = Math.round((Date.now() - d.getTime()) / 60000);
  return m < 60 ? `il y a ${Math.max(1, m)} min` : m < 1440 ? `il y a ${Math.round(m / 60)} h` : new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(d);
};

export default async function ActualitesPage({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const { f } = await searchParams;
  const filter = FILTERS.find(([k]) => k === f) ?? FILTERS[0];
  const viewer = await getViewer();
  const posts = await db.post.findMany({
    where: filter[2] ? { kind: { in: [...filter[2]] } } : {},
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    take: 30,
    include: {
      comments: { orderBy: { createdAt: "asc" } },
      _count: { select: { likes: true } },
      likes: viewer ? { where: { userId: viewer.id }, select: { userId: true } } : false,
      options: { orderBy: { order: "asc" }, include: { _count: { select: { votes: true } } } },
      votes: viewer ? { where: { userId: viewer.id }, select: { optionId: true } } : false,
    },
  });
  const authorIds = [...new Set(posts.flatMap((p) => [p.authorId, ...p.comments.map((c) => c.authorId)]))];
  const structureIds = [...new Set(posts.map((p) => p.structureId).filter(Boolean) as string[])];
  const [users, structures] = await Promise.all([
    db.user.findMany({ where: { id: { in: authorIds } }, select: { id: true, pseudo: true, role: true } }),
    db.structure.findMany({ where: { id: { in: structureIds } }, select: { id: true, name: true, tag: true } }),
  ]);
  const user = (id: string) => users.find((u) => u.id === id);
  const canPublish = viewer?.role === "admin" || viewer?.structure?.status === "VERIFIED";
  const canModerate = viewer?.role === "admin" || viewer?.role === "arbitre";
  const upcoming = demoMatches().filter((m) => m.state !== "Terminé").slice(0, 4);

  const toComments = (p: (typeof posts)[number]): CommentView[] => {
    const view = (c: (typeof p.comments)[number]): CommentView => ({
      id: c.id,
      author: user(c.authorId)?.pseudo ?? "Membre",
      text: c.text,
      time: ago(c.createdAt),
      mine: c.authorId === viewer?.id,
      official: user(c.authorId)?.role === "ADMIN",
      replies: [],
    });
    const roots = p.comments.filter((c) => !c.parentId).map(view);
    for (const c of p.comments.filter((x) => x.parentId)) roots.find((r) => r.id === c.parentId)?.replies.push(view(c));
    return roots;
  };

  return (
    <main className="mx-auto grid max-w-[1240px] items-start gap-6 px-[clamp(16px,3vw,40px)] pt-7 pb-16 lg:grid-cols-[190px_minmax(0,640px)_minmax(0,1fr)]">
      <nav className="grid gap-1 lg:sticky lg:top-[88px]" aria-label="Filtrer le fil">
        <span className="overline mb-1">Filtrer le fil</span>
        <div className="flex flex-wrap gap-1 lg:grid">
          {FILTERS.map(([k, l]) => (
            <Link key={k} href={k === "tout" ? "/actualites" : `/actualites?f=${k}`} aria-current={filter[0] === k ? "page" : undefined} className={`border-l-[3px] px-3 py-2 text-sm hover:text-ink ${filter[0] === k ? "border-orange bg-surface-2 text-ink" : "border-transparent text-silver"}`}>
              {l}
            </Link>
          ))}
        </div>
      </nav>

      <div className="grid min-w-0 gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="font-display text-[clamp(40px,6vw,56px)] font-extrabold leading-none">Actualités</h1>
          {canPublish && <Link href="/actualites/nouvelle" className="btn btn-primary">+ Publier</Link>}
        </div>

        {posts.map((p, i) => {
          const author = user(p.authorId);
          const s = structures.find((x) => x.id === p.structureId);
          const total = p.options.reduce((a, o) => a + o._count.votes, 0);
          return (
            <div key={p.id} className="grid gap-4">
              <article id={p.id} className="card scroll-mt-24">
                {p.pinned && <div className="border-b border-line bg-active-tint px-[18px] py-1.5 text-[11px] font-bold tracking-[.08em] text-orange">▲ ÉPINGLÉ · {KIND_LABEL[p.kind].toUpperCase()}</div>}
                <div className="flex items-center gap-3 px-[18px] pt-3.5">
                  {p.official ? (
                    <Image src="/assets/rushxp-logo-sm.png" alt="" width={36} height={36} />
                  ) : (
                    <span className="clip-corner-sm grid h-9 w-9 place-items-center bg-surface-2 font-mono text-[10px]">{s?.tag}</span>
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      {p.official ? <span className="font-semibold">RushXP</span> : <Link href={`/structure/${s?.tag}`} className="font-semibold text-ink hover:text-orange">{s?.name ?? author?.pseudo}</Link>}
                      {p.official && <span className="badge text-orange">Officiel</span>}
                    </div>
                    <div className="text-xs text-grey">{fmt(p.createdAt)} · {KIND_LABEL[p.kind]}</div>
                  </div>
                </div>
                <div className="px-[18px] py-3">
                  <h2 className="font-display text-2xl font-bold leading-tight">{p.title}</h2>
                  {p.body && <p className="mt-1.5 whitespace-pre-line text-[15px] text-silver">{p.body}</p>}
                </div>
                {p.image && (
                  <div className="relative aspect-video border-y border-line">
                    <Image src={p.image} alt="" fill className="object-cover" sizes="640px" />
                    {p.kind === "VIDEO" && <span className="absolute inset-0 grid place-items-center"><span className="grid h-14 w-14 place-items-center bg-orange text-xl text-bg">▶</span></span>}
                  </div>
                )}
                {p.kind === "SONDAGE" && (
                  <>
                    <Poll
                      postId={p.id}
                      options={p.options.map((o) => ({ id: o.id, label: o.label, votes: o._count.votes }))}
                      myVote={p.votes?.[0]?.optionId ?? null}
                      total={total}
                      signedIn={!!viewer}
                      closed={!!p.pollEndsAt && p.pollEndsAt < new Date()}
                    />
                    <div className="px-[18px] pb-3 text-xs text-grey">
                      {total} vote(s){p.pollEndsAt ? ` · clôture le ${fmt(p.pollEndsAt)}` : ""}{!viewer ? " · connectez-vous pour voter" : ""}
                    </div>
                  </>
                )}
                <PostActions
                  postId={p.id}
                  likes={p._count.likes}
                  liked={!!p.likes?.length}
                  comments={toComments(p)}
                  signedIn={!!viewer}
                  canModerate={canModerate}
                  isAuthor={p.authorId === viewer?.id}
                  pinned={p.pinned}
                  isAdmin={viewer?.role === "admin"}
                />
              </article>
              {i === 1 && (
                <article className="card">
                  <div className="flex items-center gap-3 px-[18px] py-3">
                    <Image src="/assets/partner-mcdo.png" alt="McDonald’s" width={36} height={36} className="h-9 w-9 object-contain" />
                    <div className="flex-1"><div className="font-semibold">McDonald’s</div><div className="text-xs text-grey">Partenaire restauration</div></div>
                    <span className="badge text-silver">Sponsorisé</span>
                  </div>
                  <div className="relative aspect-[16/7] border-y border-line bg-black">
                    <Image src="/assets/campaign-mcdelivery.png" alt="Campagne McDelivery" fill className="object-contain" sizes="640px" />
                  </div>
                  <div className="flex items-center justify-between gap-3 px-[18px] py-3 text-sm">
                    <span>Soirée de match ? Commandez avec McDelivery.</span>
                    <Link href="/partenaires" className="btn btn-tertiary btn-sm">Découvrir</Link>
                  </div>
                </article>
              )}
            </div>
          );
        })}
        {posts.length === 0 && (
          <div className="card">
            <Empty>
              Aucune publication pour le moment.{canPublish ? " Publiez la première actualité." : " Les annonces officielles et les nouvelles des structures apparaîtront ici."}
            </Empty>
          </div>
        )}
      </div>

      <aside className="grid gap-4 lg:sticky lg:top-[88px]">
        <section className="card">
          <div className="card-head"><span className="card-title">À venir</span><Link href="/calendrier" className="text-xs font-semibold">Calendrier →</Link></div>
          {upcoming.map((m) => {
            const g = getGame(m.game);
            return (
              <Link key={m.id} href={`/match?m=${m.id}`} className="list-row flex items-center gap-2.5 text-ink hover:text-ink">
                {g && <Image src={g.logo} alt="" width={26} height={16} className="h-4 w-[26px] object-contain" />}
                <span className="min-w-0 text-[13px]">
                  <span className="block truncate font-semibold">{m.a} vs {m.b}</span>
                  <span className="block text-xs text-grey">{new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(m.when)}</span>
                </span>
              </Link>
            );
          })}
        </section>
        <section className="card p-[18px]">
          <div className="overline">Partenaire</div>
          <Image src="/assets/partner-ocorner.png" alt="OCorner" width={140} height={60} className="mt-2 h-14 w-auto object-contain" />
          <div className="mt-2 text-[13px] text-silver">LAN et finales en présentiel à OCorner · places limitées.</div>
        </section>
      </aside>
    </main>
  );
}
