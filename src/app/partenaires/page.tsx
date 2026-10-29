import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { db } from "@/lib/db";
import { AD_SLOTS, PARTNERS, SEASON_PEAKS } from "@/lib/data/content";
import { DEMO_CAMPAIGNS } from "@/lib/data/demo-competition";
import { PageHeader } from "@/components/PageHeader";
import { PartnerForm } from "@/components/PartnerForm";

export const metadata: Metadata = { title: "Partenaires" };

export default async function PartenairesPage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const { p } = await searchParams;
  const sel = PARTNERS.find((x) => x.id === p) ?? PARTNERS[0];
  const camps = DEMO_CAMPAIGNS.filter((c) => c.partner === sel.name);
  const [players, structures] = await Promise.all([db.user.count({ where: { status: "ACTIVE" } }), db.structure.count({ where: { status: "VERIFIED" } })]);

  return (
    <main className="container-rx pt-7 pb-16">
      <PageHeader title="Partenaires">Les marques et institutions qui soutiennent la saison RushXP. Logos affichés dans leurs proportions d’origine, sur fond neutre.</PageHeader>
      <div className="mt-5 grid items-start gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr))] lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(min(100%,200px),1fr))]">
          {PARTNERS.map((x) => (
            <Link key={x.id} href={`/partenaires?p=${x.id}`} aria-current={x.id === sel.id ? "true" : undefined} className={`grid border bg-surface text-ink hover:text-ink ${x.id === sel.id ? "border-orange" : "border-line hover:border-[#5a5a5a]"}`}>
              <div className="grid h-[120px] place-items-center border-b border-line bg-bg p-4">
                <Image src={x.logo} alt={x.name} width={150} height={80} className="max-h-[80px] w-auto object-contain" />
              </div>
              <div className="px-4 py-3"><div className="font-semibold">{x.name}</div><div className="text-xs text-grey">{x.cat}</div></div>
            </Link>
          ))}
        </div>
        <aside className="card lg:sticky lg:top-[88px]">
          <div className="grid h-[160px] place-items-center border-b border-line bg-bg p-6">
            <Image src={sel.logo} alt={sel.name} width={200} height={110} className="max-h-[110px] w-auto object-contain" />
          </div>
          <div className="grid gap-1.5 p-[18px]">
            <div className="overline">{sel.cat}</div>
            <div className="font-display text-[28px] font-extrabold leading-none">{sel.name}</div>
            <p className="text-sm text-silver">{sel.desc}</p>
          </div>
          <div className="border-t border-line">
            <div className="overline px-[18px] pt-3">Campagnes actives</div>
            {camps.map((c) => (
              <div key={c.name} className="flex justify-between gap-3 border-b border-surface-2 px-[18px] py-2.5 text-sm"><span>{c.name}</span><span className="text-xs text-grey">{c.slot}</span></div>
            ))}
            {camps.length === 0 && <div className="px-[18px] py-3 text-[13px] text-grey">Aucune campagne en cours.</div>}
          </div>
        </aside>
      </div>

      <h2 className="font-display mt-10 text-[34px] font-extrabold">Emplacements publicitaires</h2>
      <p className="text-sm text-silver">Gabarits de référence. Chaque emplacement porte un label visible et reste hors des zones de chat et d’action de match.</p>
      <div className="mt-4 grid gap-4">
        <div>
          <div className="mb-1.5 text-sm font-semibold">Bannière d’accueil <span className="font-normal text-grey">· 1360×160</span></div>
          <div className="relative h-[120px] overflow-hidden border border-line bg-black">
            <Image src="/assets/campaign-mcdelivery.png" alt="" fill className="object-contain" sizes="1360px" />
            <span className="badge absolute top-2 right-2 bg-bg text-silver">Publicité</span>
          </div>
        </div>
        <div>
          <div className="mb-1.5 text-sm font-semibold">Bandeau de compétition <span className="font-normal text-grey">· 100 %×72</span></div>
          <div className="flex h-[72px] items-center gap-4 border border-line bg-surface px-4">
            <span className="badge text-silver">Partenaire</span>
            <Image src="/assets/partner-orange.png" alt="Orange" width={48} height={48} className="h-10 w-auto" />
            <span className="font-display text-lg font-bold">Orange présente les Playoffs RushXP</span>
          </div>
        </div>
        <div className="max-w-[640px]">
          <div className="mb-1.5 text-sm font-semibold">Visuel événementiel <span className="font-normal text-grey">· 1200×675</span></div>
          <div className="relative aspect-video overflow-hidden border border-line">
            <Image src="/assets/photo-dsc05800.jpg" alt="" fill className="object-cover" sizes="640px" />
            <span className="absolute bottom-3 left-3 flex items-center gap-2 bg-bg/85 px-3 py-2 text-[11px] font-bold tracking-[.08em]">AVEC LE SOUTIEN DE <Image src="/assets/partner-saintpaul.png" alt="Saint-Paul" width={60} height={30} className="h-6 w-auto" /></span>
            <span className="badge absolute top-2 right-2 bg-bg text-silver">Événement</span>
          </div>
        </div>
      </div>

      <section id="devenir-partenaire" className="mt-12 scroll-mt-24">
        <h2 className="font-display text-[34px] font-extrabold">Devenir partenaire</h2>
        <div className="mt-3 grid border border-line bg-surface [grid-template-columns:repeat(auto-fit,minmax(min(100%,170px),1fr))]">
          {[["Membres inscrits", players], ["Structures vérifiées", structures], ["Jeux", 8], ["Cashprize Playoffs", "2 500 €"]].map(([k, v]) => (
            <div key={k as string} className="border-r border-b border-line px-4 py-3"><div className="overline !font-normal">{k}</div><div className="font-display text-[30px] font-extrabold">{v}</div></div>
          ))}
        </div>
        <div className="mt-4 grid items-start gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr))]">
          <div className="grid gap-4">
            <section className="card">
              <div className="card-head"><span className="card-title">Temps forts de l’année</span></div>
              {SEASON_PEAKS.map(([w, t, d, l]) => (
                <div key={w} className="grid grid-cols-[120px_minmax(0,1fr)_80px] items-center gap-3 border-b border-surface-2 px-[18px] py-2.5 text-sm">
                  <span className="text-xs text-grey">{w}</span>
                  <span><strong>{t}</strong> <span className="text-grey">· {d}</span></span>
                  <span className={`text-right text-[11px] font-bold ${l === "Très fort" ? "text-yellow" : l === "Fort" ? "text-orange" : "text-silver"}`}>{l.toUpperCase()}</span>
                </div>
              ))}
            </section>
            <section className="card">
              <div className="card-head"><span className="card-title">Emplacements disponibles</span></div>
              <div className="grid [grid-template-columns:repeat(auto-fit,minmax(min(100%,180px),1fr))]">
                {AD_SLOTS.map(([t, d]) => (
                  <div key={t} className="border-r border-b border-surface-2 px-[18px] py-3"><div className="font-semibold">{t}</div><div className="text-xs text-grey">{d}</div></div>
                ))}
              </div>
            </section>
          </div>
          <section className="card">
            <div className="card-head"><span className="card-title">Nous contacter</span></div>
            <PartnerForm />
          </section>
        </div>
      </section>
    </main>
  );
}
