"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { finishOnboardingAction, saveGamesAction, saveProfileAction, signUpAction, type ActionResult } from "@/lib/auth/actions";
import { GAMES } from "@/lib/data/games";
import {
  DAYS,
  GAME_LINK,
  REGIONS,
  gamesStepSchema,
  profileStepSchema,
  signUpSchema,
  structureStepSchema,
  toFieldErrors,
  type FieldErrors,
} from "@/lib/validation";
import { Checkbox, Field, FormError, Select, Steps, TextInput, Tile } from "@/components/forms";

const STEPS = ["Compte", "Mes jeux", "Mon profil", "Ma structure"];
const INTENTS = [
  ["joueur", "Jouer", "Rejoindre une équipe ou jouer en 1v1"],
  ["capitaine", "Capitaine", "Mener une équipe et lancer des défis"],
  ["gestionnaire", "Gérer une structure", "Plusieurs rosters, recrutement"],
] as const;
const PATHS = [
  ["create", "Créer une structure", "Vous devenez gestionnaire. La structure est vérifiée par RushXP avant publication."],
  ["join", "Rejoindre avec un code", "Votre capitaine ou gestionnaire vous a donné un code d’invitation."],
  ["free", "Agent libre", "Vous apparaissez dans les annonces de recrutement. Vous pourrez rejoindre une structure plus tard."],
] as const;

