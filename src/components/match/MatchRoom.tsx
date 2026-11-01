"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { MatchRoomData } from "@/lib/matches/room";
import { addStreamAction, answerMatchAction, chatAction, checkInAction, declareMatchAction, refereeDecisionAction, reportChatAction, vetoAction, voteMvpAction, type MatchResult } from "@/lib/matches/actions";
import { availableMaps, CDL_MODES, nextStep, playedMaps, type CdlMode } from "@/lib/rules/veto";
import { STREAM_PLATFORMS } from "@/lib/rules/streams";
import { ChatMessage } from "@/components/ui/blocks";
import { FormError } from "@/components/forms";
import { ImageUpload } from "@/components/ImageUpload";
import { SeriesEditor, SeriesTable } from "./SeriesGames";
import type { GameScore } from "@/lib/rules/series";

const time = (iso: string) => new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Indian/Reunion" }).format(new Date(iso));
const when = (iso: string) => new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Indian/Reunion" }).format(new Date(iso));

/** Match Center : check-in, veto, diffusion, résultat et salon, enregistrés côté serveur (actualisation automatique). */
export function MatchRoom({ m }: { m: MatchRoomData }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const finished = m.status === "DONE" || m.status === "CANCELLED";

  // Actualisation régulière tant que le match n'est pas terminé (en attendant le temps réel).
  useEffect(() => {
    if (finished) return;
    const t = setInterval(() => router.refresh(), 6000);
    return () => clearInterval(t);
  }, [finished, router]);

  const run = (p: () => Promise<MatchResult | { ok: true; message?: string } | { ok: false; errors: Record<string, string> }>, after?: () => void) =>
    start(async () => {
      const r = await p();
      setMsg(r.ok ? (r.message ? { ok: true, text: r.message } : null) : { ok: false, text: Object.values(r.errors)[0] ?? "Action impossible." });
      if (r.ok) {
        after?.();
        router.refresh();
      }
    });

  const mine = m.viewer.side;
  const lead = m.viewer.lead;
  const staff = m.viewer.staff;
  const stateTone = m.state === "En direct" || m.state === "Contesté" ? "text-red" : m.state === "Terminé" ? "text-grey" : "text-orange";

  return (
    <div>
      <section className="relative overflow-hidden border border-line bg-black">
        <h1 className="sr-only">Match Center · {m.a.name} contre {m.b.name}</h1>
        <div className="hero-pattern absolute inset-0" />
        <div className="relative flex flex-wrap items-center gap-2.5 border-b border-line px-[18px] py-2.5 text-[13px]">
          <Image src={m.logo} alt="" width={28} height={18} className="h-[18px] w-7 object-contain" />
          <span className="text-silver">{m.comp}</span>
          <span className="flex-1" />
          <span className={`badge ${stateTone}`}>{m.state === "En direct" ? "● " : ""}{m.state}</span>
          <span className="text-grey first-letter:uppercase">{when(m.scheduledAt)} · {m.series}</span>
        </div>
        <div className="relative grid items-center gap-4 px-[18px] py-6 [grid-template-columns:minmax(0,1fr)_auto_minmax(0,1fr)]">
          {(["a", "b"] as const).map((k, i) => {
            const t = m[k];
            const win = m.winner === k;
            const block = (
              <>
                <div className="min-w-0">
                  <div className={`truncate font-display text-[clamp(20px,3vw,32px)] font-extrabold ${win ? "text-orange" : ""}`}>{t.name}</div>
                  <div className="text-xs text-grey">{k === "a" ? "Challenger" : "Défenseur"}{mine === k ? " · votre camp" : ""}</div>
                </div>
                <span className={`clip-corner-sm hidden h-14 w-14 flex-none place-items-center border bg-bg font-display text-lg font-extrabold sm:grid ${mine === k ? "border-orange" : "border-line"}`}>{t.tag}</span>
              </>
            );
            return i === 0 ? (
              <div key={k} className="flex items-center justify-end gap-3 text-right">{block}</div>
            ) : (
              <div key={k} className="flex flex-row-reverse items-center justify-end gap-3">{block}</div>
            );
          }).flatMap((el, i) => (i === 0 ? [el, <Score key="score" m={m} />] : [el]))}
        </div>
      </section>

      {msg && <div role="status" className={`mt-3 border px-4 py-2.5 text-sm ${msg.ok ? "border-orange bg-active-tint" : "border-red text-red"}`}>{msg.ok ? "✓ " : ""}{msg.text}</div>}

      <div className="mt-4 grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid min-w-0 gap-4">
          <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr))]">
            <CheckIn m={m} pending={pending} onCheck={() => run(() => checkInAction(m.id))} />
            <Streams m={m} pending={pending} onAdd={(platform, url, after) => run(() => addStreamAction({ matchId: m.id, platform, url }), after)} />
          </div>
          {m.veto && <Veto m={m} pending={pending} onPick={(map) => run(() => vetoAction({ matchId: m.id, map }))} />}
          <Result m={m} pending={pending} run={run} />
          {m.mvp && <Mvp m={m} pending={pending} onVote={(id) => run(() => voteMvpAction({ matchId: m.id, playerId: id }))} />}
          <Lineups m={m} />
        </div>
        <aside className="lg:sticky lg:top-[88px]">
          <Chat m={m} pending={pending} canWrite={!!mine || staff} onSend={(text, after) => run(() => chatAction({ matchId: m.id, text }), after)} onReport={(id) => run(() => reportChatAction(id))} />
          {!lead && !staff && !mine && m.viewer.signedIn && <p className="mt-2 text-xs text-grey">Vous suivez ce match en spectateur.</p>}
        </aside>
      </div>
    </div>
  );
}

