"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import {
  addTeamAction,
  assignMemberAction,
  cancelInvitationAction,
  deleteAdAction,
  invitePlayerAction,
  postAdAction,
  releasePlayerAction,
  removeFromRosterAction,
  requestJoinAction,
  respondInvitationAction,
  setCaptainAction,
  toggleMemberRoleAction,
} from "@/lib/team/actions";
import { GAMES, getGame } from "@/lib/data/games";
import { Field, FormError, Select, TextArea, TextInput } from "@/components/forms";
import { useServerAction } from "@/components/useServerAction";

type Role = "STARTER" | "SUB";

function Feedback({ errors, message }: { errors: Record<string, string>; message: string | null }) {
  return (
    <>
      <FormError message={errors._} />
      {message && (
        <div role="status" className="border border-orange bg-active-tint px-3.5 py-2.5 text-[13px]">
          {message}
        </div>
      )}
    </>
  );
}

// ─── Invitations reçues (joueur) ────────────────────────────────

export interface InvitationView {
  id: string;
  structure: string;
  tag: string;
  roster: string | null;
  game: string | null;
  by: string;
  role: Role;
}

export function MyInvitations({ items }: { items: InvitationView[] }) {
  const a = useServerAction(respondInvitationAction);
  if (!items.length)
    return a.message ? <div role="status" className="border border-orange bg-active-tint px-4 py-2.5 text-sm">{a.message}</div> : null;
  return (
    <section className="card border-t-2 !border-t-orange">
      <div className="card-head"><span className="card-title">Invitations reçues</span><span className="card-meta">{items.length}</span></div>
      <div className="grid gap-2 px-[18px] pt-3"><Feedback errors={a.errors} message={a.message} /></div>
      {items.map((i) => (
        <div key={i.id} className="flex flex-wrap items-center gap-3 border-b border-surface-2 px-[18px] py-3">
          <span className="clip-corner-sm grid h-10 w-10 flex-none place-items-center bg-surface-2 font-display text-sm font-bold">{i.tag}</span>
          <div className="min-w-0 flex-[1_1_220px]">
            <div className="font-semibold">{i.structure}</div>
            <div className="text-xs text-grey">
              Invité par {i.by}
              {i.roster ? ` · ${i.roster} (${getGame(i.game ?? "")?.name ?? i.game}) · ${i.role === "SUB" ? "remplaçant" : "titulaire"}` : ""}
            </div>
          </div>
          <div className="flex gap-1.5">
            <button className="btn btn-primary btn-sm" disabled={a.pending} onClick={() => a.run({ id: i.id, accept: true })}>Accepter</button>
            <button className="btn btn-tertiary btn-sm" disabled={a.pending} onClick={() => a.run({ id: i.id, accept: false })}>Décliner</button>
          </div>
        </div>
      ))}
    </section>
  );
}

// ─── Sans structure ─────────────────────────────────────────────

export function JoinByCode({ pending: pendingRequests }: { pending: { id: string; structure: string }[] }) {
  const [code, setCode] = useState("");
  const a = useServerAction(requestJoinAction);
  const cancel = useServerAction(cancelInvitationAction);
  return (
    <section className="card">
      <div className="card-head"><span className="card-title">Rejoindre une structure</span></div>
      <form
        className="grid gap-3 p-[18px]"
        onSubmit={(e) => {
          e.preventDefault();
          a.run(code);
        }}
      >
        <Feedback errors={{ _: a.errors._ ?? cancel.errors._ }} message={a.message ?? cancel.message} />
        <Field label="Code d’invitation" error={a.errors.code} hint="Votre capitaine ou gestionnaire vous le donne (ex. NVA-7K2Q).">
          {(p) => <TextInput {...p} className="font-mono uppercase" value={code} onChange={(e) => setCode(e.target.value)} placeholder="ex. NVA-7K2Q" />}
        </Field>
        <button className="btn btn-primary justify-self-start" disabled={a.pending}>Envoyer ma demande</button>
      </form>
      {pendingRequests.map((r) => (
        <div key={r.id} className="flex items-center justify-between gap-3 border-t border-surface-2 px-[18px] py-2.5 text-sm">
          <span>Demande envoyée à <strong>{r.structure}</strong> · <span className="text-grey">en attente</span></span>
          <button className="btn btn-tertiary btn-sm" onClick={() => cancel.run(r.id)} disabled={cancel.pending}>Annuler</button>
        </div>
      ))}
    </section>
  );
}

