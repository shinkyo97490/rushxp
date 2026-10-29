"use client";

import { usePathname, useRouter } from "next/navigation";

export function GameSelect({ value, options }: { value: string; options: { id: string; label: string }[] }) {
  const router = useRouter();
  const path = usePathname();
  return (
    <select className="field" aria-label="Jeu" value={value} onChange={(e) => router.push(`${path}?game=${e.target.value}`)}>
      {options.map((o) => (
        <option key={o.id} value={o.id}>{o.label}</option>
      ))}
    </select>
  );
}
