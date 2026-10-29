"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface NavItem {
  href: string;
  label: string;
  match: string[]; // préfixes de chemin qui activent l'onglet
  badge?: number;
}

export function NavLinks({ items }: { items: NavItem[] }) {
  const path = usePathname();
  const active = (it: NavItem) =>
    it.match.some((m) => (m === "/" ? path === "/" : path === m || path.startsWith(m + "/")));
  // L'onglet le plus spécifique gagne (ex. /rankings/defis → Défis plutôt que Classements).
  const best = items
    .filter(active)
    .sort((a, b) => Math.max(...b.match.map((m) => m.length)) - Math.max(...a.match.map((m) => m.length)))[0];
  return (
    <nav aria-label="Navigation principale" className="flex h-full min-w-0 flex-auto overflow-x-auto [scrollbar-width:none]">
      {items.map((it) => {
        const on = it === best;
        return (
          <Link
            key={it.href}
            href={it.href}
            aria-current={on ? "page" : undefined}
            className={`flex h-full items-center gap-1.5 whitespace-nowrap border-b-2 px-[clamp(5px,0.8vw,11px)] pt-0.5 font-display text-[clamp(14px,1.25vw,16px)] font-semibold tracking-[.05em] transition-colors duration-150 hover:text-ink ${
              on ? "border-orange text-ink" : "border-transparent text-silver"
            }`}
          >
            {it.label}
            {it.badge ? (
              <span className="grid h-4 min-w-4 place-items-center bg-orange px-1 font-sans text-[10px] font-bold text-bg" aria-label={`${it.badge} défi(s) reçu(s)`}>
                {it.badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
