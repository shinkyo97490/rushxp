import Link from "next/link";
import type { ReactNode } from "react";

export function PageHeader({ overline, title, children, actions }: { overline?: string; title: ReactNode; children?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {overline && <div className="text-[13px] font-semibold uppercase tracking-[.14em] text-grey">{overline}</div>}
        <h1 className="font-display mt-1 text-[clamp(40px,6vw,56px)] font-extrabold leading-none">{title}</h1>
        {children && <div className="mt-2 max-w-[720px] text-[15px] leading-relaxed text-silver">{children}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function TabLinks({ tabs, active }: { tabs: { key: string; label: string; href: string; badge?: number }[]; active: string }) {
  return (
    <nav className="mt-5 flex overflow-x-auto border-b border-line" aria-label="Sections">
      {tabs.map((t) => (
        <Link key={t.key} href={t.href} className="tab" aria-current={t.key === active ? "page" : undefined}>
          {t.label}
          {t.badge ? <span className="grid h-[18px] min-w-[18px] place-items-center bg-orange px-1 font-sans text-[11px] text-bg">{t.badge}</span> : null}
        </Link>
      ))}
    </nav>
  );
}

export function DemoNotice({ children }: { children: ReactNode }) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2.5 border border-line bg-surface px-4 py-2.5 text-[13px] text-silver">
      <span className="badge text-silver">Démo</span>
      <span>{children}</span>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="px-[18px] py-6 text-center text-[13px] text-grey">{children}</div>;
}