// ─── Gestion de la structure ────────────────────────────────────

export interface RosterView {
  id: string;
  name: string;
  game: string;
  rosterSize: number;
  captainId: string | null;
  members: { userId: string; pseudo: string; role: Role }[];
}

export function RosterCard({ r, canEdit, freeAgents }: { r: RosterView; canEdit: boolean; freeAgents: { userId: string; pseudo: string }[] }) {
  const g = getGame(r.game);
  const starters = r.members.filter((m) => m.role === "STARTER").length;
  const subs = r.members.length - starters;
  const complete = starters >= r.rosterSize;
  // Un seul message à la fois : celui de la dernière action.
  const [last, setLast] = useState<{ ok: boolean; text: string } | null>(null);
  const onDone = (r: { ok: boolean; message?: string; errors?: Record<string, string> }) => setLast(r.ok ? (r.message ? { ok: true, text: r.message } : null) : { ok: false, text: r.errors?._ ?? "Erreur." });
  const toggle = useServerAction(toggleMemberRoleAction, { onDone });
  const capt = useServerAction(setCaptainAction, { onDone });
  const remove = useServerAction(removeFromRosterAction, { onDone });
  const assign = useServerAction(assignMemberAction, { onDone });
  const [pick, setPick] = useState("");
  const [pickRole, setPickRole] = useState<Role>("STARTER");


  return (
    <section className="card">
      <div className="flex items-center gap-3 border-b border-line px-[18px] py-3">
        {g && <Image src={g.logo} alt="" width={40} height={26} className="h-[26px] w-10 object-contain" />}
        <span className="min-w-0 flex-1">
          <span className="block truncate font-display text-lg font-bold">{r.name}</span>
          <span className="block text-xs text-grey">{g?.name} · {starters}/{r.rosterSize} titulaire(s) · {subs}/2 remplaçant(s)</span>
        </span>
        <span className={`badge ${complete ? "text-orange" : "text-red"}`}>{complete ? "✓ Complet" : "Incomplet"}</span>
      </div>
      {last && <div className="px-[18px] pt-3"><Feedback errors={last.ok ? {} : { _: last.text }} message={last.ok ? last.text : null} /></div>}
      {r.members.map((m) => (
        <div key={m.userId} className="list-row flex flex-wrap items-center gap-2.5">
          <span className="grid h-8 w-8 flex-none place-items-center bg-surface-2 font-display text-sm font-bold">{m.pseudo.slice(0, 2).toUpperCase()}</span>
          <Link href={`/joueur/${encodeURIComponent(m.pseudo)}`} className="font-semibold text-ink hover:text-orange">{m.pseudo}</Link>
          <span className="text-xs text-grey">· {m.role === "STARTER" ? "Titulaire" : "Remplaçant"}</span>
          {r.captainId === m.userId && <span className="badge text-yellow">Capitaine</span>}
          {canEdit && (
            <span className="ml-auto flex flex-wrap gap-1.5">
              <button className="btn btn-tertiary btn-sm" disabled={toggle.pending} onClick={() => toggle.run({ rosterId: r.id, userId: m.userId })}>
                {m.role === "STARTER" ? "Passer remplaçant" : "Passer titulaire"}
              </button>
              {r.captainId !== m.userId && (
                <button className="btn btn-tertiary btn-sm" disabled={capt.pending} onClick={() => capt.run({ rosterId: r.id, userId: m.userId })}>Nommer capitaine</button>
              )}
              <button className="btn btn-danger btn-sm" disabled={remove.pending} onClick={() => remove.run({ rosterId: r.id, userId: m.userId })}>Retirer</button>
            </span>
          )}
        </div>
      ))}
      {r.members.length === 0 && <div className="px-[18px] py-3 text-[13px] text-grey">Aucun joueur. Invitez un joueur ou publiez une annonce.</div>}
      {canEdit && freeAgents.length > 0 && (
        <form
          className="flex flex-wrap items-end gap-2 border-t border-surface-2 px-[18px] py-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (pick && (await assign.run({ rosterId: r.id, userId: pick, role: pickRole }))) setPick("");
          }}
        >
          <label className="grid min-w-[160px] flex-1 gap-1">
            <span className="overline">Ajouter depuis l’effectif</span>
            <Select value={pick} onChange={(e) => setPick(e.target.value)}>
              <option value="">Choisir un joueur…</option>
              {freeAgents.map((f) => <option key={f.userId} value={f.userId}>{f.pseudo}</option>)}
            </Select>
          </label>
          <Select className="!w-auto" aria-label="Rôle" value={pickRole} onChange={(e) => setPickRole(e.target.value as Role)}>
            <option value="STARTER">Titulaire</option>
            <option value="SUB">Remplaçant</option>
          </Select>
          <button className="btn btn-secondary" disabled={!pick || assign.pending}>Ajouter</button>
        </form>
      )}
    </section>
  );
}

