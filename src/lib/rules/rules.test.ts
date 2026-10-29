import { describe, expect, it } from "vitest";
import { eloDelta, kFactor, stakes } from "./elo";
import { LOBBY_SCALES, lobbyPoints, structurePoints } from "./scales";
import { canTransition, challengeBlock, countsForRanking, isZoneWidened, type ChallengeContext, type Contender } from "./challenge";
import { rankLabel, structureStandings } from "./standings";

describe("elo", () => {
  it("utilise K = 40 en placement puis 32", () => {
    expect(kFactor({ placementMatches: 0 })).toBe(40);
    expect(kFactor({ placementMatches: 4 })).toBe(40);
    expect(kFactor({ placementMatches: 5 })).toBe(32);
  });

  it("donne ±K/2 entre scores égaux", () => {
    const a = { score: 1200, placementMatches: 10 };
    expect(stakes(a, { ...a })).toEqual({ win: 16, loss: -16 });
  });

  it("rapporte plus en battant un mieux classé", () => {
    const me = { score: 1200, placementMatches: 10 };
    expect(eloDelta(me, { score: 1400, placementMatches: 10 }, 1)).toBe(24);
    expect(eloDelta(me, { score: 1000, placementMatches: 10 }, 1)).toBe(8);
  });
});

describe("barèmes", () => {
  it("classement général : 100/90/82/75/69/64/60/56 puis −4, minimum 5", () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8].map(structurePoints)).toEqual([100, 90, 82, 75, 69, 64, 60, 56]);
    expect(structurePoints(9)).toBe(52);
    expect(structurePoints(20)).toBe(8);
    expect(structurePoints(21)).toBe(5);
    expect(structurePoints(60)).toBe(5);
    expect(() => structurePoints(0)).toThrow();
  });

  it("RDV mensuels", () => {
    expect(lobbyPoints(LOBBY_SCALES.tft, 1)).toBe(8);
    expect(lobbyPoints(LOBBY_SCALES.tft, 8)).toBe(1);
    expect(lobbyPoints(LOBBY_SCALES.wz, 1, 7)).toBe(22);
    expect(lobbyPoints(LOBBY_SCALES.wz, 11, 2)).toBe(2);
    expect(lobbyPoints(LOBBY_SCALES.apex, 15, 0)).toBe(1);
    expect(lobbyPoints(LOBBY_SCALES.apex, 16, 3)).toBe(3);
  });
});

describe("classement général des structures", () => {
  it("ne compte que le meilleur roster par jeu et gère les égalités", () => {
    const st = structureStandings([
      { game: "val", rank: 1, structureId: "A" },
      { game: "val", rank: 2, structureId: "A" }, // 2e équipe de A : ignorée
      { game: "val", rank: 3, structureId: "B" },
      { game: "rl", rank: 3, structureId: "A" },
      { game: "rl", rank: 1, structureId: "B" },
      { game: "rl", rank: 2, structureId: "C", inPlacement: true },
    ]);
    expect(st.map((s) => [s.structureId, s.total, rankLabel(s)])).toEqual([
      ["A", 182, "1="],
      ["B", 182, "1="],
    ]);
  });
});

describe("défis", () => {
  const mk = (id: string, rank: number, p: Partial<Contender> = {}): Contender => ({
    id, rank, structureId: id, inPlacement: false, inactive: false, rosterComplete: true, ...p,
  });
  const now = new Date("2026-10-29T12:00:00Z");
  const base = (over: Partial<ChallengeContext> = {}): ChallengeContext => {
    const all = [1, 2, 3, 4, 5, 6, 7, 8].map((r) => mk("t" + r, r));
    return { me: all[4], all, canAct: true, pendingOut: 0, busyWith: new Set(), lastMatchWith: new Map(), now, ...over };
  };

  it("zone standard : 2 au-dessus, 1 en dessous", () => {
    const ctx = base();
    const ok = ctx.all.filter((o) => !challengeBlock(ctx, o)).map((o) => o.rank);
    expect(ok).toEqual([3, 4, 6]);
    expect(challengeBlock(ctx, ctx.all[1])).toBe("out_of_zone");
  });

  it("refuse les défis internes à une structure", () => {
    const ctx = base();
    ctx.all[3].structureId = ctx.me.structureId;
    expect(challengeBlock(ctx, ctx.all[3])).toBe("same_structure");
  });

  it("bloque au-delà de 2 défis en attente et pour un roster incomplet", () => {
    const ctx = base({ pendingOut: 2 });
    expect(challengeBlock(ctx, ctx.all[3])).toBe("quota");
    const c2 = base();
    c2.me.rosterComplete = false;
    expect(challengeBlock(c2, c2.all[3])).toBe("roster_incomplete");
  });

  it("élargit la zone à 3 / 2 si moins de 2 adversaires disponibles", () => {
    const ctx = base({ busyWith: new Set(["t3", "t4"]) });
    expect(isZoneWidened(ctx)).toBe(true);
    expect(challengeBlock(ctx, ctx.all[1])).toBeNull(); // rang 2
    expect(challengeBlock(ctx, ctx.all[6])).toBeNull(); // rang 7
  });

  it("revanche bloquée 14 jours, limite de 2 matchs comptés par paire sur 30 jours", () => {
    const ctx = base({ lastMatchWith: new Map([["t4", new Date("2026-10-20T00:00:00Z")]]) });
    expect(challengeBlock(ctx, ctx.all[3])).toBe("rematch");
    expect(countsForRanking([new Date("2026-10-10"), new Date("2026-10-20")], now)).toBe(false);
    expect(countsForRanking([new Date("2026-09-01"), new Date("2026-10-20")], now)).toBe(true);
  });

  it("cycle de vie", () => {
    expect(canTransition("PENDING", "PLANNED")).toBe(true);
    expect(canTransition("SUBMITTED", "DONE")).toBe(true);
    expect(canTransition("DONE", "PENDING")).toBe(false);
  });
});

import { effectiveRole } from "@/lib/auth/roles";

describe("rôle effectif", () => {
  const base = { dbRole: "JOUEUR" as const, managesStructure: false, captainOfRoster: false };
  it("se déduit des structures et rosters, sauf rôles attribués par RushXP", () => {
    expect(effectiveRole(base)).toBe("joueur");
    expect(effectiveRole({ ...base, captainOfRoster: true })).toBe("capitaine");
    expect(effectiveRole({ ...base, captainOfRoster: true, managesStructure: true })).toBe("gestionnaire");
    expect(effectiveRole({ ...base, dbRole: "ARBITRE", managesStructure: true })).toBe("arbitre");
    expect(effectiveRole({ ...base, dbRole: "ADMIN" })).toBe("admin");
  });
});
