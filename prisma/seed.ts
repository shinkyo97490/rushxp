/**
 * Données de référence (idempotent) : les jeux et leurs formats.
 * Exécuté à chaque déploiement Vercel après les migrations. Aucune donnée fictive ici.
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, GameKind } from "../src/generated/prisma/client";
import { GAMES } from "../src/lib/data/games";
import { LOBBY_SCALES } from "../src/lib/rules/scales";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL! }),
});

async function main() {
  for (const g of GAMES) {
    const scale = g.id in LOBBY_SCALES ? LOBBY_SCALES[g.id as keyof typeof LOBBY_SCALES] : null;
    const data = {
      name: g.name,
      kind: g.kind === "challenge" ? GameKind.CHALLENGE : GameKind.LOBBY,
      rosterSize: g.rosterSize,
      series: g.series ?? null,
      lobbySize: g.id === "tft" ? 8 : null,
      scale: scale ? scale.placement : undefined,
      killPoint: scale?.pointPerKill ?? 0,
    };
    // Les formats sont modifiables par l'admin : on ne les écrase pas s'ils existent déjà.
    await db.game.upsert({ where: { id: g.id }, create: { id: g.id, ...data }, update: {} });
  }
  console.log(`Jeux : ${GAMES.length} vérifiés.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