function Score({ m }: { m: MatchRoomData }) {
  const prov = m.submission && !m.score;
  const s = m.score ?? (prov && m.submission ? [m.submission.declaredA ?? 0, m.submission.declaredB ?? 0] : null);
  return (
    <div className="text-center">
      <div className="font-display text-[clamp(32px,5vw,48px)] font-extrabold leading-none">{s ? `${s[0]} – ${s[1]}` : "vs"}</div>
      <div className="mt-1 text-[11px] font-bold tracking-[.08em] text-silver">{m.score ? "OFFICIEL" : prov ? "PROVISOIRE" : m.series}</div>
      {(m.games.length > 0 || (prov && m.submission?.games.length)) && (
        <div className="mt-1 text-xs tabular-nums text-grey">{(m.games.length ? m.games : m.submission!.games).map((g) => `${g.a}–${g.b}`).join(" · ")}</div>
      )}
    </div>
  );
}

function CheckIn({ m, pending, onCheck }: { m: MatchRoomData; pending: boolean; onCheck: () => void }) {
  const mineDone = m.viewer.side ? m[m.viewer.side].checkIn : false;
  const open = m.checkInOpen && ["SCHEDULED", "CHECK_IN"].includes(m.status);
  return (
    <section className="card">
      <div className="card-head"><span className="card-title">Check-in</span><span className="card-meta">30 min avant · forfait 15 min après l’heure</span></div>
      {(["a", "b"] as const).map((k) => (
        <div key={k} className="flex items-center justify-between gap-3 border-b border-surface-2 px-[18px] py-2.5 text-sm">
          <span className="truncate">{m[k].name}</span>
          <span className={`text-xs font-bold ${m[k].checkIn ? "text-orange" : "text-grey"}`}>{m[k].checkIn ? "✓ PRÉSENT" : "EN ATTENTE"}</span>
        </div>
      ))}
      <div className="px-[18px] py-3">
        {m.viewer.side && m.viewer.lead && !mineDone && ["SCHEDULED", "CHECK_IN"].includes(m.status) ? (
          <button className="btn btn-primary btn-sm w-full" disabled={!open || pending} title={!open ? "Le check-in ouvre 30 min avant l’heure du match." : undefined} onClick={onCheck}>
            {open ? "Confirmer notre présence" : "Check-in pas encore ouvert"}
          </button>
        ) : (
          <p className="text-xs text-grey">{m.a.checkIn && m.b.checkIn ? "Les deux camps sont présents." : m.status === "DONE" ? "Match terminé." : "Le capitaine de chaque camp confirme la présence."}</p>
        )}
      </div>
    </section>
  );
}

