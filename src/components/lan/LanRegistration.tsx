"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
import { startLanRegistrationAction, cancelLanRegistrationAction } from "@/lib/lan/actions";
import type { LanOption } from "@/lib/lan/queries";
import { Alert, Button, LinkButton } from "@/components/ui";
import { Checkbox, FormError } from "@/components/forms";

export interface LanTour {
  id: string;
  game: string;
  name: string;
  logo: string;
  format: string;
  day: string;
  priceCents: number | null;
  price: string;
  unit: string;
  solo: boolean;
  rosterSize: number;
  seats: string;
  fill: number;
  left: string;
  full: boolean;
  mine: { id: string; name: string; status: string; order: string } | null;
}

const STEPS = ["Tournoi", "Équipe", "Paiement", "Confirmation"];
const eur = (c: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: c % 100 ? 2 : 0 }).format(c / 100);

/** Inscription LAN en 4 étapes : tournoi, équipe (ou solo), paiement Stripe, confirmation. */
export function LanRegistration({
  lanName,
  tours,
  options,
  signedIn,
  pseudo,
  club,
  payment,
  refundUntil,
  confirmed,
  initialTour,
  serviceCents: SERVICE,
}: {
  lanName: string;
  tours: LanTour[];
  options: LanOption[];
  signedIn: boolean;
  pseudo: string;
  club: string | null;
  payment: "stripe" | "mock" | "off";
  refundUntil: string | null;
  confirmed: { id: string; tournamentId: string; name: string; game: string; order: string; paid: boolean; amount: string } | null;
  initialTour?: string;
  serviceCents: number;
}) {
  const [step, setStep] = useState(confirmed ? 4 : initialTour && tours.some((t) => t.id === initialTour) ? 2 : 1);
  const [tourId, setTourId] = useState<string | null>(confirmed?.tournamentId ?? initialTour ?? null);
  const [rosterId, setRosterId] = useState<string | null>(null);
  const [accept, setAccept] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [cancelled, setCancelled] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!signedIn)
    return (
      <div className="card grid justify-items-start gap-3 px-[18px] py-5">
        <p className="text-[15px]">Connectez-vous pour inscrire votre équipe ou vous inscrire en solo.</p>
        <LinkButton href="/connexion?next=/lan" size="sm">Se connecter</LinkButton>
      </div>
    );

  const T = tours.find((t) => t.id === tourId);
  const teams = T && !T.solo ? options.filter((o) => o.game === T.game) : [];
  const roster = teams.find((o) => o.id === rosterId);
  const who = T?.solo ? pseudo : roster ? (roster.name === roster.structure ? roster.structure : `${roster.structure} · ${roster.name}`) : "—";
  const canNext = step === 1 ? !!T && !T.full && !T.mine : step === 2 ? !!T && (T.solo || (!!roster && roster.starters.length >= T.rosterSize)) : step === 3;
  const total = T?.priceCents != null ? T.priceCents + SERVICE : 0;

  const pay = () => {
    if (!accept) return setErrors({ accept: "Acceptez le règlement pour continuer." });
    start(async () => {
      const r = await startLanRegistrationAction({ tournamentId: T!.id, rosterId: rosterId ?? undefined, accept });
      if (r.ok && r.url) window.location.assign(r.url);
      else if (!r.ok) setErrors(r.errors);
    });
  };
  const cancel = (id: string) =>
    start(async () => {
      const r = await cancelLanRegistrationAction(id);
      if (r.ok) setCancelled(r.message ?? "Inscription annulée.");
      else setErrors(r.errors);
    });

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
      <section className="card">
        <ol className="grid grid-cols-4 border-b border-line" aria-label="Étapes">
          {STEPS.map((l, i) => (
            <li key={l} aria-current={step === i + 1 ? "step" : undefined} className={`border-b-[3px] px-2 py-2.5 text-center text-[13px] ${step === i + 1 ? "border-orange text-ink" : step > i + 1 ? "border-[#6a6a6a] text-ink" : "border-transparent text-grey"}`}>
              {i + 1}. {l}
            </li>
          ))}
        </ol>

        <div className="grid gap-3 px-[18px] py-4">
          {payment === "off" && step < 4 && <Alert kind="warning">Le paiement en ligne n’est pas encore ouvert. Les inscriptions seront possibles dès son activation.</Alert>}
          {payment === "mock" && step === 3 && <Alert>Mode démonstration : paiement simulé, aucun montant n’est prélevé.</Alert>}

          {step === 1 && (
            <>
              <div className="overline">Choisissez le tournoi</div>
              {tours.length === 0 && <p className="text-sm text-grey">Aucun tournoi ouvert aux inscriptions.</p>}
              {tours.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  disabled={t.full || !!t.mine}
                  aria-pressed={tourId === t.id}
                  onClick={() => { setTourId(t.id); setRosterId(null); setErrors({}); }}
                  className={`flex cursor-pointer items-center gap-3 border px-3 py-2.5 text-left text-ink disabled:cursor-not-allowed disabled:opacity-45 ${tourId === t.id ? "border-orange bg-active-tint" : "border-line bg-bg hover:border-[#5a5a5a]"}`}
                >
                  <Image src={t.logo} alt="" width={36} height={24} className="h-6 w-9 object-contain" />
                  <span className="min-w-0 flex-1"><span className="block font-semibold">{t.name}</span><span className="block text-xs text-grey">{t.format} · {t.mine ? "déjà inscrit" : t.left}</span></span>
                  <span className="font-display text-lg font-bold">{t.price}</span>
                </button>
              ))}
            </>
          )}

          {step === 2 && T && (
            <>
              <div className="overline">{T.solo ? "Inscription individuelle" : "Quelle équipe inscrire ?"}</div>
              {T.solo ? (
                <div className="border border-orange bg-active-tint px-3 py-2.5">
                  <div className="font-semibold">{pseudo}</div>
                  <div className="text-xs text-grey">{club ? `Vos points vont à ${club}` : "Sans structure : vos points ne comptent pas au classement des structures"}</div>
                </div>
              ) : teams.length === 0 ? (
                <Alert kind="warning">Seul le capitaine ou le gestionnaire de la structure peut inscrire une équipe. Aucune équipe {T.name} ne vous est rattachée.</Alert>
              ) : (
                teams.map((o) => {
                  const ok = o.starters.length >= T.rosterSize;
                  return (
                    <button
                      key={o.id}
                      type="button"
                      aria-pressed={rosterId === o.id}
                      onClick={() => setRosterId(o.id)}
                      className={`flex cursor-pointer items-center justify-between gap-3 border px-3 py-2.5 text-left text-ink ${rosterId === o.id ? "border-orange bg-active-tint" : "border-line bg-bg hover:border-[#5a5a5a]"}`}
                    >
                      <span><span className="block font-semibold">{o.name === o.structure ? o.structure : `${o.structure} · ${o.name}`}</span><span className="block text-xs text-grey">{o.starters.length} / {T.rosterSize} titulaires</span></span>
                      <span className={`text-[11px] font-bold ${ok ? "text-orange" : "text-red"}`}>{rosterId === o.id ? "SÉLECTIONNÉE" : ok ? "" : "INCOMPLÈTE"}</span>
                    </button>
                  );
                })
              )}
              {roster && (
                <div className="border border-line">
                  <div className="overline border-b border-line px-3 py-2">Joueurs présents sur place</div>
                  {roster.starters.map((p) => <div key={p} className="border-b border-surface-2 px-3 py-1.5 text-sm last:border-b-0">{p}</div>)}
                  {roster.starters.length < T.rosterSize && <div className="px-3 py-1.5 text-xs text-red">Il manque {T.rosterSize - roster.starters.length} titulaire(s).</div>}
                </div>
              )}
            </>
          )}

          {step === 3 && (
            <>
              <div className="overline">Moyen de paiement</div>
              <div className="flex items-center gap-3 border border-orange bg-active-tint px-3 py-2.5">
                <span className="h-3 w-3 flex-none rounded-full bg-orange" aria-hidden />
                <span><span className="block font-semibold">Carte bancaire</span><span className="block text-xs text-grey">Paiement sécurisé par Stripe · Visa, Mastercard</span></span>
              </div>
              <Checkbox checked={accept} onChange={(c) => { setAccept(c); setErrors({}); }} error={errors.accept}>
                J’accepte le règlement de la LAN et les conditions de vente.{refundUntil ? ` L’inscription est remboursable jusqu’au ${refundUntil}.` : ""}
              </Checkbox>
            </>
          )}

          {step === 4 && confirmed && (
            <div className="flex flex-wrap items-start gap-5">
              <div className="grid h-28 w-28 flex-none place-items-center border border-line bg-ink font-mono text-[10px] text-bg" aria-label="QR billet">QR BILLET</div>
              <div className="grid gap-1">
                <div className={`overline ${confirmed.paid ? "!text-orange" : "!text-yellow"}`}>{confirmed.paid ? "Paiement confirmé" : "Paiement en attente de confirmation"}</div>
                <div className="font-display text-3xl font-extrabold">{cancelled ? "Inscription annulée" : confirmed.paid ? "Inscription validée" : "Inscription réservée"}</div>
                <div>{confirmed.name} · {confirmed.game}</div>
                <div className="font-mono text-xs text-grey">Commande {confirmed.order} · {confirmed.amount}</div>
                {!cancelled && <p className="text-sm text-silver">{confirmed.paid ? "Billet disponible dans vos notifications. Présentez-le au check-in avec une pièce d’identité." : "La confirmation arrive dès que le paiement est validé par la banque."}</p>}
                {cancelled ? <Alert kind="success">{cancelled}</Alert> : (
                  <div className="mt-1"><Button variant="tertiary" size="sm" loading={pending} onClick={() => cancel(confirmed.id)}>{confirmed.paid ? "Annuler et demander le remboursement" : "Annuler la réservation"}</Button></div>
                )}
              </div>
            </div>
          )}

          <FormError message={errors._ ?? errors.rosterId} />

          {step >= 1 && step <= 3 && (
            <div className="flex justify-between gap-2 border-t border-line pt-3">
              <Button variant="tertiary" size="sm" disabled={step <= 1 || pending} onClick={() => { setStep(step - 1); setErrors({}); }}>Retour</Button>
              {step < 3 ? (
                <Button size="sm" disabled={!canNext} onClick={() => setStep(step + 1)}>Continuer</Button>
              ) : (
                <Button size="sm" loading={pending} disabledReason={payment === "off" ? "Paiement en ligne bientôt disponible" : undefined} onClick={pay}>Payer {eur(total)}</Button>
              )}
            </div>
          )}
        </div>
      </section>

      <aside className="card content-start">
        <div className="card-head"><span className="card-title">Récapitulatif</span></div>
        <dl>
          {[
            ["Événement", lanName],
            ["Tournoi", T?.name ?? "—"],
            [T?.solo ? "Joueur" : "Équipe", confirmed ? confirmed.name : step >= 2 ? who : "—"],
            ["Inscription", T ? `${T.price} ${T.unit}` : "—"],
            ["Frais de service", T ? eur(SERVICE) : "—"],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 border-b border-surface-2 px-[18px] py-2.5 text-sm"><dt className="text-grey">{k}</dt><dd className="text-right">{v}</dd></div>
          ))}
        </dl>
        <div className="flex justify-between px-[18px] py-3"><span className="font-semibold">Total</span><span className="font-display text-2xl font-extrabold text-yellow">{confirmed ? confirmed.amount : T ? eur(total) : "—"}</span></div>
      </aside>
    </div>
  );
}
