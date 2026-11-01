"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { resolveReportAction } from "@/lib/admin/actions";
import { moderateMatchChatAction, refereeDecisionAction } from "@/lib/matches/actions";
import { FormError, TextArea } from "@/components/forms";
import { useServerAction } from "@/components/useServerAction";
import { SeriesEditor } from "@/components/match/SeriesGames";
import type { GameScore } from "@/lib/rules/series";

/** Décision motivée sur un résultat contesté : appliquée au classement et inscrite au journal du match. */
export function DisputeDecision({ matchId, game, series, a: teamA, b: teamB, declared }: { matchId: string; game: string; series: string; a: string; b: string; declared: GameScore[] }) {
  const router = useRouter();
  const [games, setGames] = useState<GameScore[]>(declared);
  const [reason, setReason] = useState("");
  const act = useServerAction(refereeDecisionAction, {
    onDone: (r) => {
      if (r.ok) router.replace(`/arbitrage?msg=${encodeURIComponent(r.message ?? "Décision rendue.")}`, { scroll: false });
    },
  });
  return (
    <form className="grid gap-3 border-t border-line p-[18px]" onSubmit={(e) => { e.preventDefault(); act.run({ matchId, games, reason }); }}>
      <div className="grid gap-1.5">
        <span className="overline">Résultat retenu, partie par partie</span>
        <SeriesEditor game={game} series={series} names={{ a: teamA, b: teamB }} planned={[]} initial={declared} onChange={setGames} />
      </div>
      <label className="grid gap-1.5">
        <span className="overline">Motif (visible par les deux équipes)</span>
        <TextArea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} aria-invalid={!!act.errors.reason} placeholder="ex. Capture lisible, score confirmé par le chat (art. 5.2)." />
        {act.errors.reason && <span className="text-[13px] text-red">{act.errors.reason}</span>}
      </label>
      <div className="flex flex-wrap gap-1.5">
        <button className="btn btn-primary btn-sm" disabled={act.pending}>Rendre la décision</button>
        <Link href={`/match?m=${matchId}`} className="btn btn-tertiary btn-sm">Ouvrir le Match Center</Link>
        <Link href="/admin?s=sanctions" className="btn btn-tertiary btn-sm">Appliquer une sanction →</Link>
      </div>
      <FormError message={act.errors._} />
    </form>
  );
}

export function MatchChatDecision({ eventId }: { eventId: string }) {
  const router = useRouter();
  const act = useServerAction(moderateMatchChatAction, {
    onDone: (r) => {
      if (r.ok) router.replace(`/arbitrage?msg=${encodeURIComponent(r.message ?? "Dossier traité.")}`, { scroll: false });
    },
  });
  return (
    <div className="grid gap-2 border-t border-line p-[18px]">
      <FormError message={act.errors._} />
      <div className="flex flex-wrap gap-1.5">
        <button className="btn btn-danger btn-sm" disabled={act.pending} onClick={() => act.run({ eventId, hide: true })}>Masquer le message</button>
        <button className="btn btn-tertiary btn-sm" disabled={act.pending} onClick={() => act.run({ eventId, hide: false })}>Classer sans suite</button>
        <Link href="/admin?s=sanctions" className="btn btn-tertiary btn-sm">Appliquer une sanction →</Link>
      </div>
    </div>
  );
}

export function ReportDecision({ messageId }: { messageId: string }) {
  const router = useRouter();
  // Le dossier quitte la file une fois traité : la confirmation s'affiche en bannière de page.
  const a = useServerAction(resolveReportAction, {
    onDone: (r) => {
      if (r.ok) router.replace(`/arbitrage?msg=${encodeURIComponent(r.message ?? "Dossier traité.")}`, { scroll: false });
    },
  });
  return (
    <div className="grid gap-2 border-t border-line p-[18px]">
      <FormError message={a.errors._} />
      {a.message ? (
        <div role="status" className="border border-orange bg-active-tint px-3 py-2.5 text-sm">✓ {a.message}</div>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          <button className="btn btn-danger btn-sm" disabled={a.pending} onClick={() => a.run({ messageId, decision: "mask" })}>Masquer le message</button>
          <button className="btn btn-tertiary btn-sm" disabled={a.pending} onClick={() => a.run({ messageId, decision: "dismiss" })}>Classer sans suite</button>
          <Link href="/admin?s=sanctions" className="btn btn-tertiary btn-sm">Appliquer une sanction →</Link>
        </div>
      )}
    </div>
  );
}
