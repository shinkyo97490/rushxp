"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export interface NavLeaf {
  href: string;
  label: string;
  hint?: string;
  match: string[]; // préfixes de chemin qui activent l'entrée
  badge?: number;
}
export interface NavItem extends NavLeaf {
  children?: NavLeaf[];
}

const hit = (path: string, m: string) => (m === "/" ? path === "/" : path === m || path.startsWith(m + "/"));
const depth = (it: NavLeaf, path: string) => Math.max(-1, ...it.match.filter((m) => hit(path, m)).map((m) => m.length));

/** Entrée active : le préfixe le plus spécifique gagne (ex. /rankings/defis → Défis plutôt que Classements). */
export function useActive(items: NavItem[]) {
  const path = usePathname();
  let best: { top: NavItem; d: number } | null = null;
  for (const it of items) {
    const d = Math.max(depth(it, path), ...(it.children ?? []).map((c) => depth(c, path)));
    if (d >= 0 && (!best || d > best.d)) best = { top: it, d };
  }
  return { path, top: best?.top ?? null };
}

function Badge({ n, label }: { n?: number; label: string }) {
  if (!n) return null;
  return <span className="grid h-4 min-w-4 place-items-center bg-orange px-1 font-sans text-[10px] font-bold text-bg" aria-label={label}>{n > 99 ? "99+" : n}</span>;
}

const linkCls = (on: boolean) =>
  `flex h-full items-center gap-1.5 whitespace-nowrap border-b-2 px-[clamp(8px,1vw,14px)] pt-0.5 font-display text-[16px] font-semibold tracking-[.05em] transition-colors duration-150 hover:text-ink ${on ? "border-orange text-ink" : "border-transparent text-silver"}`;

/** Navigation bureau : quelques entrées, les rubriques secondaires dans des menus déroulants. */
export function NavLinks({ items }: { items: NavItem[] }) {
  const { path, top } = useActive(items);
  const [open, setOpen] = useState<string | null>(null);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(null);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, []);

  return (
    <nav ref={ref} aria-label="Navigation principale" className="hidden h-full min-w-0 flex-auto lg:flex">
      {items.map((it) => {
        const on = it === top;
        if (!it.children)
          return (
            <Link key={it.href} href={it.href} aria-current={on ? "page" : undefined} className={linkCls(on)}>
              {it.label}
              <Badge n={it.badge} label={`${it.badge} défi(s) reçu(s)`} />
            </Link>
          );
        const isOpen = open === it.href;
        return (
          <div key={it.href} className="relative h-full" onMouseEnter={() => setOpen(it.href)} onMouseLeave={() => setOpen(null)}>
            <button type="button" aria-expanded={isOpen} aria-haspopup="true" onClick={() => setOpen(isOpen ? null : it.href)} className={linkCls(on)}>
              {it.label}
              <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden className={`transition-transform ${isOpen ? "rotate-180" : ""}`}>
                <path d="M2 3.5 5 6.5 8 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
              </svg>
            </button>
            {isOpen && (
              <div className="absolute top-full left-0 z-40 min-w-[280px] border border-line bg-surface py-1.5 shadow-[0_12px_32px_rgba(0,0,0,.5)]">
                {it.children.map((c) => {
                  const cOn = c.match.some((m) => hit(path, m));
                  return (
                    <Link key={c.href} href={c.href} onClick={() => setOpen(null)} aria-current={cOn ? "page" : undefined} className={`block border-l-2 px-4 py-2.5 hover:bg-surface-2 ${cOn ? "border-orange bg-surface-2" : "border-transparent"}`}>
                      <span className="flex items-center gap-2 font-semibold text-ink">{c.label}<Badge n={c.badge} label={`${c.badge} en attente`} /></span>
                      {c.hint && <span className="block text-xs text-grey">{c.hint}</span>}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
