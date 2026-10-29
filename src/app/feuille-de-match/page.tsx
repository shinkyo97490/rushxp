import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getGame } from "@/lib/data/games";
import { demoMatches } from "@/lib/data/demo-competition";
import { DemoNotice, PageHeader } from "@/components/PageHeader";
import { MatchSheet } from "@/components/match/MatchSheet";

export const metadata: Metadata = { title: "Feuille de match" };

const GAMES = ["val", "cod", "rl", "fc", "tek", "tft"] as const;

export default async function FeuillePage({ searchParams }: { searchParams: Promise<{ m?: string; jeu?: string }> }) {
  const sp = await searchParams;
  const done = demoMatches().filter((x) => x.state === "Terminé");
  const match = done.find((x) => x.id === sp.m);
  const game = (GAMES.find((g) => g === sp.jeu) ?? match?.game ?? "val") as (typeof GAMES)[number];
  const g = getGame(game)!;
  const a = match?.game === game ? match.a : "Équipe A";
  const b = match?.game === game ? match.b : "Équipe B";
  return (
    <main className="mx-auto max-w-[1100px] px-[clamp(16px,3vw,40px)] pt-7 pb-16">
      <PageHeader overline={match?.game === game ? match.comp : g.name} title="Feuille de match">
        {a} vs {b}{match?.score && match.game === game ? ` · ${match.score}` : ""}
      </PageHeader>
      <nav className="mt-4 flex flex-wrap gap-1.5" aria-label="Jeu">
        {GAMES.map((id) => {
          const x = getGame(id)!;
          return (
            <Link key={id} href={`/feuille-de-match?jeu=${id}`} aria-current={id === game ? "page" : undefined} className={`flex h-9 items-center gap-1.5 border px-2.5 text-[13px] text-ink hover:text-ink ${id === game ? "border-orange bg-surface-2" : "border-line"}`}>
              <Image src={x.logo} alt="" width={22} height={14} className="h-3.5 w-[22px] object-contain" />
              {x.short}
            </Link>
          );
        })}
      </nav>
      <div className="mt-4">
        <MatchSheet game={game} teamA={a} teamB={b} score={match?.game === game ? match.score : undefined} official lowConf={false} />
      </div>
      <DemoNotice>Statistiques de démonstration. Elles seront lues sur la capture de fin de partie (OCR) ou via l’API de l’éditeur.</DemoNotice>
    </main>
  );
}
