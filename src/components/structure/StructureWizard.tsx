"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
import { checkIdentityAction, checkInvitesAction, createStructureAction, type StructureResult } from "@/lib/structure/actions";
import { GAMES } from "@/lib/data/games";
import { REGIONS, parsePseudoList, structureIdentitySchema, structureSchema, toFieldErrors, type FieldErrors } from "@/lib/validation";
import { Field, FormError, Select, Steps, TextArea, TextInput, Tile } from "@/components/forms";

const STEPS = ["Identité", "Jeux engagés", "Joueurs", "Validation"];

export function StructureWizard() {
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [pending, start] = useTransition();
  const [f, setF] = useState({ name: "", tag: "", region: REGIONS[0] as string, bio: "", games: [] as string[], invites: "" });
  const [code, setCode] = useState<string | null>(null);
  const invites = parsePseudoList(f.invites);
  const picked = GAMES.filter((g) => f.games.includes(g.id));

  const run = (local: FieldErrors | null, action: () => Promise<StructureResult>, after: (r: StructureResult & { ok: true }) => void) => {
    if (local) return setErrors(local);
    setErrors({});
    start(async () => {
      const r = await action();
      if (!r.ok) {
        setErrors(r.errors);
        if (r.errors.name || r.errors.tag) setStep(0);
        return;
      }
      after(r);
    });
  };

  const next = () => {
    if (step === 0) {
      const p = structureIdentitySchema.safeParse(f);
      run(p.success ? null : toFieldErrors(p.error), () => checkIdentityAction(f), () => setStep(1));
    } else if (step === 1) {
      if (!f.games.length) return setErrors({ games: "Engagez au moins un jeu." });
      setErrors({});
      setStep(2);
    } else if (step === 2) {
      const p = structureSchema.pick({ invites: true }).safeParse({ invites });
      run(p.success ? null : { invites: Object.values(toFieldErrors(p.error))[0] }, () => checkInvitesAction(invites), () => setStep(3));
    } else if (!code) {
      const data = { ...f, invites };
      const p = structureSchema.safeParse(data);
      run(p.success ? null : toFieldErrors(p.error), () => createStructureAction(data), (r) => setCode(r.inviteCode ?? null));
    }
  };

  const recap: [string, string][] = [
    ["Nom", f.name],
    ["Tag", f.tag.toUpperCase()],
    ["Région", f.region],
    ["Jeux", picked.map((g) => g.name).join(", ")],
    ["Invitations", invites.length ? invites.join(", ") : "Aucune"],
  ];

  return (
    <div className="mt-5 grid items-start gap-5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,380px),1fr))]">
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          next();
        }}
        className="card grid gap-3.5 p-[18px]"
      >
        <Steps labels={STEPS} current={code ? 4 : step} />
        <FormError message={errors._} />

        {step === 0 && (
          <>
            <div className="flex items-center gap-3.5">
              <span className="img-placeholder h-24 w-24 flex-none border border-dashed border-[#5a5a5a] text-center">logo<br />512×512</span>
              <span className="text-[13px] text-grey">L’envoi du logo arrive avec le stockage des médias. Il sera affiché dans un carré, jamais déformé.</span>
            </div>
            <Field label="Nom de la structure" error={errors.name}>
              {(p) => <TextInput {...p} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="ex. Nova Esport" maxLength={40} />}
            </Field>
            <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-2.5">
              <Field label="Tag" error={errors.tag}>
                {(p) => <TextInput {...p} value={f.tag} onChange={(e) => setF({ ...f, tag: e.target.value.toUpperCase() })} maxLength={4} placeholder="NVA" className="font-display !text-lg font-bold uppercase" />}
              </Field>
              <Field label="Région" error={errors.region}>
                {(p) => (
                  <Select {...p} value={f.region} onChange={(e) => setF({ ...f, region: e.target.value })}>
                    {REGIONS.map((r) => <option key={r}>{r}</option>)}
                  </Select>
                )}
              </Field>
            </div>
            <Field label="Présentation" error={errors.bio} hint={`${f.bio.length} / 500`}>
              {(p) => <TextArea {...p} rows={3} value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} placeholder="Histoire, objectifs, valeurs…" />}
            </Field>
          </>
        )}

        {step === 1 && (
          <div className="grid gap-2" role="group" aria-label="Jeux engagés">
            <span className="overline">Jeux engagés</span>
            {GAMES.map((g) => {
              const on = f.games.includes(g.id);
              return (
                <Tile key={g.id} selected={on} onClick={() => setF({ ...f, games: on ? f.games.filter((x) => x !== g.id) : [...f.games, g.id] })} className="flex items-center gap-3 px-3 py-2.5">
                  <Image src={g.logo} alt="" width={40} height={26} className="h-[26px] w-10 object-contain" />
                  <span className="flex-1">
                    <span className="block font-bold">{g.name}</span>
                    <span className="block text-xs text-grey">
                      {g.kind === "challenge" ? `RushXP Rankings · ${g.format}${g.rosterSize > 1 ? ` · ${g.rosterSize} titulaires` : ""}` : `RDV mensuels · ${g.format}`}
                    </span>
                  </span>
                  <span className="font-extrabold text-orange">{on ? "✓" : ""}</span>
                </Tile>
              );
            })}
            {errors.games && <span className="text-[13px] text-red">{errors.games}</span>}
            <span className="text-xs text-grey">Un roster est créé par jeu. Vous pourrez ajouter d’autres équipes sur un même jeu (ex. « Academy ») depuis la page de la structure.</span>
          </div>
        )}

        {step === 2 && (
          <>
            <Field label="Inviter des joueurs (pseudos séparés par des virgules)" error={errors.invites} hint="Facultatif. Les joueurs reçoivent une notification et acceptent l’invitation.">
              {(p) => <TextArea {...p} rows={3} value={f.invites} onChange={(e) => setF({ ...f, invites: e.target.value })} placeholder="Pseudo1, Pseudo2…" />}
            </Field>
            <div className="border border-line bg-bg px-3 py-3 text-[13px] text-silver">
              Un code d’invitation sera généré à la création, à partager sur Discord : les joueurs l’indiquent à leur inscription.
            </div>
          </>
        )}

        {step === 3 && (
          <div className="grid gap-2.5">
            {recap.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3 border-b border-surface-2 py-2 text-sm">
                <span className="text-grey">{k}</span>
                <span className="text-right">{v}</span>
              </div>
            ))}
            {code ? (
              <div role="status" className="grid gap-2 border border-orange bg-active-tint p-3 text-sm">
                <span>Demande envoyée. L’équipe RushXP vérifie la structure sous 24 à 48 h. Vous recevrez une notification.</span>
                <span>
                  Code d’invitation : <strong className="font-mono text-orange">{code}</strong> · à partager sur Discord.
                </span>
              </div>
            ) : (
              <span className="text-xs text-grey">En validant, vous devenez gestionnaire de la structure. Elle reste privée jusqu’à sa vérification.</span>
            )}
          </div>
        )}

        <div className="flex flex-wrap justify-between gap-2">
          <button type="button" className={`btn btn-tertiary ${step === 0 || code ? "invisible" : ""}`} onClick={() => setStep((s) => s - 1)} disabled={pending}>
            Retour
          </button>
          {code ? (
            // eslint-disable-next-line @next/next/no-html-link-for-pages -- rechargement voulu (rôle gestionnaire dans l'en-tête)
            <a href="/" className="btn btn-primary">Terminer</a>
          ) : (
            <button className="btn btn-primary" disabled={pending}>
              {pending ? "Vérification…" : step === 3 ? "Envoyer pour vérification" : "Continuer"}
            </button>
          )}
        </div>
      </form>

      <aside className="card overflow-hidden" aria-label="Aperçu public">
        <div className="overline border-b border-line px-3.5 py-2.5">Aperçu public</div>
        <div className="h-[90px] bg-[repeating-linear-gradient(-60deg,#141414_0_22px,#181818_22px_23px)]" />
        <div className="-mt-9 grid gap-2 px-4 pb-4">
          <span className="clip-corner grid h-[72px] w-[72px] place-items-center border-2 border-orange bg-bg font-display text-2xl font-extrabold">{f.tag.toUpperCase() || "TAG"}</span>
          <span className="font-display text-[30px] font-extrabold leading-none">{f.name || "Nom de la structure"}</span>
          <span className="text-xs text-grey">{f.region} · {picked.length} jeu{picked.length > 1 ? "x" : ""}</span>
          <div className="flex flex-wrap gap-1.5">
            {picked.map((g) => (
              <span key={g.id} className="grid h-[34px] w-[34px] place-items-center border border-line bg-bg p-1">
                <Image src={g.logo} alt={g.name} width={26} height={26} className="max-h-full w-auto object-contain" />
              </span>
            ))}
          </div>
          <span className="text-[13px] text-silver">{f.bio || "Présentation de la structure."}</span>
        </div>
      </aside>
    </div>
  );
}
