"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  broadcastAction,
  createSanctionAction,
  liftSanctionAction,
  moderateAdAction,
  reviewStructureAction,
  setUserRoleAction,
  setUserStatusAction,
  updateGameFormatAction,
} from "@/lib/admin/actions";
import { Field, FormError, Select, TextArea, TextInput } from "@/components/forms";
import { useServerAction } from "@/components/useServerAction";

/** Après une action qui retire l'élément de la liste, le message s'affiche en bannière de page. */
function useFlash() {
  const router = useRouter();
  return (message?: string | null) => {
    const u = new URL(window.location.href);
    if (message) u.searchParams.set("msg", message);
    router.replace(`${u.pathname}?${u.searchParams}`, { scroll: false });
  };
}

function Msg({ a }: { a: { errors: Record<string, string>; message: string | null } }) {
  if (a.errors._) return <FormError message={a.errors._} />;
  return a.message ? <span role="status" className="text-[13px] text-orange">{a.message}</span> : null;
}

export function StructureReview({ id, name }: { id: string; name: string }) {
  const a = useServerAction(reviewStructureAction);
  const flash = useFlash();
  const [rejecting, setRejecting] = useState(false);
  const run = async (input: Parameters<typeof reviewStructureAction>[0]) => {
    if (await a.run(input)) flash(input.approve ? `${name} vérifiée : sa page est publique.` : `${name} renvoyée en brouillon.`);
  };
  const [reason, setReason] = useState("");
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-1.5">
        <button className="btn btn-primary btn-sm" disabled={a.pending} onClick={() => run({ id, approve: true })}>Vérifier</button>
        <button className="btn btn-tertiary btn-sm" onClick={() => setRejecting((r) => !r)}>Refuser</button>
      </div>
      {rejecting && (
        <form
          className="flex flex-wrap gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            run({ id, approve: false, reason });
          }}
        >
          <TextInput aria-label={`Motif du refus pour ${name}`} className="!h-9 min-w-[200px] flex-1" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motif (envoyé au gestionnaire)" aria-invalid={!!a.errors.reason} />
          <button className="btn btn-danger btn-sm" disabled={a.pending}>Confirmer le refus</button>
        </form>
      )}
      {a.errors.reason && <span className="text-[13px] text-red">{a.errors.reason}</span>}
      <Msg a={a} />
    </div>
  );
}

export function UserControls({ id, role, status, self }: { id: string; role: string; status: string; self: boolean }) {
  const r = useServerAction(setUserRoleAction);
  const s = useServerAction(setUserStatusAction);
  const [reason, setReason] = useState("");
  const [suspending, setSuspending] = useState(false);
  return (
    <div className="grid justify-items-end gap-1.5">
      <div className="flex flex-wrap justify-end gap-1.5">
        <Select aria-label="Rôle" className="!h-9 !w-auto" value={role} disabled={r.pending || self} onChange={(e) => r.run({ userId: id, role: e.target.value as "JOUEUR" | "ARBITRE" | "ADMIN" })}>
          <option value="JOUEUR">Membre</option>
          <option value="ARBITRE">Arbitre</option>
          <option value="ADMIN">Admin</option>
        </Select>
        {status === "SUSPENDED" ? (
          <button className="btn btn-secondary btn-sm" disabled={s.pending} onClick={() => s.run({ userId: id, suspend: false })}>Réactiver</button>
        ) : (
          !self && <button className="btn btn-danger btn-sm" onClick={() => setSuspending((x) => !x)}>Suspendre</button>
        )}
      </div>
      {suspending && (
        <form
          className="flex flex-wrap justify-end gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            s.run({ userId: id, suspend: true, reason });
          }}
        >
          <TextInput aria-label="Motif de suspension" className="!h-9 min-w-[200px]" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motif · article du règlement" />
          <button className="btn btn-danger btn-sm" disabled={s.pending}>Confirmer</button>
        </form>
      )}
      <Msg a={{ errors: { ...r.errors, ...s.errors, _: r.errors._ ?? s.errors._ ?? s.errors.reason }, message: r.message ?? s.message }} />
    </div>
  );
}

export function AdModeration({ id }: { id: string }) {
  const a = useServerAction(moderateAdAction);
  const flash = useFlash();
  const run = async (approve: boolean) => {
    if (await a.run({ id, approve })) flash(approve ? "Annonce publiée." : "Annonce refusée.");
  };
  return (
    <div className="grid justify-items-end gap-1.5">
      <div className="flex gap-1.5">
        <button className="btn btn-primary btn-sm" disabled={a.pending} onClick={() => run(true)}>Publier</button>
        <button className="btn btn-danger btn-sm" disabled={a.pending} onClick={() => run(false)}>Refuser</button>
      </div>
      <Msg a={a} />
    </div>
  );
}

const SANCTION_TYPES = ["Avertissement", "Carton jaune", "Carton rouge", "Suspension 1 match", "Suspension 3 matchs", "Pénalité −20 pts"];

