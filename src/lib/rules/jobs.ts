/** Politique de relance des tâches programmées (fonction pure). */

export const MAX_ATTEMPTS = 3;

/** Prochaine tentative après un échec : 5 min, puis 30 min ; au-delà de 3 tentatives, abandon (null). */
export function nextRetry(attempts: number, now: Date): Date | null {
  if (attempts >= MAX_ATTEMPTS) return null;
  const delayMin = attempts <= 1 ? 5 : 30;
  return new Date(now.getTime() + delayMin * 60_000);
}
