"use client";

/**
 * État des défis côté client, pour la DÉMONSTRATION (persisté en sessionStorage).
 * En production : server actions + table Challenge, avec contrôle des droits et des règles côté serveur,
 * puis diffusion temps réel (WebSocket) des compteurs.
 */

import { useCallback, useSyncExternalStore } from "react";
import type { ChallengeItem } from "@/lib/data/challenges";

type State = Record<string, ChallengeItem[]>;
const KEY = "rxp-challenges";
const listeners = new Set<() => void>();
let state: State | null = null;

function load(): State {
  if (state) return state;
  try {
    state = JSON.parse(sessionStorage.getItem(KEY) ?? "{}") as State;
  } catch {
    state = {};
  }
  return state;
}

function save(next: State) {
  state = next;
  try {
    sessionStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* stockage indisponible : l'état reste en mémoire */
  }
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

const EMPTY: State = {};

export function useChallenges(game: string, initial: ChallengeItem[]) {
  const snap = useSyncExternalStore(subscribe, load, () => EMPTY);
  const list = snap[game] ?? initial;
  const update = useCallback(
    (fn: (l: ChallengeItem[]) => ChallengeItem[]) => {
      const cur = load();
      save({ ...cur, [game]: fn(cur[game] ?? initial) });
    },
    [game, initial],
  );
  const reset = useCallback(() => {
    const rest = { ...load() };
    delete rest[game];
    save(rest);
  }, [game]);
  return { list, update, reset };
}
