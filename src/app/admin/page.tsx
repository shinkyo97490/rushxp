import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getViewer } from "@/lib/auth/viewer";
import { getGame } from "@/lib/data/games";
import { DEMO_CAMPAIGNS, DEMO_RESULTS, RESULT_STATUS } from "@/lib/data/demo-competition";
import { K_DEFAULT, K_PLACEMENT, PLACEMENT_MATCHES, START_SCORE } from "@/lib/rules/elo";
import { MAX_PENDING_OUT, PAIR_MAX_COUNTED, PAIR_WINDOW_DAYS, REMATCH_DAYS, RESPONSE_HOURS, UNJUSTIFIED_REFUSAL_PENALTY } from "@/lib/rules/challenge";
import { MAX_SUBS } from "@/lib/rules/roster";
import { LAN_BONUS, structurePoints } from "@/lib/rules/scales";
import { DIVISION_SIZE } from "@/lib/data/repo";
import { Empty } from "@/components/PageHeader";
import { integrationStatus } from "@/lib/integrations";
import { AdModeration, BroadcastForm, GameFormatForm, LiftSanction, SanctionForm, StructureReview, UserControls } from "@/components/admin/AdminClient";

export const metadata: Metadata = { title: "Administration" };

const NAV: { group: string; items: [string, string][] }[] = [
  { group: "Pilotage", items: [["dashboard", "Tableau de bord"]] },
  { group: "Compétition", items: [["results", "Résultats"], ["sanctions", "Sanctions"], ["formats", "Formats & barèmes"], ["rankcfg", "Paramètres Rankings"]] },
  { group: "Communauté", items: [["structs", "Structures"], ["users", "Utilisateurs"], ["ads", "Annonces"], ["posts", "Publications"], ["notifs", "Notifications"]] },
  { group: "Commercial", items: [["leads", "Demandes partenaires"], ["campaigns", "Publicités"]] },
  { group: "Système", items: [["audit", "Journal d’audit"]] },
];
const REFEREE_OK = ["dashboard", "results", "sanctions"];

const fmt = (d: Date) => new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(d);

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ s?: string; q?: string; f?: string; msg?: string }> }) {
  const viewer = await getViewer();
  // Contrôle serveur : la console n'existe pas pour les autres rôles.
  if (!viewer || (viewer.role !== "admin" && viewer.role !== "arbitre")) notFound();
  const isAdmin = viewer.role === "admin";
  const sp = await searchParams;
  const allowed = (k: string) => isAdmin || REFEREE_OK.includes(k);
  const sec = sp.s && allowed(sp.s) && NAV.some((g) => g.items.some(([k]) => k === sp.s)) ? sp.s : "dashboard";
  const label = NAV.flatMap((g) => g.items).find(([k]) => k === sec)![1];

  return (
    <main className="grid min-h-[calc(100vh-100px)] [grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr))] lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="border-r border-line bg-black">
        <div className="flex items-center gap-2.5 border-b border-line px-4 py-4">
          <Image src="/assets/rushxp-logo-sm.png" alt="RushXP" width={36} height={36} />
          <div>
            <div className="font-display text-lg font-bold leading-none">RushXP</div>
            <div className="text-[11px] uppercase tracking-[.08em] text-grey">Console · {isAdmin ? "Administrateur" : "Arbitre"}</div>
          </div>
        </div>
        <nav className="grid gap-3 py-3" aria-label="Administration">
          {NAV.map((g) => {
            const items = g.items.filter(([k]) => allowed(k));
            if (!items.length) return null;
            return (
              <div key={g.group}>
                <div className="overline px-4 pb-1">{g.group}</div>
                {items.map(([k, l]) => (
                  <Link
                    key={k}
                    href={`/admin?s=${k}`}
                    aria-current={k === sec ? "page" : undefined}
                    className={`block border-l-[3px] px-4 py-2 text-sm hover:text-ink ${k === sec ? "border-orange bg-surface-2 text-ink" : "border-transparent text-silver"}`}
                  >
                    {l}
                  </Link>
                ))}
              </div>
            );
          })}
        </nav>
        <Link href="/arbitrage" className="block border-t border-line px-4 py-3 text-[13px]">Espace arbitre →</Link>
      </aside>
      <div className="min-w-0 px-[clamp(16px,3vw,32px)] pt-6 pb-16">
        <h1 className="font-display text-[clamp(32px,5vw,44px)] font-extrabold leading-none">{label}</h1>
        {sp.msg && (
          <div role="status" className="mt-4 border border-orange bg-active-tint px-4 py-2.5 text-sm">✓ {sp.msg.slice(0, 200)}</div>
        )}
        <div className="mt-5">
          {sec === "dashboard" && <Dashboard isAdmin={isAdmin} />}
          {sec === "structs" && <Structures filter={sp.f} />}
          {sec === "users" && <Users q={sp.q} selfId={viewer.id} />}
          {sec === "ads" && <Ads />}
          {sec === "posts" && <Posts />}
          {sec === "notifs" && (
            <section className="card max-w-2xl">
              <div className="card-head"><span className="card-title">Annonce à tous les membres</span><span className="card-meta">Catégorie « Communauté »</span></div>
              <BroadcastForm />
            </section>
          )}
          {sec === "sanctions" && <Sanctions />}
          {sec === "formats" && <Formats />}
          {sec === "rankcfg" && <RankConfig />}
          {sec === "results" && <Results />}
          {sec === "leads" && <Leads />}
          {sec === "campaigns" && <Campaigns />}
          {sec === "audit" && <Audit />}
        </div>
      </div>
    </main>
  );
}

