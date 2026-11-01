"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { saveCampaignAction, saveCompetitionTextAction, saveHomeAction, savePartnerAction, setMaintenanceAction } from "@/lib/site/actions";
import { useServerAction } from "@/components/useServerAction";
import { Field, FormError, Select, TextArea, TextInput } from "@/components/forms";
import { ImageUpload } from "@/components/ImageUpload";

function Done({ a }: { a: { message: string | null; errors: Record<string, string> } }) {
  return (
    <>
      {a.message && <span role="status" className="text-[13px] text-orange">✓ {a.message}</span>}
      <FormError message={a.errors._} />
    </>
  );
}

function Toggle({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-orange" />
      {children}
    </label>
  );
}

// ─── Page d'accueil ──────────────────────────────────────────────

export interface HomeForm {
  title: string;
  accent: string;
  subtitle: string;
  heroImage: string;
  bannerLan: string;
  blocks: string[];
}

/** Éditeur de l'accueil avec aperçu en direct du héros. */
export function HomeEditor({ initial, allBlocks, lans }: { initial: HomeForm; allBlocks: readonly string[]; lans: { slug: string; name: string }[] }) {
  const [f, setF] = useState(initial);
  const a = useServerAction(saveHomeAction);
  const set = <K extends keyof HomeForm>(k: K, v: HomeForm[K]) => setF((x) => ({ ...x, [k]: v }));
  return (
    <form className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]" onSubmit={(e) => { e.preventDefault(); a.run(f); }}>
      <div className="grid content-start gap-3">
        <div className="overline">1 · Héros</div>
        <Field label="Titre" error={a.errors.title}>{(p) => <TextInput {...p} value={f.title} onChange={(e) => set("title", e.target.value)} />}</Field>
        <Field label="Suite du titre (en orange)" error={a.errors.accent}>{(p) => <TextInput {...p} value={f.accent} onChange={(e) => set("accent", e.target.value)} />}</Field>
        <Field label="Sous-titre" error={a.errors.subtitle}>{(p) => <TextArea {...p} rows={3} value={f.subtitle} onChange={(e) => set("subtitle", e.target.value)} />}</Field>
        <Field label="Visuel (chemin ou https://)" error={a.errors.heroImage}>{(p) => <TextInput {...p} value={f.heroImage} onChange={(e) => set("heroImage", e.target.value)} />}</Field>
        <ImageUpload folder="accueil" onUploaded={(u) => set("heroImage", u)} />
        <div className="overline mt-2">2 · Mises en avant</div>
        <Field label="Bannière LAN sous le héros" hint="Par défaut : la prochaine LAN annoncée ou ouverte.">
          {(p) => (
            <Select {...p} value={f.bannerLan} onChange={(e) => set("bannerLan", e.target.value)}>
              <option value="">Automatique</option>
              {lans.map((l) => <option key={l.slug} value={l.slug}>{l.name}</option>)}
            </Select>
          )}
        </Field>
        <div className="grid gap-1.5">
          <span className="overline">Blocs affichés</span>
          {allBlocks.map((b) => (
            <Toggle key={b} checked={f.blocks.includes(b)} onChange={(on) => set("blocks", on ? [...f.blocks, b] : f.blocks.filter((x) => x !== b))}>{b}</Toggle>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button className="btn btn-primary btn-sm" disabled={a.pending}>Publier</button>
          <Done a={a} />
        </div>
      </div>
      <div className="grid content-start gap-2">
        <div className="overline">Aperçu</div>
        <div className="relative overflow-hidden border border-line bg-black px-6 py-8">
          {/^(\/|https:\/\/)/.test(f.heroImage) && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={f.heroImage} alt="" className="absolute inset-0 h-full w-full object-cover opacity-40" />
          )}
          <div className="relative">
            <div className="font-display text-[40px] font-extrabold leading-[.9]">{f.title || "Titre"}<br /><span className="text-orange">{f.accent}</span></div>
            <p className="mt-3 max-w-[420px] text-sm text-silver">{f.subtitle}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1">{f.blocks.map((b) => <span key={b} className="badge text-silver">{b}</span>)}</div>
      </div>
    </form>
  );
}

export function MaintenanceToggle({ on, message }: { on: boolean; message: string }) {
  const [text, setText] = useState(message);
  const router = useRouter();
  const a = useServerAction(setMaintenanceAction, { onDone: (r) => r.ok && router.refresh() });
  return (
    <div className="grid gap-2">
      <Field label="Message affiché aux visiteurs">{(p) => <TextInput {...p} value={text} onChange={(e) => setText(e.target.value)} placeholder="Maintenance programmée jusqu’à 22:00." />}</Field>
      <div className="flex flex-wrap items-center gap-3">
        <button className={`btn btn-sm ${on ? "btn-secondary" : "btn-danger"}`} disabled={a.pending} onClick={() => a.run({ on: !on, message: text })}>{on ? "Désactiver la maintenance" : "Activer la maintenance"}</button>
        <Done a={a} />
      </div>
    </div>
  );
}

// ─── Partenaires ─────────────────────────────────────────────────

export interface PartnerFormData {
  id?: string;
  name: string;
  category: string;
  level: "MAIN" | "OFFICIAL" | "ASSOCIATIVE";
  site: string;
  description: string;
  logoUrl: string;
  band: boolean;
  active: boolean;
  order: string;
}

export function PartnerEditor({ initial }: { initial: PartnerFormData }) {
  const [f, setF] = useState(initial);
  const router = useRouter();
  const a = useServerAction(savePartnerAction, { onDone: (r) => r.ok && !initial.id && router.replace(`/admin?s=partners&msg=${encodeURIComponent(r.message ?? "Partenaire créé.")}`) });
  const set = <K extends keyof PartnerFormData>(k: K, v: PartnerFormData[K]) => setF((x) => ({ ...x, [k]: v }));
  return (
    <form className="grid gap-3 px-[18px] py-4" onSubmit={(e) => { e.preventDefault(); a.run(f); }}>
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,200px),1fr))]">
        <Field label="Nom *" error={a.errors.name}>{(p) => <TextInput {...p} value={f.name} onChange={(e) => set("name", e.target.value)} />}</Field>
        <Field label="Catégorie *" error={a.errors.category}>{(p) => <TextInput {...p} value={f.category} onChange={(e) => set("category", e.target.value)} placeholder="Restauration, Association…" />}</Field>
        <Field label="Niveau">{(p) => <Select {...p} value={f.level} onChange={(e) => set("level", e.target.value as PartnerFormData["level"])}><option value="MAIN">Partenaire principal</option><option value="OFFICIAL">Partenaire officiel</option><option value="ASSOCIATIVE">Partenaire associatif</option></Select>}</Field>
        <Field label="Site web" error={a.errors.site}>{(p) => <TextInput {...p} value={f.site} onChange={(e) => set("site", e.target.value)} placeholder="https://…" />}</Field>
        <Field label="Logo (PNG transparent) *" error={a.errors.logoUrl}>{(p) => <TextInput {...p} value={f.logoUrl} onChange={(e) => set("logoUrl", e.target.value)} placeholder="/assets/partner-….png" />}</Field>
        <Field label="Ordre" error={a.errors.order}>{(p) => <TextInput {...p} type="number" min={0} value={f.order} onChange={(e) => set("order", e.target.value)} />}</Field>
      </div>
      <ImageUpload folder="partenaires" label="Envoyer le logo" onUploaded={(u) => set("logoUrl", u)} />
      <Field label="Description" error={a.errors.description}>{(p) => <TextArea {...p} rows={2} value={f.description} onChange={(e) => set("description", e.target.value)} />}</Field>
      <div className="flex flex-wrap gap-5">
        <Toggle checked={f.band} onChange={(v) => set("band", v)}>Bande partenaires de l’accueil</Toggle>
        <Toggle checked={f.active} onChange={(v) => set("active", v)}>Visible sur le site</Toggle>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn btn-primary btn-sm" disabled={a.pending}>{initial.id ? "Enregistrer" : "Ajouter le partenaire"}</button>
        <Done a={a} />
      </div>
    </form>
  );
}

