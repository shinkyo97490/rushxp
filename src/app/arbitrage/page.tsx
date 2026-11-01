import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getViewer } from "@/lib/auth/viewer";
import { getGame } from "@/lib/data/games";
import { namesFor } from "@/lib/matches/queries";
import { gamesLine, readGames } from "@/lib/rules/series";
import { Empty, PageHeader } from "@/components/PageHeader";
import { DisputeDecision, MatchChatDecision, ReportDecision } from "@/components/referee/RefereeClient";

export const metadata: Metadata = { title: "Espace arbitre" };

const TYPE = { contest: "Contestation", chat: "Salon de match", report: "Messagerie" } as const;
const fmt = (d: Date) => new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Indian/Reunion" }).format(d);

/** Âge d'un dossier, en heures. */
function hoursSince(d: Date) {
  return (Date.now() - d.getTime()) / 36e5;
}

function Extract({ events, authors }: { events: { id: string; kind: string; authorId: string | null; text: string; createdAt: Date }[]; authors: Map<string, string> }) {
  return (
    <div className="grid gap-1 px-[18px] pb-4">
      <span className="overline">Extrait du salon de match</span>
      {[...events].reverse().map((e) => (
        <div key={e.id} className="text-[13px] text-silver">
          <strong className={e.kind === "REFEREE" ? "text-yellow" : "text-ink"}>{e.kind === "SYSTEM" ? "Système" : (authors.get(e.authorId ?? "") ?? "Membre")}</strong> <span className="text-grey">{fmt(e.createdAt)}</span> · {e.text}
        </div>
      ))}
      {events.length === 0 && <span className="text-[13px] text-grey">Aucun message.</span>}
    </div>
  );
}