function DemoTag() {
  return <span className="badge text-silver">Données de démonstration</span>;
}

async function Dashboard({ isAdmin }: { isAdmin: boolean }) {
  const [users, structures, pendingStructs, pendingAds, reported, sanctions, audit] = await Promise.all([
    db.user.count(),
    db.structure.count(),
    db.structure.findMany({ where: { status: "PENDING" }, orderBy: { createdAt: "asc" }, take: 5 }),
    db.recruitAd.count({ where: { moderation: "PENDING" } }),
    db.message.count({ where: { reported: true } }),
    db.sanction.count({ where: { liftedAt: null } }),
    db.auditLog.findMany({ orderBy: { at: "desc" }, take: 8, include: { actor: { select: { pseudo: true } } } }),
  ]);
  const kpis: [string, string, string?][] = [
    ["Membres", String(users)],
    ["Structures", String(structures)],
    ["Structures à vérifier", String(pendingStructs.length), "/admin?s=structs&f=PENDING"],
    ["Annonces à modérer", String(pendingAds), "/admin?s=ads"],
    ["Signalements", String(reported), "/arbitrage"],
    ["Sanctions actives", String(sanctions), "/admin?s=sanctions"],
  ];
  return (
    <div className="grid gap-4">
      <div className="grid border border-line bg-surface [grid-template-columns:repeat(auto-fit,minmax(min(100%,150px),1fr))]">
        {kpis.map(([k, v, href]) => {
          const body = (
            <>
              <div className="overline !font-normal">{k}</div>
              <div className={`font-display text-[30px] font-extrabold ${href && v !== "0" ? "text-orange" : ""}`}>{v}</div>
            </>
          );
          return href && (isAdmin || href === "/arbitrage" || href.includes("sanctions")) ? (
            <Link key={k} href={href} className="border-r border-b border-line px-4 py-3 text-ink hover:bg-surface-2 hover:text-ink">{body}</Link>
          ) : (
            <div key={k} className="border-r border-b border-line px-4 py-3">{body}</div>
          );
        })}
      </div>
      <div className="grid items-start gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,360px),1fr))]">
        <section className="card">
          <div className="card-head"><span className="card-title">File de traitement</span></div>
          {pendingStructs.map((s) => (
            <div key={s.id} className="flex flex-wrap items-center gap-3 border-b border-surface-2 px-[18px] py-2.5 text-sm">
              <span className="font-mono text-xs text-grey">{s.tag}</span>
              <span className="flex-1 font-semibold">{s.name}</span>
              <span className="badge text-orange">À vérifier</span>
              {isAdmin && <Link href="/admin?s=structs&f=PENDING" className="text-[13px] font-semibold">Ouvrir →</Link>}
            </div>
          ))}
          {pendingStructs.length === 0 && <Empty>Aucune structure en attente.</Empty>}
        </section>
        <section className="card">
          <div className="card-head"><span className="card-title">Intégrations</span><span className="card-meta">Simulées tant qu’elles ne sont pas configurées</span></div>
          {integrationStatus().map((i) => (
            <div key={i.key} className="flex items-center justify-between gap-3 border-b border-surface-2 px-[18px] py-2.5 text-sm">
              <span>{i.label}</span>
              <span className={`badge ${i.configured ? "text-orange" : "text-silver"}`}>{i.configured ? "✓ Configurée" : "Simulée"}</span>
            </div>
          ))}
        </section>
        <section className="card">
          <div className="card-head"><span className="card-title">Journal d’audit récent</span></div>
          {audit.map((a) => (
            <div key={a.id} className="flex gap-3 border-b border-surface-2 px-[18px] py-2.5 text-sm">
              <span className="mt-1.5 h-1.5 w-1.5 flex-none bg-orange" />
              <div>
                <div className="font-mono text-[13px]">{a.action} · {a.target}</div>
                <div className="text-xs text-grey">{fmt(a.at)} · {a.actor?.pseudo ?? "Système"}</div>
              </div>
            </div>
          ))}
          {audit.length === 0 && <Empty>Aucune action enregistrée.</Empty>}
        </section>
      </div>
    </div>
  );
}

