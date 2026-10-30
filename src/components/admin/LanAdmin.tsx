"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { saveLanAction, saveLanResultsAction, validateLanResultsAction } from "@/lib/lan/actions";
import { Field, FormError, Select, TextArea, TextInput } from "@/components/forms";
import { Button } from "@/components/ui";
import { useServerAction } from "@/components/useServerAction";

export interface LanForm {
  id?: string;
  name: string;
  organizer: string;
  place: string;
  startsAt: string;
  endsAt: string;
  description: string;
  posterUrl: string;
  status: "DRAFT" | "ANNOUNCED" | "OPEN" | "CLOSED" | "DONE";
  refundUntil: string;
  visitorPass: string;
  countsForGeneral: boolean;
  program: string;
  tournaments: { game: string; format: string; price: string; capacity: string; day: string }[];
}

const STATUS: [LanForm["status"], string][] = [
  ["DRAFT", "Brouillon (invisible)"],
  ["ANNOUNCED", "Annoncé (inscriptions bientôt)"],
  ["OPEN", "Inscriptions ouvertes"],
  ["CLOSED", "Inscriptions fermées"],
  ["DONE", "Terminé (résultats validés)"],
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="grid gap-3 border-b border-surface-2 px-[18px] py-4">
      <legend className="sr-only">{title}</legend>
      <div className="overline">{title}</div>
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,200px),1fr))]">{children}</div>
    </fieldset>
  );
}

