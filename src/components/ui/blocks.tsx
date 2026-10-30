import Image from "next/image";
import type { ReactNode } from "react";

// ─── Bloc de chat ────────────────────────────────────────────────

export type ChatLine =
  | { kind: "system"; text: string; time: string }
  | { kind: "referee"; author: string; text: string; time: string }
  | { kind: "user"; author: string; team?: string; text: string; time: string; mine?: boolean; reported?: boolean }
  | { kind: "file"; author: string; file: string; size: string; time: string };

/** Ligne de chat de match : messages système, arbitre et joueurs visuellement distincts (et nommés). */
export function ChatMessage({ line, onReport }: { line: ChatLine; onReport?: () => void }) {
  if (line.kind === "system")
    return (
      <div className="flex gap-2 border-l-2 border-line pl-2.5 text-xs text-grey">
        <span className="font-bold text-silver">SYSTÈME</span>
        <span className="flex-1">{line.text}</span>
        <span>{line.time}</span>
      </div>
    );
  if (line.kind === "referee")
    return (
      <div className="flex gap-2 border-l-2 border-yellow bg-[rgba(255,201,40,.06)] py-1 pl-2.5 text-xs">
        <span className="font-bold text-yellow">ARBITRE</span>
        <span className="flex-1"><b>{line.author}</b> · {line.text}</span>
        <span className="text-grey">{line.time}</span>
      </div>
    );
  const author = line.author;
  return (
    <div className="flex gap-2.5">
      <span className="grid h-7 w-7 flex-none place-items-center bg-surface-2 font-display text-xs font-bold">{author.slice(0, 2).toUpperCase()}</span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className={`font-semibold ${line.kind === "user" && line.mine ? "text-orange" : ""}`}>{author}</span>
          <span className="text-grey">{line.kind === "user" && line.team ? `${line.team} · ` : ""}{line.time}</span>
          {onReport && line.kind === "user" && !line.mine && (
            <button className="ml-auto cursor-pointer text-[11px] text-grey hover:text-red" onClick={onReport}>{line.reported ? "Signalé" : "Signaler"}</button>
          )}
        </div>
        {line.kind === "user" ? (
          <div className="text-sm">{line.text}</div>
        ) : (
          <div className="mt-1 inline-flex items-center gap-2 border border-line bg-bg px-2.5 py-1.5 text-xs">
            <span aria-hidden>▤</span>
            {line.file} <span className="text-grey">{line.size}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Carte de publication ────────────────────────────────────────

export function PostCard({
  author,
  official,
  sponsored,
  logo,
  date,
  kind,
  title,
  body,
  image,
  pinned,
  footer,
}: {
  author: string;
  official?: boolean;
  sponsored?: boolean;
  logo?: string;
  date: string;
  kind: string;
  title: string;
  body?: string;
  image?: string;
  pinned?: boolean;
  footer?: ReactNode;
}) {
  return (
    <article className="card">
      {pinned && <div className="border-b border-line bg-active-tint px-[18px] py-1.5 text-[11px] font-bold tracking-[.08em] text-orange">▲ ÉPINGLÉ · {kind.toUpperCase()}</div>}
      <div className="flex items-center gap-3 px-[18px] pt-3.5">
        {logo ? <Image src={logo} alt="" width={36} height={36} className="h-9 w-9 object-contain" /> : <span className="clip-corner-sm grid h-9 w-9 place-items-center bg-surface-2 font-mono text-[10px]">{author.slice(0, 3).toUpperCase()}</span>}
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold">{author}</span>
            {official && <span className="badge text-orange">Officiel</span>}
          </div>
          <div className="text-xs text-grey">{date} · {kind}</div>
        </div>
        {sponsored && <span className="badge text-silver">Sponsorisé</span>}
      </div>
      <div className="px-[18px] py-3">
        <h3 className="font-display text-2xl font-bold leading-tight">{title}</h3>
        {body && <p className="mt-1.5 whitespace-pre-line text-[15px] text-silver">{body}</p>}
      </div>
      {image && (
        <div className="relative aspect-video border-y border-line">
          <Image src={image} alt="" fill className="object-cover" sizes="640px" />
        </div>
      )}
      {footer}
    </article>
  );
}

// ─── Étapes d'un processus (OCR, inscription…) ───────────────────

export function ProgressSteps({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="grid border-b border-line" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0,1fr))` }}>
      {steps.map((l, i) => (
        <li key={l} aria-current={i === current ? "step" : undefined} className={`border-r border-line px-3 py-2.5 text-center last:border-r-0 ${i <= current ? "text-orange" : "text-grey"}`}>
          <div className="text-xs font-bold">{i < current ? "✓" : i + 1}</div>
          <div className="text-[12px]">{l}</div>
        </li>
      ))}
    </ol>
  );
}