async function Structures({ filter }: { filter?: string }) {
  const status = filter === "PENDING" || filter === "VERIFIED" || filter === "DRAFT" ? filter : undefined;
  const list = await db.structure.findMany({
    where: status ? { status } : {},
    include: { staff: { include: { user: { select: { pseudo: true } } } }, rosters: { select: { game: true } }, _count: { select: { members: { where: { leftAt: null } } } } },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 100,
  });
  const ST: Record<string, [string, string]> = { PENDING: ["À vérifier", "text-orange"], VERIFIED: ["✓ Vérifiée", "text-ink"], DRAFT: ["Brouillon / refusée", "text-grey"] };
  return (
    <>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {[[undefined, "Toutes"], ["PENDING", "À vérifier"], ["VERIFIED", "Vérifiées"], ["DRAFT", "Brouillons"]].map(([k, l]) => (
          <Link key={l} href={k ? `/admin?s=structs&f=${k}` : "/admin?s=structs"} className={`btn btn-sm ${status === k ? "btn-secondary" : "btn-tertiary"}`}>{l}</Link>
        ))}
      </div>
      <section className="card">
        {list.map((s) => (
          <div key={s.id} className="flex flex-wrap items-start gap-3 border-b border-surface-2 px-[18px] py-3">
            <span className="clip-corner-sm grid h-10 w-10 flex-none place-items-center bg-surface-2 font-display text-sm font-bold">{s.tag}</span>
            <div className="min-w-0 flex-[1_1_260px]">
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/structure/${s.tag}`} className="font-semibold text-ink hover:text-orange">{s.name}</Link>
                <span className={`badge ${ST[s.status][1]}`}>{ST[s.status][0]}</span>
              </div>
              <div className="text-xs text-grey">
                {s.region} · créée le {fmt(s.createdAt)} · gestionnaire : {s.staff.map((m) => m.user.pseudo).join(", ")} · jeux : {[...new Set(s.rosters.map((r) => getGame(r.game)?.short))].join(", ") || "—"} · {s._count.members} joueur(s)
              </div>
              {s.bio && <div className="mt-1 text-[13px] text-silver">{s.bio}</div>}
            </div>
            {s.status !== "VERIFIED" && <StructureReview id={s.id} name={s.name} />}
          </div>
        ))}
        {list.length === 0 && <Empty>Aucune structure.</Empty>}
      </section>
    </>
  );
}

async function Users({ q, selfId }: { q?: string; selfId: string }) {
  const list = await db.user.findMany({
    where: q ? { OR: [{ pseudo: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] } : {},
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, pseudo: true, email: true, role: true, status: true, createdAt: true },
  });
  return (
    <>
      <form className="mb-3 flex max-w-xl gap-2" action="/admin">
        <input type="hidden" name="s" value="users" />
        <input name="q" defaultValue={q} placeholder="Pseudo ou e-mail…" aria-label="Rechercher un utilisateur" className="field h-11 flex-1" />
        <button className="btn btn-secondary">Rechercher</button>
      </form>
      <section className="card">
        {list.map((u) => (
          <div key={u.id} className="flex flex-wrap items-start gap-3 border-b border-surface-2 px-[18px] py-3">
            <div className="min-w-0 flex-[1_1_240px]">
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/joueur/${encodeURIComponent(u.pseudo)}`} className="font-semibold text-ink hover:text-orange">{u.pseudo}</Link>
                {u.status === "SUSPENDED" && <span className="badge text-red">Suspendu</span>}
                {u.role !== "JOUEUR" && <span className="badge text-orange">{u.role === "ADMIN" ? "Admin" : u.role === "ARBITRE" ? "Arbitre" : u.role}</span>}
              </div>
              <div className="text-xs text-grey">{u.email} · inscrit le {fmt(u.createdAt)}</div>
            </div>
            <UserControls id={u.id} role={u.role === "ADMIN" || u.role === "ARBITRE" ? u.role : "JOUEUR"} status={u.status} self={u.id === selfId} />
          </div>
        ))}
        {list.length === 0 && <Empty>Aucun utilisateur.</Empty>}
      </section>
    </>
  );
}

