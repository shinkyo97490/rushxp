/** Schémas de validation partagés client / serveur. Messages en français, affichés sous les champs. */

import { z } from "zod";
import { GAMES } from "@/lib/data/games";

const GAME_IDS = GAMES.map((g) => g.id) as [string, ...string[]];

export const REGIONS = ["Île de La Réunion", "Mayotte", "Maurice", "Métropole"] as const;
export const DAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"] as const;

export const pseudoSchema = z
  .string()
  .trim()
  .min(3, "3 caractères minimum.")
  .max(20, "20 caractères maximum.")
  .regex(/^[A-Za-z0-9_.\-À-ÿ]+$/, "Lettres, chiffres, point, tiret et tiret bas uniquement.");

export const signUpSchema = z.object({
  email: z.string().trim().toLowerCase().email("Adresse e-mail invalide."),
  pseudo: pseudoSchema,
  password: z.string().min(8, "8 caractères minimum.").max(128, "128 caractères maximum."),
  terms: z.literal(true, { error: "Vous devez accepter le règlement et avoir 13 ans ou plus." }),
});

export const signInSchema = z.object({
  identifier: z.string().trim().min(1, "Saisissez votre e-mail ou votre pseudo."),
  password: z.string().min(1, "Saisissez votre mot de passe."),
});

/** Identifiant de compte de jeu, selon l'éditeur. */
export const GAME_LINK: Record<string, { provider: "RIOT" | "ACTIVISION" | "EA" | "EPIC" | "BANDAI"; label: string; placeholder: string; pattern: RegExp; hint: string }> = {
  val: { provider: "RIOT", label: "Riot ID", placeholder: "Pseudo#EUW", pattern: /^.{3,16}#[A-Za-z0-9]{2,5}$/, hint: "Format : Pseudo#TAG" },
  tft: { provider: "RIOT", label: "Riot ID", placeholder: "Pseudo#EUW", pattern: /^.{3,16}#[A-Za-z0-9]{2,5}$/, hint: "Format : Pseudo#TAG" },
  cod: { provider: "ACTIVISION", label: "Activision ID", placeholder: "Pseudo#1234567", pattern: /^.{2,24}#\d{4,8}$/, hint: "Format : Pseudo#1234567" },
  wz: { provider: "ACTIVISION", label: "Activision ID", placeholder: "Pseudo#1234567", pattern: /^.{2,24}#\d{4,8}$/, hint: "Format : Pseudo#1234567" },
  fc: { provider: "EA", label: "EA ID", placeholder: "Pseudo", pattern: /^[A-Za-z0-9_\-]{4,16}$/, hint: "4 à 16 caractères" },
  apex: { provider: "EA", label: "EA ID", placeholder: "Pseudo", pattern: /^[A-Za-z0-9_\-]{4,16}$/, hint: "4 à 16 caractères" },
  rl: { provider: "EPIC", label: "Epic ID", placeholder: "Pseudo", pattern: /^.{3,32}$/, hint: "3 à 32 caractères" },
  tek: { provider: "BANDAI", label: "Bandai Namco ID", placeholder: "Pseudo", pattern: /^.{3,32}$/, hint: "3 à 32 caractères" },
};

export const gamesStepSchema = z
  .object({
    games: z.array(z.enum(GAME_IDS)).min(1, "Choisissez au moins un jeu."),
    links: z.record(z.string(), z.string().trim()),
  })
  .superRefine((v, ctx) => {
    for (const g of v.games) {
      const id = v.links[g] ?? "";
      if (id && !GAME_LINK[g].pattern.test(id)) ctx.addIssue({ code: "custom", path: ["links", g], message: `${GAME_LINK[g].label} invalide. ${GAME_LINK[g].hint}.` });
    }
  });

export const profileStepSchema = z.object({
  intent: z.enum(["joueur", "capitaine", "gestionnaire"], { error: "Choisissez une option." }),
  region: z.enum(REGIONS),
  availability: z.array(z.enum(DAYS)),
});

export const structureStepSchema = z.discriminatedUnion("path", [
  z.object({ path: z.literal("create") }),
  z.object({ path: z.literal("free") }),
  z.object({ path: z.literal("join"), code: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{2,4}-[A-Z0-9]{4}$/, "Code invalide (ex. NVA-7K2Q).") }),
]);

export const structureIdentitySchema = z.object({
  name: z.string().trim().min(3, "3 caractères minimum.").max(40, "40 caractères maximum."),
  tag: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{2,4}$/, "2 à 4 lettres ou chiffres."),
  region: z.enum(REGIONS),
  bio: z.string().trim().max(500, "500 caractères maximum.").optional().default(""),
});

export const structureSchema = structureIdentitySchema.extend({
  games: z.array(z.enum(GAME_IDS)).min(1, "Engagez au moins un jeu."),
  invites: z.array(pseudoSchema).max(30, "30 invitations maximum."),
});

export type FieldErrors = Record<string, string>;

/** Convertit les erreurs Zod en { "champ.sous-champ": "message" }. */
export function toFieldErrors(err: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const i of err.issues) {
    const k = i.path.join(".") || "_";
    if (!out[k]) out[k] = i.message;
  }
  return out;
}

/** « Kael, Nyx ; Rook » → ["Kael","Nyx","Rook"] (sans doublons). */
export function parsePseudoList(raw: string): string[] {
  return [...new Set(raw.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean))];
}