export function AddTeamForm({ structureId }: { structureId: string }) {
  const [game, setGame] = useState(GAMES[0].id as string);
  const [name, setName] = useState("");
  const a = useServerAction(addTeamAction);
  return (
    <section className="card">
      <div className="card-head"><span className="card-title">Ajouter une équipe</span></div>
      <form
        className="grid gap-3 p-[18px]"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await a.run({ structureId, game, name })) setName("");
        }}
      >
        <Feedback errors={{ _: a.errors._ }} message={a.message} />
        <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(140px,1fr))]">
          <Field label="Jeu" error={a.errors.game}>
            {(p) => (
              <Select {...p} value={game} onChange={(e) => setGame(e.target.value)}>
                {GAMES.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </Select>
            )}
          </Field>
          <Field label="Nom de l’équipe" error={a.errors.name}>
            {(p) => <TextInput {...p} value={name} onChange={(e) => setName(e.target.value)} placeholder="ex. Academy" />}
          </Field>
        </div>
        <span className="text-xs text-grey">Plusieurs équipes par jeu sont possibles. Chacune a son propre classement ; deux équipes d’une même structure ne peuvent pas se défier.</span>
        <button className="btn btn-secondary justify-self-start" disabled={a.pending}>+ Créer l’équipe</button>
      </form>
    </section>
  );
}

export function InvitePlayerForm({ rosters }: { rosters: { id: string; label: string }[] }) {
  const [pseudo, setPseudo] = useState("");
  const [rosterId, setRosterId] = useState(rosters[0]?.id ?? "");
  const [role, setRole] = useState<Role>("STARTER");
  const a = useServerAction(invitePlayerAction);
  if (!rosters.length) return null;
  return (
    <section className="card">
      <div className="card-head"><span className="card-title">Ajouter un joueur</span></div>
      <form
        className="grid gap-3 p-[18px]"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await a.run({ rosterId, pseudo, role })) setPseudo("");
        }}
      >
        <Feedback errors={{ _: a.errors._ }} message={a.message} />
        <Field label="Pseudo RushXP" error={a.errors.pseudo}>
          {(p) => <TextInput {...p} value={pseudo} onChange={(e) => setPseudo(e.target.value)} placeholder="Pseudo du joueur" />}
        </Field>
        <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(140px,1fr))]">
          <Field label="Roster">
            {(p) => (
              <Select {...p} value={rosterId} onChange={(e) => setRosterId(e.target.value)}>
                {rosters.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
              </Select>
            )}
          </Field>
          <Field label="Rôle">
            {(p) => (
              <Select {...p} value={role} onChange={(e) => setRole(e.target.value as Role)}>
                <option value="STARTER">Titulaire</option>
                <option value="SUB">Remplaçant</option>
              </Select>
            )}
          </Field>
        </div>
        <span className="text-xs text-grey">Un joueur déjà sous contrat avec votre structure est ajouté directement. Les autres reçoivent une invitation.</span>
        <button className="btn btn-primary justify-self-start" disabled={a.pending}>Envoyer l’invitation</button>
      </form>
    </section>
  );
}