function Streams({ m, pending, onAdd }: { m: MatchRoomData; pending: boolean; onAdd: (platform: string, url: string, after: () => void) => void }) {
  const [platform, setPlatform] = useState<string>("Twitch");
  const [url, setUrl] = useState("");
  const can = (m.viewer.lead || m.viewer.staff) && m.status !== "DONE";
  return (
    <section className="card">
      <div className="card-head"><span className="card-title">Diffusion</span><span className="card-meta">{m.streams.length} lien(s)</span></div>
      {m.streams.length === 0 && <p className="px-[18px] py-2.5 text-sm text-grey">Aucune diffusion annoncée.</p>}
      {m.streams.map((s) => (
        <a key={s.url} href={`https://${s.url}`} target="_blank" rel="noopener noreferrer" className="flex justify-between gap-3 border-b border-surface-2 px-[18px] py-2 text-sm">
          <span className="font-semibold">{s.platform}</span><span className="truncate text-grey">{s.url}</span>
        </a>
      ))}
      {can && (
        <form className="flex flex-wrap gap-1.5 px-[18px] py-3" onSubmit={(e) => { e.preventDefault(); onAdd(platform, url, () => setUrl("")); }}>
          <select className="field !h-9" aria-label="Plateforme" value={platform} onChange={(e) => setPlatform(e.target.value)}>
            {Object.keys(STREAM_PLATFORMS).map((p) => <option key={p}>{p}</option>)}
          </select>
          <input className="field !h-9 min-w-0 flex-1" aria-label="Lien de la diffusion" placeholder="twitch.tv/chaine" value={url} onChange={(e) => setUrl(e.target.value)} />
          <button className="btn btn-secondary btn-sm" disabled={pending}>Ajouter</button>
        </form>
      )}
    </section>
  );
}

function Veto({ m, pending, onPick }: { m: MatchRoomData; pending: boolean; onPick: (map: string) => void }) {
  const v = m.veto!;
  const step = nextStep(m.game, v.steps);
  const actorSide = step?.actor === "A" ? "a" : step?.actor === "B" ? "b" : null;
  const myTurn = !!step && ((m.viewer.lead && m.viewer.side === actorSide) || (m.viewer.staff && !m.viewer.side));
  const ready = m.a.checkIn && m.b.checkIn;
  const maps = step ? availableMaps(m.game, v.pool, v.steps) : [];
  const pool = Array.isArray(v.pool) ? { Pool: v.pool } : Object.fromEntries(Object.entries(v.pool).map(([k, x]) => [CDL_MODES[k as CdlMode], x]));
  return (
    <section className="card">
      <div className="card-head">
        <span className="card-title">Veto des cartes</span>
        <span className="card-meta">{step ? `${step.action === "ban" ? "Ban" : step.action === "pick" ? "Pick" : "Décisive"}${step.mode ? ` · ${CDL_MODES[step.mode]}` : ""} · ${actorSide ? m[actorSide].name : "système"}` : "Terminé"}</span>
      </div>
      <div className="grid gap-3 px-[18px] py-3.5">
        {!ready && !v.steps.length && <p className="text-sm text-grey">Le veto commence quand les deux camps ont confirmé leur présence.</p>}
        {ready && step && (
          <div>
            <div className="mb-2 text-sm">{myTurn ? <strong className="text-orange">À vous : {step.action === "ban" ? "bannissez" : "choisissez"} une carte{step.mode ? ` (${CDL_MODES[step.mode]})` : ""}.</strong> : <span className="text-silver">En attente de {actorSide ? m[actorSide].name : "…"}.</span>}</div>
            <div className="flex flex-wrap gap-1.5">
              {maps.map((x) => (
                <button key={x} disabled={!myTurn || pending} onClick={() => onPick(x)} className={`btn btn-sm ${step.action === "ban" ? "btn-tertiary" : "btn-secondary"}`}>{step.action === "ban" ? "✕ " : "✓ "}{x}</button>
              ))}
            </div>
          </div>
        )}
        {v.steps.length > 0 && (
          <ol className="grid gap-1 text-sm">
            {v.steps.map((s, i) => (
              <li key={i} className="flex gap-3 border-b border-surface-2 py-1">
                <span className="w-6 font-mono text-xs text-grey">{i + 1}</span>
                <span className={`w-20 text-xs font-bold ${s.action === "ban" ? "text-red" : "text-orange"}`}>{s.action === "ban" ? "BAN" : s.action === "pick" ? "PICK" : "DÉCISIVE"}</span>
                <span className="flex-1">{s.map}{s.mode ? <span className="text-grey"> · {s.mode}</span> : null}</span>
                <span className="text-xs text-grey">{s.actor === "A" ? m.a.tag : s.actor === "B" ? m.b.tag : "—"}</span>
              </li>
            ))}
          </ol>
        )}
        {!step && <p className="text-sm">Cartes jouées : <strong>{playedMaps(v.steps).map((s) => s.map).join(" · ")}</strong></p>}
        <details className="text-xs text-grey">
          <summary className="cursor-pointer">Map pool {v.steps.length ? "figé au début du veto" : "du cycle en cours"}</summary>
          {Object.entries(pool).map(([k, x]) => <div key={k} className="mt-1"><strong className="text-silver">{k} :</strong> {(x as string[]).join(", ")}</div>)}
        </details>
      </div>
    </section>
  );
}

