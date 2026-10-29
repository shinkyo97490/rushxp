import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getViewer } from "@/lib/auth/viewer";
import { resolvePrivacy } from "@/lib/account/preferences";
import { getGame } from "@/lib/data/games";
import { GAME_LINK } from "@/lib/validation";
import { Empty } from "@/components/PageHeader";

type Params = { params: Promise<{ pseudo: string }> };

async function load(pseudo: string) {
  return db.user.findFirst({
    where: { pseudo: { equals: decodeURIComponent(pseudo), mode: "insensitive" } },
    include: {
      gameAccounts: true,
      contracts: { include: { structure: { select: { name: true, tag: true, status: true } } }, orderBy: { joinedAt: "desc" } },
      memberships: { where: { leftAt: null }, include: { roster: { select: { id: true, name: true, game: true, captainId: true } } } },
      structureStaff: { include: { structure: { select: { name: true, tag: true } } } },
    },
  });
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const u = await load((await params).pseudo);
  return { title: u ? u.pseudo : "Joueur introuvable" };
}

const fmt = (d: Date) => new Intl.DateTimeFormat("fr-FR", { month: "short", year: "numeric" }).format(d);

export default async function PlayerPage({ params }: Params) {
  const u = await load((await params).pseudo);
  if (!u || u.pseudo.startsWith("supprime-")) notFound();
  const viewer = await getViewer();
  const isMe = viewer?.id === u.id;
  const privacy = resolvePrivacy(u.privacy);
  const club = u.contracts.find((c) => !c.leftAt)?.structure ?? null;
  // Visibilité du profil (Paramètres · Confidentialité).
  const sameClub = !!club && viewer?.club?.tag === club.tag;
  const visible = isMe || privacy.profile === "Public" || (privacy.profile === "Membres RushXP" && !!viewer) || (privacy.profile === "Ma structure" && sameClub);
  const teams = u.memberships.map((m) => ({ ...m.roster, role: m.role, isCap: m.roster.captainId === u.id }));
  const main = teams[0] ? getGame(teams[0].game) : null;
  const xpNext = 3000;

  return (
    <main className="pb-16">
      <section className="relative overflow-hidden border-b border-line bg-black">
        <Image src="/assets/photo-dsc05885.jpg" alt="" fill className="object-cover opacity-30" sizes="100vw" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,#000_10%,rgba(0,0,0,.6)_60%,rgba(0,0,0,.85))]" />
        <div className="hero-pattern absolute inset-0" />
        <div className="container-rx relative flex flex-wrap items-end gap-6 py-10">
          <div className="clip-corner img-placeholder relative h-[150px] w-[130px] flex-none border border-line">
            <span className="font-display text-4xl font-extrabold text-ink">{u.pseudo.slice(0, 2).toUpperCase()}</span>
          </div>
          <div className="min-w-0 flex-[1_1_320px]">
            <div className="flex flex-wrap items-center gap-2">
              {main && <Image src={main.logo} alt="" width={28} height={20} className="h-5 w-7 object-contain" />}
              <span className="text-[13px] font-semibold uppercase tracking-[.12em] text-silver">
                {main ? `${main.name} · ${teams[0].role === "SUB" ? "Remplaçant" : "Titulaire"}` : u.structureStaff.length ? "Gestionnaire de structure" : "Joueur"}
              </span>
              {teams.some((t) => t.isCap) && <span className="badge text-yellow">Capitaine</span>}
            </div>
            <h1 className="font-display mt-1 text-[clamp(48px,7vw,72px)] font-extrabold leading-[.9]">{u.pseudo}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              {club ? (
                <Link href={`/structure/${club.tag}`} className="flex items-center gap-2 text-ink hover:text-orange">
                  <span className="bg-surface-2 px-1.5 py-0.5 font-mono text-[11px]">{club.tag}</span>
                  <span className="font-semibold">{club.name}</span>
                  <span>→</span>
                </Link>
              ) : (
                <span className="text-silver">Agent libre</span>
              )}
              <span className="text-grey">· {u.region === "RE" ? "Île de La Réunion" : u.region}</span>
            </div>
            <div className="mt-3 max-w-[360px]">
              <div className="flex justify-between text-xs text-grey"><span>Niveau XP {u.level}</span><span>{u.xp} / {xpNext.toLocaleString("fr-FR")} XP</span></div>
              <div className="mt-1 h-1 bg-surface-2"><div className="h-full bg-orange" style={{ width: `${Math.min(100, (u.xp / xpNext) * 100)}%` }} /></div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {isMe ? (
              <Link href="/parametres" className="btn btn-tertiary">Paramètres du compte →</Link>
            ) : viewer && privacy.dm !== "Personne" ? (
              <Link href={`/messages?a=${encodeURIComponent(u.pseudo)}`} className="btn btn-secondary">Envoyer un message</Link>
            ) : null}
          </div>
        </div>
        <div className="container-rx relative grid border-t border-line [grid-template-columns:repeat(auto-fit,minmax(min(100%,160px),1fr))]">
          {[
            ["Équipes", String(teams.length), teams.map((t) => getGame(t.game)?.short).join(" · ") || "—"],
            ["Matchs validés", "0", "saison en cours"],
            ["Comptes liés", String(u.gameAccounts.filter((g) => g.externalId).length), `${u.gameAccounts.filter((g) => g.verifiedAt).length} vérifié(s)`],
            ["Membre depuis", fmt(u.createdAt), ""],
          ].map(([k, v, s]) => (
            <div key={k} className="border-r border-line px-4 py-3">
              <div className="overline !font-normal">{k}</div>
              <div className="font-display text-[26px] font-extrabold">{v}</div>
              <div className="text-xs text-grey">{s}</div>
            </div>
          ))}
        </div>
      </section>

      {!visible ? (
        <div className="container-rx mt-6">
          <div className="card"><Empty>Ce joueur a limité la visibilité de son profil{privacy.profile === "Membres RushXP" ? " aux membres RushXP : connectez-vous pour le voir" : " à sa structure"}.</Empty></div>
        </div>
      ) : (
        <div className="container-rx mt-6 grid items-start gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr))] lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="grid min-w-0 gap-4">
            {u.bio && (
              <section className="card p-[18px]">
                <div className="overline mb-1">Bio</div>
                <p className="whitespace-pre-line text-sm text-silver">{u.bio}</p>
              </section>
            )}
            <section className="card">
              <div className="card-head"><span className="card-title">Équipes actuelles</span></div>
              {teams.map((t) => {
                const g = getGame(t.game);
                return (
                  <div key={t.id} className="list-row flex items-center gap-3">
                    {g && <Image src={g.logo} alt="" width={36} height={24} className="h-6 w-9 object-contain" />}
                    <span className="flex-1">
                      <span className="block font-semibold">{t.name}</span>
                      <span className="block text-xs text-grey">{g?.name} · {t.role === "SUB" ? "Remplaçant" : "Titulaire"}</span>
                    </span>
                    {t.isCap && <span className="badge text-yellow">Capitaine</span>}
                  </div>
                );
              })}
              {teams.length === 0 && <Empty>Aucune équipe pour le moment.</Empty>}
            </section>
            <section className="card">
              <div className="card-head"><span className="card-title">Derniers matchs</span><span className="card-meta">Matchs validés uniquement</span></div>
              <Empty>Aucun match validé pour l’instant. Les statistiques propres à chaque jeu (KDA, ACS, compositions…) s’affichent après les premiers matchs officiels.</Empty>
            </section>
          </div>
          <div className="grid gap-4">
            <section className="card">
              <div className="card-head"><span className="card-title">Parcours</span></div>
              {u.contracts.map((c) => (
                <div key={c.id} className="flex items-center gap-3 border-b border-surface-2 px-[18px] py-2.5">
                  <span className={`h-2 w-2 flex-none ${c.leftAt ? "bg-[#5a5a5a]" : "bg-orange"}`} />
                  <span>
                    <span className="block text-sm font-semibold">{c.structure.name}</span>
                    <span className="block text-xs text-grey">{fmt(c.joinedAt)} → {c.leftAt ? fmt(c.leftAt) : "aujourd’hui"}</span>
                  </span>
                </div>
              ))}
              {u.structureStaff.map((s) => (
                <div key={s.structureId} className="flex items-center gap-3 border-b border-surface-2 px-[18px] py-2.5">
                  <span className="h-2 w-2 flex-none bg-yellow" />
                  <span>
                    <span className="block text-sm font-semibold">{s.structure.name}</span>
                    <span className="block text-xs text-grey">{s.role === "OWNER" ? "Fondateur · gestionnaire" : "Gestionnaire"}</span>
                  </span>
                </div>
              ))}
              {u.contracts.length + u.structureStaff.length === 0 && <Empty>Agent libre depuis l’inscription.</Empty>}
            </section>
            <section className="card">
              <div className="card-head"><span className="card-title">Comptes de jeu</span></div>
              {u.gameAccounts.filter((a) => a.externalId).map((a) => (
                <div key={a.game} className="flex justify-between gap-3 border-b border-surface-2 px-[18px] py-2.5 text-sm">
                  <span className="text-grey">{getGame(a.game)?.name} · {GAME_LINK[a.game]?.label}</span>
                  <span className="font-mono">{a.externalId} {a.verifiedAt ? <span className="text-orange">✓</span> : <span className="text-xs text-grey">(non vérifié)</span>}</span>
                </div>
              ))}
              {!u.gameAccounts.some((a) => a.externalId) && <Empty>Aucun compte lié.</Empty>}
              <div className="px-[18px] py-2.5 text-xs text-grey">Liaison vérifiée nécessaire pour la lecture automatique des résultats.</div>
            </section>
          </div>
        </div>
      )}
    </main>
  );
}