export interface PendingView {
  id: string;
  kind: "INVITE" | "REQUEST";
  pseudo: string;
  detail: string;
}

export function PendingRequests({ items }: { items: PendingView[] }) {
  const respond = useServerAction(respondInvitationAction);
  const cancel = useServerAction(cancelInvitationAction);
  return (
    <section className="card">
      <div className="card-head"><span className="card-title">Demandes en cours</span><span className="card-meta">{items.length}</span></div>
      {(respond.errors._ || cancel.errors._ || respond.message) && (
        <div className="px-[18px] pt-3"><Feedback errors={{ _: respond.errors._ ?? cancel.errors._ }} message={respond.message} /></div>
      )}
      {items.map((d) => (
        <div key={d.id} className="flex flex-wrap items-center gap-2.5 border-b border-surface-2 px-[18px] py-2.5">
          <span className="min-w-0 flex-[1_1_180px]">
            <span className="block text-sm font-semibold">{d.kind === "REQUEST" ? "Demande" : "Invitation"} · {d.pseudo}</span>
            <span className="block text-xs text-grey">{d.detail}</span>
          </span>
          {d.kind === "REQUEST" ? (
            <span className="flex gap-1.5">
              <button className="btn btn-primary btn-sm" disabled={respond.pending} onClick={() => respond.run({ id: d.id, accept: true })}>Accepter</button>
              <button className="btn btn-tertiary btn-sm" disabled={respond.pending} onClick={() => respond.run({ id: d.id, accept: false })}>Refuser</button>
            </span>
          ) : (
            <button className="btn btn-tertiary btn-sm" disabled={cancel.pending} onClick={() => cancel.run(d.id)}>Annuler</button>
          )}
        </div>
      ))}
      {items.length === 0 && <div className="px-[18px] py-3 text-[13px] text-grey">Aucune demande en attente.</div>}
    </section>
  );
}

export function Effectif({ structureId, members }: { structureId: string; members: { userId: string; pseudo: string; teams: string }[] }) {
  const a = useServerAction(releasePlayerAction);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  return (
    <section className="card">
      <div className="card-head"><span className="card-title">Effectif sous contrat</span><span className="card-meta">{members.length} joueur(s)</span></div>
      {(a.errors._ || a.message) && <div className="px-[18px] pt-3"><Feedback errors={a.errors} message={a.message} /></div>}
      {members.map((m) => (
        <div key={m.userId} className="list-row flex flex-wrap items-center gap-2.5">
          <Link href={`/joueur/${encodeURIComponent(m.pseudo)}`} className="font-semibold text-ink hover:text-orange">{m.pseudo}</Link>
          <span className="flex-1 text-xs text-grey">{m.teams || "Sans roster"}</span>
          {confirmId === m.userId ? (
            <span className="flex gap-1.5">
              <button className="btn btn-danger btn-sm" disabled={a.pending} onClick={() => a.run({ structureId, userId: m.userId })}>Confirmer la libération</button>
              <button className="btn btn-tertiary btn-sm" onClick={() => setConfirmId(null)}>Annuler</button>
            </span>
          ) : (
            <button className="btn btn-tertiary btn-sm" onClick={() => setConfirmId(m.userId)}>Libérer</button>
          )}
        </div>
      ))}
      {members.length === 0 && <div className="px-[18px] py-3 text-[13px] text-grey">Aucun joueur sous contrat. Partagez votre code d’invitation ou invitez des joueurs.</div>}
    </section>
  );
}

// ─── Annonces ───────────────────────────────────────────────────