type Run = (p: () => Promise<{ ok: true; message?: string } | { ok: false; errors: Record<string, string> }>, after?: () => void) => void;

function Result({ m, pending, run }: { m: MatchRoomData; pending: boolean; run: Run }) {
  const [games, setGames] = useState<GameScore[]>([]);
  const [reason, setReason] = useState("");
  const [proof, setProof] = useState("");
  const [err, setErr] = useState<string>();
  const names = { a: m.a.name, b: m.b.name };
  const started = m.started;
  const sub = m.submission;

  let body: React.ReactNode;
  if (m.status === "DONE" && m.score) {
    const d = m.deltas;
    body = (
      <div className="grid gap-2 text-sm">
        <p><strong>{m[m.winner!].name}</strong> remporte la série {Math.max(...m.score)}–{Math.min(...m.score)}.</p>
        <SeriesTable game={m.game} games={m.games} names={names} compact />
        {d && <p className="text-silver">{m.counted ? `Points : ${m.a.name} ${d[0] >= 0 ? "+" : "−"}${Math.abs(d[0])} · ${m.b.name} ${d[1] >= 0 ? "+" : "−"}${Math.abs(d[1])}` : "Match non compté au classement (3e match de la paire en 30 jours)."}</p>}
        <Link href={`/feuille-de-match?m=${m.id}`} className="text-[13px] font-semibold">Voir la feuille de match →</Link>
      </div>
    );
  } else if (m.status === "DISPUTED") {
    body = (
      <div className="grid gap-3 text-sm">
        <p className="text-red">Résultat contesté : {sub?.dispute ?? "motif non précisé"}. En attente d’un arbitre.</p>
        {sub && sub.games.length > 0 && (
          <div>
            <div className="overline mb-1">Déclaré par {sub.by}</div>
            <SeriesTable game={m.game} games={sub.games} names={names} compact />
          </div>
        )}
        {m.viewer.staff && (
          <form className="grid gap-2" onSubmit={(e) => { e.preventDefault(); run(async () => { const r = await refereeDecisionAction({ matchId: m.id, games: games.length ? games : (sub?.games ?? []), reason }); if (!r.ok) setErr(Object.values(r.errors)[0]); return r; }); }}>
            <div className="overline">Résultat retenu par l’arbitre</div>
            <SeriesEditor game={m.game} series={m.series} names={names} planned={m.plannedMaps} initial={sub?.games} onChange={setGames} />
            <textarea className="field !h-auto py-2" rows={2} placeholder="Motif de la décision (preuves, article du règlement)" aria-label="Motif de la décision" value={reason} onChange={(e) => setReason(e.target.value)} />
            <button className="btn btn-primary btn-sm justify-self-start" disabled={pending}>Rendre la décision</button>
            <FormError message={err} />
          </form>
        )}
      </div>
    );
  } else if (m.status === "SUBMITTED" && sub) {
    const aWon = (sub.declaredA ?? 0) > (sub.declaredB ?? 0);
    const canAnswer = sub.status === "AWAITING_OPPONENT" && m.viewer.lead && !!m.viewer.side && m.viewer.side !== sub.side;
    body = (
      <div className="grid gap-3 text-sm">
        {sub.fileUrl && <a href={sub.fileUrl} target="_blank" rel="noopener noreferrer" className="text-[13px]">Voir la capture jointe →</a>}
        <p>Résultat déclaré par <strong>{sub.by}</strong> : victoire <strong>{aWon ? m.a.name : m.b.name}</strong> {Math.max(sub.declaredA ?? 0, sub.declaredB ?? 0)}–{Math.min(sub.declaredA ?? 0, sub.declaredB ?? 0)}. Provisoire : l’adversaire a 24 h pour confirmer ou contester.</p>
        <SeriesTable game={m.game} games={sub.games} names={names} compact />
        {canAnswer && (
          <div className="grid gap-2">
            <div className="flex flex-wrap gap-1.5">
              <button className="btn btn-primary btn-sm" disabled={pending} onClick={() => run(() => answerMatchAction({ matchId: m.id, confirm: true }))}>Confirmer le résultat</button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <input className="field !h-9 min-w-0 flex-1" aria-label="Motif de la contestation" placeholder="Motif de la contestation" value={reason} onChange={(e) => setReason(e.target.value)} />
              <button className="btn btn-danger btn-sm" disabled={pending} onClick={() => run(async () => { const r = await answerMatchAction({ matchId: m.id, confirm: false, reason }); if (!r.ok) setErr(Object.values(r.errors)[0]); return r; })}>Contester</button>
            </div>
            <FormError message={err} />
          </div>
        )}
      </div>
    );
  } else if (m.viewer.side && m.viewer.lead && ["SCHEDULED", "CHECK_IN", "LIVE"].includes(m.status)) {
    body = started ? (
      <div className="grid gap-2 text-sm">
        <p className="text-xs text-grey">Saisissez le score de chaque {m.game === "val" || m.game === "cod" ? "carte" : "partie"} : le score de la série est calculé automatiquement.</p>
        <SeriesEditor game={m.game} series={m.series} names={names} planned={m.plannedMaps} onChange={setGames} />
        <button className="btn btn-secondary btn-sm justify-self-start" disabled={pending} onClick={() => run(async () => { const r = await declareMatchAction({ matchId: m.id, games, fileUrl: proof || undefined }); if (!r.ok) setErr(Object.values(r.errors)[0]); return r; })}>Déclarer le résultat</button>
        <ImageUpload folder="captures" label={proof ? "✓ Capture jointe · remplacer" : "Joindre la capture de fin de partie"} onUploaded={setProof} />
        <p className="text-xs text-grey">Le résultat reste provisoire jusqu’à confirmation de l’adversaire (ou 24 h).</p>
        <FormError message={err} />
      </div>
    ) : (
      <p className="text-sm text-grey">La déclaration du résultat s’ouvre à l’heure du match.</p>
    );
  } else {
    body = <p className="text-sm text-grey">{m.status === "CANCELLED" ? "Match annulé." : "Le résultat est déclaré par l’un des capitaines à la fin de la série."}</p>;
  }
  return (
    <section className="card">
      <div className="card-head"><span className="card-title">Résultat</span><span className="card-meta">{m.series}</span></div>
      <div className="px-[18px] py-3.5">{body}</div>
    </section>
  );
}

