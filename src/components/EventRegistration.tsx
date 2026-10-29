"use client";

import Link from "next/link";
import { useState } from "react";
import { registerEventAction, unregisterEventAction } from "@/lib/events/actions";
import { FormError } from "@/components/forms";
import { useServerAction } from "@/components/useServerAction";

interface Props {
  game: "tft" | "wz" | "apex";
  solo: boolean;
  signedIn: boolean;
  registeredEntityId: string | null;
  rosters: { id: string; label: string }[];
  closed: string | null;
}

export function EventRegistration({ game, solo, signedIn, registeredEntityId, rosters, closed }: Props) {
  const reg = useServerAction(registerEventAction);
  const unreg = useServerAction(unregisterEventAction);
  const [rosterId, setRosterId] = useState(rosters[0]?.id ?? "");
  const err = reg.errors._ ?? unreg.errors._;
  const msg = reg.message ?? unreg.message;

  if (!signedIn)
    return (
      <div className="grid gap-1.5">
        <Link href="/inscription" className="btn btn-primary justify-self-start">Créer un compte pour participer</Link>
        <span className="text-xs text-grey">Les spectateurs peuvent suivre les manches en direct.</span>
      </div>
    );
  return (
    <div className="grid gap-2">
      <FormError message={err} />
      {msg && <span role="status" className="text-[13px] text-orange">{msg}</span>}
      {registeredEntityId ? (
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn btn-secondary" disabled={unreg.pending} onClick={() => unreg.run({ game, entityId: registeredEntityId })}>✓ Inscrit · se désinscrire</button>
          <span className="text-xs text-grey">Check-in obligatoire le jour J. Sans check-in, la place est libérée.</span>
        </div>
      ) : closed ? (
        <span className="text-sm text-grey">{closed}</span>
      ) : solo ? (
        <button className="btn btn-primary justify-self-start" disabled={reg.pending} onClick={() => reg.run({ game })}>S’inscrire</button>
      ) : rosters.length ? (
        <div className="flex flex-wrap items-end gap-2">
          <label className="grid min-w-[200px] flex-1 gap-1">
            <span className="overline">{game === "wz" ? "Duo inscrit" : "Trio inscrit"}</span>
            <select className="field h-11" value={rosterId} onChange={(e) => setRosterId(e.target.value)}>
              {rosters.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
          </label>
          <button className="btn btn-primary" disabled={reg.pending} onClick={() => reg.run({ game, rosterId })}>Inscrire {game === "wz" ? "le duo" : "le trio"}</button>
        </div>
      ) : (
        <span className="text-sm text-grey">Votre capitaine inscrit le {game === "wz" ? "duo" : "trio"} de la structure. Pas d’équipe {game === "wz" ? "Warzone" : "Apex"} ? <Link href="/recrutement">Créez-en une →</Link></span>
      )}
      {!registeredEntityId && !closed && <span className="text-xs text-grey">Inscriptions jusqu’au jeudi précédent, 23:59.</span>}
    </div>
  );
}
