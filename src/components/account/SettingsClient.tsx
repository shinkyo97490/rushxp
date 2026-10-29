"use client";

import Image from "next/image";
import { useState } from "react";
import {
  changePasswordAction,
  deleteAccountAction,
  linkGameAction,
  revokeSessionAction,
  unlinkGameAction,
  updatePrivacyAction,
  updateProfileAction,
} from "@/lib/account/actions";
import { PRIVACY_OPTIONS } from "@/lib/account/preferences";
import { GAMES } from "@/lib/data/games";
import { DAYS, GAME_LINK, REGIONS } from "@/lib/validation";
import { Field, FormError, Select, TextArea, TextInput } from "@/components/forms";
import { useServerAction } from "@/components/useServerAction";

function Saved({ message }: { message: string | null }) {
  return message ? <span role="status" className="text-[13px] text-orange">{message}</span> : null;
}

export function ProfileForm({ initial, email }: { initial: { pseudo: string; bio: string; region: string; availability: string[] }; email: string }) {
  const [f, setF] = useState(initial);
  const a = useServerAction(updateProfileAction);
  return (
    <form
      className="card grid max-w-[640px] gap-3.5 p-[18px]"
      onSubmit={(e) => {
        e.preventDefault();
        a.run(f);
      }}
    >
      <FormError message={a.errors._} />
      <div className="flex items-center gap-3.5">
        <span className="clip-corner grid h-20 w-20 flex-none place-items-center border border-orange bg-surface-2 font-display text-2xl font-extrabold">{f.pseudo.slice(0, 2).toUpperCase()}</span>
        <span className="text-[13px] text-grey">L’envoi d’une photo arrive avec le stockage des médias.</span>
      </div>
      <Field label="Pseudo" error={a.errors.pseudo}>
        {(p) => <TextInput {...p} value={f.pseudo} onChange={(e) => setF({ ...f, pseudo: e.target.value })} />}
      </Field>
      <Field label="E-mail" hint="Le changement d’adresse arrive avec la vérification par e-mail.">
        {(p) => <TextInput {...p} value={email} readOnly aria-readonly className="opacity-70" />}
      </Field>
      <Field label="Bio" error={a.errors.bio} hint={`${f.bio.length} / 300`}>
        {(p) => <TextArea {...p} rows={3} value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} placeholder="Jeux, rôle, objectifs…" />}
      </Field>
      <Field label="Région" error={a.errors.region}>
        {(p) => (
          <Select {...p} value={f.region} onChange={(e) => setF({ ...f, region: e.target.value })}>
            {REGIONS.map((r) => <option key={r}>{r}</option>)}
          </Select>
        )}
      </Field>
      <div className="grid gap-1.5">
        <span className="overline">Disponibilités</span>
        <div className="flex flex-wrap gap-1.5">
          {DAYS.map((d) => {
            const on = f.availability.includes(d);
            return (
              <button
                type="button"
                key={d}
                aria-pressed={on}
                onClick={() => setF({ ...f, availability: on ? f.availability.filter((x) => x !== d) : [...f.availability, d] })}
                className={`h-11 min-w-11 cursor-pointer border px-3 text-[13px] font-semibold ${on ? "border-orange bg-orange text-bg" : "border-line bg-bg text-silver"}`}
              >
                {d}
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button className="btn btn-primary" disabled={a.pending}>Enregistrer</button>
        <Saved message={a.message} />
      </div>
    </form>
  );
}

export function PasswordForm() {
  const [f, setF] = useState({ current: "", next: "", confirm: "" });
  const a = useServerAction(changePasswordAction);
  return (
    <form
      className="card grid gap-3 p-[18px]"
      onSubmit={async (e) => {
        e.preventDefault();
        if (await a.run(f)) setF({ current: "", next: "", confirm: "" });
      }}
    >
      <span className="card-title">Mot de passe</span>
      <FormError message={a.errors._} />
      <Field label="Mot de passe actuel" error={a.errors.current}>
        {(p) => <TextInput {...p} type="password" autoComplete="current-password" value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} />}
      </Field>
      <Field label="Nouveau mot de passe" error={a.errors.next} hint="8 caractères minimum.">
        {(p) => <TextInput {...p} type="password" autoComplete="new-password" value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} />}
      </Field>
      <Field label="Confirmer" error={a.errors.confirm}>
        {(p) => <TextInput {...p} type="password" autoComplete="new-password" value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} />}
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn btn-primary" disabled={a.pending}>Modifier</button>
        <Saved message={a.message} />
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-surface-2 pt-3">
        <span>
          <span className="block text-sm font-semibold">Double authentification</span>
          <span className="block text-xs text-grey">Recommandée pour les capitaines et gestionnaires · bientôt disponible</span>
        </span>
        <button type="button" disabled className="btn btn-tertiary btn-sm" title="Bientôt disponible">Activer</button>
      </div>
    </form>
  );
}

export function SessionsList({ sessions }: { sessions: { token: string; device: string; when: string; current: boolean }[] }) {
  const a = useServerAction(revokeSessionAction);
  return (
    <section className="card">
      <div className="card-head"><span className="card-title">Sessions actives</span></div>
      {a.errors._ && <div className="px-[18px] pt-3"><FormError message={a.errors._} /></div>}
      {sessions.map((s) => (
        <div key={s.token} className="flex flex-wrap items-center gap-2.5 border-b border-surface-2 px-[18px] py-2.5">
          <span className="min-w-0 flex-1">
            <span className="block text-sm">{s.device}</span>
            <span className="block text-xs text-grey">{s.when}</span>
          </span>
          {s.current ? (
            <span className="badge text-orange">Cette session</span>
          ) : (
            <button className="btn btn-tertiary btn-sm" disabled={a.pending} onClick={() => a.run(s.token)}>Déconnecter</button>
          )}
        </div>
      ))}
    </section>
  );
}

