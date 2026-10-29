import Link from "next/link";

const TABS = [
  ["general", "Classement général des structures", "/classement"],
  ["rankings", "RushXP Rankings", "/rankings"],
  ["mvp", "Joueurs & MVP", "/mvp"],
] as const;

export function ClassementTabs({ active }: { active: (typeof TABS)[number][0] }) {
  return (
    <div className="mb-5 flex gap-0.5 overflow-x-auto border-b border-line">
      {TABS.map(([k, label, href]) => (
        <Link key={k} href={href} className="tab !h-11 !px-4" aria-current={k === active ? "page" : undefined}>
          {label}
        </Link>
      ))}
    </div>
  );
}
