import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SYSTEM_STATES } from "@/lib/data/content";

type Params = { params: Promise<{ code: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const s = SYSTEM_STATES[(await params).code];
  return { title: s?.title ?? "Page introuvable", robots: { index: false } };
}

const TONE = { orange: "text-orange", yellow: "text-yellow", red: "text-red", silver: "text-silver" } as const;

/** États système (maintenance, compte suspendu, connexion perdue). La 404 est gérée par not-found.tsx. */
export default async function EtatPage({ params }: Params) {
  const s = SYSTEM_STATES[(await params).code];
  if (!s) notFound();
  const link = (href: string, label: string, primary: boolean) =>
    href.startsWith("mailto:") ? (
      <a key={label} href={href} className={`btn ${primary ? "btn-primary" : "btn-tertiary"}`}>{label}</a>
    ) : (
      <Link key={label} href={href} className={`btn ${primary ? "btn-primary" : "btn-tertiary"}`}>{label}</Link>
    );
  return (
    <main className="hero-pattern grid min-h-[70vh] place-items-center px-4 py-16 text-center">
      <div className="grid max-w-[560px] justify-items-center gap-3">
        <Image src="/assets/rushxp-logo.png" alt="RushXP" width={110} height={110} />
        <span className={`font-display text-[72px] font-extrabold leading-none ${TONE[s.tone]}`}>{s.code}</span>
        <h1 className="font-display text-[40px] font-extrabold leading-none">{s.title}</h1>
        <p className="text-[15px] text-silver">{s.text}</p>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {link(s.primary[1], s.primary[0], true)}
          {s.secondary && link(s.secondary[1], s.secondary[0], false)}
        </div>
      </div>
    </main>
  );
}
