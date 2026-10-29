"use client";

import { useTransition } from "react";
import { setDemoRole } from "@/app/actions";
import { ROLES, ROLE_LABEL, type Role } from "@/lib/session-shared";

export function DemoBar({ role }: { role: Role }) {
  const [pending, start] = useTransition();
  return (
    <div className="bg-black border-b border-line text-xs text-silver">
      <div className="container-rx flex flex-wrap items-center gap-x-5 gap-y-2 py-1.5">
        <span className="font-mono text-[11px] tracking-[.08em] bg-silver text-bg px-1.5 py-0.5">DÉMO</span>
        <span>Données de démonstration : structures, joueurs et scores fictifs.</span>
        <span className="flex-1" />
        <label className="flex items-center gap-2">
          Voir en tant que
          <select
            value={role}
            disabled={pending}
            onChange={(e) => start(() => setDemoRole(e.target.value as Role))}
            className="bg-surface text-ink border border-line px-2 py-1 text-xs"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>{ROLE_LABEL[r]}</option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
