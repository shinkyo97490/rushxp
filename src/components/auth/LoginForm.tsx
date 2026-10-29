"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { signInAction } from "@/lib/auth/actions";
import { signInSchema, toFieldErrors, type FieldErrors } from "@/lib/validation";
import { Field, FormError, TextInput } from "@/components/forms";

export function LoginForm({ next }: { next?: string }) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [pending, start] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = signInSchema.safeParse({ identifier, password });
    if (!parsed.success) return setErrors(toFieldErrors(parsed.error));
    setErrors({});
    start(async () => {
      const res = await signInAction({ identifier, password, next });
      if (res && !res.ok) setErrors(res.errors);
    });
  };

  return (
    <form onSubmit={submit} noValidate className="grid w-full max-w-[400px] gap-3.5">
      <h1 className="font-display text-[42px] font-extrabold leading-none">Connexion</h1>
      <FormError message={errors._} />
      <Field label="E-mail ou pseudo" error={errors.identifier}>
        {(p) => <TextInput {...p} autoComplete="username" value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="vous@exemple.fr" />}
      </Field>
      <Field label="Mot de passe" error={errors.password}>
        {(p) => <TextInput {...p} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />}
      </Field>
      <button className="btn btn-primary clip-corner-sm !min-h-[50px] !text-lg" disabled={pending}>
        {pending ? "Connexion…" : "Se connecter"}
      </button>
      <div className="flex items-center gap-2.5 text-xs text-[#6a6a6a]">
        <span className="h-px flex-1 bg-line" />ou<span className="h-px flex-1 bg-line" />
      </div>
      <button type="button" className="btn btn-tertiary" disabled title="Connexion Discord : bientôt disponible">
        Continuer avec Discord · bientôt
      </button>
      <p className="text-center text-[13px] text-grey">
        Mot de passe oublié ? La réinitialisation par e-mail arrive bientôt : contactez l’équipe RushXP en attendant.
      </p>
      <p className="text-center text-[13px] text-grey">
        Pas encore de compte ? <Link href="/inscription">Rejoindre RushXP</Link>
      </p>
    </form>
  );
}
