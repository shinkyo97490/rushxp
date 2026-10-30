import Image from "next/image";
import Link from "next/link";

const COLS: [string, [string, string][]][] = [
  ["Compétition", [["RushXP Rankings", "/rankings"], ["Classement général", "/classement"], ["RDV mensuels", "/rdv"], ["LAN & événements", "/lan"], ["Playoffs", "/playoffs"]]],
  ["Communauté", [["Recrutement", "/recrutement"], ["Actualités", "/actualites"], ["Partenaires", "/partenaires"]]],
  ["Infos", [["Le circuit", "/le-circuit"], ["Règlement", "/reglement"], ["Devenir partenaire", "/partenaires#devenir-partenaire"]]],
];

export function Footer() {
  return (
    <footer className="mt-16 border-t border-line bg-black">
      <div className="container-rx grid gap-8 py-10 [grid-template-columns:repeat(auto-fit,minmax(min(100%,200px),1fr))]">
        <div className="grid content-start gap-3">
          <Image src="/assets/rushxp-logo-sm.png" alt="RushXP" width={56} height={56} />
          <p className="max-w-xs text-sm leading-relaxed text-grey">La plateforme esports compétitive de La Réunion. Multi-jeux, multi-structures.</p>
        </div>
        {COLS.map(([title, links]) => (
          <div key={title} className="grid content-start gap-2">
            <div className="overline mb-1">{title}</div>
            {links.map(([l, h]) => (
              <Link key={h} href={h} className="text-sm text-silver hover:text-orange">{l}</Link>
            ))}
          </div>
        ))}
      </div>
      <div className="container-rx border-t border-surface-2 py-4 text-xs text-grey">© {new Date().getFullYear()} RushXP · Île de La Réunion</div>
    </footer>
  );
}