export default async function ArbitragePage({ searchParams }: { searchParams: Promise<{ c?: string; f?: string; msg?: string }> }) {
  const viewer = await getViewer();
  if (!viewer || (viewer.role !== "arbitre" && viewer.role !== "admin")) notFound();
  const sp = await searchParams;

  const reports = await db.message.findMany({
    where: { reported: true },
    include: { author: { select: { pseudo: true } }, thread: { include: { messages: { orderBy: { createdAt: "desc" }, take: 6, include: { author: { select: { pseudo: true } } } } } } },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  const reportCases = reports.map((m) => ({
    id: `S-${m.id.slice(-5).toUpperCase()}`,
    key: m.id,
    type: "report" as const,
    title: `Signalement · message de ${m.author.pseudo}`,
    sub: `Messagerie · ${fmt(m.createdAt)}`,
    prio: "NORMALE",
    m,
  }));
  // Contestations ouvertes : résultat suspendu, en attente de décision.
  const disputes = await db.dispute.findMany({
    where: { decidedAt: null },
    include: { openedBy: { select: { pseudo: true } }, submission: { include: { uploader: { select: { pseudo: true } }, match: { include: { events: { where: { hidden: false }, orderBy: { createdAt: "desc" }, take: 8 } } } } } },
    orderBy: { id: "asc" },
    take: 50,
  });
  const chatReports = await db.matchEvent.findMany({
    where: { reported: true, hidden: false },
    include: { match: { include: { events: { where: { hidden: false }, orderBy: { createdAt: "desc" }, take: 8 } } } },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  const names = await namesFor([...disputes.map((d) => d.submission.match!).filter(Boolean), ...chatReports.map((c) => c.match)]);
  const authors = new Map((await db.user.findMany({ where: { id: { in: [...new Set([...chatReports, ...disputes.flatMap((d) => d.submission.match?.events ?? []), ...chatReports.flatMap((c) => c.match.events)].map((e) => e.authorId).filter((x): x is string => !!x))] } }, select: { id: true, pseudo: true } })).map((u) => [u.id, u.pseudo]));
  const vs = (m: { a: string; b: string }) => `${names.get(m.a)?.name ?? "?"} vs ${names.get(m.b)?.name ?? "?"}`;
  const disputeCases = disputes.filter((d) => d.submission.match).map((d) => ({ id: `C-${d.id.slice(-5).toUpperCase()}`, d, m: d.submission.match! }));
  const chatCases = chatReports.map((e) => ({ id: `M-${e.id.slice(-5).toUpperCase()}`, e }));
  const all = [
    ...disputeCases.map((c) => ({ id: c.id, type: "contest" as const, title: vs(c.m), sub: `${getGame(c.m.game)?.name} · ${fmt(c.d.submission.createdAt)}`, prio: hoursSince(c.d.submission.createdAt) > 24 ? "URGENT" : "HAUTE", game: c.m.game as string | null })),
    ...chatCases.map((c) => ({ id: c.id, type: "chat" as const, title: `Signalement · ${vs(c.e.match)}`, sub: fmt(c.e.createdAt), prio: "NORMALE", game: c.e.match.game as string | null })),
    ...reportCases.map((r) => ({ id: r.id, type: r.type, title: r.title, sub: r.sub, prio: r.prio, game: null as string | null })),
  ];
  const f = sp.f && sp.f in TYPE ? sp.f : null;
  const list = f ? all.filter((x) => x.type === f) : all;
  const curId = sp.c ?? list[0]?.id;
  const report = reportCases.find((r) => r.id === curId);
  const dispute = disputeCases.find((c) => c.id === curId);
  const chat = chatCases.find((c) => c.id === curId);


  return (
    <main className="container-rx pt-7 pb-16">
      <PageHeader title="Espace arbitre">{viewer.pseudo} · {viewer.role === "admin" ? "administrateur" : "arbitre"}</PageHeader>
      {sp.msg && <div role="status" className="mt-4 border border-orange bg-active-tint px-4 py-2.5 text-sm">✓ {sp.msg.slice(0, 200)}</div>}
      <div className="mt-4 grid border border-line bg-surface [grid-template-columns:repeat(auto-fit,minmax(min(100%,160px),1fr))]">
        {[["À traiter", all.length], ["Signalements", reportCases.length + chatCases.length], ["Contestations", disputeCases.length], ["Urgent", all.filter((x) => x.prio === "URGENT").length]].map(([k, v]) => (
          <div key={k} className="border-r border-line px-4 py-3"><div className="overline !font-normal">{k}</div><div className={`font-display text-[30px] font-extrabold ${k === "Urgent" && v ? "text-red" : ""}`}>{v}</div></div>
        ))}
      </div>
      <div className="mt-4 grid items-start gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr))] lg:grid-cols-[360px_minmax(0,1fr)]">
        <section className="card">
          <div className="flex flex-wrap gap-1 border-b border-line p-2.5">
            {[[null, "Tout"], ...Object.entries(TYPE)].map(([k, l]) => (
              <Link key={l} href={k ? `/arbitrage?f=${k}` : "/arbitrage"} className={`btn btn-sm ${f === k ? "btn-secondary" : "btn-tertiary"}`}>
                {l} · {k ? all.filter((x) => x.type === k).length : all.length}
              </Link>
            ))}
          </div>
          {list.map((q) => {
            const g = q.game ? getGame(q.game) : null;
            return (
              <Link
                key={q.id}
                href={`/arbitrage?c=${q.id}${f ? `&f=${f}` : ""}`}
                className={`flex items-center gap-3 border-b border-surface-2 px-4 py-3 text-ink hover:bg-surface-2 hover:text-ink ${q.id === curId ? "border-l-[3px] border-l-orange bg-surface-2" : ""}`}
              >
                {g ? <Image src={g.logo} alt="" width={28} height={18} className="h-[18px] w-7 object-contain" /> : <span className="w-7 text-center text-grey">✉</span>}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{q.title}</span>
                  <span className="block text-xs text-grey">{TYPE[q.type]} · {q.sub}</span>
                </span>
                <span className={`text-[11px] font-bold ${q.prio === "URGENT" ? "text-red" : q.prio === "HAUTE" ? "text-orange" : "text-grey"}`}>{q.prio}</span>
              </Link>
            );
          })}
          {list.length === 0 && <Empty>File vide. Rien à traiter.</Empty>}
        </section>

        <section className="card min-w-0">
          {report ? (
            <>
              <div className="card-head">
                <span className="min-w-0">
                  <span className="block font-display text-xl font-bold">{report.title}</span>
                  <span className="block text-xs text-grey">{report.id} · Messagerie · Signalement</span>
                </span>
                <span className="badge bg-orange !text-bg">À traiter</span>
              </div>
              <div className="grid gap-2 p-[18px]">
                <span className="overline">Message signalé</span>
                <div className="border border-red bg-[rgba(255,90,42,.06)] px-3.5 py-2.5 text-sm">{report.m.text}</div>
                <span className="overline mt-2">Contexte de la conversation</span>
                {[...report.m.thread.messages].reverse().map((x) => (
                  <div key={x.id} className="text-[13px] text-silver">
                    <strong className="text-ink">{x.author.pseudo}</strong> <span className="text-grey">{fmt(x.createdAt)}</span> · {x.text}
                  </div>
                ))}
              </div>
              <ReportDecision messageId={report.m.id} />
            </>
          ) : dispute ? (
            <>
              <div className="card-head">
                <span className="min-w-0">
                  <span className="block font-display text-xl font-bold">{vs(dispute.m)}</span>
                  <span className="block text-xs text-grey">{dispute.id} · {getGame(dispute.m.game)?.name} · {dispute.m.series} · Contestation</span>
                </span>
                <span className="badge bg-orange !text-bg">À trancher</span>
              </div>
              <div className="grid gap-1 p-[18px]">
                <span className="overline">Comparaison</span>
                {[
                  [`Déclaré par ${dispute.d.submission.uploader.pseudo}`, `${names.get(dispute.m.a)?.name} ${dispute.d.submission.declaredA ?? "?"} – ${dispute.d.submission.declaredB ?? "?"} ${names.get(dispute.m.b)?.name}`, false],
                  ...(readGames(dispute.d.submission.games).length ? [["Détail déclaré", gamesLine(dispute.m.game, readGames(dispute.d.submission.games)), false]] : []),
                  [`Contesté par ${dispute.d.openedBy.pseudo}`, dispute.d.reason, true],
                  ["Capture", dispute.d.submission.fileUrl ? <a key="c" href={dispute.d.submission.fileUrl} target="_blank" rel="noopener noreferrer">Ouvrir la capture →</a> : "à demander dans le salon", !dispute.d.submission.fileUrl],
                ].map(([k, v, warn]) => (
                  <div key={k as string} className="flex justify-between gap-3 border-b border-surface-2 py-1.5 text-sm">
                    <span className="text-grey">{k}</span>
                    <span className={`text-right ${warn ? "font-semibold text-red" : ""}`}>{v}</span>
                  </div>
                ))}
              </div>
              <Extract events={dispute.m.events} authors={authors} />
              <DisputeDecision matchId={dispute.m.id} a={names.get(dispute.m.a)?.name ?? "A"} b={names.get(dispute.m.b)?.name ?? "B"} game={dispute.m.game} series={dispute.m.series} declared={readGames(dispute.d.submission.games)} />
            </>
          ) : chat ? (
            <>
              <div className="card-head">
                <span className="min-w-0">
                  <span className="block font-display text-xl font-bold">Message signalé</span>
                  <span className="block text-xs text-grey">{chat.id} · {vs(chat.e.match)} · <Link href={`/match?m=${chat.e.matchId}`}>Match Center</Link></span>
                </span>
                <span className="badge bg-orange !text-bg">À traiter</span>
              </div>
              <div className="grid gap-2 p-[18px]">
                <div className="border border-red bg-[rgba(255,90,42,.06)] px-3.5 py-2.5 text-sm"><strong>{authors.get(chat.e.authorId ?? "") ?? "Membre"}</strong> · {chat.e.text}</div>
              </div>
              <Extract events={chat.e.match.events} authors={authors} />
              <MatchChatDecision eventId={chat.e.id} />
            </>
          ) : (
            <Empty>Choisissez un dossier dans la file.</Empty>
          )}
        </section>
      </div>
    </main>
  );
}
