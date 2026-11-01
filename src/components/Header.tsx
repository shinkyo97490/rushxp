import Link from "next/link";
import { ROLE_LABEL, isStaff } from "@/lib/session-shared";
import type { Viewer } from "@/lib/auth/viewer";
import { NavLinks, type NavItem } from "./NavLinks";
import { AccountMenu } from "./AccountMenu";
import { MobileNav } from "./MobileNav";
import { Logo } from "@/components/Logo";

const iconBtn =
  "relative grid h-[38px] w-[38px] flex-none place-items-center border border-line bg-surface transition-colors duration-150 hover:border-orange";

export function Header({
  viewer,
  received = 0,
}: {
  viewer: Viewer | null;
  received?: number;
}) {
  const role = viewer?.role ?? "visiteur";
  const member = !!viewer;
  const nav: NavItem[] = [
    {
      href: "/rankings/defis",
      label: "Défis",
      hint: "Lancer et suivre vos défis",
      match: ["/rankings/defis", "/match"],
      badge: received,
    },
    {
      href: "/classement",
      label: "Classements",
      match: ["/classement", "/rankings", "/mvp"],
    },
    {
      href: "/calendrier",
      label: "Calendrier",
      match: ["/calendrier", "/feuille-de-match"],
    },
    {
      href: "/competitions",
      label: "Compétitions",
      match: [],
      children: [
        {
          href: "/competitions",
          label: "Toutes les compétitions",
          hint: "Formats, jeux et inscriptions",
          match: ["/competitions"],
        },
        {
          href: "/rdv",
          label: "RDV mensuels",
          hint: "Un tournoi par mois et par jeu",
          match: ["/rdv"],
        },
        {
          href: "/lan",
          label: "LAN & événements",
          hint: "Événements en présentiel, +50 pts",
          match: ["/lan"],
        },
        {
          href: "/playoffs",
          label: "Playoffs",
          hint: "Top 8 de la Division 1 · 2 500 €",
          match: ["/playoffs"],
        },
      ],
    },
    {
      href: "/communaute",
      label: "Communauté",
      match: [],
      children: [
        {
          href: "/recrutement",
          label: "Recrutement",
          hint: "Trouver une équipe ou des joueurs",
          match: ["/recrutement", "/structure", "/joueur"],
        },
        {
          href: "/actualites",
          label: "Actualités",
          hint: "Résultats, annonces, transferts",
          match: ["/actualites"],
        },
        {
          href: "/partenaires",
          label: "Partenaires",
          hint: "Ils soutiennent la scène réunionnaise",
          match: ["/partenaires"],
        },
        {
          href: "/le-circuit",
          label: "Le circuit",
          hint: "Comment ça marche, FAQ",
          match: ["/le-circuit"],
        },
        {
          href: "/reglement",
          label: "Règlement",
          hint: "Règles générales et par jeu",
          match: ["/reglement"],
        },
      ],
    },
  ];
  const staffLinks = [
    ...(role === "admin" ? [{ href: "/admin", label: "Admin" }] : []),
    ...(isStaff(role) ? [{ href: "/arbitrage", label: "Arbitrage" }] : []),
  ];

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-line bg-[rgba(10,10,10,.94)] backdrop-blur-md">
        <div className="container-rx flex h-[68px] items-center gap-[clamp(8px,1.4vw,20px)]">
          <Link
            href="/"
            className="flex flex-none"
            aria-label="RushXP · accueil"
          >
            <Logo size={22} />
          </Link>
          <NavLinks items={nav} />
          <div className="flex-1" />
          {member && (
            <Link href="/messages" title="Messages" className={iconBtn}>
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                stroke="#BFC1C4"
                strokeWidth="1.5"
                aria-hidden
              >
                <path d="M2 3h12v8H7l-3 3v-3H2z" />
              </svg>
              {viewer!.unreadMessages > 0 && (
                <span className="absolute -top-[5px] -right-[5px] grid h-4 min-w-4 place-items-center bg-orange px-1 text-[10px] font-bold text-bg">
                  {viewer!.unreadMessages}
                </span>
              )}
              <span className="sr-only">
                Messages, {viewer!.unreadMessages} non lu(s)
              </span>
            </Link>
          )}
          {viewer && (
            <Link
              href="/notifications"
              title="Notifications"
              className={iconBtn}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                stroke="#BFC1C4"
                strokeWidth="1.5"
                aria-hidden
              >
                <path d="M4 11V7a4 4 0 0 1 8 0v4l1 1.5H3z" />
                <line x1="6.5" y1="14.5" x2="9.5" y2="14.5" />
              </svg>
              {viewer.unreadNotifications > 0 && (
                <span className="absolute -top-[5px] -right-[5px] grid h-4 min-w-4 place-items-center bg-orange px-1 text-[10px] font-bold text-bg">
                  {viewer.unreadNotifications > 99
                    ? "99+"
                    : viewer.unreadNotifications}
                </span>
              )}
              <span className="sr-only">
                Notifications, {viewer.unreadNotifications} non lue(s)
              </span>
            </Link>
          )}
          {isStaff(role) && (
            <>
              {role === "admin" && (
                <Link
                  href="/admin"
                  className="btn btn-secondary !hidden !min-h-[38px] !px-3 !text-sm lg:!inline-flex"
                >
                  Admin
                </Link>
              )}
              <Link
                href="/arbitrage"
                className="btn btn-tertiary !hidden !min-h-[38px] !px-3 !text-sm lg:!inline-flex"
              >
                Arbitrage
              </Link>
            </>
          )}
          {viewer ? (
            <AccountMenu
              pseudo={viewer.pseudo}
              roleLabel={ROLE_LABEL[role]}
              structure={viewer.structure}
              staff={role === "admin" || role === "arbitre" ? role : null}
            />
          ) : (
            <Link
              href="/connexion"
              className="btn btn-primary clip-corner-sm !min-h-[38px] !px-4"
            >
              Connexion
            </Link>
          )}
        </div>
      </header>
      <MobileNav
        items={nav}
        received={received}
        staff={staffLinks}
        signedIn={!!viewer}
      />
    </>
  );
}
