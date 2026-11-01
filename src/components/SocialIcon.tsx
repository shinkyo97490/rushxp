/** Pictogrammes simplifiés des réseaux (traits, couleur héritée). */
export function SocialIcon({ id, size = 18 }: { id: string; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  switch (id) {
    case "twitch":
      return (
        <svg {...common}>
          <path d="M4 3h17v11l-5 5h-4l-3 3H7v-3H3V7z" />
          <path d="M11 8v5M16 8v5" />
        </svg>
      );
    case "discord":
      return (
        <svg {...common}>
          <path d="M7 6.5C9.5 5.5 14.5 5.5 17 6.5c1.6 2.4 2.6 5.3 2.8 9-1.4 1.2-3 2-4.6 2.5l-1-1.6M7 6.5C5.4 8.9 4.4 11.8 4.2 15.5c1.4 1.2 3 2 4.6 2.5l1-1.6" />
          <path d="M7.5 15c2.8 1.3 6.2 1.3 9 0" />
          <circle cx="9.3" cy="12" r="1" fill="currentColor" stroke="none" />
          <circle cx="14.7" cy="12" r="1" fill="currentColor" stroke="none" />
        </svg>
      );
    case "instagram":
      return (
        <svg {...common}>
          <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.2" cy="6.8" r="0.9" fill="currentColor" stroke="none" />
        </svg>
      );
    case "tiktok":
      return (
        <svg {...common}>
          <path d="M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5" />
          <path d="M14 3c.4 2.6 2.2 4.4 5 4.6" />
        </svg>
      );
    case "facebook":
      return (
        <svg {...common}>
          <path d="M15 3.5h-2.2A3.8 3.8 0 0 0 9 7.3V10H6.5v3.5H9V21h3.5v-7.5H15l.5-3.5h-3V7.8c0-.6.4-.9.9-.9H15z" />
        </svg>
      );
    default:
      return null;
  }
}
