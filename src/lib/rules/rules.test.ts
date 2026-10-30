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

import { isRosterComplete, rosterSlotError, transferKind } from "./roster";

describe("rosters et transferts", () => {
  it("limite titulaires et remplaçants", () => {
    expect(rosterSlotError({ rosterSize: 5, starters: 5, subs: 0 }, "STARTER")).toMatch(/complet/);
    expect(rosterSlotError({ rosterSize: 5, starters: 5, subs: 1 }, "SUB")).toBeNull();
    expect(rosterSlotError({ rosterSize: 5, starters: 5, subs: 2 }, "SUB")).toMatch(/2 remplaçants/);
    expect(isRosterComplete({ rosterSize: 3, starters: 2 })).toBe(false);
  });
  it("pas de mercato : signature ou transfert toute l’année", () => {
    expect(transferKind(null, "B")).toBe("SIGNING");
    expect(transferKind("A", "B")).toBe("TRANSFER");
    expect(transferKind("B", "B")).toBe("SAME");
  });
});

import { validateStreamUrl } from "./streams";

describe("liens de diffusion", () => {
  it("accepte uniquement les domaines de la plateforme choisie", () => {
    expect(validateStreamUrl("Twitch", "https://www.twitch.tv/rushxp")).toEqual({ ok: true, url: "twitch.tv/rushxp" });
    expect(validateStreamUrl("YouTube", "youtu.be/abc123").ok).toBe(true);
    expect(validateStreamUrl("Twitch", "https://kick.com/rushxp").ok).toBe(false);
    expect(validateStreamUrl("Kick", "https://kick.com.evil.io/x").ok).toBe(false);
    expect(validateStreamUrl("Kick", "kick.com").ok).toBe(false);
    expect(validateStreamUrl("TikTok", "javascript:alert(1)").ok).toBe(false);
  });
});

import { nextEventDate } from "@/lib/events/schedule";

describe("dates des RDV mensuels", () => {
  const local = (d: Date) => new Intl.DateTimeFormat("fr-FR", { timeZone: "Indian/Reunion", dateStyle: "short", timeStyle: "short" }).format(d);
  it("un samedi par mois, pendant la pré-saison et la saison régulière seulement", () => {
    const tft = nextEventDate("tft", new Date("2026-10-29T12:00:00+04:00")); // Playoffs : pas de RDV → janvier
    expect(local(tft)).toBe("16/01/2027 18:00");
    expect(local(nextEventDate("apex", new Date("2026-05-31T22:00:00+04:00")))).toBe("27/06/2026 20:00");
    expect(local(nextEventDate("wz", new Date("2026-12-01T00:00:00+04:00")))).toBe("23/01/2027 20:00");
  });
});

import { defaultSeason, nextPhase, phaseAt, phaseWhen } from "./season";

describe("calendrier de saison", () => {
  const s26 = defaultSeason(2026);
  it("pré-saison janv. → avr., saison régulière mai → août, Playoffs sept. → déc.", () => {
    expect(s26.phases.map((p) => [p.kind, phaseWhen(p)])).toEqual([
      ["PRESEASON", "Janv. → avr."],
      ["REGULAR", "Mai → août"],
      ["PLAYOFFS", "Sept. → déc."],
    ]);
  });
  it("bornes à l’heure de La Réunion", () => {
    expect(phaseAt(s26.phases, new Date("2026-04-30T23:59:00+04:00"))?.kind).toBe("PRESEASON");
    expect(phaseAt(s26.phases, new Date("2026-05-01T00:00:00+04:00"))?.kind).toBe("REGULAR");
    expect(phaseAt(s26.phases, new Date("2026-10-30T12:00:00+04:00"))?.kind).toBe("PLAYOFFS");
    expect(s26.seedingAt.toISOString()).toBe("2026-08-31T19:59:00.000Z");
  });
  it("la pré-saison ne compte pas au général ; pas de RDV pendant les Playoffs", () => {
    expect(s26.phases.find((p) => p.kind === "PRESEASON")?.countsForGeneral).toBe(false);
    expect(s26.phases.find((p) => p.kind === "PLAYOFFS")?.monthlyEvents).toBe(false);
    expect(nextPhase(s26.phases, new Date("2026-03-01T00:00:00+04:00"))?.kind).toBe("REGULAR");
  });
});

import { lanPoints, lanStructurePoints } from "./scales";

describe("barème LAN", () => {
  it("barème des Rankings + 50 points", () => {
    expect([1, 2, 3, 8].map(lanPoints)).toEqual([150, 140, 132, 106]);
    expect(lanPoints(9)).toBe(102);
    expect(lanPoints(40)).toBe(55);
  });
  it("par jeu, seul le meilleur classement de la structure compte", () => {
    const r = lanStructurePoints([
      { game: "val", place: 1, structure: "Nova" },
      { game: "val", place: 3, structure: "Nova" },
      { game: "fc", place: 2, structure: "Nova" },
      { game: "fc", place: 1, structure: "Atlas" },
      { game: "tek", place: 1, structure: null },
    ]);
    expect(r).toEqual([
      { structure: "Nova", points: 290, byGame: { val: 150, fc: 140 } },
      { structure: "Atlas", points: 150, byGame: { fc: 150 } },
    ]);
  });
});

import { MAX_ATTEMPTS, nextRetry } from "./jobs";
import { mocks, ocrNeedsReview } from "@/lib/integrations";

describe("tâches programmées et intégrations simulées", () => {
  const now = new Date("2026-10-30T12:00:00Z");
  it("relance à 5 min puis 30 min, abandon après 3 tentatives", () => {
    expect(nextRetry(1, now)?.toISOString()).toBe("2026-10-30T12:05:00.000Z");
    expect(nextRetry(2, now)?.toISOString()).toBe("2026-10-30T12:30:00.000Z");
    expect(nextRetry(MAX_ATTEMPTS, now)).toBeNull();
  });
  it("OCR : confiance faible → vérification arbitre", async () => {
    const ok = await mocks.ocr.analyze({ game: "val", fileUrl: "capture.png" });
    const flou = await mocks.ocr.analyze({ game: "val", fileUrl: "capture_flou.png" });
    expect(ocrNeedsReview(ok.fields)).toBe(false);
    expect(ocrNeedsReview(flou.fields)).toBe(true);
  });
  it("paiement simulé : retour vers la page de succès", async () => {
    const r = await mocks.payments.createCheckout({ amountCents: 1500, currency: "eur", description: "LAN", customerEmail: "a@b.re", metadata: { lan: "x" }, successUrl: "/lan/x/paiement/retour", cancelUrl: "/lan/x" });
    expect(r.url).toMatch(/^\/lan\/x\/paiement\/retour\?session_id=mock_cs_.+&mock=1$/);
  });
});
