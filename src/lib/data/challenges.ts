/** Défis de démonstration, positionnés autour du rang de l'utilisateur. */

import type { ChallengeStatus } from "@/lib/rules/challenge";
import type { ChallengeGameId } from "./games";
import { getRankings } from "./repo";

export interface ChallengeItem {
  id: string;
  dir: "in" | "out";
  oppId: string;
  status: ChallengeStatus;
  origin: "manual" | "auto";
  meta: string;
  slots?: string[]; // 3 créneaux proposés par le challenger
  slot?: string;
  declared?: 0 | 1; // résultat déclaré, provisoire tant que non validé
  result?: string;
  playedAt?: string; // ISO, pour la règle de revanche
  deltaMe?: number; // variations appliquées à la validation (démo)
  deltaOpp?: number;
}

export const DEMO_SLOTS = ["Sam. 1 nov. · 19:00", "Dim. 2 nov. · 18:00", "Mar. 4 nov. · 20:30"];

export function initialChallenges(game: ChallengeGameId): ChallengeItem[] {
  const rows = getRankings(game);
  const me = rows.find((r) => r.isMe)!;
  const at = (rank: number) => rows[Math.min(rows.length, Math.max(1, rank)) - 1];
  const used = new Set<string>([me.id]);
  const pick = (...ranks: number[]) => {
    for (const k of ranks) {
      const r = at(k);
      if (r && !used.has(r.id) && !r.inPlacement) {
        used.add(r.id);
        return r.id;
      }
    }
    return null;
  };
  const out: ChallengeItem[] = [];
  const a = pick(me.rank + 1, me.rank + 2, me.rank - 1);
  if (a) out.push({ id: "c1", dir: "in", oppId: a, status: "PENDING", origin: "manual", meta: "Reçu il y a 17 h · réponse sous 31 h", slots: DEMO_SLOTS });
  const b = pick(me.rank - 2, me.rank - 1, me.rank + 1);
  if (b) out.push({ id: "c2", dir: "out", oppId: b, status: "PENDING", origin: "manual", meta: "Envoyé il y a 6 h · réponse attendue sous 42 h" });
  const c = pick(me.rank + 2, me.rank + 3, me.rank - 3);
  if (c) out.push({ id: "c3", dir: "out", oppId: c, status: "PLANNED", origin: "manual", meta: "Accepté · ajouté au calendrier", slot: "Jeu. 30 oct. · 20:00" });
  const d = pick(me.rank + 4, me.rank + 5, me.rank - 4);
  if (d) out.push({ id: "c4", dir: "in", oppId: d, status: "DONE", origin: "manual", meta: "Validé le 24 oct.", result: "Victoire 2–1 · +14 pts", playedAt: "2026-10-24T20:00:00Z" });
  return out;
}

export function receivedChallengeCount(game: ChallengeGameId = "val"): number {
  return initialChallenges(game).filter((c) => c.dir === "in" && c.status === "PENDING").length;
}
