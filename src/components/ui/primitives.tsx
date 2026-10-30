import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

/**
 * Bibliothèque de composants RushXP (charte : angles droits, aucune ombre, statut jamais porté par la couleur seule).
 * États couverts : normal, survol, actif, focus clavier, désactivé (avec raison), chargement, succès, erreur, avertissement.
 */

export type Variant = "primary" | "secondary" | "tertiary" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: "md" | "sm";
  loading?: boolean;
  /** Raison affichée quand l'action est indisponible (infobulle + texte lu par les lecteurs d'écran). */
  disabledReason?: string;
}

export function Button({ variant = "primary", size = "md", loading, disabledReason, disabled, children, className = "", ...rest }: ButtonProps) {
  const off = disabled || !!disabledReason || loading;
  return (
    <button
      {...rest}
      disabled={off}
      aria-busy={loading || undefined}
      title={disabledReason ?? rest.title}
      className={`btn btn-${variant} ${size === "sm" ? "btn-sm" : ""} ${className}`}
    >
      {loading && <span className="spinner" aria-hidden />}
      {children}
      {disabledReason && <span className="sr-only"> · indisponible : {disabledReason}</span>}
    </button>
  );
}

export function LinkButton({ href, variant = "primary", size = "md", className = "", children }: { href: string; variant?: Variant; size?: "md" | "sm"; className?: string; children: ReactNode }) {
  return (
    <Link href={href} className={`btn btn-${variant} ${size === "sm" ? "btn-sm" : ""} ${className}`}>
      {children}
    </Link>
  );
}

export type Tone = "neutral" | "orange" | "yellow" | "red" | "muted" | "solid";
const TONE: Record<Tone, string> = {
  neutral: "text-silver",
  orange: "text-orange",
  yellow: "text-yellow",
  red: "text-red",
  muted: "text-grey",
  solid: "bg-orange !border-orange !text-bg",
};

/** Badge de statut : toujours un libellé texte. */
export function Badge({ tone = "neutral", children, className = "" }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={`badge ${TONE[tone]} ${className}`}>{children}</span>;
}

export function Card({ title, meta, actions, children, className = "", accent }: { title?: ReactNode; meta?: ReactNode; actions?: ReactNode; children?: ReactNode; className?: string; accent?: boolean }) {
  return (
    <section className={`card ${accent ? "border-t-2 !border-t-orange" : ""} ${className}`}>
      {(title || meta || actions) && (
        <div className="card-head">
          {title && <span className="card-title flex-1">{title}</span>}
          {meta && <span className="card-meta">{meta}</span>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export type AlertKind = "info" | "success" | "warning" | "error";
const ALERT: Record<AlertKind, [string, string]> = {
  info: ["border-line bg-surface text-silver", "Info"],
  success: ["border-orange bg-active-tint text-ink", "✓ Succès"],
  warning: ["border-yellow bg-[rgba(255,201,40,.08)] text-ink", "▲ Attention"],
  error: ["border-red bg-[rgba(255,90,42,.08)] text-red", "Erreur"],
};

/** Message d'état. `role` adapté : les erreurs sont annoncées immédiatement. */
export function Alert({ kind = "info", title, children }: { kind?: AlertKind; title?: string; children: ReactNode }) {
  const [cls, label] = ALERT[kind];
  return (
    <div role={kind === "error" ? "alert" : "status"} className={`border px-3.5 py-2.5 text-[13px] ${cls}`}>
      <span className="mr-1.5 text-[11px] font-bold uppercase tracking-[.08em]">{title ?? label}</span>
      {children}
    </div>
  );
}

/** Tableau large : défile horizontalement dans sa carte. */
export function Table({ head, rows, minWidth = 560, empty }: { head: ReactNode[]; rows: ReactNode[][]; minWidth?: number; empty?: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm" style={{ minWidth }}>
        <thead>
          <tr className="overline !font-normal">
            {head.map((h, i) => (
              <th key={i} scope="col" className={`border-b border-line px-[18px] py-2.5 font-normal ${i === 0 ? "text-left" : "text-left"}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-surface-2 transition-colors duration-150 hover:bg-surface-2">
              {r.map((c, j) => (
                <td key={j} className="px-[18px] py-2.5">{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && empty && <EmptyState>{empty}</EmptyState>}
    </div>
  );
}

export function EmptyState({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="grid justify-items-center gap-3 px-[18px] py-8 text-center text-[13px] text-grey">
      <span>{children}</span>
      {action}
    </div>
  );
}

export function ErrorState({ children, retryHref }: { children: ReactNode; retryHref?: string }) {
  return (
    <div role="alert" className="grid justify-items-center gap-3 px-[18px] py-8 text-center text-[13px] text-red">
      <span>{children}</span>
      {retryHref && <LinkButton href={retryHref} variant="tertiary" size="sm">Réessayer</LinkButton>}
    </div>
  );
}

/** Chargement : blocs neutres animés, avec un libellé pour les lecteurs d'écran. */
export function Skeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="grid gap-2 px-[18px] py-4" aria-busy="true">
      <span className="sr-only">Chargement…</span>
      {Array.from({ length: lines }, (_, i) => (
        <span key={i} className="h-3 animate-rxpulse bg-surface-2" style={{ width: `${90 - i * 15}%` }} />
      ))}
    </div>
  );
}

/** Emplacement publicitaire : label toujours visible, jamais dans les zones de chat ou d'action de match. */
export function AdSlot({ label = "Publicité", children, ratio = "aspect-[1360/160]" }: { label?: "Publicité" | "Partenaire" | "Sponsorisé"; children: ReactNode; ratio?: string }) {
  return (
    <aside aria-label={label} className={`relative overflow-hidden border border-line bg-black ${ratio}`}>
      {children}
      <span className="badge absolute top-2 right-2 bg-bg text-silver">{label}</span>
    </aside>
  );
}
