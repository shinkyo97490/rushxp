import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getViewer } from "@/lib/auth/viewer";
import { CHALLENGE_GAMES, GAMES, getGame } from "@/lib/data/games";
import { namesFor } from "@/lib/matches/queries";
import { K_DEFAULT, K_PLACEMENT, PLACEMENT_MATCHES, START_SCORE } from "@/lib/rules/elo";
import { MAX_PENDING_OUT, PAIR_MAX_COUNTED, PAIR_WINDOW_DAYS, REMATCH_DAYS, RESPONSE_HOURS, UNJUSTIFIED_REFUSAL_PENALTY } from "@/lib/rules/challenge";
import { MAX_SUBS } from "@/lib/rules/roster";
import { LAN_BONUS, structurePoints } from "@/lib/rules/scales";
import { DIVISION_SIZE } from "@/lib/rankings-model";
import { Empty } from "@/components/PageHeader";
import { integrationStatus } from "@/lib/integrations";
import { LanEditor, LanResultsEditor, ValidateLanResults, type LanForm } from "@/components/admin/LanAdmin";
import { euros, getLan, LAN_STATUS, lanDates, listLans, programToText } from "@/lib/lan/queries";
import { Badge } from "@/components/ui";
import { CampaignEditor, CompetitionTextEditor, HomeEditor, MaintenanceToggle, PartnerEditor } from "@/components/admin/SiteAdmin";
import { SLOT_LABEL } from "@/lib/site/ads";
import { getCompetitionTexts, getHome, getMaintenance, HOME_BLOCKS } from "@/lib/site/settings";
import { getPlayoffs } from "@/lib/playoffs";
import { getSeason, seasonYearAt } from "@/lib/season";
import { MatchDate, PlayoffsGameActions } from "@/components/admin/PlayoffsAdmin";
import { RoundEntry } from "@/components/admin/RdvAdmin";
import { CycleEditor, DeleteCycle } from "@/components/admin/MapPoolAdmin";
import { activePool } from "@/lib/matches/room";
import { CDL_MODES, type CdlMode, type VetoPool } from "@/lib/rules/veto";
import { eventResults } from "@/lib/events/results";
import { tftLobbies } from "@/lib/rules/scales";
import { AdModeration, BroadcastForm, GameFormatForm, LiftSanction, SanctionForm, StructureReview, UserControls } from "@/components/admin/AdminClient";

export const metadata: Metadata = { title: "Administration" };

const NAV: { group: string; items: [string, string][] }[] = [
  { group: "Pilotage", items: [["dashboard", "Tableau de bord"]] },
  { group: "Compétition", items: [["comps", "Compétitions"], ["results", "Résultats"], ["rdv", "RDV mensuels"], ["playoffs", "Playoffs"], ["lan", "LAN"], ["mappool", "Map pool & cycles"], ["sanctions", "Sanctions"], ["formats", "Formats & barèmes"], ["rankcfg", "Paramètres Rankings"]] },
  { group: "Contenu du site", items: [["home", "Page d’accueil"], ["posts", "Publications"], ["notifs", "Notifications"]] },
  { group: "Communauté", items: [["structs", "Structures"], ["users", "Utilisateurs"], ["ads", "Annonces"]] },
  { group: "Commercial", items: [["partners", "Partenaires"], ["campaigns", "Publicités"], ["leads", "Demandes partenaires"]] },
  { group: "Système", items: [["audit", "Journal d’audit"]] },
];
const REFEREE_OK = ["dashboard", "rdv", "lan", "results", "sanctions"];

const fmt = (d: Date) => new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(d);

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ s?: string; q?: string; f?: string; msg?: string; id?: string }> }) {
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
          {sec === "lan" && <LanSection id={sp.id} isAdmin={isAdmin} />}
          {sec === "playoffs" && <PlayoffsSection />}
          {sec === "rdv" && <RdvSection id={sp.id} isAdmin={isAdmin} />}
          {sec === "mappool" && <MapPoolSection />}
          {sec === "leads" && <Leads />}
          {sec === "campaigns" && <Campaigns id={sp.id} />}
          {sec === "partners" && <PartnersSection id={sp.id} />}
          {sec === "home" && <HomeSection />}
          {sec === "comps" && <CompetitionsSection />}
          {sec === "audit" && <Audit />}
        </div>
      </div>
    </main>
  );
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