export function SanctionForm() {
  const [f, setF] = useState({ target: "", type: SANCTION_TYPES[0], reason: "" });
  const a = useServerAction(createSanctionAction);
  return (
    <form
      className="grid gap-3 p-[18px]"
      onSubmit={async (e) => {
        e.preventDefault();
        if (await a.run(f)) setF({ ...f, target: "", reason: "" });
      }}
    >
      <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
        <Field label="Joueur (pseudo) ou structure (tag)" error={a.errors.target}>
          {(p) => <TextInput {...p} value={f.target} onChange={(e) => setF({ ...f, target: e.target.value })} />}
        </Field>
        <Field label="Type" error={a.errors.type}>
          {(p) => (
            <Select {...p} value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
              {SANCTION_TYPES.map((t) => <option key={t}>{t}</option>)}
            </Select>
          )}
        </Field>
      </div>
      <Field label="Motif (article du règlement)" error={a.errors.reason}>
        {(p) => <TextInput {...p} value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} placeholder="ex. Art. 4.2 · retard au check-in" />}
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn btn-danger" disabled={a.pending}>Appliquer</button>
        <Msg a={{ errors: { _: a.errors._ }, message: a.message }} />
      </div>
      <span className="text-xs text-grey">Le joueur ou les gestionnaires de la structure sont notifiés. Deux cartons jaunes valent une suspension d’un match. Appel possible sous 48 h.</span>
    </form>
  );
}

export function LiftSanction({ id }: { id: string }) {
  const a = useServerAction(liftSanctionAction);
  return <button className="btn btn-tertiary btn-sm" disabled={a.pending} onClick={() => a.run(id)}>Lever</button>;
}

export function GameFormatForm({ g }: { g: { id: string; name: string; rosterSize: number; series: string; lobbySize: string; scale: string; killPoint: number; kind: string } }) {
  const [f, setF] = useState(g);
  const a = useServerAction(updateGameFormatAction);
  const lobby = g.kind === "LOBBY";
  return (
    <form
      className="grid gap-3 border-b border-surface-2 px-[18px] py-4"
      onSubmit={(e) => {
        e.preventDefault();
        a.run(f);
      }}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-display text-lg font-bold">{g.name}</span>
        <span className="text-xs text-grey">{lobby ? "RDV mensuels" : "RushXP Rankings"}</span>
      </div>
      <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(130px,1fr))]">
        <Field label={lobby ? "Joueurs par équipe" : "Titulaires"} error={a.errors.rosterSize}>
          {(p) => <TextInput {...p} type="number" min={1} max={10} value={f.rosterSize} onChange={(e) => setF({ ...f, rosterSize: Number(e.target.value) })} />}
        </Field>
        {!lobby && (
          <Field label="Série" error={a.errors.series}>
            {(p) => <TextInput {...p} value={f.series} onChange={(e) => setF({ ...f, series: e.target.value })} placeholder="BO3" />}
          </Field>
        )}
        {lobby && (
          <>
            <Field label="Taille de lobby" error={a.errors.lobbySize}>
              {(p) => <TextInput {...p} value={f.lobbySize} onChange={(e) => setF({ ...f, lobbySize: e.target.value })} placeholder="—" />}
            </Field>
            <Field label="Points / élimination" error={a.errors.killPoint}>
              {(p) => <TextInput {...p} type="number" min={0} max={10} value={f.killPoint} onChange={(e) => setF({ ...f, killPoint: Number(e.target.value) })} />}
            </Field>
          </>
        )}
      </div>
      {lobby && (
        <Field label="Barème par place (1re, 2e, …)" error={a.errors.scale}>
          {(p) => <TextInput {...p} className="font-mono" value={f.scale} onChange={(e) => setF({ ...f, scale: e.target.value })} />}
        </Field>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn btn-secondary btn-sm" disabled={a.pending}>Enregistrer</button>
        <Msg a={{ errors: { _: a.errors._ }, message: a.message }} />
      </div>
    </form>
  );
}

export function BroadcastForm() {
  const [f, setF] = useState({ text: "", link: "" });
  const a = useServerAction(broadcastAction);
  return (
    <form
      className="grid gap-3 p-[18px]"
      onSubmit={async (e) => {
        e.preventDefault();
        if (await a.run(f)) setF({ text: "", link: "" });
      }}
    >
      <Field label="Message" error={a.errors.text} hint={`${f.text.length} / 200`}>
        {(p) => <TextArea {...p} rows={2} value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} placeholder="ex. Les inscriptions au RDV TFT de novembre sont ouvertes." />}
      </Field>
      <Field label="Lien (facultatif)" error={a.errors.link}>
        {(p) => <TextInput {...p} value={f.link} onChange={(e) => setF({ ...f, link: e.target.value })} placeholder="/rdv" />}
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn btn-primary" disabled={a.pending}>Envoyer à tous les membres</button>
        <Msg a={{ errors: { _: a.errors._ }, message: a.message }} />
      </div>
    </form>
  );
}
