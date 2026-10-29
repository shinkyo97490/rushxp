import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

/** Mise en page Connexion / Inscription : photo d'événement à gauche, formulaire à droite. */
export function AuthShell({ photo, title, subtitle, children }: { photo: string; title: ReactNode; subtitle?: string; children: ReactNode }) {
  return (
    <main className="grid min-h-[calc(100vh-100px)] [grid-template-columns:repeat(auto-fit,minmax(min(100%,460px),1fr))]">
      <div className="relative min-h-[280px] overflow-hidden bg-black">
        <Image src={photo} alt="" fill priority sizes="(max-width: 920px) 100vw, 50vw" className="object-cover opacity-55" />
        <div className="absolute inset-0 bg-[linear-gradient(0deg,#000_5%,rgba(0,0,0,.2)_60%)]" />
        <div className="absolute inset-x-[clamp(20px,4vw,48px)] bottom-[clamp(20px,4vw,48px)]">
          <Image src="/assets/rushxp-logo.png" alt="RushXP" width={110} height={110} />
          <div className="font-display mt-3 text-[clamp(40px,5vw,60px)] font-extrabold leading-[.92]">{title}</div>
          {subtitle && <p className="mt-2 max-w-[420px] text-[15px] text-silver">{subtitle}</p>}
        </div>
      </div>
      <div className="grid w-full max-w-[620px] content-start gap-5 px-[clamp(20px,4vw,56px)] py-10">
        <Link href="/" className="justify-self-start text-[13px] text-grey hover:text-orange">← Retour au site</Link>
        {children}
      </div>
    </main>
  );
}
