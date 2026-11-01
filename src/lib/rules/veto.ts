/** Veto des cartes (Valorant BO3, CDL BO5) et map pool par cycle. Fonctions pures, testées. */

export const VAL_ALL = ["Abyss", "Ascent", "Bind", "Breeze", "Corrode", "Fracture", "Haven", "Icebox", "Lotus", "Pearl", "Split", "Sunset"];
export const CDL_MODES = { HP: "Hardpoint", SND: "Recherche & Destruction", CTRL: "Contrôle" } as const;
export type CdlMode = keyof typeof CDL_MODES;
export const CDL_ALL: Record<CdlMode, string[]> = {
  HP: ["Hacienda", "Protocol", "Red Card", "Rewind", "Skyline", "Vault"],
  SND: ["Dealership", "Hacienda", "Protocol", "Red Card", "Rewind", "Skyline", "Vault"],
  CTRL: ["Hacienda", "Protocol", "Rewind", "Skyline", "Vault"],
};
/** Taille du pool actif par jeu (et par mode en CDL). */
export const POOL_SIZE = { val: 7, cod: { HP: 4, SND: 5, CTRL: 3 } as Record<CdlMode, number> };
export const DEFAULT_POOLS = {
  val: ["Ascent", "Bind", "Haven", "Lotus", "Split", "Sunset", "Pearl"],
  cod: { HP: ["Hacienda", "Protocol", "Rewind", "Skyline"], SND: ["Dealership", "Hacienda", "Protocol", "Rewind", "Skyline"], CTRL: ["Hacienda", "Protocol", "Vault"] } as Record<CdlMode, string[]>,
};
/** Modes des 5 cartes d'une série CDL. */
export const CDL_SLOTS: CdlMode[] = ["HP", "SND", "CTRL", "HP", "SND"];

export type VetoPool = string[] | Record<CdlMode, string[]>;
export interface VetoStep {
  actor: "A" | "B" | "-";
  action: "ban" | "pick" | "decider";
  map: string;
  mode?: CdlMode;
  slot?: number;
}
type StepDef = Omit<VetoStep, "map">;

export function hasVeto(game: string) {
  return game === "val" || game === "cod";
}

export function vetoSequence(game: string): StepDef[] {
  if (game === "val")
    return [
      { actor: "A", action: "ban" },
      { actor: "B", action: "ban" },
      { actor: "A", action: "pick" },
      { actor: "B", action: "pick" },
      { actor: "A", action: "ban" },
      { actor: "B", action: "ban" },
      { actor: "-", action: "decider" },
    ];
  if (game === "cod")
    return CDL_SLOTS.flatMap((mode, slot): StepDef[] => {
      const a = slot % 2 === 0 ? "A" : "B";
      const b = a === "A" ? "B" : "A";
      return [
        { actor: a, action: "ban", mode, slot },
        { actor: b, action: "pick", mode, slot },
      ];
    });
  return [];
}

export function nextStep(game: string, steps: VetoStep[]): StepDef | null {
  return vetoSequence(game)[steps.length] ?? null;
}

/** Cartes encore possibles pour l'étape en cours. */
export function availableMaps(game: string, pool: VetoPool, steps: VetoStep[]): string[] {
  const step = nextStep(game, steps);
  if (!step) return [];
  if (game === "val") {
    const used = new Set(steps.map((s) => s.map));
    return (pool as string[]).filter((m) => !used.has(m));
  }
  const p = (pool as Record<CdlMode, string[]>)[step.mode!] ?? [];
  const pickedSameMode = new Set(steps.filter((s) => s.mode === step.mode && s.action === "pick").map((s) => s.map));
  const bannedThisSlot = new Set(steps.filter((s) => s.slot === step.slot && s.action === "ban").map((s) => s.map));
  return p.filter((m) => !pickedSameMode.has(m) && !bannedThisSlot.has(m));
}

/** Applique un choix de `actor` ; la carte décisive (Valorant) est ajoutée automatiquement. */
export function applyVeto(game: string, pool: VetoPool, steps: VetoStep[], actor: "A" | "B", map: string): { steps: VetoStep[] } | { error: string } {
  const step = nextStep(game, steps);
  if (!step) return { error: "Veto terminé." };
  if (step.actor !== actor) return { error: "Ce n’est pas votre tour." };
  if (!availableMaps(game, pool, steps).includes(map)) return { error: "Carte indisponible." };
  const out = [...steps, { ...step, map }];
  const after = nextStep(game, out);
  if (after?.action === "decider") {
    const left = availableMaps(game, pool, out);
    if (left.length === 1) out.push({ ...after, map: left[0] });
  }
  return { steps: out };
}

/** Cartes jouées, dans l'ordre. */
export function playedMaps(steps: VetoStep[]) {
  return steps.filter((s) => s.action !== "ban");
}

export function validatePool(game: string, pool: VetoPool): string | null {
  if (game === "val") {
    const p = pool as string[];
    if (!Array.isArray(p) || p.length !== POOL_SIZE.val) return `Le pool Valorant compte ${POOL_SIZE.val} cartes.`;
    if (p.some((m) => !VAL_ALL.includes(m))) return "Carte inconnue.";
    return new Set(p).size === p.length ? null : "Carte en double.";
  }
  if (game === "cod") {
    for (const mode of Object.keys(CDL_MODES) as CdlMode[]) {
      const p = (pool as Record<CdlMode, string[]>)[mode];
      if (!Array.isArray(p) || p.length !== POOL_SIZE.cod[mode]) return `${CDL_MODES[mode]} : ${POOL_SIZE.cod[mode]} cartes.`;
      if (p.some((m) => !CDL_ALL[mode].includes(m))) return `${CDL_MODES[mode]} : carte inconnue.`;
      if (new Set(p).size !== p.length) return `${CDL_MODES[mode]} : carte en double.`;
    }
    return null;
  }
  return "Ce jeu n’a pas de veto.";
}
