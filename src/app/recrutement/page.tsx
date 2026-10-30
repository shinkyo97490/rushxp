import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getViewer } from "@/lib/auth/viewer";
import { GAMES, getGame } from "@/lib/data/games";
import { getAds, getMyAds, getMyInvitations, getMyRequests, getTeamStructure, getTransfers } from "@/lib/team/queries";
import { Empty, PageHeader, TabLinks } from "@/components/PageHeader";
import {
  AddTeamForm,
  Effectif,
  InvitePlayerForm,
  JoinByCode,
  MyAds,
  MyInvitations,
  PendingRequests,
  PostAdForm,
  RosterCard,
} from "@/components/team/TeamClient";

export const metadata: Metadata = { title: "Équipe & recrutement" };

const fmtDate = (d: Date) => new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" }).format(d);

export default async function RecrutementPage({ searchParams }: { searchParams: Promise<{ tab?: string; jeu?: string; type?: string }> }) {
  const sp = await searchParams;
  const tab = sp.tab === "annonces" || sp.tab === "transferts" ? sp.tab : "equipe";
  const viewer = await getViewer();

  return (
    <main className="container-rx pt-7 pb-16">
      <PageHeader
        title="Équipe & recrutement"
        actions={
          <>
            {viewer && !viewer.structure && <Link href="/structure/nouvelle" className="btn btn-secondary">+ Créer une structure</Link>}
          </>
        }
      >
        Composez vos rosters, publiez une annonce et suivez les transferts. Un roster complet est obligatoire pour lancer ou accepter un défi.
      </PageHeader>
      <TabLinks
        active={tab}
        tabs={[
          { key: "equipe", label: "Mon équipe", href: "/recrutement" },
          { key: "annonces", label: "Annonces", href: "/recrutement?tab=annonces" },
          { key: "transferts", label: "Transferts", href: "/recrutement?tab=transferts" },
        ]}
      />
      {tab === "equipe" && <TeamTab />}
      {tab === "annonces" && <AdsTab game={sp.jeu} type={sp.type} />}
      {tab === "transferts" && <TransfersTab />}
    </main>
  );
}

async function TeamTab() {
  const viewer = await getViewer();
  if (!viewer)
    return (
      <div className="card mt-4 max-w-2xl p-[18px]">
        <div className="card-title">Vous cherchez une équipe ?</div>
        <p className="mt-1 text-sm text-silver">Créez un compte pour rejoindre une structure, postuler aux annonces ou publier votre profil de joueur.</p>
        <div className="mt-3 flex gap-2">
          <Link href="/inscription" className="btn btn-primary">Rejoindre RushXP</Link>
          <Link href="/connexion?next=/recrutement" className="btn btn-tertiary">Se connecter</Link>
        </div>
      </div>
    );

  const [invitations, requests] = await Promise.all([getMyInvitations(viewer.id), getMyRequests(viewer.id)]);
  const inbox = invitations.map((i) => ({
    id: i.id,
    structure: i.structure.name,
    tag: i.structure.tag,
    roster: i.roster?.name ?? null,
    game: i.roster?.game ?? null,
    by: i.invitedBy.pseudo,
    role: i.memberRole,
  }));
  const structureId = viewer.structure?.id ?? viewer.club?.id;
  const s = structureId ? await getTeamStructure(structureId) : null;
  const isStaff = !!s && s.staff.some((x) => x.userId === viewer.id);

  if (!s)
    return (
      <div className="mt-4 grid items-start gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,360px),1fr))]">
        <div className="grid gap-4">
          <MyInvitations items={inbox} />
          <JoinByCode pending={requests.map((r) => ({ id: r.id, structure: r.structure.name }))} />
        </div>
        <div className="grid gap-4">
          <section className="card p-[18px]">
            <div className="card-title">Agent libre</div>
            <p className="mt-1 text-sm text-silver">Vous n’êtes sous contrat avec aucune structure : vous pouvez signer à tout moment de l’année.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href="/recrutement?tab=annonces" className="btn btn-primary">Voir les annonces</Link>
              <Link href="/structure/nouvelle" className="btn btn-tertiary">Créer ma structure</Link>
            </div>
          </section>
          <RosterRules />
        </div>
      </div>
    );

  const rosters = s.rosters.map((r) => ({
    id: r.id,
    name: r.name,
    game: r.game,
    rosterSize: r.gameRef.rosterSize,
    captainId: r.captainId,
    members: r.members.map((m) => ({ userId: m.userId, pseudo: m.user.pseudo, role: m.role })),
  }));
  const canEditRoster = (r: (typeof rosters)[number]) => isStaff || r.captainId === viewer.id;
  const teamsOf = (userId: string) =>
    rosters.filter((r) => r.members.some((m) => m.userId === userId)).map((r) => `${r.name} (${getGame(r.game)?.short})`).join(", ");
  const effectif = s.members.map((m) => ({ userId: m.userId, pseudo: m.user.pseudo, teams: teamsOf(m.userId) }));
  const pending = s.invitations.map((i) => ({
    id: i.id,
    kind: i.kind,
    pseudo: i.user.pseudo,
    detail:
      i.kind === "REQUEST"
        ? `Demande via le code d’invitation · ${fmtDate(i.createdAt)}`
        : `${i.roster ? `${i.roster.name} (${getGame(i.roster.game)?.short}) · ` : ""}${i.memberRole === "SUB" ? "remplaçant" : "titulaire"} · envoyée le ${fmtDate(i.createdAt)}`,
  }));
  const invitable = rosters.filter(canEditRoster).map((r) => ({ id: r.id, label: `${r.name} · ${getGame(r.game)?.name}` }));

  return (
    <div className="mt-4 grid items-start gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,360px),1fr))] xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="grid min-w-0 gap-4">
        <MyInvitations items={inbox} />
        <div className="card flex flex-wrap items-center gap-3 px-[18px] py-3.5">
          <span className="clip-corner-sm grid h-12 w-12 flex-none place-items-center border border-orange bg-bg font-display text-lg font-extrabold">{s.tag}</span>
          <span className="min-w-0 flex-1">
            <span className="block font-display text-[26px] font-extrabold leading-none">{s.name}</span>
            <span className="block text-xs text-grey">
              {isStaff ? "Vous êtes gestionnaire" : "Vous êtes sous contrat"} · {s.status === "VERIFIED" ? "✓ Structure vérifiée" : s.status === "PENDING" ? "En vérification par RushXP" : "Brouillon"}
            </span>
          </span>
          {isStaff && (
            <span className="text-[13px] text-silver">
              Code d’invitation : <strong className="font-mono text-orange">{s.inviteCode}</strong>
            </span>
          )}
          <Link href={`/structure/${s.tag}`} className="text-[13px] font-semibold">Page publique →</Link>
        </div>
        {rosters.map((r) => (
          <RosterCard
            key={r.id}
            r={r}
            canEdit={isStaff}
            freeAgents={effectif.filter((m) => !rosters.some((x) => x.game === r.game && x.members.some((mm) => mm.userId === m.userId)))}
          />
        ))}
        {rosters.length === 0 && <div className="card"><Empty>Aucune équipe. Ajoutez une équipe pour commencer.</Empty></div>}
      </div>
      <div className="grid gap-4">
        {isStaff && <AddTeamForm structureId={s.id} />}
        {invitable.length > 0 && <InvitePlayerForm rosters={invitable} />}
        {isStaff && <PendingRequests items={pending} />}
        {isStaff && <Effectif structureId={s.id} members={effectif} />}
        <RosterRules />
      </div>
    </div>
  );
}