// ─── Campagnes ───────────────────────────────────────────────────

export interface CampaignFormData {
  id?: string;
  partnerId: string;
  name: string;
  slot: string;
  imageUrl: string;
  title: string;
  body: string;
  link: string;
  startsOn: string;
  endsOn: string;
  cap: string;
  active: boolean;
}

export function CampaignEditor({ initial, partners, slots }: { initial: CampaignFormData; partners: { id: string; name: string }[]; slots: [string, string][] }) {
  const [f, setF] = useState(initial);
  const router = useRouter();
  const a = useServerAction(saveCampaignAction, { onDone: (r) => r.ok && !initial.id && router.replace(`/admin?s=campaigns&msg=${encodeURIComponent(r.message ?? "Campagne créée.")}`) });
  const set = <K extends keyof CampaignFormData>(k: K, v: CampaignFormData[K]) => setF((x) => ({ ...x, [k]: v }));
  return (
    <form className="grid gap-3 px-[18px] py-4" onSubmit={(e) => { e.preventDefault(); a.run(f); }}>
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,200px),1fr))]">
        <Field label="Partenaire *" error={a.errors.partnerId}>{(p) => <Select {...p} value={f.partnerId} onChange={(e) => set("partnerId", e.target.value)}><option value="">—</option>{partners.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select>}</Field>
        <Field label="Nom de la campagne *" error={a.errors.name}>{(p) => <TextInput {...p} value={f.name} onChange={(e) => set("name", e.target.value)} />}</Field>
        <Field label="Emplacement">{(p) => <Select {...p} value={f.slot} onChange={(e) => set("slot", e.target.value)}>{slots.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select>}</Field>
        <Field label="Visuel" error={a.errors.imageUrl}>{(p) => <TextInput {...p} value={f.imageUrl} onChange={(e) => set("imageUrl", e.target.value)} placeholder="/assets/campaign-….png" />}</Field>
        <Field label="Lien *" error={a.errors.link}>{(p) => <TextInput {...p} value={f.link} onChange={(e) => set("link", e.target.value)} placeholder="https://… ou /partenaires" />}</Field>
        <Field label="Plafond d’impressions" hint="Vide = illimité" error={a.errors.cap}>{(p) => <TextInput {...p} inputMode="numeric" value={f.cap} onChange={(e) => set("cap", e.target.value)} />}</Field>
        <Field label="Début *" error={a.errors.startsOn}>{(p) => <TextInput {...p} type="date" value={f.startsOn} onChange={(e) => set("startsOn", e.target.value)} />}</Field>
        <Field label="Fin" error={a.errors.endsOn}>{(p) => <TextInput {...p} type="date" value={f.endsOn} onChange={(e) => set("endsOn", e.target.value)} />}</Field>
      </div>
      <ImageUpload folder="publicites" label="Envoyer le visuel" onUploaded={(u) => set("imageUrl", u)} />
      <Field label="Texte affiché *" error={a.errors.title}>{(p) => <TextInput {...p} value={f.title} onChange={(e) => set("title", e.target.value)} />}</Field>
      <Toggle checked={f.active} onChange={(v) => set("active", v)}>Campagne active</Toggle>
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn btn-primary btn-sm" disabled={a.pending}>{initial.id ? "Enregistrer" : "Créer la campagne"}</button>
        <Done a={a} />
      </div>
    </form>
  );
}

