/** Liens de diffusion : seuls les domaines des plateformes autorisées sont acceptés (SPEC_METIER §7). */

export const STREAM_PLATFORMS = {
  Twitch: ["twitch.tv"],
  Kick: ["kick.com"],
  YouTube: ["youtube.com", "youtu.be"],
  Facebook: ["facebook.com", "fb.gg"],
  TikTok: ["tiktok.com"],
} as const;

export type StreamPlatform = keyof typeof STREAM_PLATFORMS;

/** Renvoie l'URL normalisée (https) ou un message d'erreur. */
export function validateStreamUrl(platform: StreamPlatform, raw: string): { ok: true; url: string } | { ok: false; error: string } {
  const v = raw.trim();
  if (!v) return { ok: false, error: "Collez le lien de la diffusion." };
  let u: URL;
  try {
    u = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
  } catch {
    return { ok: false, error: "Lien invalide." };
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return { ok: false, error: "Lien invalide." };
  const host = u.hostname.toLowerCase().replace(/^www\.|^m\./, "");
  const allowed = STREAM_PLATFORMS[platform] as readonly string[];
  if (!allowed.some((d) => host === d || host.endsWith(`.${d}`))) return { ok: false, error: `Ce lien n’est pas un lien ${platform} (${allowed.join(" ou ")}).` };
  if (u.pathname === "/" || u.pathname === "") return { ok: false, error: "Indiquez la chaîne ou la vidéo, pas seulement le site." };
  u.protocol = "https:";
  return { ok: true, url: `${host}${u.pathname.replace(/\/$/, "")}${u.search}` };
}