const SUB_STATUS: Record<string, [string, string]> = {
  AWAITING_OPPONENT: ["Confirmation attendue", "text-silver"],
  REFEREE_REVIEW: ["Contesté · arbitre", "text-red"],
  AUTO_VALIDATED: ["Validé auto (24 h)", "text-ink"],
  VALIDATED: ["Validé", "text-grey"],
  REJECTED: ["Rejeté", "text-grey"],
};

async function Results() {
  const subs = await db.resultSubmission.findMany({
    where: { matchId: { not: null } },
    include: { match: true, uploader: { select: { pseudo: true } } },
    orderBy: { createdAt: "desc" },
    take: 60,
  });
  const names = await namesFor(subs.map((x) => x.match!));
  return (
    <section className="card overflow-x-auto">
      <div className="card-head"><span className="card-title">Résultats soumis</span><span className="card-meta">{subs.length} récent(s)</span></div>
      {subs.length === 0 ? (
        <Empty>Aucun résultat déclaré pour le moment.</Empty>
      ) : (
        <div className="min-w-[760px]">
          <div className="grid grid-cols-[40px_minmax(0,1fr)_120px_70px_120px_170px] gap-3 border-b border-line px-[18px] py-2.5 overline !font-normal">
            <span /><span>Match</span><span>Déclaré par</span><span>Score</span><span>Date</span><span>Statut</span>
          </div>
          {subs.map((r) => {
            const m = r.match!;
            const g = getGame(m.game);
            const [l, c] = SUB_STATUS[r.status] ?? [r.status, "text-grey"];
            return (
              <Link key={r.id} href={`/match?m=${m.id}`} className="grid grid-cols-[40px_minmax(0,1fr)_120px_70px_120px_170px] items-center gap-3 border-b border-surface-2 px-[18px] py-2.5 text-sm text-ink hover:bg-surface-2 hover:text-ink">
                {g ? <Image src={g.logo} alt={g.name} width={28} height={18} className="h-[18px] w-7 object-contain" /> : <span />}
                <span className="truncate">{names.get(m.a)?.name ?? "?"} vs {names.get(m.b)?.name ?? "?"}</span>
                <span className="truncate text-xs text-grey">{r.uploader.pseudo}</span>
                <span className="font-display text-lg font-bold">{r.declaredA ?? "?"}–{r.declaredB ?? "?"}</span>
                <span className="text-xs text-grey">{fmt(r.createdAt)}</span>
                <span className={`text-xs font-bold ${c}`}>● {l}</span>
              </Link>
            );
          })}
        </div>
      )}
      <div className="px-[18px] py-3 text-xs text-grey">Un résultat devient officiel à la confirmation adverse, après 24 h sans réponse, ou sur décision d’arbitre. Les contestations se traitent dans l’<Link href="/arbitrage">espace arbitre</Link>.</div>
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

async function Campaigns({ id }: { id?: string }) {
  const nf = new Intl.NumberFormat("fr-FR");
  const [list, partners] = await Promise.all([
    db.adCampaign.findMany({ orderBy: { createdAt: "desc" }, include: { partner: { select: { name: true } } } }),
    db.partner.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const now = new Date();
  const d = (x: Date | null) => (x ? new Intl.DateTimeFormat("en-CA", { timeZone: "Indian/Reunion" }).format(x) : "");
  const cur = list.find((c) => c.id === id);
  const status = (c: (typeof list)[number]) => (!c.active ? "Désactivée" : c.startsAt > now ? "Programmée" : c.endsAt && c.endsAt < now ? "Terminée" : c.cap != null && c.impressions >= c.cap ? "Plafond atteint" : "Active");
  return (
    <div className="grid gap-4">
      {(id === "new" || cur) && (
        <section className="card">
          <div className="card-head"><span className="card-title">{cur ? `Modifier · ${cur.name}` : "Nouvelle campagne"}</span><Link href="/admin?s=campaigns" className="text-[13px]">Fermer</Link></div>
          <CampaignEditor
            key={cur?.id ?? "new"}
            partners={partners}
            slots={Object.entries(SLOT_LABEL)}
            initial={cur ? { id: cur.id, partnerId: cur.partnerId, name: cur.name, slot: cur.slot, imageUrl: cur.imageUrl ?? "", title: cur.title, body: cur.body ?? "", link: cur.link, startsOn: d(cur.startsAt), endsOn: d(cur.endsAt), cap: cur.cap == null ? "" : String(cur.cap), active: cur.active } : { partnerId: "", name: "", slot: "FEED_CARD", imageUrl: "", title: "", body: "", link: "", startsOn: d(now), endsOn: "", cap: "", active: true }}
          />
        </section>
      )}
      <section className="card overflow-x-auto">
        <div className="card-head"><span className="card-title">Campagnes · performances</span><Link href="/admin?s=campaigns&id=new" className="btn btn-primary btn-sm">Nouvelle campagne</Link></div>
        {list.length === 0 ? (
          <Empty>Aucune campagne.</Empty>
        ) : (
          <div className="min-w-[760px]">
            <div className="grid grid-cols-[minmax(0,1fr)_170px_90px_70px_70px_120px] gap-3 border-b border-line px-[18px] py-2.5 overline !font-normal">
              <span>Campagne</span><span>Emplacement</span><span className="text-right">Impr.</span><span className="text-right">Clics</span><span className="text-right">CTR</span><span>Statut</span>
            </div>
            {list.map((c) => {
              const st = status(c);
              return (
                <Link key={c.id} href={`/admin?s=campaigns&id=${c.id}`} className="grid grid-cols-[minmax(0,1fr)_170px_90px_70px_70px_120px] items-center gap-3 border-b border-surface-2 px-[18px] py-2.5 text-sm text-ink hover:bg-surface-2 hover:text-ink">
                  <span><span className="block font-semibold">{c.name}</span><span className="block text-xs text-grey">{c.partner.name} · dès le {fmt(c.startsAt)}{c.cap ? ` · plafond ${nf.format(c.cap)}` : ""}</span></span>
                  <span className="text-xs">{SLOT_LABEL[c.slot]}</span>
                  <span className="text-right">{nf.format(c.impressions)}</span>
                  <span className="text-right">{nf.format(c.clicks)}</span>
                  <span className="text-right">{c.impressions ? `${((c.clicks / c.impressions) * 100).toFixed(1).replace(".", ",")} %` : "—"}</span>
                  <span className={`text-xs font-bold ${st === "Active" ? "text-orange" : "text-grey"}`}>● {st}</span>
                </Link>
              );
            })}
          </div>
        )}
        <div className="px-[18px] py-3 text-xs text-grey">Impressions comptées à chaque affichage, clics comptés via un lien de redirection. Rotation : la campagne la moins vue de l’emplacement passe en premier.</div>
      </section>
    </div>
  );
}

async function PartnersSection({ id }: { id?: string }) {
  const list = await db.partner.findMany({ orderBy: [{ order: "asc" }, { name: "asc" }], include: { _count: { select: { campaigns: true } } } });
  const cur = list.find((p) => p.id === id);
  const LEVEL = { MAIN: "Principal", OFFICIAL: "Officiel", ASSOCIATIVE: "Associatif" } as const;
  return (
    <div className="grid gap-4">
      {(id === "new" || cur) && (
        <section className="card">
          <div className="card-head"><span className="card-title">{cur ? `Modifier · ${cur.name}` : "Ajouter un partenaire"}</span><Link href="/admin?s=partners" className="text-[13px]">Fermer</Link></div>
          <PartnerEditor
            key={cur?.id ?? "new"}
            initial={cur ? { id: cur.id, name: cur.name, category: cur.category, level: cur.level, site: cur.site ?? "", description: cur.description, logoUrl: cur.logoUrl, band: cur.band, active: cur.active, order: String(cur.order) } : { name: "", category: "", level: "OFFICIAL", site: "", description: "", logoUrl: "", band: true, active: true, order: String(list.length) }}
          />
        </section>
      )}
      <section className="card">
        <div className="card-head"><span className="card-title">Partenaires</span><Link href="/admin?s=partners&id=new" className="btn btn-primary btn-sm">Ajouter un partenaire</Link></div>
        {list.map((p) => (
          <Link key={p.id} href={`/admin?s=partners&id=${p.id}`} className="flex items-center gap-3 border-b border-surface-2 px-[18px] py-2.5 text-sm text-ink hover:bg-surface-2 hover:text-ink">
            <Image src={p.logoUrl} alt="" width={48} height={32} className="h-8 w-12 object-contain" />
            <span className="min-w-0 flex-1"><span className="block font-semibold">{p.name}</span><span className="block text-xs text-grey">{LEVEL[p.level]} · {p.category} · {p._count.campaigns} campagne(s)</span></span>
            <span className="text-xs text-grey">{p.active ? (p.band ? "Visible · accueil" : "Visible") : "Masqué"}</span>
          </Link>
        ))}
        {list.length === 0 && <Empty>Aucun partenaire.</Empty>}
      </section>
    </div>
  );
}

async function HomeSection() {
  const [home, maint, lans] = await Promise.all([getHome(), getMaintenance(), db.lanEvent.findMany({ where: { status: { not: "DRAFT" } }, select: { slug: true, name: true }, orderBy: { startsAt: "desc" } })]);
  return (
    <div className="grid gap-4">
      <section className="card">
        <div className="card-head"><span className="card-title">Page d’accueil</span><Link href="/" className="text-[13px]">Voir l’accueil →</Link></div>
        <div className="px-[18px] py-4">
          <HomeEditor initial={{ ...home, bannerLan: home.bannerLan ?? "" }} allBlocks={HOME_BLOCKS} lans={lans} />
        </div>
      </section>
      <section className={`card ${maint.on ? "!border-red" : ""}`}>
        <div className="card-head"><span className="card-title">Mode maintenance</span><span className={`card-meta ${maint.on ? "!text-red" : ""}`}>{maint.on ? "ACTIVÉ" : "Désactivé"}</span></div>
        <div className="px-[18px] py-4">
          <p className="mb-3 text-sm text-silver">Remplace le site public par la page de maintenance. Les administrateurs continuent de voir le site et la page de connexion reste accessible.</p>
          <MaintenanceToggle on={maint.on} message={maint.message} />
        </div>
      </section>
    </div>
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

// ─── LAN (CMS) ───────────────────────────────────────────────────

/** Date → valeur d'un champ datetime-local, à l'heure de La Réunion. */
function reunionInput(d: Date | null, dateOnly = false) {
  if (!d) return "";
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "Indian/Reunion", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(d).map((x) => [x.type, x.value]));
  return dateOnly ? `${p.year}-${p.month}-${p.day}` : `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

async function LanSection({ id, isAdmin }: { id?: string; isAdmin: boolean }) {
  const games = GAMES.map((g) => ({ id: g.id, name: g.name, solo: g.rosterSize === 1, format: `${g.format}${g.series ? ` · ${g.series}` : ""}` }));
  if (id === "new" && isAdmin) {
    const empty: LanForm = { name: "", organizer: "", place: "", startsAt: "", endsAt: "", description: "", posterUrl: "", status: "DRAFT", refundUntil: "", visitorPass: "", countsForGeneral: true, program: "", tournaments: [] };
    return (
      <div className="grid gap-3">
        <Link href="/admin?s=lan" className="text-[13px]">← Tous les événements</Link>
        <LanEditor initial={empty} games={games} />
      </div>
    );
  }
  const lan = id ? await getLan(id) : null;
  if (lan) {
    const form: LanForm = {
      id: lan.id,
      name: lan.name,
      organizer: lan.organizer,
      place: lan.place,
      startsAt: reunionInput(lan.startsAt),
      endsAt: reunionInput(lan.endsAt),
      description: lan.description,
      posterUrl: lan.posterUrl ?? "",
      status: lan.status,
      refundUntil: reunionInput(lan.refundUntil, true),
      visitorPass: lan.visitorPassCents == null ? "" : String(lan.visitorPassCents / 100),
      countsForGeneral: lan.countsForGeneral,
      program: programToText(lan.program),
      tournaments: lan.tournaments.map((t) => ({ game: t.game, format: t.format, price: t.priceCents == null ? "" : String(t.priceCents / 100), capacity: String(t.capacity), day: t.day ?? "" })),
    };
    const done = lan.status === "DONE";
    const missing = lan.tournaments.filter((t) => t.registrations.some((r) => r.status === "PAID") && !t.results.length).length;
    return (
      <div className="grid gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/admin?s=lan" className="text-[13px]">← Tous les événements</Link>
          <Link href={`/lan?e=${lan.slug}`} className="text-[13px]">Voir la page publique →</Link>
        </div>
        {isAdmin && <LanEditor key={lan.id} initial={form} games={games} />}
        <section className="card">
          <div className="card-head"><span className="card-title">Résultats · saisie arbitre</span><span className="card-meta">{done ? "Validés et publiés" : "Inscriptions payées, du 1er au 8e"}</span></div>
          {lan.tournaments.length === 0 && <p className="px-[18px] py-4 text-sm text-grey">Ajoutez d’abord des tournois.</p>}
          {lan.tournaments.map((t) => (
            <LanResultsEditor
              key={t.id}
              tournamentId={t.id}
              title={getGame(t.game)?.name ?? t.game}
              entries={t.registrations.filter((r) => r.status === "PAID").map((r) => ({ id: r.id, name: r.name }))}
              initial={t.results.map((r) => t.registrations.find((x) => x.name === r.name)?.id ?? "")}
              locked={done}
            />
          ))}
          {isAdmin && !done && lan.tournaments.length > 0 && (
            <ValidateLanResults lanId={lan.id} slug={lan.slug} disabledReason={missing ? `${missing} tournoi(s) sans classement` : undefined} />
          )}
        </section>
      </div>
    );
  }
  const lans = await listLans(true);
  return (
    <section className="card">
      <div className="card-head">
        <span className="card-title">Événements</span>
        {isAdmin && <Link href="/admin?s=lan&id=new" className="btn btn-primary btn-sm">Créer une LAN / un événement</Link>}
      </div>
      {lans.length === 0 ? (
        <Empty>Aucun événement. Créez la première LAN : elle reste invisible tant qu’elle est en brouillon.</Empty>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead><tr className="text-left text-xs text-grey">{["Événement", "Dates", "Statut", "Tournois", "Inscrits"].map((h) => <th key={h} className="px-[18px] py-2 font-semibold">{h}</th>)}</tr></thead>
            <tbody>
              {lans.map((l) => (
                <tr key={l.id} className="border-t border-surface-2">
                  <td className="px-[18px] py-2.5"><Link href={`/admin?s=lan&id=${l.slug}`} className="font-semibold text-ink">{l.name}</Link><div className="text-xs text-grey">{l.organizer} · {l.place}</div></td>
                  <td className="px-[18px] py-2.5 text-silver">{lanDates(l.startsAt, l.endsAt)}</td>
                  <td className="px-[18px] py-2.5"><Badge tone={LAN_STATUS[l.status].tone}>{LAN_STATUS[l.status].label}</Badge></td>
                  <td className="px-[18px] py-2.5 text-silver">{l.tournaments.map((t) => getGame(t.game)?.short ?? t.game).join(" · ") || "—"}</td>
                  <td className="px-[18px] py-2.5 font-mono">{l.tournaments.reduce((a, t) => a + t._count.registrations, 0)}{l.tournaments.some((t) => t.priceCents != null) ? <span className="text-grey"> · dès {euros(Math.min(...l.tournaments.filter((t) => t.priceCents != null).map((t) => t.priceCents!)))}</span> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// ─── Playoffs ────────────────────────────────────────────────────

async function PlayoffsSection() {
  const year = seasonYearAt();
  const season = await getSeason(year);
  const games = await Promise.all(CHALLENGE_GAMES.map(async (g) => ({ g, p: await getPlayoffs(g.id, year) })));
  return (
    <div className="grid gap-4">
      <p className="max-w-3xl text-sm text-silver">
        Le seeding se fige automatiquement le {new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "short", timeZone: "Indian/Reunion" }).format(season.seedingAt)} (tâche quotidienne, jusqu’à 7 jours après), puis les quarts sont générés. En dehors de cette fenêtre, figez-le ici. Un seeding figé est immuable.
      </p>
      {games.map(({ g, p }) => {
        const all = [...p.qf, ...p.sf, ...p.fi].filter((m) => m.id);
        return (
          <section key={g.id} className="card">
            <div className="card-head">
              <span className="card-title">{g.name}</span>
              <span className="card-meta">{p.frozen ? `Figé · ${p.seeds.length} qualifiés` : `Aperçu · ${p.seeds.length} qualifiable(s)`}</span>
            </div>
            <div className="grid gap-3 px-[18px] py-3.5">
              <PlayoffsGameActions game={g.id} frozen={!!p.frozen} generated={all.length > 0} />
              {all.map((m) => (
                <div key={m.round} className="flex flex-wrap items-center justify-between gap-2 border-t border-surface-2 pt-2.5 text-sm">
                  <span><strong>{m.label}</strong> · {m.sides[0].name} vs {m.sides[1].name} <span className="text-xs text-grey">· {m.state}</span></span>
                  {m.state === "Programmé" && m.when ? <MatchDate matchId={m.id!} label={m.label} value={reunionInput(new Date(m.when))} /> : <Link href={`/match?m=${m.id}`} className="text-[13px]">Match Center →</Link>}
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

// ─── RDV mensuels : saisie des résultats ─────────────────────────

async function RdvSection({ id, isAdmin }: { id?: string; isAdmin: boolean }) {
  const events = await db.monthlyEvent.findMany({ orderBy: { date: "desc" }, take: 30, include: { _count: { select: { entries: true } } } });
  const cur = events.find((e) => e.id === id) ?? events.find((e) => e.status === "LIVE") ?? events.find((e) => e.date <= new Date() && e.status !== "DONE") ?? events[0];
  const res = cur ? await eventResults(cur.id) : null;
  const rounds: Record<number, Record<string, { placement: number; kills: number }>> = {};
  for (const r of res?.allRounds ?? []) rounds[r.n] = Object.fromEntries(r.results.map((x) => [x.entryId, { placement: x.placement, kills: x.kills }]));
  const label = (e: (typeof events)[number]) => `${getGame(e.game)?.short ?? e.game} · ${new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "Indian/Reunion" }).format(e.date)}`;
  return (
    <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
      <section className="card content-start">
        <div className="card-head"><span className="card-title">Rendez-vous</span></div>
        {events.length === 0 && <Empty>Aucun RDV.</Empty>}
        {events.map((e) => (
          <Link key={e.id} href={`/admin?s=rdv&id=${e.id}`} aria-current={e.id === cur?.id ? "page" : undefined} className={`flex justify-between gap-2 border-b border-surface-2 px-[18px] py-2.5 text-sm text-ink hover:bg-surface-2 hover:text-ink ${e.id === cur?.id ? "border-l-[3px] border-l-orange bg-surface-2" : ""}`}>
            <span className="first-letter:uppercase">{label(e)}</span>
            <span className="text-xs text-grey">{e._count.entries} · {e.status === "DONE" ? "clôturé" : e.status === "LIVE" ? "en cours" : e.status === "OPEN" ? "ouvert" : e.status.toLowerCase()}</span>
          </Link>
        ))}
      </section>
      {cur && res && (
        <section className="card">
          <div className="card-head"><span className="card-title first-letter:uppercase">{label(cur)}</span><Link href={`/rdv?jeu=${cur.game}&mois=${cur.month}`} className="text-[13px]">Page publique →</Link></div>
          <div className="px-[18px] py-3.5">
            {cur.status === "DONE" ? (
              <p className="text-sm text-grey">Rendez-vous clôturé : résultats définitifs.</p>
            ) : (
              <RoundEntry
                eventId={cur.id}
                solo={res.solo}
                kills={cur.game !== "tft"}
                entries={res.entries}
                rounds={rounds}
                published={res.publishedRounds}
                lobbies={cur.game === "tft" ? tftLobbies(res.standing.map((s) => s.id)) : null}
                canClose={isAdmin}
              />
            )}
          </div>
        </section>
      )}
    </div>
  );
}

// ─── Map pool & cycles ───────────────────────────────────────────

function poolText(game: string, p: VetoPool) {
  return game === "val" ? (p as string[]).join(", ") : (Object.keys(CDL_MODES) as CdlMode[]).map((m) => `${m} : ${(p as Record<CdlMode, string[]>)[m]?.join(", ")}`).join(" · ");
}

async function MapPoolSection() {
  const now = new Date();
  const tomorrow = new Intl.DateTimeFormat("en-CA", { timeZone: "Indian/Reunion" }).format(new Date(now.getTime() + 86_400_000));
  const day = (d: Date) => new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeZone: "Indian/Reunion" }).format(d);
  const blocks = await Promise.all(
    (["val", "cod"] as const).map(async (game) => ({
      game,
      current: await activePool(game, now),
      cycles: await db.mapCycle.findMany({ where: { game }, orderBy: { startsAt: "desc" }, take: 12 }),
    })),
  );
  return (
    <div className="grid gap-4">
      {blocks.map(({ game, current, cycles }) => {
        const active = cycles.find((c) => c.startsAt <= now);
        return (
          <section key={game} className="card">
            <div className="card-head"><span className="card-title">{getGame(game)?.name}</span><span className="card-meta">{active ? `Cycle actif : ${active.name}` : "Pool par défaut"}</span></div>
            <div className="border-b border-line px-[18px] py-3 text-sm"><span className="overline mr-2">Pool actif</span>{poolText(game, current)}</div>
            <CycleEditor game={game} current={current} tomorrow={tomorrow} />
            <div className="border-t border-line">
              <div className="overline px-[18px] pt-3 pb-1">Historique des cycles</div>
              {cycles.length === 0 && <p className="px-[18px] pb-3 text-sm text-grey">Aucun cycle : le pool par défaut s’applique.</p>}
              {cycles.map((c) => (
                <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-surface-2 px-[18px] py-2 text-sm">
                  <span><strong>{c.name}</strong> <span className="text-xs text-grey">· {c.startsAt > now ? `programmé le ${day(c.startsAt)}` : `depuis le ${day(c.startsAt)}`}{c.id === active?.id ? " · actif" : ""}</span><span className="block text-xs text-silver">{poolText(game, c.maps as VetoPool)}</span></span>
                  {c.startsAt > now && <DeleteCycle id={c.id} />}
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

async function CompetitionsSection() {
  const texts = await getCompetitionTexts();
  return (
    <section className="card">
      <div className="card-head"><span className="card-title">Pages compétition</span><span className="card-meta">Nom, bannière et présentation par jeu</span></div>
      {GAMES.map((g) => <CompetitionTextEditor key={g.id} game={g.id} name={g.name} initial={texts[g.id]} />)}
      <div className="px-[18px] py-3 text-xs text-grey">Formats, séries et barèmes : section « Formats & barèmes ». Map pool : « Map pool & cycles ». LAN : section « LAN ».</div>
    </section>
  );
}