function Mvp({ m, pending, onVote }: { m: MatchRoomData; pending: boolean; onVote: (id: string) => void }) {
  const p = m.mvp!;
  return (
    <section className="card">
      <div className="card-head"><span className="card-title">MVP du match</span><span className="card-meta">{p.open ? `Vote ouvert 48 h · ${p.votes} vote(s)` : "Vote clos"}</span></div>
      <div className="grid gap-2 px-[18px] py-3.5 text-sm">
        {!p.open && <p>{p.mvp ? <>MVP élu : <strong className="text-yellow">★ {p.mvp}</strong></> : "Aucun vote : pas de MVP pour ce match."}</p>}
        {p.open && !p.canVote && <p className="text-grey">Les joueurs du match élisent le MVP. Résultat à la clôture du vote.</p>}
        {p.canVote && (
          <div className="flex flex-wrap gap-1.5">
            {p.candidates.map((c) => (
              <button key={c.id} disabled={pending} aria-pressed={p.myVote === c.id} onClick={() => onVote(c.id)} className={`btn btn-sm ${p.myVote === c.id ? "btn-primary" : "btn-tertiary"}`}>
                {p.myVote === c.id ? "★ " : ""}{c.pseudo} <span className="text-xs text-grey">· {m[c.side].tag}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function Lineups({ m }: { m: MatchRoomData }) {
  if (!m.a.lineup.length && !m.b.lineup.length) return null;
  return (
    <section className="card">
      <div className="card-head"><span className="card-title">Compositions</span></div>
      <div className="grid [grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr))]">
        {(["a", "b"] as const).map((k) => (
          <div key={k} className="border-r border-surface-2 px-[18px] py-3">
            <div className="overline mb-1">{m[k].name}</div>
            {m[k].lineup.map((p) => <div key={p.pseudo} className="py-0.5 text-sm">{p.pseudo}{p.sub && <span className="text-xs text-grey"> · remplaçant</span>}</div>)}
          </div>
        ))}
      </div>
    </section>
  );
}

function Chat({ m, pending, canWrite, onSend, onReport }: { m: MatchRoomData; pending: boolean; canWrite: boolean; onSend: (t: string, after: () => void) => void; onReport: (id: string) => void }) {
  const [text, setText] = useState("");
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest" });
  }, [m.events.length]);
  const tag = (side: string | null) => (side === "a" ? m.a.tag : side === "b" ? m.b.tag : undefined);
  return (
    <section className="card">
      <div className="card-head"><span className="card-title">Salon du match</span><span className="card-meta">Journal officiel</span></div>
      <div className="grid max-h-[480px] gap-2.5 overflow-y-auto px-[18px] py-3">
        {m.events.length === 0 && <p className="text-sm text-grey">Aucun message.</p>}
        {m.events.map((e) =>
          e.kind === "SYSTEM" ? (
            <ChatMessage key={e.id} line={{ kind: "system", text: e.text, time: time(e.at) }} />
          ) : e.kind === "REFEREE" ? (
            <ChatMessage key={e.id} line={{ kind: "referee", author: e.author ?? "Arbitre", text: e.text, time: time(e.at) }} />
          ) : (
            <ChatMessage key={e.id} line={{ kind: "user", author: e.author ?? "Membre", team: tag(e.side), text: e.text, time: time(e.at), mine: e.mine, reported: e.reported }} onReport={m.viewer.signedIn && !e.reported ? () => onReport(e.id) : undefined} />
          ),
        )}
        <div ref={end} />
      </div>
      {canWrite ? (
        <form className="flex gap-1.5 border-t border-line px-[18px] py-3" onSubmit={(e) => { e.preventDefault(); if (text.trim()) onSend(text, () => setText("")); }}>
          <input className="field !h-9 min-w-0 flex-1" aria-label="Message" maxLength={500} placeholder="Écrire dans le salon…" value={text} onChange={(e) => setText(e.target.value)} />
          <button className="btn btn-primary btn-sm" disabled={pending || !text.trim()}>Envoyer</button>
        </form>
      ) : (
        <p className="border-t border-line px-[18px] py-3 text-xs text-grey">Lecture seule : seuls les participants et les arbitres écrivent ici.</p>
      )}
    </section>
  );
}
