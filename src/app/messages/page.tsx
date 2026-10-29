import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getViewer } from "@/lib/auth/viewer";
import { openThreadAction } from "@/lib/messages/actions";
import { FormError } from "@/components/forms";
import { PageHeader } from "@/components/PageHeader";
import { AutoRefresh, Conversation, NewConversation } from "@/components/messages/MessagesClient";

export const metadata: Metadata = { title: "Messages" };

const time = (d: Date) => {
  const today = new Date().toDateString() === d.toDateString();
  return new Intl.DateTimeFormat("fr-FR", today ? { hour: "2-digit", minute: "2-digit" } : { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(d);
};

export default async function MessagesPage({ searchParams }: { searchParams: Promise<{ t?: string; a?: string; erreur?: string }> }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/connexion?next=/messages");
  const sp = await searchParams;
  // Lien « Contacter » depuis une annonce ou un profil : ouvre la conversation.
  if (sp.a) await openThreadAction(sp.a);

  const threads = await db.thread.findMany({
    where: { OR: [{ userAId: viewer.id }, { userBId: viewer.id }] },
    include: {
      userA: { select: { id: true, pseudo: true } },
      userB: { select: { id: true, pseudo: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { lastAt: "desc" },
  });
  const view = threads.map((t) => {
    const other = t.userAId === viewer.id ? t.userB : t.userA;
    const read = t.userAId === viewer.id ? t.readA : t.readB;
    const last = t.messages[0];
    return { id: t.id, other, last, unread: !!last && last.authorId !== viewer.id && (!read || read < last.createdAt) };
  });
  const cur = view.find((t) => t.id === sp.t) ?? null;
  const messages = cur
    ? await db.message.findMany({ where: { threadId: cur.id }, include: { author: { select: { pseudo: true } } }, orderBy: { createdAt: "asc" }, take: 200 })
    : [];

  return (
    <main className="container-rx pt-7 pb-16">
      <PageHeader title="Messages" />
      {sp.erreur && <div className="mt-4 max-w-2xl"><FormError message={sp.erreur} /></div>}
      <div className="card mt-4 grid min-h-[480px] [grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr))] lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="border-r border-line">
          <NewConversation />
          {view.map((t) => (
            <Link
              key={t.id}
              href={`/messages?t=${t.id}`}
              className={`flex items-center gap-3 border-b border-surface-2 px-4 py-3 text-ink hover:bg-surface-2 hover:text-ink ${cur?.id === t.id ? "border-l-[3px] border-l-orange bg-surface-2" : ""}`}
            >
              <span className="grid h-9 w-9 flex-none place-items-center bg-surface-2 font-display text-sm font-bold">{t.other.pseudo.slice(0, 2).toUpperCase()}</span>
              <span className="min-w-0 flex-1">
                <span className="flex justify-between gap-2">
                  <span className={`truncate text-sm ${t.unread ? "font-bold" : "font-semibold"}`}>{t.other.pseudo}</span>
                  {t.last && <span className="flex-none text-[11px] text-grey">{time(t.last.createdAt)}</span>}
                </span>
                <span className="block truncate text-xs text-grey">{t.last ? t.last.text : "Nouvelle conversation"}</span>
              </span>
              {t.unread && <span className="h-2 w-2 flex-none bg-orange" aria-label="non lu" />}
            </Link>
          ))}
          {view.length === 0 && <div className="px-4 py-6 text-center text-[13px] text-grey">Aucune conversation. Écrivez à un membre avec son pseudo, ou depuis une annonce de recrutement.</div>}
        </div>
        <div className="grid min-w-0 content-start">
          {cur ? (
            <>
              <div className="flex items-center gap-3 border-b border-line px-[18px] py-3">
                <span className="min-w-0 flex-1">
                  <Link href={`/joueur/${encodeURIComponent(cur.other.pseudo)}`} className="block font-display text-xl font-bold text-ink hover:text-orange">{cur.other.pseudo}</Link>
                  <span className="block text-xs text-grey">Message privé · soumis au règlement (art. 6.1)</span>
                </span>
              </div>
              <Conversation
                threadId={cur.id}
                disabledReason={cur.other.pseudo.startsWith("supprime-") ? "Ce compte a été supprimé." : null}
                messages={messages.map((m) => ({ id: m.id, text: m.text, mine: m.authorId === viewer.id, author: m.author.pseudo, time: time(m.createdAt) }))}
              />
              <AutoRefresh threadId={cur.id} />
            </>
          ) : (
            <div className="grid place-items-center p-10 text-center text-[13px] text-grey">Choisissez une conversation à gauche.</div>
          )}
        </div>
      </div>
      <p className="mt-2 text-xs text-grey">Les conversations se mettent à jour toutes les 10 secondes. Le temps réel arrive avec le chat de match.</p>
    </main>
  );
}
