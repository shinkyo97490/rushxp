"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { SOCIALS } from "@/lib/data/content";
import { SocialIcon } from "./SocialIcon";
import type { NavItem } from "./NavLinks";

const ICONS: Record<string, React.ReactNode> = {
  home: <path d="M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z" />,
  duel: <path d="M5 19 19 5M14 5h5v5M5 14l5 5M3 21l3-3M18 18l3 3M19 14l-5 5" />,
  cal: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
  rank: <path d="M4 20V11h4v9M10 20V5h4v15M16 20v-6h4v6" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
};
const Icon = ({ id }: { id: string }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {ICONS[id]}
  </svg>
);

const hit = (path: string, m: string) => (m === "/" ? path === "/" : path === m || path.startsWith(m + "/"));

/**
 * Mobile : barre d'onglets en bas d'écran (les 4 rubriques les plus utilisées + Menu)
 * et menu plein écran avec toutes les rubriques, l'espace staff et les réseaux.
 */
export function MobileNav({ items, received, staff, signedIn }: { items: NavItem[]; received: number; staff: { href: string; label: string }[]; signedIn: boolean }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(path);
  if (seen !== path) {
    // Changement de page : on referme le menu.
    setSeen(path);
    setOpen(false);
  }
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const tabs = [
    { href: "/", label: "Accueil", icon: "home", match: ["/"] },
    { href: "/rankings/defis", label: "Défis", icon: "duel", match: ["/rankings/defis", "/match"], badge: received },
    { href: "/calendrier", label: "Calendrier", icon: "cal", match: ["/calendrier", "/feuille-de-match"] },
    { href: "/classement", label: "Classements", icon: "rank", match: ["/classement", "/rankings", "/mvp"] },
  ];
  const activeTab = open ? null : tabs.filter((t) => t.match.some((m) => hit(path, m))).sort((a, b) => Math.max(...b.match.filter((m) => hit(path, m)).map((m) => m.length)) - Math.max(...a.match.filter((m) => hit(path, m)).map((m) => m.length)))[0];

  return (
    <>
      {open && (
        <div id="menu-mobile" role="dialog" aria-modal="true" aria-label="Menu" className="fixed inset-x-0 top-0 bottom-[calc(64px+env(safe-area-inset-bottom))] z-40 overflow-y-auto bg-bg lg:hidden">
          <div className="grid gap-6 px-4 pt-5 pb-8">
            {!signedIn && (
              <div className="grid grid-cols-2 gap-2">
                <Link href="/connexion" className="btn btn-primary">Connexion</Link>
                <Link href="/inscription" className="btn btn-secondary">Créer un compte</Link>
              </div>
            )}
            {items.filter((it) => it.children).map((it) => (
              <section key={it.href}>
                <div className="overline mb-1.5">{it.label}</div>
                <div className="grid border border-line bg-surface">
                  {it.children!.map((c) => {
                    const on = c.match.some((m) => hit(path, m));
                    return (
                      <Link key={c.href} href={c.href} className={`flex min-h-[52px] items-center justify-between gap-3 border-b border-line border-l-2 px-4 py-2 text-ink last:border-b-0 ${on ? "border-l-orange bg-surface-2" : "border-l-transparent"}`}>
                        <span className="min-w-0">
                          <span className="block font-semibold">{c.label}</span>
                          {c.hint && <span className="block truncate text-xs text-grey">{c.hint}</span>}
                        </span>
                        {c.badge ? <span className="grid h-5 min-w-5 place-items-center bg-orange px-1 text-[11px] font-bold text-bg">{c.badge}</span> : <span className="text-grey" aria-hidden>›</span>}
                      </Link>
                    );
                  })}
                </div>
              </section>
            ))}
            {staff.length > 0 && (
              <section>
                <div className="overline mb-1.5">Staff</div>
                <div className="grid grid-cols-2 gap-2">
                  {staff.map((s) => <Link key={s.href} href={s.href} className="btn btn-secondary">{s.label}</Link>)}
                </div>
              </section>
            )}
            <section>
              <div className="overline mb-1.5">Suivez RushXP</div>
              <div className="flex flex-wrap gap-2">
                {SOCIALS.map((n) => (
                  <a key={n.id} href={n.url} target="_blank" rel="noopener noreferrer" aria-label={`RushXP sur ${n.name}`} className="grid h-11 w-11 place-items-center border border-line text-silver">
                    <SocialIcon id={n.id} size={20} />
                  </a>
                ))}
              </div>
            </section>
          </div>
        </div>
      )}
      <nav aria-label="Navigation mobile" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-[rgba(10,10,10,.97)] pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden">
        <div className="grid h-16 grid-cols-5">
          {tabs.map((t) => {
            const on = t === activeTab;
            return (
              <Link key={t.href} href={t.href} aria-current={on ? "page" : undefined} className={`relative flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${on ? "text-orange" : "text-silver"}`}>
                <Icon id={t.icon} />
                {t.label}
                {t.badge ? <span className="absolute top-1.5 left-[calc(50%+6px)] grid h-4 min-w-4 place-items-center bg-orange px-1 text-[10px] font-bold text-bg">{t.badge}</span> : null}
              </Link>
            );
          })}
          <button type="button" aria-expanded={open} aria-controls="menu-mobile" onClick={() => setOpen(!open)} className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${open ? "text-orange" : "text-silver"}`}>
            <Icon id={open ? "close" : "menu"} />
            {open ? "Fermer" : "Menu"}
          </button>
        </div>
      </nav>
    </>
  );
}