export function SignupWizard({ initialStep, initialPseudo }: { initialStep: number; initialPseudo?: string }) {
  const router = useRouter();
  const [step, setStep] = useState(initialStep);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [pending, start] = useTransition();

  const [account, setAccount] = useState({ email: "", pseudo: initialPseudo ?? "", password: "", terms: false });
  const [games, setGames] = useState<string[]>([]);
  const [links, setLinks] = useState<Record<string, string>>({});
  const [profile, setProfile] = useState<{ intent: string; region: string; availability: string[] }>({ intent: "", region: REGIONS[0], availability: [] });
  const [path, setPath] = useState<{ path: string; code: string }>({ path: "", code: "" });

  /** Valide côté client, puis côté serveur (qui reste la référence). */
  const run = (check: () => FieldErrors | null, action: () => Promise<ActionResult>, after: () => void) => {
    const local = check();
    if (local) return setErrors(local);
    setErrors({});
    start(async () => {
      try {
        const res = await action();
        if (!res.ok) return setErrors(res.errors);
        after();
      } catch (e) {
        setErrors({ _: e instanceof Error ? e.message : "Erreur inattendue. Réessayez." });
      }
    });
  };
  const zodCheck = (schema: { safeParse: (v: unknown) => { success: boolean; error?: unknown } }, value: unknown) => () => {
    const r = schema.safeParse(value);
    return r.success ? null : toFieldErrors(r.error as never);
  };

  const next = () => {
    if (step === 0)
      run(zodCheck(signUpSchema, account), () => signUpAction(account), () => {
        setStep(1);
        router.refresh();
      });
    if (step === 1) run(zodCheck(gamesStepSchema, { games, links }), () => saveGamesAction({ games, links }), () => setStep(2));
    if (step === 2) run(zodCheck(profileStepSchema, profile), () => saveProfileAction(profile), () => setStep(3));
    if (step === 3) {
      const value = path.path === "join" ? path : { path: path.path };
      run(
        () => (path.path ? zodCheck(structureStepSchema, value)() : { path: "Choisissez une option." }),
        () => finishOnboardingAction(value),
        // Pas de refresh ici : la page redirigerait un compte déjà inscrit. Les liens ci-dessous rechargent la page.
        () => setStep(4),
      );
    }
  };

  if (step === 4) {
    const recap: [string, string][] = [
      ["Pseudo", account.pseudo || initialPseudo || "—"],
      ["Jeux", games.map((g) => GAMES.find((x) => x.id === g)?.name).join(", ") || "—"],
      ["Comptes liés", Object.values(links).filter(Boolean).length ? `${Object.values(links).filter(Boolean).length} · vérification à venir` : "Aucun"],
      ["Région", profile.region],
      ["Structure", PATHS.find((p) => p[0] === path.path)?.[1] ?? "—"],
    ];
    return (
      <div className="grid gap-3.5">
        <span className="justify-self-start bg-orange px-2 py-0.5 text-[11px] font-bold tracking-[.1em] text-bg">COMPTE CRÉÉ</span>
        <h1 className="font-display text-[40px] font-extrabold leading-none">Bienvenue, {account.pseudo || initialPseudo}</h1>
        {path.path === "join" && (
          <p className="text-sm text-silver">Votre demande a été envoyée aux gestionnaires de la structure. Vous serez notifié de leur réponse.</p>
        )}
        <div className="card">
          {recap.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3 border-b border-surface-2 px-3.5 py-2.5 text-sm">
              <span className="text-grey">{k}</span>
              <span className="text-right">{v}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {/* eslint-disable @next/next/no-html-link-for-pages -- rechargement complet voulu pour mettre à jour l'en-tête */}
          {path.path === "create" ? (
            <a href="/structure/nouvelle" className="btn btn-primary">Créer ma structure</a>
          ) : (
            <a href="/rankings" className="btn btn-primary">Voir les classements</a>
          )}
          <a href="/recrutement" className="btn btn-tertiary">Voir les annonces</a>
          {/* eslint-enable @next/next/no-html-link-for-pages */}
        </div>
      </div>
    );
  }

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        next();
      }}
      className="grid gap-5"
    >
      <Steps labels={STEPS} current={step} />
      <FormError message={errors._} />

      {step === 0 && (
        <div className="grid gap-3.5">
          <h1 className="font-display text-[40px] font-extrabold leading-none">Créer mon compte</h1>
          <Field label="E-mail" error={errors.email}>
            {(p) => <TextInput {...p} type="email" autoComplete="email" value={account.email} onChange={(e) => setAccount({ ...account, email: e.target.value })} placeholder="vous@exemple.fr" />}
          </Field>
          <Field label="Pseudo RushXP" error={errors.pseudo} hint="Visible sur les classements. 3 à 20 caractères.">
            {(p) => <TextInput {...p} autoComplete="nickname" value={account.pseudo} onChange={(e) => setAccount({ ...account, pseudo: e.target.value })} />}
          </Field>
          <Field label="Mot de passe" error={errors.password} hint="8 caractères minimum.">
            {(p) => <TextInput {...p} type="password" autoComplete="new-password" value={account.password} onChange={(e) => setAccount({ ...account, password: e.target.value })} />}
          </Field>
          <Checkbox checked={account.terms} onChange={(v) => setAccount({ ...account, terms: v })} error={errors.terms}>
            J’accepte le <Link href="/reglement">règlement RushXP</Link> et la politique de confidentialité. J’ai 13 ans ou plus.
          </Checkbox>
        </div>
      )}

      {step === 1 && (
        <div className="grid gap-3.5">
          <h1 className="font-display text-[40px] font-extrabold leading-none">Mes jeux</h1>
          <p className="text-sm text-silver">Choisissez vos jeux et indiquez vos identifiants. Ils serviront à lire automatiquement vos résultats.</p>
          <div className="grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(120px,1fr))]" role="group" aria-label="Jeux">
            {GAMES.map((g) => (
              <Tile key={g.id} selected={games.includes(g.id)} onClick={() => setGames((l) => (l.includes(g.id) ? l.filter((x) => x !== g.id) : [...l, g.id]))} className="grid h-16 place-items-center p-1.5">
                <Image src={g.logo} alt={g.name} width={90} height={34} className="max-h-[34px] w-auto object-contain" />
              </Tile>
            ))}
          </div>
          {errors.games && <span className="text-[13px] text-red">{errors.games}</span>}
          {games.map((g) => {
            const meta = GAME_LINK[g];
            const name = GAMES.find((x) => x.id === g)!.name;
            return (
              <Field key={g} label={`${name} · ${meta.label} (facultatif)`} error={errors[`links.${g}`]} hint={meta.hint}>
                {(p) => <TextInput {...p} className="font-mono" value={links[g] ?? ""} onChange={(e) => setLinks({ ...links, [g]: e.target.value })} placeholder={meta.placeholder} />}
              </Field>
            );
          })}
          <span className="text-xs text-grey">La vérification par connexion au compte de l’éditeur (Riot, Activision, EA, Epic, Bandai Namco) arrive dans un prochain lot. En attendant, l’identifiant est marqué « non vérifié ».</span>
        </div>
      )}

      {step === 2 && (
        <div className="grid gap-3.5">
          <h1 className="font-display text-[40px] font-extrabold leading-none">Mon profil</h1>
          <div className="grid gap-1.5">
            <span className="overline">Je viens surtout pour</span>
            <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(150px,1fr))]">
              {INTENTS.map(([k, l, d]) => (
                <Tile key={k} selected={profile.intent === k} onClick={() => setProfile({ ...profile, intent: k })} className="p-3">
                  <span className="block font-bold">{l}</span>
                  <span className="block text-xs text-grey">{d}</span>
                </Tile>
              ))}
            </div>
            {errors.intent && <span className="text-[13px] text-red">{errors.intent}</span>}
          </div>
          <Field label="Région" error={errors.region}>
            {(p) => (
              <Select {...p} value={profile.region} onChange={(e) => setProfile({ ...profile, region: e.target.value })}>
                {REGIONS.map((r) => <option key={r}>{r}</option>)}
              </Select>
            )}
          </Field>
          <div className="grid gap-1.5">
            <span className="overline">Disponibilités</span>
            <div className="flex flex-wrap gap-1.5">
              {DAYS.map((d) => {
                const on = profile.availability.includes(d);
                return (
                  <button
                    type="button"
                    key={d}
                    aria-pressed={on}
                    onClick={() => setProfile({ ...profile, availability: on ? profile.availability.filter((x) => x !== d) : [...profile.availability, d] })}
                    className={`h-11 min-w-11 cursor-pointer border px-3 text-[13px] font-semibold transition-colors duration-150 ${on ? "border-orange bg-orange text-bg" : "border-line bg-bg text-silver hover:border-[#5a5a5a]"}`}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="grid gap-3">
          <h1 className="font-display text-[40px] font-extrabold leading-none">Ma structure</h1>
          {PATHS.map(([k, l, d]) => (
            <Tile key={k} selected={path.path === k} onClick={() => setPath({ ...path, path: k })} className="grid gap-1 px-4 py-3.5">
              <span className="font-display text-xl font-bold">{l}</span>
              <span className="text-[13px] text-silver">{d}</span>
            </Tile>
          ))}
          {errors.path && <span className="text-[13px] text-red">{errors.path}</span>}
          {path.path === "join" && (
            <Field label="Code d’invitation" error={errors.code}>
              {(p) => <TextInput {...p} className="font-mono uppercase" value={path.code} onChange={(e) => setPath({ ...path, code: e.target.value })} placeholder="ex. NVA-7K2Q" />}
            </Field>
          )}
        </div>
      )}

      <div className="flex flex-wrap justify-between gap-2">
        <button type="button" className={`btn btn-tertiary ${step < 2 ? "invisible" : ""}`} onClick={() => setStep((s) => s - 1)} disabled={pending}>
          Retour
        </button>
        <button className="btn btn-primary" disabled={pending}>
          {pending ? "Enregistrement…" : step === 3 ? "Terminer" : "Continuer"}
        </button>
      </div>
      {step === 0 && (
        <p className="text-[13px] text-grey">
          Déjà inscrit ? <Link href="/connexion">Se connecter</Link>
        </p>
      )}
    </form>
  );
}