async function Ads() {
  const ads = await db.recruitAd.findMany({
    where: { moderation: "PENDING" },
    include: { author: { select: { pseudo: true } }, structure: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
  });
  return (
    <section className="card">
      <div className="card-head"><span className="card-title">Annonces en attente</span><span className="card-meta">{ads.length}</span></div>
      {ads.map((a) => (
        <div key={a.id} className="flex flex-wrap items-start gap-3 border-b border-surface-2 px-[18px] py-3">
          <div className="min-w-0 flex-[1_1_300px]">
            <div className="font-semibold">{a.kind === "STRUCTURE" ? `${a.structure?.name ?? a.author.pseudo} recrute` : `${a.author.pseudo} cherche une équipe`} · {getGame(a.game)?.name} · {a.role}</div>
            <div className="text-xs text-grey">{a.level} · {a.availability} · par {a.author.pseudo} le {fmt(a.createdAt)}</div>
            <p className="mt-1 whitespace-pre-line text-[13px] text-silver">{a.text}</p>
          </div>
          <AdModeration id={a.id} />
        </div>
      ))}
      {ads.length === 0 && <Empty>Rien à modérer.</Empty>}
    </section>
  );
}

async function Posts() {
  const [posts, reported] = await Promise.all([
    db.post.findMany({ orderBy: { createdAt: "desc" }, take: 30, include: { _count: { select: { comments: true, likes: true } } } }),
    db.postComment.findMany({ where: { reported: true }, orderBy: { createdAt: "desc" }, take: 30 }),
  ]);
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/actualites/nouvelle" className="btn btn-primary">+ Nouvelle publication officielle</Link>
        <span className="text-[13px] text-grey">La modération des publications se fait aussi directement dans le fil.</span>
      </div>
      <section className="card">
        <div className="card-head"><span className="card-title">Publications</span><span className="card-meta">{posts.length}</span></div>
        {posts.map((p) => (
          <div key={p.id} className="flex flex-wrap items-center gap-3 border-b border-surface-2 px-[18px] py-2.5 text-sm">
            <span className="badge text-silver">{p.kind}</span>
            <Link href={`/actualites#${p.id}`} className="min-w-0 flex-1 truncate font-semibold text-ink hover:text-orange">{p.title}</Link>
            {p.pinned && <span className="badge text-orange">Épinglé</span>}
            <span className="text-xs text-grey">{p._count.likes} j’aime · {p._count.comments} commentaires · {fmt(p.createdAt)}</span>
          </div>
        ))}
        {posts.length === 0 && <Empty>Aucune publication.</Empty>}
      </section>
      <section className="card">
        <div className="card-head"><span className="card-title">Commentaires signalés</span><span className="card-meta">{reported.length}</span></div>
        {reported.map((c) => (
          <div key={c.id} className="border-b border-surface-2 px-[18px] py-2.5 text-sm text-silver">« {c.text} » · <Link href={`/actualites#${c.postId}`}>voir</Link></div>
        ))}
        {reported.length === 0 && <Empty>Aucun commentaire signalé.</Empty>}
      </section>
    </div>
  );
}