/** Éditeur d'une LAN (CMS) : informations, tournois, inscriptions & paiement, classement. */
export function LanEditor({ initial, games }: { initial: LanForm; games: { id: string; name: string; solo: boolean; format: string }[] }) {
  const [f, setF] = useState(initial);
  const router = useRouter();
  const a = useServerAction(saveLanAction, {
    onDone: (r) => {
      if (r.ok && !initial.id) router.replace(`/admin?s=lan&msg=${encodeURIComponent(r.message ?? "Événement créé.")}`);
      else if (r.ok) router.refresh();
    },
  });
  const set = <K extends keyof LanForm>(k: K, v: LanForm[K]) => setF((x) => ({ ...x, [k]: v }));
  const tour = (game: string) => f.tournaments.find((t) => t.game === game);
  const setTour = (game: string, patch: Partial<LanForm["tournaments"][number]>) =>
    set("tournaments", f.tournaments.map((t) => (t.game === game ? { ...t, ...patch } : t)));
  const toggleGame = (g: (typeof games)[number]) =>
    set("tournaments", tour(g.id) ? f.tournaments.filter((t) => t.game !== g.id) : [...f.tournaments, { game: g.id, format: g.format, price: "", capacity: g.solo ? "32" : "16", day: "" }]);
  const e = a.errors;
  const tourErr = Object.entries(e).find(([k]) => k.startsWith("tournaments."))?.[1];

  return (
    <form
      className="card"
      onSubmit={(ev) => {
        ev.preventDefault();
        a.run({ ...f, tournaments: f.tournaments.map((t) => ({ ...t })) });
      }}
    >
      <div className="card-head"><span className="card-title">{initial.id ? `Modifier · ${initial.name}` : "Créer une LAN / un événement"}</span><span className="card-meta">Affiché sur la page LAN et l’accueil</span></div>
      <Section title="Informations">
        <Field label="Nom de l’événement *" error={e.name}>{(p) => <TextInput {...p} value={f.name} onChange={(x) => set("name", x.target.value)} placeholder="ex. R.A.G.E LAN 3" />}</Field>
        <Field label="Organisateur *" error={e.organizer}>{(p) => <TextInput {...p} value={f.organizer} onChange={(x) => set("organizer", x.target.value)} placeholder="ex. Association R.A.G.E" />}</Field>
        <Field label="Lieu *" error={e.place}>{(p) => <TextInput {...p} value={f.place} onChange={(x) => set("place", x.target.value)} placeholder="Ville, salle" />}</Field>
        <Field label="Début" hint="Heure de La Réunion" error={e.startsAt}>{(p) => <TextInput {...p} type="datetime-local" value={f.startsAt} onChange={(x) => set("startsAt", x.target.value)} />}</Field>
        <Field label="Fin" error={e.endsAt}>{(p) => <TextInput {...p} type="datetime-local" value={f.endsAt} onChange={(x) => set("endsAt", x.target.value)} />}</Field>
        <Field label="Affiche (URL)" hint="Chemin /assets/… ou https://" error={e.posterUrl}>{(p) => <TextInput {...p} value={f.posterUrl} onChange={(x) => set("posterUrl", x.target.value)} placeholder="/assets/photo-dsc05885.jpg" />}</Field>
        <div className="col-span-full">
          <Field label="Description" error={e.description}>{(p) => <TextArea {...p} rows={4} value={f.description} onChange={(x) => set("description", x.target.value)} placeholder="Présentation, ambiance, diffusion…" />}</Field>
        </div>
        <div className="col-span-full">
          <Field label="Programme" hint="Le jour sur une ligne, puis une ligne par horaire (« 09:00 Accueil »). Ligne vide entre deux jours." error={e.program}>
            {(p) => <TextArea {...p} rows={6} className="font-mono" value={f.program} onChange={(x) => set("program", x.target.value)} placeholder={"Samedi 21 novembre\n09:00 Accueil et check-in\n\nDimanche 22 novembre\n19:00 Remise des prix"} />}
          </Field>
        </div>
      </Section>

      <fieldset className="grid gap-3 border-b border-surface-2 px-[18px] py-4">
        <legend className="sr-only">Tournois</legend>
        <div className="overline">Tournois</div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Jeux au programme">
          {games.map((g) => (
            <button key={g.id} type="button" aria-pressed={!!tour(g.id)} onClick={() => toggleGame(g)} className={`h-9 cursor-pointer border px-3 text-[13px] ${tour(g.id) ? "border-orange bg-active-tint text-ink" : "border-line text-silver hover:border-[#5a5a5a]"}`}>
              {tour(g.id) ? "✓ " : "+ "}{g.name}
            </button>
          ))}
        </div>
        {f.tournaments.map((t) => {
          const g = games.find((x) => x.id === t.game)!;
          return (
            <div key={t.game} className="grid gap-2.5 border border-line p-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,150px),1fr))]">
              <div className="col-span-full font-semibold">{g.name} <span className="text-xs font-normal text-grey">· {g.solo ? "par joueur" : "par équipe"}</span></div>
              <Field label="Format">{(p) => <TextInput {...p} value={t.format} onChange={(x) => setTour(t.game, { format: x.target.value })} />}</Field>
              <Field label="Tarif (€)" hint="Vide = à venir">{(p) => <TextInput {...p} inputMode="decimal" value={t.price} onChange={(x) => setTour(t.game, { price: x.target.value })} />}</Field>
              <Field label="Places">{(p) => <TextInput {...p} type="number" min={2} value={t.capacity} onChange={(x) => setTour(t.game, { capacity: x.target.value })} />}</Field>
              <Field label="Jour">{(p) => <TextInput {...p} value={t.day} onChange={(x) => setTour(t.game, { day: x.target.value })} placeholder="Samedi" />}</Field>
            </div>
          );
        })}
        {(e.tournaments || tourErr) && <span className="text-[13px] text-red">{e.tournaments ?? tourErr}</span>}
      </fieldset>

      <Section title="Inscriptions & paiement">
        <Field label="Statut" error={e.status}>{(p) => <Select {...p} value={f.status} onChange={(x) => set("status", x.target.value as LanForm["status"])}>{STATUS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select>}</Field>
        <Field label="Prestataire de paiement">{(p) => <Select {...p} disabled value="stripe"><option value="stripe">Stripe</option></Select>}</Field>
        <Field label="Remboursable jusqu’au" error={e.refundUntil}>{(p) => <TextInput {...p} type="date" value={f.refundUntil} onChange={(x) => set("refundUntil", x.target.value)} />}</Field>
        <Field label="Pass visiteur (€ / jour)" error={e.visitorPass}>{(p) => <TextInput {...p} inputMode="decimal" value={f.visitorPass} onChange={(x) => set("visitorPass", x.target.value)} placeholder="5" />}</Field>
      </Section>

      <Section title="Classement">
        <label className="flex cursor-pointer items-center gap-2.5 text-sm">
          <input type="checkbox" checked={f.countsForGeneral} onChange={(x) => set("countsForGeneral", x.target.checked)} className="h-4 w-4 accent-orange" />
          Compte au classement général (barème LAN : Rankings + 50)
        </label>
      </Section>

      <div className="flex flex-wrap items-center gap-3 px-[18px] py-4">
        <Button type="submit" loading={a.pending}>{initial.id ? "Enregistrer" : "Créer l’événement"}</Button>
        {a.message && <span role="status" className="text-[13px] text-orange">✓ {a.message}</span>}
        <FormError message={e._} />
      </div>
    </form>
  );
}

/** Classement final d'un tournoi : on range les inscriptions payées (1er en haut). */
export function LanResultsEditor({ tournamentId, title, entries, initial, locked }: { tournamentId: string; title: string; entries: { id: string; name: string }[]; initial: string[]; locked: boolean }) {
  const places = Math.min(entries.length, 8);
  const [ranking, setRanking] = useState<string[]>(Array.from({ length: places }, (_, i) => initial[i] ?? ""));
  const a = useServerAction(saveLanResultsAction);
  return (
    <form
      className="grid gap-2 border-b border-surface-2 px-[18px] py-4"
      onSubmit={(ev) => {
        ev.preventDefault();
        a.run({ tournamentId, ranking });
      }}
    >
      <div className="flex items-baseline justify-between gap-3"><span className="font-semibold">{title}</span><span className="text-xs text-grey">{entries.length} inscrit(s) payé(s)</span></div>
      {places === 0 ? (
        <p className="text-sm text-grey">Aucune inscription payée à classer.</p>
      ) : (
        <div className="grid gap-1.5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr))]">
          {ranking.map((v, i) => (
            <label key={i} className="flex items-center gap-2 text-sm">
              <span className="w-8 font-display font-bold">{i + 1}{i === 0 ? "er" : "e"}</span>
              <Select disabled={locked} aria-label={`Place ${i + 1} · ${title}`} className="!h-9" value={v} onChange={(x) => setRanking(ranking.map((r, j) => (j === i ? x.target.value : r)))}>
                <option value="">—</option>
                {entries.map((en) => <option key={en.id} value={en.id}>{en.name}</option>)}
              </Select>
            </label>
          ))}
        </div>
      )}
      {!locked && places > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" variant="secondary" size="sm" loading={a.pending}>Enregistrer le classement</Button>
          {a.message && <span role="status" className="text-[13px] text-orange">✓ {a.message}</span>}
          <FormError message={a.errors._} />
        </div>
      )}
    </form>
  );
}

export function ValidateLanResults({ lanId, slug, disabledReason }: { lanId: string; slug: string; disabledReason?: string }) {
  const router = useRouter();
  // Une fois validée, la LAN est verrouillée et ce bloc disparaît : le message passe en bannière.
  const a = useServerAction(validateLanResultsAction, { onDone: (r) => r.ok && router.replace(`/admin?s=lan&id=${slug}&msg=${encodeURIComponent(r.message ?? "Résultats validés.")}`) });
  return (
    <div className="flex flex-wrap items-center gap-3 px-[18px] py-4">
      <Button loading={a.pending} disabledReason={disabledReason} onClick={() => a.run(lanId)}>Valider et publier les résultats</Button>
      {a.message && <span role="status" className="text-[13px] text-orange">✓ {a.message}</span>}
      <FormError message={a.errors._} />
    </div>
  );
}
