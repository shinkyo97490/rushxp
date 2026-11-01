import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";

export interface HomeContent {
  title: string;
  accent: string;
  subtitle: string;
  heroImage: string;
  bannerLan: string | null; // slug de la LAN mise en avant sous le héros
  blocks: string[];
}

export const HOME_BLOCKS = ["Pour vous", "Calendrier de saison", "Prochains matchs", "LAN & événements", "Classement général", "Partenaires"] as const;

export const HOME_DEFAULT: HomeContent = {
  title: "Chaque match",
  accent: "compte au classement.",
  subtitle: "RushXP réunit cinq jeux compétitifs dans un classement permanent. Défiez les équipes proches de vous, montez en division et visez les Playoffs : 2 500 € à partager pour les tops de la Division 1.",
  heroImage: "/assets/photo-dsc07373.jpg",
  bannerLan: null,
  blocks: [...HOME_BLOCKS],
};

export const getSetting = cache(async <T,>(key: string, fallback: T): Promise<T> => {
  try {
    const s = await db.siteSetting.findUnique({ where: { key } });
    return s ? ({ ...(fallback as object), ...(s.value as object) } as T) : fallback;
  } catch {
    return fallback;
  }
});

/** Accueil enregistré par l'admin ; l'ancienne formule du cashprize est remplacée par la formule validée. */
export const getHome = async () => {
  const h = await getSetting<HomeContent>("home", HOME_DEFAULT);
  return { ...h, subtitle: h.subtitle.replace("2 500 € pour le top de la Division 1", "2 500 € à partager pour les tops de la Division 1") };
};
export const getMaintenance = () => getSetting<{ on: boolean; message: string }>("maintenance", { on: false, message: "" });

export interface CompetitionText {
  comp: string;
  photo: string;
  desc: string;
}

/** Présentation des compétitions par jeu (modifiable dans Administration › Compétitions). */
export const COMPETITION_DEFAULT: Record<string, CompetitionText> = {
  val: { comp: "RushXP Valorant Series", photo: "/assets/photo-dsc07373.jpg", desc: "Ligue 5v5 en divisions de 8. Défis toute l’année, veto BO3 directement dans le Match Center, Playoffs pour le top 8 de la Division 1." },
  rl: { comp: "RushXP Rocket Cup", photo: "/assets/photo-dsc06369.jpg", desc: "Classement 3v3 permanent. Séries BO5, BO7 en finale. Le lobby est créé par l’équipe la mieux classée." },
  cod: { comp: "RushXP CDL Challengers", photo: "/assets/photo-dsc05885.jpg", desc: "Circuit 4v4 au format CDL : séries BO5 alternant Hardpoint, Recherche & Destruction et Contrôle, veto mode par mode." },
  fc: { comp: "RushXP FUT Ladder", photo: "/assets/photo-dsc06256.jpg", desc: "Ladder individuel FUT en aller simple. Le meilleur joueur de chaque structure compte au classement général." },
  tek: { comp: "RushXP Tekken Clash", photo: "/assets/photo-dsc06256.jpg", desc: "Ligue 1v1 en sets FT3, finale des Playoffs en FT5. Le perdant d’une manche peut changer de personnage." },
  tft: { comp: "RDV mensuel TFT", photo: "/assets/photo-dsc05753.jpg", desc: "Un rendez-vous par mois en 6 manches, lobbys de 8 recomposés selon le classement cumulé." },
  wz: { comp: "RDV mensuel Warzone", photo: "/assets/photo-dsc05885.jpg", desc: "Un rendez-vous par mois en duo, 6 manches, placement + 1 point par élimination." },
  apex: { comp: "RDV mensuel Apex Legends", photo: "/assets/photo-dsc06369.jpg", desc: "Un rendez-vous par mois en trio, 6 manches, placement + 1 point par élimination." },
};

export const getCompetitionTexts = () => getSetting<Record<string, CompetitionText>>("competitions", COMPETITION_DEFAULT);
