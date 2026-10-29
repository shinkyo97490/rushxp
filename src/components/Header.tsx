import Image from "next/image";
import Link from "next/link";
import { ROLE_LABEL, isStaff } from "@/lib/session-shared";
import type { Viewer } from "@/lib/auth/viewer";
import { receivedChallengeCount } from "@/lib/data/challenges";
import { NavLinks, type NavItem } from "./NavLinks";
import { AccountMenu } from "./AccountMenu";

const iconBtn =
  "relative grid h-[38px] w-[38px] flex-none place-items-center border border-line bg-surface transition-colors duration-150 hover:border-orange";

export function Header({ viewer }: { viewer: Viewer | null }) {
  const role = viewer?.role ?? "visiteur";
  const member = !!viewer;
  const received = member ? receivedChallengeCount() : 0;
  const nav: NavItem[] = [
    { href: "/", label: "Accueil", match: ["/"] },
    { href: "/rankings/defis", label: "Défis", match: ["/rankings/defis"], badge: received },
    { href: "/classement", label: "Classements", match: ["/classement", "/rankings", "/mvp"] },
    { href: "/calendrier", label: "Calendrier", match: ["/calendrier", "/match"] },
    { href: "/competitions", label: "Compétitions", match: ["/competitions", "/playoffs"] },
    { href: "/rdv", label: "RDV mensuels", match: ["/rdv"] },
    { href: "/actualites", label: "Actualités", match: ["/actualites"] },
    { href: "/recrutement", label: "Recrutement", match: ["/recrutement"] },
    { href: "/partenaires", label: "Partenaires", match: ["/partenaires"] },
    { href: "/le-circuit", label: "Le circuit", match: ["/le-circuit", "/reglement"] },
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-[rgba(10,10,10,.94)] backdrop-blur-md">
      <div className="container-rx flex h-[68px] items-center gap-[clamp(8px,1.4vw,20px)]">
        <Link href="/" className="flex flex-none" aria-label="RushXP · accueil">
          <Image src="/assets/rushxp-logo-sm.png" alt="RushXP" width={46} height={46} priority />
        </Link>
        <NavLinks items={nav} />
        <div className="ml-auto hidden h-[38px] max-w-[320px] min-w-0 flex-1 items-center gap-2 overflow-hidden border border-line bg-surface px-2.5 2xl:flex">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#8A8A8A" strokeWidth="1.6" aria-hidden>
            <circle cx="6" cy="6" r="4.5" />
            <line x1="9.5" y1="9.5" x2="13" y2="13" />
          </svg>
          <input placeholder="Structure, joueur, compétition…" aria-label="Rechercher" className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none" />
        </div>
        {member && (
          <Link href="/messages" title="Messages" className={iconBtn}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#BFC1C4" strokeWidth="1.5" aria-hidden>
              <path d="M2 3h12v8H7l-3 3v-3H2z" />
            </svg>
            <span className="sr-only">Messages</span>
          </Link>
        )}
        {member && (
          <Link href="/notifications" title="Notifications" className={iconBtn}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#BFC1C4" strokeWidth="1.5" aria-hidden>
              <path d="M4 11V7a4 4 0 0 1 8 0v4l1 1.5H3z" />
              <line x1="6.5" y1="14.5" x2="9.5" y2="14.5" />
            </svg>
            <span className="absolute -top-[5px] -right-[5px] grid h-4 w-4 place-items-center bg-orange text-[10px] font-bold text-bg">3</span>
            <span className="sr-only">Notifications, 3 non lues</span>
          </Link>
        )}
        {isStaff(role) && (
          <>
            {role === "admin" && (
              <Link href="/admin" className="btn btn-secondary !min-h-[38px] !px-3 !text-sm">Admin</Link>
            )}
            <Link href="/arbitrage" className="btn btn-tertiary !min-h-[38px] !px-3 !text-sm">Arbitrage</Link>
          </>
        )}
        {viewer ? (
          <AccountMenu pseudo={viewer.pseudo} roleLabel={ROLE_LABEL[role]} structure={viewer.structure} />
        ) : (
          <Link href="/connexion" className="btn btn-primary clip-corner-sm !min-h-[38px] !px-4">Connexion</Link>
        )}
      </div>
    </header>
  );
}