// ─── Compétitions ────────────────────────────────────────────────

export function CompetitionTextEditor({ game, name, initial }: { game: string; name: string; initial: { comp: string; desc: string; photo: string } }) {
  const [f, setF] = useState(initial);
  const a = useServerAction(saveCompetitionTextAction);
  return (
    <form className="grid gap-3 border-b border-surface-2 px-[18px] py-4" onSubmit={(e) => { e.preventDefault(); a.run({ game, ...f }); }}>
      <div className="font-display text-lg font-bold">{name}</div>
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr))]">
        <Field label="Nom de la compétition" error={a.errors.comp}>{(p) => <TextInput {...p} value={f.comp} onChange={(e) => setF({ ...f, comp: e.target.value })} />}</Field>
        <Field label="Bannière (chemin ou https://)" error={a.errors.photo}>{(p) => <TextInput {...p} value={f.photo} onChange={(e) => setF({ ...f, photo: e.target.value })} />}</Field>
      </div>
      <Field label="Description" error={a.errors.desc}>{(p) => <TextArea {...p} rows={2} value={f.desc} onChange={(e) => setF({ ...f, desc: e.target.value })} />}</Field>
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn btn-secondary btn-sm" disabled={a.pending}>Publier</button>
        <Done a={a} />
      </div>
    </form>
  );
}
