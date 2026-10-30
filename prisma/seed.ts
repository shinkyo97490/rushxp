/**
 * Données de référence (idempotent) : les jeux et leurs formats.
 * Exécuté à chaque déploiement Vercel après les migrations. Aucune donnée fictive ici.
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, GameKind } from "../src/generated/prisma/client";
import { GAMES } from "../src/lib/data/games";
import { LOBBY_SCALES } from "../src/lib/rules/scales";
import { defaultSeason } from "../src/lib/rules/season";

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

  // Saisons : créées avec le calendrier validé si elles n'existent pas (jamais écrasées, l'admin peut les modifier).
  const year = new Date().getFullYear();
  for (const y of [year, year + 1]) {
    const exists = await db.season.findUnique({ where: { year: y } });
    if (exists) continue;
    const def = defaultSeason(y);
    await db.season.create({
      data: { year: y, name: def.name, seedingAt: def.seedingAt, phases: { create: def.phases } },
    });
    console.log(`Saison ${y} créée.`);
  }
}


/**
 * Événements annoncés dans le prototype, créés en BROUILLON (invisibles) : l'admin vérifie dates,
 * tarifs et lieux avec les associations, puis les publie. Jamais écrasés.
 */
const LAN_DRAFTS = [
  {
    slug: "rage-lan-2",
    name: "R.A.G.E LAN 2",
    organizer: "Association R.A.G.E",
    place: "Saint-Denis · salle à confirmer",
    startsAt: new Date("2026-11-21T09:00:00+04:00"),
    endsAt: new Date("2026-11-22T20:00:00+04:00"),
    refundUntil: new Date("2026-11-14T23:59:00+04:00"),
    visitorPassCents: 500,
    posterUrl: "/assets/photo-dsc05885.jpg",
    description:
      "Deuxième édition de la LAN R.A.G.E, organisée avec RushXP. Deux jours de tournois sur place, avec matchs diffusés, finales sur scène et remise des prix le dimanche soir. Chaque tournoi rapporte des points au classement général des structures.",
    program: [
      { day: "Samedi 21 novembre", items: [["09:00", "Accueil et check-in des joueurs"], ["10:00", "Poules Valorant, Rocket League, FC 27"], ["14:00", "Phases finales Rocket League et FC 27"], ["20:00", "Finales FC 27 et Rocket League sur scène"]] },
      { day: "Dimanche 22 novembre", items: [["09:30", "Tournoi Tekken 8"], ["13:00", "Demi-finales Valorant"], ["17:00", "Finale Valorant sur scène"], ["19:00", "Remise des prix et points au classement"]] },
    ],
    tournaments: [
      { game: "val", format: "5v5 · double élimination · BO3", priceCents: 5000, capacity: 16, day: "Samedi et dimanche" },
      { game: "rl", format: "3v3 · double élimination · BO5", priceCents: 3000, capacity: 16, day: "Samedi" },
      { game: "fc", format: "1v1 · poules puis élimination", priceCents: 1000, capacity: 32, day: "Samedi" },
      { game: "tek", format: "1v1 · double élimination · FT3", priceCents: 1000, capacity: 32, day: "Dimanche" },
    ],
  },
  {
    slug: "major-petit-ile",
    name: "Major Petit Ile",
    organizer: "Rising Sun",
    place: "Petite-Île",
    posterUrl: "/assets/photo-dsc06256.jpg",
    description: "Tournoi Tekken 8 et Rocket League organisé par Rising Sun, en partenariat avec RushXP. Les résultats validés comptent au classement général des structures.",
    tournaments: [
      { game: "tek", format: "1v1 · format à annoncer", capacity: 32 },
      { game: "rl", format: "3v3 · format à annoncer", capacity: 16 },
    ],
  },
  {
    slug: "make-your-clutch",
    name: "Make Your Clutch",
    organizer: "Make Your Clutch",
    place: "Lieu à confirmer",
    posterUrl: "/assets/photo-dsc05753.jpg",
    description: "Tournoi Valorant en LAN. Les résultats validés comptent au classement général des structures.",
    tournaments: [{ game: "val", format: "5v5 · format à annoncer", capacity: 16 }],
  },
  {
    slug: "geekgames",
    name: "GeekGames",
    organizer: "Geekali",
    place: "Lieu à confirmer",
    posterUrl: "/assets/photo-dsc05800.jpg",
    description: "Événement organisé par Geekali, en partenariat avec RushXP. Les tournois et jeux au programme seront annoncés prochainement.",
    tournaments: [],
  },
  {
    slug: "tournoi-tekken-8-pixel-game",
    name: "Tournoi Tekken 8",
    organizer: "Pixel Game",
    place: "Lieu à confirmer",
    posterUrl: "/assets/photo-dsc06369.jpg",
    description: "Tournoi Tekken 8 organisé par Pixel Game, en partenariat avec RushXP. Les résultats validés comptent au classement général des structures.",
    tournaments: [{ game: "tek", format: "1v1 · format à annoncer", capacity: 32 }],
  },
];

async function seedLans() {
  for (const { tournaments, ...lan } of LAN_DRAFTS) {
    if (await db.lanEvent.findUnique({ where: { slug: lan.slug } })) continue;
    await db.lanEvent.create({ data: { ...lan, status: "DRAFT", tournaments: { create: tournaments } } });
    console.log(`LAN « ${lan.name} » créée en brouillon.`);
  }
}

main()
  .then(seedLans)
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
