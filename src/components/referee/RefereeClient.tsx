"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { resolveReportAction } from "@/lib/admin/actions";
import { FormError, TextArea } from "@/components/forms";
import { useServerAction } from "@/components/useServerAction";

/** Décision sur un cas de démonstration : état local uniquement (la table Dispute arrive avec les matchs). */
export function DemoDecision({ actions }: { actions: string[] }) {
  const [note, setNote] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  if (done)
    return (
      <div role="status" className="border border-orange bg-active-tint px-[18px] py-3 text-sm">
        ✓ {done}
        {note ? ` · ${note}` : ""} <span className="text-xs text-grey">(démonstration : non enregistré)</span>
      </div>
    );
  return (
    <div className="grid gap-3 border-t border-line p-[18px]">
      <label className="grid gap-1.5">
        <span className="overline">Note de décision (visible par les deux équipes)</span>
        <TextArea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="ex. Capture lisible, score confirmé par le chat." />
      </label>
      <div className="flex flex-wrap gap-1.5">
        {actions.map((a, i) => (
          <button key={a} className={`btn btn-sm ${i === 0 ? "btn-primary" : a.startsWith("Sanction") ? "btn-danger" : "btn-tertiary"}`} onClick={() => setPending(a)}>{a}</button>
        ))}
      </div>
      {pending && (
        <div className="flex flex-wrap items-center gap-2 border border-line bg-bg px-3 py-2.5 text-[13px]">
          <span className="flex-1">Confirmer « {pending} » ? La décision est notifiée aux deux parties et inscrite au journal d’audit.</span>
          <button className="btn btn-primary btn-sm" onClick={() => setDone(pending)}>Confirmer</button>
          <button className="btn btn-tertiary btn-sm" onClick={() => setPending(null)}>Annuler</button>
        </div>
      )}
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