async function Sanctions() {
  const list = await db.sanction.findMany({ orderBy: { createdAt: "desc" }, take: 50 });
  const userIds = list.filter((s) => s.targetType === "USER").map((s) => s.targetId);
  const structIds = list.filter((s) => s.targetType === "STRUCTURE").map((s) => s.targetId);
  const [users, structs] = await Promise.all([
    db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, pseudo: true } }),
    db.structure.findMany({ where: { id: { in: structIds } }, select: { id: true, name: true } }),
  ]);
  const nameOf = (s: (typeof list)[number]) => (s.targetType === "USER" ? users.find((u) => u.id === s.targetId)?.pseudo : structs.find((x) => x.id === s.targetId)?.name) ?? "—";
  const now = new Date();
  const state = (s: (typeof list)[number]): [string, string] =>
    s.liftedAt ? ["Levée", "text-grey"] : s.until && s.until < now ? ["Purgée", "text-grey"] : ["Active", "text-red"];
  return (
    <div className="grid gap-4">
      <div className="grid border border-line bg-surface [grid-template-columns:repeat(auto-fit,minmax(min(100%,160px),1fr))]">
        {[["Actives", list.filter((s) => state(s)[0] === "Active").length], ["Ce mois-ci", list.filter((s) => s.createdAt.getMonth() === now.getMonth()).length], ["Total", list.length]].map(([k, v]) => (
          <div key={k} className="border-r border-line px-4 py-3"><div className="overline !font-normal">{k}</div><div className="font-display text-[30px] font-extrabold">{v}</div></div>
        ))}
      </div>
      <section className="card max-w-3xl">
        <div className="card-head"><span className="card-title">Nouvelle sanction</span></div>
        <SanctionForm />
      </section>
      <section className="card overflow-x-auto">
        <div className="min-w-[720px]">
          <div className="grid grid-cols-[110px_160px_150px_minmax(0,1fr)_90px_80px] gap-3 border-b border-line px-[18px] py-2.5 overline !font-normal">
            <span>Date</span><span>Concerné</span><span>Sanction</span><span>Motif</span><span>Statut</span><span />
          </div>
          {list.map((s) => {
            const [l, c] = state(s);
            return (
              <div key={s.id} className="grid grid-cols-[110px_160px_150px_minmax(0,1fr)_90px_80px] items-center gap-3 border-b border-surface-2 px-[18px] py-2.5 text-sm">
                <span className="text-xs text-grey">{fmt(s.createdAt)}</span>
                <span className="truncate font-semibold">{nameOf(s)}</span>
                <span>{s.type}</span>
                <span className="text-silver">{s.reason}</span>
                <span className={`text-xs font-bold ${c}`}>● {l}</span>
                <span>{l === "Active" && <LiftSanction id={s.id} />}</span>
              </div>
            );
          })}
          {list.length === 0 && <Empty>Aucune sanction.</Empty>}
        </div>
      </section>
    </div>
  );
}

