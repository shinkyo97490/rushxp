"use client";

import { useState } from "react";
import { submitLeadAction } from "@/lib/partners/actions";
import { Field, FormError, Select, TextArea, TextInput } from "@/components/forms";
import { useServerAction } from "@/components/useServerAction";

const GOALS = ["Visibilité de marque", "Sponsoring d’une compétition", "Partenariat d’une structure", "Événement / LAN"];

export function PartnerForm() {
  const [f, setF] = useState({ company: "", email: "", goal: GOALS[0], message: "", website: "" });
  const [sent, setSent] = useState(false);
  const a = useServerAction(async (x: typeof f) => {
    const r = await submitLeadAction(x);
    if (r.ok) setSent(true);
    return r;
  });
  if (sent)
    return (
      <div role="status" className="m-[18px] border border-orange bg-active-tint p-4 text-sm">
        Demande envoyée. L’équipe partenariats RushXP vous répond sous 48 h avec le dossier et les tarifs.
      </div>
    );
  return (
    <form
      className="grid gap-3 p-[18px]"
      onSubmit={(e) => {
        e.preventDefault();
        a.run(f);
      }}
    >
      <FormError message={a.errors._} />
      <Field label="Entreprise" error={a.errors.company}>
        {(p) => <TextInput {...p} autoComplete="organization" value={f.company} onChange={(e) => setF({ ...f, company: e.target.value })} />}
      </Field>
      <Field label="E-mail professionnel" error={a.errors.email}>
        {(p) => <TextInput {...p} type="email" autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />}
      </Field>
      <Field label="Objectif" error={a.errors.goal}>
        {(p) => (
          <Select {...p} value={f.goal} onChange={(e) => setF({ ...f, goal: e.target.value })}>
            {GOALS.map((g) => <option key={g}>{g}</option>)}
          </Select>
        )}
      </Field>
      <Field label="Message" error={a.errors.message}>
        {(p) => <TextArea {...p} rows={3} value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} />}
      </Field>
      {/* Piège à robots : invisible pour les humains. */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} />
      <button className="btn btn-primary justify-self-start" disabled={a.pending}>Demander le dossier partenaire</button>
      <span className="text-xs text-grey">Réponse sous 48 h avec le dossier partenaire.</span>
    </form>
  );
}
