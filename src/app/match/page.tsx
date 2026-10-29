import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getRole } from "@/lib/session";
import { getGame } from "@/lib/data/games";
import { demoMatches } from "@/lib/data/demo-competition";
import { STRUCTURES } from "@/lib/data/demo";
import { DemoNotice } from "@/components/PageHeader";
import { MatchCenter, type MatchInfo } from "@/components/match/MatchCenter";

export const metadata: Metadata = { title: "Match Center" };

const PICKER = ["val", "cod", "rl", "fc", "tek", "tft"] as const;
const tagOf = (name: string) => STRUCTURES.find((s) => name.startsWith(s.name) || name.includes(`(${s.tag})`))?.tag ?? name.slice(0, 3).toUpperCase();

export default async function MatchPage({ searchParams }: { searchParams: Promise<{ m?: string; jeu?: string }> }) {
  const sp = await searchParams;
  const role = await getRole();
  const all = demoMatches();
  const jeu = PICKER.find((g) => g === sp.jeu);
  const found = all.find((x) => x.id === sp.m) ?? (jeu ? all.find((x) => x.game === jeu && x.state !== "Terminé") : all[0]);
  const game = (jeu ?? found?.game ?? "val") as MatchInfo["game"];
  const g = getGame(game)!;
  const a = found && found.game === game ? found.a : game === "tft" ? "Lobby C" : "Équipe A";
  const b = found && found.game === game ? found.b : game === "tft" ? "Manche 3" : "Équipe B";
  const info: MatchInfo = {
    game,
    gameName: g.name,
    logo: g.logo,
    comp: found && found.game === game ? found.comp : game === "tft" ? "Rendez-vous mensuel · TFT" : `RushXP Rankings · ${g.name}`,
    series: g.series ?? "6 manches",
    a,
    b,
    aTag: tagOf(a),
    bTag: tagOf(b),
  };
  // Démo : un membre connecté (hors arbitrage) joue pour l'équipe A.
  const participant = ["joueur", "capitaine", "gestionnaire"].includes(role);

  return (
    <main className="mx-auto max-w-[1440px] px-[clamp(16px,3vw,32px)] pt-4 pb-12">
      <nav className="mb-3 flex flex-wrap items-center gap-1.5 text-[13px]" aria-label="Jeu de démonstration">
        <span className="text-grey">Jeu (démo) :</span>
        {PICKER.map((id) => {
          const x = getGame(id)!;
          return (
            <Link key={id} href={`/match?jeu=${id}`} aria-current={id === game ? "page" : undefined} className={`flex h-9 items-center gap-1.5 border px-2.5 text-ink hover:text-ink ${id === game ? "border-orange bg-surface-2" : "border-line hover:border-[#5a5a5a]"}`}>
              <Image src={x.logo} alt="" width={22} height={14} className="h-3.5 w-[22px] object-contain" />
              {x.short}
            </Link>
          );
        })}
      </nav>
      <MatchCenter key={game} m={info} role={role} participant={participant} />
      <DemoNotice>Match Center de démonstration : veto, check-in, chat et lecture OCR sont simulés dans le navigateur. Ils passeront par le serveur et le temps réel avec les défis en base.</DemoNotice>
    </main>
  );
}