async function Formats() {
  const games = await db.game.findMany({ orderBy: [{ kind: "asc" }, { name: "asc" }] });
  return (
    <section className="card max-w-3xl">
      <div className="card-head"><span className="card-title">Formats par jeu</span><span className="card-meta">Paramètres, pas des constantes · chaque modification est journalisée</span></div>
      {games.map((g) => (
        <GameFormatForm
          key={g.id}
          g={{ id: g.id, name: g.name, kind: g.kind, rosterSize: g.rosterSize, series: g.series ?? "", lobbySize: g.lobbySize ? String(g.lobbySize) : "", scale: Array.isArray(g.scale) ? (g.scale as number[]).join(", ") : "", killPoint: g.killPoint }}
        />
      ))}
      {games.length === 0 && <Empty>Aucun jeu : lancez le seed (npm run db:seed).</Empty>}
    </section>
  );
}

function RankConfig() {
  const rows: [string, string][] = [
    ["Score de départ", `${START_SCORE} pts`],
    ["K en placement", `${K_PLACEMENT} (${PLACEMENT_MATCHES} premiers matchs)`],
    ["K ensuite", String(K_DEFAULT)],
    ["Zone de défi", "2 rangs au-dessus, 1 en dessous (élargie à 3 / 2)"],
    ["Défis en attente", `${MAX_PENDING_OUT} maximum`],
    ["Délai de réponse", `${RESPONSE_HOURS} h (relance à 24 h)`],
    ["Refus injustifié", `−${UNJUSTIFIED_REFUSAL_PENALTY} pts`],
    ["Revanche", `après ${REMATCH_DAYS} jours`],
    ["Matchs comptés par paire", `${PAIR_MAX_COUNTED} sur ${PAIR_WINDOW_DAYS} jours glissants`],
    ["Taille de division", `${DIVISION_SIZE}`],
    ["Remplaçants par roster", `${MAX_SUBS} maximum`],
    ["Barème du classement général", `${[1, 2, 3, 4, 5, 6, 7, 8].map(structurePoints).join(" / ")}, puis −4 par rang (min. 5)`],
    ["Barème LAN", `barème du classement général + ${LAN_BONUS} points (${[1, 2, 3].map((r) => structurePoints(r) + LAN_BONUS).join(" / ")}…)`],
    ["Pré-saison", "classe les équipes (Elo) sans compter au classement général"],
  ];
  return (
    <section className="card max-w-3xl">
      <div className="card-head"><span className="card-title">Règles en vigueur</span><span className="card-meta">Lecture seule</span></div>
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-4 border-b border-surface-2 px-[18px] py-2.5 text-sm">
          <span className="text-grey">{k}</span>
          <span className="text-right font-semibold">{v}</span>
        </div>
      ))}
      <div className="px-[18px] py-3 text-xs text-grey">Ces valeurs sont définies dans le code (src/lib/rules) et testées. Leur édition depuis la console arrivera avec les Rankings en base.</div>
    </section>
  );
}

function Results() {
  return (
    <section className="card overflow-x-auto">
      <div className="card-head"><span className="card-title">Résultats soumis</span><DemoTag /></div>
      <div className="min-w-[760px]">
        <div className="grid grid-cols-[40px_80px_minmax(0,1fr)_150px_70px_130px_170px] gap-3 border-b border-line px-[18px] py-2.5 overline !font-normal">
          <span /><span>ID</span><span>Match</span><span>Compétition</span><span>Score</span><span>Source</span><span>Statut</span>
        </div>
        {DEMO_RESULTS.map((r) => {
          const g = getGame(r.game);
          const [l, c] = RESULT_STATUS[r.st];
          return (
            <div key={r.id} className="grid grid-cols-[40px_80px_minmax(0,1fr)_150px_70px_130px_170px] items-center gap-3 border-b border-surface-2 px-[18px] py-2.5 text-sm">
              {g ? <Image src={g.logo} alt={g.name} width={28} height={18} className="h-[18px] w-7 object-contain" /> : <span />}
              <span className="font-mono text-xs">{r.id}</span>
              <span className="truncate">{r.match}</span>
              <span className="text-xs text-grey">{r.comp}</span>
              <span className="font-display text-lg font-bold">{r.score}</span>
              <span className="text-xs text-grey">{r.src}</span>
              <span className={`text-xs font-bold ${c}`}>● {l}</span>
            </div>
          );
        })}
      </div>
      <div className="px-[18px] py-3 text-xs text-grey">La validation des résultats passera par la table ResultSubmission avec la lecture OCR. Les contestations se traitent dans l’espace arbitre.</div>
    </section>
  );
}

