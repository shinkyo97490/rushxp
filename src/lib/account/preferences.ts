/** Catégories de notifications et options de confidentialité (partagées client / serveur). */

export const NOTIF_CATEGORIES = [
  { key: "defis", label: "Défis", locked: false },
  { key: "matchs", label: "Matchs (veto, check-in, résultats)", locked: true },
  { key: "recrutement", label: "Recrutement et invitations", locked: false },
  { key: "equipe", label: "Mon équipe", locked: false },
  { key: "communaute", label: "Communauté et actualités", locked: false },
  { key: "systeme", label: "Compte et sécurité", locked: true },
] as const;

export const NOTIF_LABEL: Record<string, string> = Object.fromEntries(NOTIF_CATEGORIES.map((c) => [c.key, c.label.split(" (")[0]]));

export type NotifPrefs = Record<string, { site: boolean; email: boolean }>;

export function resolvePrefs(stored: unknown): NotifPrefs {
  const s = (stored ?? {}) as NotifPrefs;
  return Object.fromEntries(NOTIF_CATEGORIES.map((c) => [c.key, { site: c.locked ? true : (s[c.key]?.site ?? true), email: s[c.key]?.email ?? c.key !== "communaute" }]));
}

export const PRIVACY_OPTIONS = [
  { key: "profile", label: "Visibilité du profil", desc: "Qui peut voir vos statistiques et votre historique", opts: ["Public", "Membres RushXP", "Ma structure"] },
  { key: "dm", label: "Messages privés", desc: "Qui peut vous écrire", opts: ["Tout le monde", "Structures et coéquipiers", "Personne"] },
  { key: "lft", label: "Profil agent libre", desc: "Apparaître dans Recrutement · Joueurs disponibles", opts: ["Visible", "Masqué"] },
] as const;

export function resolvePrivacy(stored: unknown): Record<string, string> {
  const s = (stored ?? {}) as Record<string, string>;
  return Object.fromEntries(PRIVACY_OPTIONS.map((o) => [o.key, (o.opts as readonly string[]).includes(s[o.key]) ? s[o.key] : o.opts[0]]));
}
