import Link from "next/link";

const TABS = [
  ["general", "Classement général des structures", "Général", "/classement"],
  ["rankings", "RushXP Rankings", "Rankings", "/rankings"],
  ["mvp", "Joueurs & MVP", "Joueurs & MVP", "/mvp"],
] as const;

export function ClassementTabs({ active }: { active: (typeof TABS)[number][0] }) {
  return (
    <div className="mb-5 flex gap-0.5 overflow-x-auto border-b border-line">
      {TABS.map(([k, label, short, href]) => (
        <Link key={k} href={href} className="tab !h-11 !flex-none !px-3 sm:!px-4" aria-current={k === active ? "page" : undefined}>
          <span className="sm:hidden">{short}</span>
          <span className="hidden sm:inline">{label}</span>
        </Link>
      ))}
    </div>
  );
}