async function Leads() {
  const leads = await db.partnerLead.findMany({ orderBy: { createdAt: "desc" }, take: 50 });
  return (
    <section className="card">
      <div className="card-head"><span className="card-title">Demandes « Devenir partenaire »</span><span className="card-meta">{leads.length}</span></div>
      {leads.map((l) => (
        <div key={l.id} className="border-b border-surface-2 px-[18px] py-3 text-sm">
          <div className="flex flex-wrap justify-between gap-2">
            <span className="font-semibold">{l.company} · <a href={`mailto:${l.email}`}>{l.email}</a></span>
            <span className="text-xs text-grey">{fmt(l.createdAt)}</span>
          </div>
          <div className="text-xs text-grey">{l.goal}</div>
          {l.message && <p className="mt-1 whitespace-pre-line text-[13px] text-silver">{l.message}</p>}
        </div>
      ))}
      {leads.length === 0 && <Empty>Aucune demande pour le moment.</Empty>}
    </section>
  );
}

function Campaigns() {
  const nf = new Intl.NumberFormat("fr-FR");
  return (
    <section className="card overflow-x-auto">
      <div className="card-head"><span className="card-title">Campagnes · performances</span><DemoTag /></div>
      <div className="min-w-[760px]">
        <div className="grid grid-cols-[minmax(0,1fr)_170px_90px_70px_70px_120px] gap-3 border-b border-line px-[18px] py-2.5 overline !font-normal">
          <span>Campagne</span><span>Emplacement</span><span className="text-right">Impr.</span><span className="text-right">Clics</span><span className="text-right">CTR</span><span>Statut</span>
        </div>
        {DEMO_CAMPAIGNS.map((c) => (
          <div key={c.name} className="grid grid-cols-[minmax(0,1fr)_170px_90px_70px_70px_120px] items-center gap-3 border-b border-surface-2 px-[18px] py-2.5 text-sm">
            <span><span className="block font-semibold">{c.name}</span><span className="block text-xs text-grey">{c.partner} · {c.dates} · plafond {c.cap}</span></span>
            <span className="text-xs">{c.slot}</span>
            <span className="text-right">{nf.format(c.imp)}</span>
            <span className="text-right">{nf.format(c.clicks)}</span>
            <span className="text-right">{((c.clicks / c.imp) * 100).toFixed(1).replace(".", ",")} %</span>
            <span className={`text-xs font-bold ${c.status === "Active" ? "text-orange" : "text-grey"}`}>● {c.status}</span>
          </div>
        ))}
      </div>
      <div className="px-[18px] py-3 text-xs text-grey">Impressions et clics : nécessite une intégration de mesure publicitaire.</div>
    </section>
  );
}

async function Audit() {
  const list = await db.auditLog.findMany({ orderBy: { at: "desc" }, take: 100, include: { actor: { select: { pseudo: true } } } });
  return (
    <section className="card overflow-x-auto">
      <div className="min-w-[640px]">
        <div className="grid grid-cols-[130px_140px_minmax(0,1fr)] gap-3 border-b border-line px-[18px] py-2.5 overline !font-normal">
          <span>Date</span><span>Auteur</span><span>Action</span>
        </div>
        {list.map((a) => (
          <div key={a.id} className="grid grid-cols-[130px_140px_minmax(0,1fr)] gap-3 border-b border-surface-2 px-[18px] py-2.5 text-sm">
            <span className="text-xs text-grey">{fmt(a.at)}</span>
            <span className="truncate">{a.actor?.pseudo ?? "Système"}</span>
            <span className="font-mono text-[13px]">{a.action} · <span className="text-grey">{a.target}</span></span>
          </div>
        ))}
        {list.length === 0 && <Empty>Journal vide.</Empty>}
      </div>
    </section>
  );
}