export function LinkedAccounts({ links }: { links: Record<string, { id: string | null; verified: boolean }> }) {
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const link = useServerAction(linkGameAction);
  const unlink = useServerAction(unlinkGameAction);
  return (
    <section className="card max-w-[760px]">
      <div className="card-head"><span className="card-title">Comptes de jeu liés</span></div>
      {(link.message || unlink.message) && <div className="px-[18px] pt-3"><Saved message={link.message ?? unlink.message} /></div>}
      {GAMES.map((g) => {
        const l = links[g.id];
        const meta = GAME_LINK[g.id];
        return (
          <div key={g.id} className="border-b border-surface-2 px-[18px] py-3">
            <div className="flex flex-wrap items-center gap-3">
              <Image src={g.logo} alt="" width={40} height={26} className="h-[26px] w-10 object-contain" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{g.name} · {meta.label}</span>
                <span className="block font-mono text-xs text-grey">{l?.id ?? "Non lié"}</span>
              </span>
              <span className={`badge ${l?.id ? (l.verified ? "text-orange" : "text-silver") : "text-grey"}`}>{l?.id ? (l.verified ? "✓ Vérifié" : "Non vérifié") : "Non lié"}</span>
              {l?.id ? (
                <span className="flex gap-1.5">
                  <button className="btn btn-tertiary btn-sm" onClick={() => setEditing(g.id)}>Modifier</button>
                  <button className="btn btn-danger btn-sm" disabled={unlink.pending} onClick={() => unlink.run(g.id)}>Délier</button>
                </span>
              ) : (
                <button className="btn btn-secondary btn-sm" onClick={() => setEditing(g.id)}>Lier le compte</button>
              )}
            </div>
            {editing === g.id && (
              <form
                className="mt-2.5 flex flex-wrap items-start gap-2"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (await link.run({ game: g.id, externalId: draft[g.id] ?? "" })) setEditing(null);
                }}
              >
                <div className="min-w-[200px] flex-1">
                  <TextInput aria-label={meta.label} className="font-mono" value={draft[g.id] ?? l?.id ?? ""} onChange={(e) => setDraft({ ...draft, [g.id]: e.target.value })} placeholder={meta.placeholder} aria-invalid={!!link.errors[g.id]} />
                  {link.errors[g.id] && <span className="text-[13px] text-red">{link.errors[g.id]}</span>}
                </div>
                <button className="btn btn-primary btn-sm" disabled={link.pending}>Enregistrer</button>
                <button type="button" className="btn btn-tertiary btn-sm" onClick={() => setEditing(null)}>Annuler</button>
              </form>
            )}
          </div>
        );
      })}
      <div className="px-[18px] py-3 text-xs text-grey">
        Un compte lié est nécessaire pour la lecture automatique des résultats. La vérification par connexion à l’éditeur (OAuth) arrive dans un prochain lot.
      </div>
    </section>
  );
}

export function PrivacyForm({ initial }: { initial: Record<string, string> }) {
  const [f, setF] = useState(initial);
  const a = useServerAction(updatePrivacyAction);
  return (
    <section className="card">
      <div className="card-head"><span className="card-title">Confidentialité</span></div>
      {PRIVACY_OPTIONS.map((o) => (
        <div key={o.key} className="flex flex-wrap items-center gap-3 border-b border-surface-2 px-[18px] py-3">
          <span className="min-w-0 flex-[1_1_220px]">
            <span className="block text-sm font-semibold">{o.label}</span>
            <span className="block text-xs text-grey">{o.desc}</span>
          </span>
          <Select className="!w-auto" aria-label={o.label} value={f[o.key]} onChange={(e) => setF({ ...f, [o.key]: e.target.value })}>
            {o.opts.map((x) => <option key={x}>{x}</option>)}
          </Select>
        </div>
      ))}
      <div className="flex items-center gap-3 px-[18px] py-3">
        <button className="btn btn-primary btn-sm" disabled={a.pending} onClick={() => a.run(f)}>Enregistrer</button>
        <Saved message={a.message} />
      </div>
    </section>
  );
}

export function DataSection() {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const a = useServerAction(deleteAccountAction);
  return (
    <section className="card">
      <div className="card-head"><span className="card-title">Mes données</span></div>
      <div className="flex flex-wrap gap-2 p-[18px]">
        <a href="/api/compte/export" download className="btn btn-tertiary">Exporter mes données</a>
        <button className="btn btn-danger" onClick={() => setOpen(true)}>Supprimer mon compte</button>
      </div>
      {open && (
        <form
          className="grid gap-3 border-t border-line p-[18px]"
          onSubmit={(e) => {
            e.preventDefault();
            a.run(password);
          }}
        >
          <p className="text-sm text-silver">
            Votre profil est anonymisé et vous ne pourrez plus vous connecter. Les résultats déjà validés restent dans l’historique des compétitions sous le nom « Joueur supprimé ». Cette action est irréversible.
          </p>
          <FormError message={a.errors._} />
          <Field label="Confirmez avec votre mot de passe" error={a.errors.password}>
            {(p) => <TextInput {...p} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />}
          </Field>
          <div className="flex gap-2">
            <button className="btn btn-danger" disabled={a.pending || !password}>Supprimer définitivement</button>
            <button type="button" className="btn btn-tertiary" onClick={() => setOpen(false)}>Annuler</button>
          </div>
        </form>
      )}
    </section>
  );
}