export function PostAdForm({ canStructure }: { canStructure: boolean }) {
  const [f, setF] = useState({ kind: canStructure ? "STRUCTURE" : "PLAYER", game: GAMES[0].id as string, level: "Tous niveaux", role: "", availability: "", text: "" });
  const a = useServerAction(postAdAction);
  const isStruct = f.kind === "STRUCTURE";
  return (
    <section className="card">
      <div className="card-head"><span className="card-title">{isStruct ? "Publier une annonce de recrutement" : "Publier mon profil de joueur"}</span></div>
      <form
        className="grid gap-3 p-[18px]"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await a.run(f)) setF({ ...f, role: "", availability: "", text: "" });
        }}
      >
        <Feedback errors={{ _: a.errors._ }} message={a.message} />
        {canStructure && (
          <div className="flex gap-1.5" role="group" aria-label="Type d’annonce">
            {[["STRUCTURE", "Ma structure recrute"], ["PLAYER", "Je cherche une équipe"]].map(([k, l]) => (
              <button type="button" key={k} aria-pressed={f.kind === k} onClick={() => setF({ ...f, kind: k })} className={`btn btn-sm ${f.kind === k ? "btn-secondary" : "btn-tertiary"}`}>{l}</button>
            ))}
          </div>
        )}
        <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(140px,1fr))]">
          <Field label="Jeu" error={a.errors.game}>
            {(p) => (
              <Select {...p} value={f.game} onChange={(e) => setF({ ...f, game: e.target.value })}>
                {GAMES.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </Select>
            )}
          </Field>
          <Field label="Niveau" error={a.errors.level}>
            {(p) => (
              <Select {...p} value={f.level} onChange={(e) => setF({ ...f, level: e.target.value })}>
                {["Division 1", "Division 2", "Division 3", "Tous niveaux"].map((l) => <option key={l}>{l}</option>)}
              </Select>
            )}
          </Field>
        </div>
        <Field label={isStruct ? "Poste recherché" : "Mon rôle"} error={a.errors.role}>
          {(p) => <TextInput {...p} value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })} placeholder={isStruct ? "ex. Duelliste, IGL…" : "ex. Contrôleur, flex"} />}
        </Field>
        <Field label="Disponibilités" error={a.errors.availability}>
          {(p) => <TextInput {...p} value={f.availability} onChange={(e) => setF({ ...f, availability: e.target.value })} placeholder="ex. Mar. et jeu. 20h–23h" />}
        </Field>
        <Field label="Message" error={a.errors.text}>
          {(p) => <TextArea {...p} rows={3} value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} placeholder={isStruct ? "Ambiance, objectifs, attentes…" : "Expérience, objectifs, ce que vous cherchez…"} />}
        </Field>
        <button className="btn btn-primary justify-self-start" disabled={a.pending}>Publier l’annonce</button>
        <span className="text-xs text-grey">Les annonces sont vérifiées par l’équipe RushXP avant publication et expirent après 30 jours.</span>
      </form>
    </section>
  );
}

export function MyAds({ items }: { items: { id: string; title: string; moderation: string; expired: boolean }[] }) {
  const a = useServerAction(deleteAdAction);
  if (!items.length) return null;
  const st = (m: string, expired: boolean): [string, string] =>
    expired ? ["Expirée", "text-grey"] : m === "APPROVED" ? ["✓ Publiée", "text-orange"] : m === "REJECTED" ? ["Refusée", "text-red"] : ["En modération", "text-silver"];
  return (
    <section className="card">
      <div className="card-head"><span className="card-title">Mes annonces</span></div>
      {a.errors._ && <div className="px-[18px] pt-3"><FormError message={a.errors._} /></div>}
      {items.map((ad) => {
        const [l, c] = st(ad.moderation, ad.expired);
        return (
          <div key={ad.id} className="flex flex-wrap items-center gap-2.5 border-b border-surface-2 px-[18px] py-2.5 text-sm">
            <span className="min-w-0 flex-1 truncate">{ad.title}</span>
            <span className={`badge ${c}`}>{l}</span>
            <button className="btn btn-tertiary btn-sm" disabled={a.pending} onClick={() => a.run(ad.id)}>Supprimer</button>
          </div>
        );
      })}
    </section>
  );
}