function RosterRules() {
  return (
    <section className="card grid gap-1.5 p-[18px] text-[13px] text-silver">
      <span className="overline">Règles de roster</span>
      <span>Agent libre : peut signer toute l’année.</span>
      <span>Pas de mercato : un joueur peut changer de structure toute l’année. En rejoignant une nouvelle structure, il quitte automatiquement l’ancienne.</span>
      <span>Un joueur ne dispute les Playoffs que pour une seule équipe par saison.</span>
      <span>Un joueur n’est que dans une seule équipe par jeu. Jusqu’à 2 remplaçants par roster.</span>
      <span>Le capitaine lance les défis et valide les résultats.</span>
    </section>
  );
}

async function AdsTab({ game, type }: { game?: string; type?: string }) {
  const viewer = await getViewer();
  const g = getGame(game ?? "");
  const kind = type === "joueurs" ? "PLAYER" : type === "structures" ? "STRUCTURE" : null;
  const [all, mine] = await Promise.all([getAds(g?.id), viewer ? getMyAds(viewer.id) : Promise.resolve([])]);
  const ads = kind ? all.filter((a) => a.kind === kind) : all;
  const q = (o: { jeu?: string; type?: string }) => {
    const p = new URLSearchParams({ tab: "annonces" });
    const jeu = "jeu" in o ? o.jeu : g?.id;
    const ty = "type" in o ? o.type : type;
    if (jeu) p.set("jeu", jeu);
    if (ty) p.set("type", ty);
    return `/recrutement?${p}`;
  };
  const now = new Date();

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center gap-2">
        {[
          [undefined, `Toutes · ${all.length}`],
          ["structures", `Structures qui recrutent · ${all.filter((a) => a.kind === "STRUCTURE").length}`],
          ["joueurs", `Joueurs disponibles · ${all.filter((a) => a.kind === "PLAYER").length}`],
        ].map(([k, l]) => (
          <Link key={l} href={q({ type: k })} className={`btn btn-sm ${type === k || (!type && !k) ? "btn-secondary" : "btn-tertiary"}`}>{l}</Link>
        ))}
        <span className="flex-1" />
        <nav className="flex flex-wrap gap-1" aria-label="Filtrer par jeu">
          <Link href={q({ jeu: undefined })} className={`btn btn-sm ${!g ? "btn-secondary" : "btn-tertiary"}`}>Tous les jeux</Link>
          {GAMES.map((x) => (
            <Link key={x.id} href={q({ jeu: x.id })} className={`btn btn-sm ${g?.id === x.id ? "btn-secondary" : "btn-tertiary"}`}>{x.short}</Link>
          ))}
        </nav>
      </div>
      <div className="mt-4 grid items-start gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,360px),1fr))] xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="grid min-w-0 gap-3">
          {ads.map((a) => {
            const gm = getGame(a.game);
            return (
              <article key={a.id} className="card">
                <div className="flex items-center gap-3 border-b border-surface-2 px-[18px] py-3">
                  {gm && <Image src={gm.logo} alt={gm.name} width={40} height={26} className="h-[26px] w-10 object-contain" />}
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{a.kind === "STRUCTURE" ? `${a.structure?.name ?? a.author.pseudo} recrute · ${a.role}` : `${a.author.pseudo} cherche une équipe · ${a.role}`}</span>
                    <span className="block text-xs text-grey">{gm?.name} · publiée le {fmtDate(a.createdAt)}</span>
                  </span>
                  <span className="badge text-silver">{a.level}</span>
                </div>
                <p className="whitespace-pre-line px-[18px] py-3 text-sm text-silver">{a.text}</p>
                <div className="flex flex-wrap items-center gap-2 border-t border-surface-2 px-[18px] py-2.5">
                  <span className="flex-1 text-xs text-grey">Disponibilités · {a.availability}</span>
                  {viewer && viewer.id !== a.authorId ? (
                    <Link href={`/messages?a=${encodeURIComponent(a.author.pseudo)}`} className="btn btn-primary btn-sm">{a.kind === "STRUCTURE" ? "Postuler" : "Contacter"}</Link>
                  ) : !viewer ? (
                    <Link href="/connexion?next=/recrutement?tab=annonces" className="btn btn-tertiary btn-sm">Se connecter pour répondre</Link>
                  ) : null}
                </div>
              </article>
            );
          })}
          {ads.length === 0 && <div className="card"><Empty>Aucune annonce publiée{g ? ` pour ${g.name}` : ""} pour le moment.</Empty></div>}
        </div>
        <div className="grid gap-4">
          {viewer ? (
            <>
              <PostAdForm canStructure={!!viewer.structure} />
              <MyAds items={mine.map((m) => ({ id: m.id, title: `${getGame(m.game)?.short} · ${m.role}`, moderation: m.moderation, expired: m.expiresAt < now }))} />
            </>
          ) : (
            <section className="card grid gap-2 p-[18px]">
              <span className="card-title">Vous cherchez une équipe ?</span>
              <span className="text-sm text-silver">Créez un compte pour postuler aux annonces ou publier votre profil de joueur.</span>
              <Link href="/inscription" className="btn btn-primary justify-self-start">Rejoindre RushXP</Link>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

async function TransfersTab() {
  const transfers = await getTransfers();
  const KIND = { SIGNING: ["↗", "Signature"], TRANSFER: ["⇄", "Transfert"], RELEASE: ["↘", "Libération"] } as const;
  return (
    <div className="mt-4 grid gap-4">
      <div className="border border-line bg-surface px-[18px] py-3.5">
        <div className="font-display text-xl font-bold">Transferts libres toute l’année</div>
        <div className="text-sm text-silver">
          RushXP est un circuit amateur : il n’y a pas de mercato. Un joueur rejoint une structure en acceptant une invitation ou avec son code d’invitation ; il quitte alors automatiquement sa structure précédente, dont les gestionnaires sont prévenus. Seule limite : un joueur ne dispute les Playoffs que pour une seule équipe par saison.
        </div>
      </div>
      <section className="card">
        <div className="card-head"><span className="card-title">Transferts et signatures</span><span className="card-meta">Validés par RushXP · publics</span></div>
        {transfers.map((t) => (
          <div key={t.id} className="list-row grid grid-cols-[90px_110px_minmax(0,1fr)] items-center gap-3 text-sm">
            <span className="text-xs text-grey">{fmtDate(t.createdAt)}</span>
            <span className="text-xs font-bold uppercase tracking-[.06em] text-silver">{KIND[t.kind][0]} {KIND[t.kind][1]}</span>
            <span className="min-w-0 truncate">
              <Link href={`/joueur/${encodeURIComponent(t.user.pseudo)}`} className="font-semibold text-ink hover:text-orange">{t.user.pseudo}</Link>{" "}
              <span className="text-grey">
                · {t.kind === "RELEASE" ? `quitte ${t.fromStructure?.name ?? "sa structure"}` : `${t.fromStructure?.name ?? "agent libre"} → ${t.toStructure.name}`}
              </span>
            </span>
          </div>
        ))}
        {transfers.length === 0 && <Empty>Aucun mouvement pour le moment.</Empty>}
      </section>
    </div>
  );
}
