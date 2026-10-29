"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { signOutAction } from "@/lib/auth/actions";

interface Props {
  pseudo: string;
  roleLabel: string;
  structure: { name: string; status: string } | null;
}

export function AccountMenu({ pseudo, roleLabel, structure }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const item = "block px-4 py-2.5 text-sm text-silver transition-colors duration-150 hover:bg-surface-2 hover:text-ink";
  return (
    <div ref={ref} className="relative flex-none">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu" className="flex cursor-pointer items-center gap-2.5 text-left">
        <span className="grid h-[38px] w-[38px] place-items-center border border-orange bg-surface-2 font-display text-[15px] font-bold">
          {pseudo.slice(0, 2).toUpperCase()}
        </span>
        <span className="hidden leading-tight lg:block">
          <span className="block text-sm font-semibold">{pseudo}</span>
          <span className="block text-[11px] uppercase tracking-[.08em] text-grey">{roleLabel}</span>
        </span>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-[46px] z-40 w-60 border border-line bg-surface">
          <div className="border-b border-line px-4 py-3">
            <div className="text-sm font-semibold">{pseudo}</div>
            <div className="text-xs text-grey">
              {structure ? `${structure.name}${structure.status === "PENDING" ? " · en vérification" : ""}` : "Sans structure"}
            </div>
          </div>
          <Link role="menuitem" href="/profil" className={item} onClick={() => setOpen(false)}>Mon profil</Link>
          {structure ? (
            <Link role="menuitem" href="/recrutement" className={item} onClick={() => setOpen(false)}>Ma structure</Link>
          ) : (
            <Link role="menuitem" href="/structure/nouvelle" className={item} onClick={() => setOpen(false)}>Créer une structure</Link>
          )}
          <Link role="menuitem" href="/parametres" className={item} onClick={() => setOpen(false)}>Paramètres</Link>
          <form action={signOutAction} className="border-t border-line">
            <button role="menuitem" className={`${item} w-full cursor-pointer text-left`}>Se déconnecter</button>
          </form>
        </div>
      )}
    </div>
  );
}
