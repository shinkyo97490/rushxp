"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { markThreadReadAction, openThreadAction, reportMessageAction, sendMessageAction } from "@/lib/messages/actions";
import { FormError, TextInput } from "@/components/forms";
import { useServerAction } from "@/components/useServerAction";

/** Rafraîchit la conversation régulièrement (le temps réel par WebSocket viendra ensuite). */
export function AutoRefresh({ threadId, seconds = 10 }: { threadId: string | null; seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    if (threadId) markThreadReadAction(threadId);
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, seconds * 1000);
    return () => clearInterval(id);
  }, [threadId, seconds, router]);
  return null;
}

export function NewConversation() {
  const [pseudo, setPseudo] = useState("");
  return (
    <form action={() => openThreadAction(pseudo)} className="flex gap-2 border-b border-line p-3">
      <TextInput aria-label="Pseudo du destinataire" value={pseudo} onChange={(e) => setPseudo(e.target.value)} placeholder="Nouveau message : pseudo…" className="!h-10" />
      <button className="btn btn-secondary btn-sm" disabled={!pseudo.trim()}>Écrire</button>
    </form>
  );
}

export interface MsgView {
  id: string;
  text: string;
  mine: boolean;
  author: string;
  time: string;
}

export function Conversation({ threadId, messages, disabledReason }: { threadId: string; messages: MsgView[]; disabledReason: string | null }) {
  const [draft, setDraft] = useState("");
  const send = useServerAction(sendMessageAction);
  const report = useServerAction(reportMessageAction);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  return (
    <>
      <div className="grid max-h-[55vh] min-h-[320px] content-start gap-2.5 overflow-y-auto p-[18px]" aria-live="polite">
        {messages.map((m) => (
          <div key={m.id} className={`group max-w-[78%] ${m.mine ? "justify-self-end" : "justify-self-start"}`}>
            <div className={`px-3.5 py-2.5 text-sm whitespace-pre-line ${m.mine ? "bg-orange text-bg" : "border border-line bg-surface-2"}`}>{m.text}</div>
            <div className={`mt-1 flex gap-2 text-[11px] text-grey ${m.mine ? "justify-end" : ""}`}>
              <span>{m.author} · {m.time}</span>
              {!m.mine && (
                <button className="cursor-pointer text-grey underline-offset-2 hover:text-red hover:underline" onClick={() => report.run(m.id)} disabled={report.pending}>
                  Signaler
                </button>
              )}
            </div>
          </div>
        ))}
        {messages.length === 0 && <div className="py-10 text-center text-[13px] text-grey">Aucun message. Écrivez le premier.</div>}
        <div ref={end} />
      </div>
      {(report.message || report.errors._) && (
        <div className="px-[18px]">
          {report.message ? <span role="status" className="text-[13px] text-orange">{report.message}</span> : <FormError message={report.errors._} />}
        </div>
      )}
      <form
        className="grid gap-2 border-t border-line p-3"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await send.run({ threadId, text: draft })) setDraft("");
        }}
      >
        <FormError message={send.errors._ ?? disabledReason ?? undefined} />
        <div className="flex gap-2">
          <TextInput aria-label="Message" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={disabledReason ? "Envoi désactivé" : "Écrire un message…"} disabled={!!disabledReason} maxLength={2000} />
          <button className="btn btn-primary" disabled={send.pending || !draft.trim() || !!disabledReason}>Envoyer</button>
        </div>
      </form>
    </>
  );
}
