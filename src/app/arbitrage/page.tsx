import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getViewer } from "@/lib/auth/viewer";
import { getGame } from "@/lib/data/games";
import { demoRefereeQueue } from "@/lib/data/demo-competition";
import { Empty, PageHeader } from "@/components/PageHeader";
import { DemoDecision, ReportDecision } from "@/components/referee/RefereeClient";

export const metadata: Metadata = { title: "Espace arbitre" };

const TYPE = { contest: "Contestation", ocr: "Lecture incertaine", ev: "RDV mensuel", report: "Signalement" } as const;
const fmt = (d: Date) => new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(d);

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
  const demo = demoRefereeQueue();
  const all = [
    ...reportCases.map((r) => ({ id: r.id, type: r.type, title: r.title, sub: r.sub, prio: r.prio, game: null as string | null, demo: false })),
    ...demo.map((d) => ({ id: d.id, type: d.type, title: d.title, sub: `${d.comp} · ${d.age}`, prio: d.prio, game: d.game, demo: true })),
  ];
  const f = sp.f && sp.f in TYPE ? sp.f : null;
  const list = f ? all.filter((x) => x.type === f) : all;
  const curId = sp.c ?? list[0]?.id;
  const report = reportCases.find((r) => r.id === curId);
  const demoCase = demo.find((d) => d.id === curId);

  return (
    <main className="container-rx pt-7 pb-16">
      <PageHeader title="Espace arbitre">{viewer.pseudo} · {viewer.role === "admin" ? "administrateur" : "arbitre"}</PageHeader>
      {sp.msg && <div role="status" className="mt-4 border border-orange bg-active-tint px-4 py-2.5 text-sm">✓ {sp.msg.slice(0, 200)}</div>}
      <div className="mt-4 grid border border-line bg-surface [grid-template-columns:repeat(auto-fit,minmax(min(100%,160px),1fr))]">
        {[["À traiter", all.length], ["Signalements", reportCases.length], ["Contestations", demo.filter((d) => d.type === "contest").length], ["Urgent", all.filter((x) => x.prio === "URGENT").length]].map(([k, v]) => (
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
                  <span className="block text-xs text-grey">{TYPE[q.type]} · {q.sub}{q.demo ? " · démo" : ""}</span>
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
          ) : demoCase ? (
            <>
              <div className="card-head">
                <span className="min-w-0">
                  <span className="block font-display text-xl font-bold">{demoCase.title}</span>
                  <span className="block text-xs text-grey">{demoCase.id} · {demoCase.comp} · {TYPE[demoCase.type]}</span>
                </span>
                <span className="badge text-silver">Démo</span>
              </div>
              <div className="grid gap-4 p-[18px] [grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr))]">
                <div className="grid content-start gap-2">
                  <span className="overline">Preuve envoyée</span>
                  <div className="img-placeholder relative aspect-video border border-line">
                    {demoCase.img ? <Image src={demoCase.img} alt="Capture de fin de partie" fill className="object-cover" sizes="400px" /> : null}
                    <span className="absolute bottom-1.5 left-2 bg-bg/80 px-1.5 font-mono text-[10px] text-silver">{demoCase.file}</span>
                  </div>
                </div>
                <div className="grid content-start gap-1">
                  <span className="overline">Comparaison</span>
                  {demoCase.cmp.map(([k, v, warn]) => (
                    <div key={k} className="flex justify-between gap-3 border-b border-surface-2 py-1.5 text-sm">
                      <span className="text-grey">{k}</span>
                      <span className={warn ? "font-semibold text-red" : ""}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid gap-1.5 px-[18px] pb-3">
                <span className="overline">Motif</span>
                <p className="text-sm text-silver">{demoCase.why}</p>
              </div>
              <div className="grid gap-1 px-[18px] pb-4">
                <span className="overline">Extrait du chat de match</span>
                {demoCase.chat.map(([a, t, m], i) => (
                  <div key={i} className="text-[13px] text-silver"><strong className="text-ink">{a}</strong> <span className="text-grey">{t}</span> · {m}</div>
                ))}
              </div>
              <DemoDecision actions={demoCase.acts} />
            </>
          ) : (
            <Empty>Choisissez un dossier dans la file.</Empty>
          )}
        </section>
      </div>
    </main>
  );
}
