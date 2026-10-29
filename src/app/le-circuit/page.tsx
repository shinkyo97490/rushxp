import type { Metadata } from "next";
import Link from "next/link";
import { GUIDE } from "@/lib/data/content";
import { PHASES } from "@/lib/season";
import { TabLinks } from "@/components/PageHeader";

export const metadata: Metadata = { title: "Le circuit" };

export default async function CircuitPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab: t } = await searchParams;
  const tab = t && t in GUIDE ? t : "joueurs";
  const g = GUIDE[tab];
  const faq = tab === "faq";
  return (
    <main className="mx-auto max-w-[1100px] px-[clamp(16px,3vw,40px)] pt-7 pb-16">
      <div className="text-[13px] font-semibold uppercase tracking-[.14em] text-grey">Guide RushXP · saison {new Date().getFullYear()}</div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display mt-1 text-[clamp(44px,7vw,64px)] font-extrabold leading-none">Le circuit RushXP</h1>
        <Link href="/reglement" className="text-sm font-semibold">Lire le règlement complet →</Link>
      </div>
      <p className="mt-3 max-w-[760px] text-[16px] text-silver">
        Un classement permanent par jeu, des défis toute l’année, deux splits en divisions de 8 et des Playoffs pour le top 8 de la Division 1, avec 2 500 € de cashprize.
      </p>
      <div className="mt-5 grid border border-line bg-surface [grid-template-columns:repeat(auto-fit,minmax(min(100%,180px),1fr))]">
        {PHASES.map((p) => (
          <div key={p.key} className="border-r border-b border-line px-4 py-3">
            <div className="text-[11px] font-bold uppercase tracking-[.1em] text-orange">{p.when}</div>
            <div className="font-display text-lg font-bold">{p.label}</div>
          </div>
        ))}
      </div>
      <TabLinks active={tab} tabs={Object.entries(GUIDE).map(([k, v]) => ({ key: k, label: v.label, href: `/le-circuit?tab=${k}` }))} />
      <div className="mt-4 grid gap-3">
        {g.blocks.map((b, i) => (
          <div key={b.t} className="card flex gap-4 p-[18px]">
            <span className={`grid h-10 w-10 flex-none place-items-center font-display text-lg font-extrabold ${faq ? "border border-line text-orange" : "bg-orange text-bg"}`}>{faq ? "?" : i + 1}</span>
            <div>
              <div className="font-display text-xl font-bold">{b.t}</div>
              <div className="mt-1 text-[15px] text-silver">{b.d}</div>
              {b.cta && <Link href={b.cta[1]} className="mt-2 inline-block text-sm font-semibold">{b.cta[0]} →</Link>}
            </div>
          </div>
        ))}
      </div>
      {faq && <p className="mt-4 text-sm text-grey">Une autre question ? Écrivez à l’équipe RushXP à <a href="mailto:contact@rushxp.re">contact@rushxp.re</a>.</p>}
    </main>
  );
}
