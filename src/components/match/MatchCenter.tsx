"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { STREAM_PLATFORMS, validateStreamUrl, type StreamPlatform } from "@/lib/rules/streams";
import { MatchSheet } from "./MatchSheet";

/**
 * Match Center : interface propre au jeu (veto VAL / CDL, manches RL / Tekken, score FC, lobby TFT),
 * check-in, diffusion, preuves (OCR) et salon de match.
 * DÉMONSTRATION : l'état est local. En production, chaque action passe par le serveur et le temps réel (WebSocket).
 */

export interface MatchInfo {
  game: "val" | "cod" | "rl" | "fc" | "tek" | "tft";
  gameName: string;
  logo: string;
  comp: string;
  series: string;
  a: string;
  b: string;
  aTag: string;
  bTag: string;
}

type ChatMsg = { id: number; kind: "sys" | "ref" | "msg"; author?: string; team?: string; text: string; time: string; mine?: boolean; reported?: boolean };
type Journal = { time: string; who: string; text: string };

const now = () => new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

const VMAPS = ["Ascent", "Bind", "Haven", "Lotus", "Split", "Sunset", "Pearl"];
const VSEQ: ["A" | "B" | "-", "ban" | "pick" | "decider"][] = [["A", "ban"], ["B", "ban"], ["A", "pick"], ["B", "pick"], ["A", "ban"], ["B", "ban"], ["-", "decider"]];
const MODES = { HP: "Hardpoint", SND: "Recherche & Destruction", CTRL: "Contrôle" } as const;
const CPOOL: Record<keyof typeof MODES, string[]> = { HP: ["Hacienda", "Protocol", "Rewind", "Skyline"], SND: ["Dealership", "Hacienda", "Protocol", "Rewind", "Skyline"], CTRL: ["Hacienda", "Protocol", "Vault"] };
const CSLOTS: (keyof typeof MODES)[] = ["HP", "SND", "CTRL", "HP", "SND"];

export function MatchCenter({ m, role, participant }: { m: MatchInfo; role: string; participant: boolean }) {
  const staff = role === "admin" || role === "arbitre";
  const visitor = role === "visiteur";
  const [tab, setTab] = useState<"match" | "chat" | "historique">("match");
  const [journal, setJournal] = useState<Journal[]>([{ time: "19:30", who: "Système", text: "Match programmé · salon ouvert" }]);
  const log = (who: string, text: string) => setJournal((j) => [{ time: now(), who, text }, ...j]);
  const [chat, setChat] = useState<ChatMsg[]>([
    { id: 1, kind: "sys", text: `Salon du match ouvert · ${m.a} vs ${m.b}.`, time: "19:42" },
    { id: 2, kind: "msg", author: "Capitaine", team: m.aTag, text: "Salut, on est prêts de notre côté.", time: "19:44", mine: participant },
    { id: 3, kind: "msg", author: "Capitaine", team: m.bTag, text: "Pareil. On lance dès que l’arbitre valide la présence.", time: "19:45" },
    { id: 4, kind: "ref", author: "Arbitre", text: "Les deux capitaines sont présents. Le match peut commencer.", time: "19:46" },
  ]);
  const sys = (text: string) => setChat((c) => [...c, { id: Date.now() + Math.random(), kind: "sys", text, time: now() }]);

  return (
    <div>
      <section className="relative overflow-hidden border border-line bg-black">
        <h1 className="sr-only">Match Center · {m.a} contre {m.b}</h1>
        <div className="hero-pattern absolute inset-0" />
        <div className="relative flex flex-wrap items-center gap-2.5 border-b border-line px-[18px] py-2.5 text-[13px]">
          <Image src={m.logo} alt="" width={28} height={18} className="h-[18px] w-7 object-contain" />
          <span className="text-silver">{m.comp}</span>
          <span className="flex-1" />
          <span className="badge text-orange">● En cours</span>
          <span className="text-grey">{m.series}</span>
        </div>
        <div className="relative grid items-center gap-4 px-[18px] py-6 [grid-template-columns:minmax(0,1fr)_auto_minmax(0,1fr)]">
          <div className="flex items-center justify-end gap-3 text-right">
            <div className="min-w-0"><div className="truncate font-display text-[clamp(20px,3vw,32px)] font-extrabold">{m.a}</div><div className="text-xs text-grey">Tête de série · {m.aTag}</div></div>
            <span className="clip-corner-sm hidden h-14 w-14 flex-none place-items-center border border-orange bg-bg font-display text-lg font-extrabold sm:grid">{m.aTag}</span>
          </div>
          <div className="text-center">
            <div className="font-display text-[clamp(32px,5vw,48px)] font-extrabold leading-none">0 – 0</div>
            <div className="mt-1 text-[11px] font-bold tracking-[.08em] text-silver">PROVISOIRE</div>
          </div>
          <div className="flex items-center gap-3">
            <span className="clip-corner-sm hidden h-14 w-14 flex-none place-items-center border border-line bg-bg font-display text-lg font-extrabold sm:grid">{m.bTag}</span>
            <div className="min-w-0"><div className="truncate font-display text-[clamp(20px,3vw,32px)] font-extrabold">{m.b}</div><div className="text-xs text-grey">{m.bTag}</div></div>
          </div>
        </div>
      </section>

      <div className="mt-3 flex border-b border-line lg:hidden" role="tablist">
        {(["match", "chat", "historique"] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className="tab flex-1 justify-center" aria-current={tab === t ? "page" : undefined}>
            {t === "match" ? "Match" : t === "chat" ? "Chat" : "Historique"}
          </button>
        ))}
      </div>

      <div className="mt-4 grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className={`grid min-w-0 gap-4 ${tab !== "match" ? "hidden lg:grid" : ""}`}>
          <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr))]">
            <CheckIn m={m} participant={participant} staff={staff} onDone={(t) => { sys(`${t} a confirmé sa présence.`); log(t, "Check-in confirmé"); }} />
            <Streams staff={staff} participant={participant} onAdd={(p) => log("Diffusion", `Lien ${p} ajouté`)} />
          </div>
          {m.game === "val" && <ValVeto m={m} canAct={participant || staff} onLog={(t) => { sys(t); log("Veto", t); }} />}
          {m.game === "cod" && <CodVeto m={m} canAct={participant || staff} onLog={(t) => { sys(t); log("Veto", t); }} />}
          {m.game === "rl" && <RocketLobby m={m} canAct={participant} onLog={(t) => { sys(t); log(m.a, t); }} />}
          {m.game === "fc" && <FcDeclaration m={m} participant={participant} onLog={(t) => { sys(t); log("Résultat", t); }} />}
          {m.game === "tek" && <TekkenSet m={m} />}
          {m.game === "tft" && <TftLobby />}
          <ResultFlow m={m} participant={participant} staff={staff} onLog={(who, t) => { sys(t); log(who, t); }} />
          <div className="hidden lg:block"><History journal={journal} /></div>
        </div>
        <aside className={`${tab !== "chat" ? "hidden lg:block" : ""} lg:sticky lg:top-[88px]`}>
          <MatchChat chat={chat} setChat={setChat} canWrite={participant || staff} visitor={visitor} />
        </aside>
        <div className={tab === "historique" ? "lg:hidden" : "hidden"}><History journal={journal} /></div>
      </div>
    </div>
  );
}

function History({ journal }: { journal: Journal[] }) {
  return (
    <section className="card">
      <div className="card-head"><span className="card-title">Historique officiel</span></div>
      {journal.map((j, i) => (
        <div key={i} className="grid grid-cols-[52px_110px_minmax(0,1fr)] gap-3 border-b border-surface-2 px-[18px] py-2 text-[13px]">
          <span className="font-mono text-xs text-grey">{j.time}</span>
          <span className="truncate text-silver">{j.who}</span>
          <span>{j.text}</span>
        </div>
      ))}
    </section>
  );
}

function CheckIn({ m, participant, staff, onDone }: { m: MatchInfo; participant: boolean; staff: boolean; onDone: (team: string) => void }) {
  const [secs, setSecs] = useState(12 * 60);
  const [a, setA] = useState(false);
  const b = true;
  useEffect(() => {
    if (a && b) return;
    const id = setInterval(() => setSecs((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [a, b]);
  const done = a && b;
  const left = `${String(Math.floor(secs / 60)).padStart(2, "0")}:${String(secs % 60).padStart(2, "0")}`;
  return (
    <section className="card">
      <div className="card-head">
        <span className="card-title">Check-in</span>
        <span className={`badge ${done ? "text-orange" : "text-silver"}`}>{done ? "✓ Complet" : "En cours"}</span>
        {!done && <span className="font-mono text-sm text-orange" aria-label="Temps restant">{left}</span>}
      </div>
      {[[m.aTag, m.a, a], [m.bTag, m.b, b]].map(([tag, name, ok]) => (
        <div key={tag as string} className="flex items-center gap-3 border-b border-surface-2 px-[18px] py-2.5">
          <span className="bg-surface-2 px-1.5 py-0.5 font-mono text-[11px]">{tag as string}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">{name as string}</span>
            <span className="block text-xs text-grey">{ok ? "Présence confirmée" : "En attente du capitaine"}</span>
          </span>
          <span className={ok ? "text-orange" : "text-grey"}>{ok ? "✓" : "…"}</span>
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-2 px-[18px] py-3">
        <span className="flex-1 text-xs text-grey">Check-in obligatoire 30 min avant (art. 4.1). Au-delà de 15 min de retard : forfait possible.</span>
        {participant && !a && <button className="btn btn-primary btn-sm" onClick={() => { setA(true); onDone(m.a); }}>Confirmer ma présence</button>}
        {staff && a && <button className="btn btn-tertiary btn-sm" onClick={() => setA(false)}>Rouvrir le check-in</button>}
      </div>
    </section>
  );
}

function Streams({ staff, participant, onAdd }: { staff: boolean; participant: boolean; onAdd: (p: string) => void }) {
  const [list, setList] = useState([{ plat: "Twitch", url: "twitch.tv/rushxp_officiel", by: "RushXP", official: true, time: "19:30" }]);
  const [plat, setPlat] = useState<StreamPlatform>("Twitch");
  const [url, setUrl] = useState("");
  const [err, setErr] = useState("");
  const canAdd = staff || participant;
  const add = () => {
    const r = validateStreamUrl(plat, url);
    if (!r.ok) return setErr(r.error);
    if (list.some((s) => s.url === r.url)) return setErr("Ce lien est déjà annoncé.");
    setList([...list, { plat, url: r.url, by: staff ? "RushXP" : "Votre équipe", official: staff, time: now() }]);
    setUrl("");
    setErr("");
    onAdd(plat);
  };
  return (
    <section className="card">
      <div className="card-head"><span className="card-title">Diffusion du match</span><span className="card-meta">{list.length} lien(s)</span></div>
      {list.map((s, i) => (
        <div key={s.url} className="flex flex-wrap items-center gap-2.5 border-b border-surface-2 px-[18px] py-2.5">
          <span className="badge w-[76px] text-center text-silver">{s.plat}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-mono text-xs">{s.url}</span>
            <span className="block text-[11px] text-grey">Ajouté par {s.by} · {s.time} <span className={`badge ml-1 ${s.official ? "text-orange" : "text-silver"}`}>{s.official ? "Officiel" : "Équipe"}</span></span>
          </span>
          <a href={`https://${s.url}`} target="_blank" rel="noopener noreferrer" className="text-[13px] font-semibold">Regarder ↗</a>
          {(staff || (!s.official && participant)) && i > 0 && (
            <button aria-label="Retirer le lien" className="cursor-pointer px-1 text-grey hover:text-red" onClick={() => setList(list.filter((x) => x !== s))}>✕</button>
          )}
        </div>
      ))}
      {canAdd ? (
        <form className="grid gap-2 px-[18px] py-3" onSubmit={(e) => { e.preventDefault(); add(); }}>
          <div className="flex flex-wrap gap-2">
            <select className="field !h-10" aria-label="Plateforme" value={plat} onChange={(e) => setPlat(e.target.value as StreamPlatform)}>
              {Object.keys(STREAM_PLATFORMS).map((p) => <option key={p}>{p}</option>)}
            </select>
            <input className="field !h-10 min-w-[160px] flex-1 font-mono" aria-label="Lien de diffusion" aria-invalid={!!err} value={url} onChange={(e) => { setUrl(e.target.value); setErr(""); }} placeholder={`${STREAM_PLATFORMS[plat][0]}/votre-chaine`} />
            <button className="btn btn-secondary btn-sm">Ajouter le lien</button>
          </div>
          {err && <span className="text-[13px] text-red">{err}</span>}
        </form>
      ) : (
        <div className="px-[18px] py-3 text-xs text-grey">Les équipes du match et RushXP peuvent annoncer une diffusion.</div>
      )}
    </section>
  );
}

function ValVeto({ m, canAct, onLog }: { m: MatchInfo; canAct: boolean; onLog: (t: string) => void }) {
  const [state, setState] = useState<Record<string, { st: "ban" | "pick" | "decider"; team?: "A" | "B"; no?: number }>>({});
  const step = Object.keys(state).length;
  const cur = VSEQ[step];
  const name = (t: "A" | "B") => (t === "A" ? m.a : m.b);
  const act = (map: string) => {
    if (!canAct || !cur || cur[0] === "-" || state[map]) return;
    const picks = Object.values(state).filter((x) => x.st === "pick").length;
    const next = { ...state, [map]: { st: cur[1], team: cur[0] as "A" | "B", no: cur[1] === "pick" ? picks + 1 : undefined } };
    onLog(`${name(cur[0] as "A" | "B")} a ${cur[1] === "ban" ? "banni" : "choisi"} ${map}.${cur[1] === "pick" ? ` Carte ${picks + 1}.` : ""}`);
    if (VSEQ[step + 1]?.[0] === "-") {
      const rest = VMAPS.find((x) => !next[x])!;
      next[rest] = { st: "decider", no: 3 };
      onLog(`${rest} est la carte décisive. Veto terminé : la série peut commencer.`);
    }
    setState(next);
  };
  const done = !cur || cur[0] === "-";
  return (
    <section className="card">
      <div className="card-head"><span className="card-title">Veto des cartes · BO3</span><button className="btn btn-tertiary btn-sm" onClick={() => setState({})}>Réinitialiser (démo)</button></div>
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-[18px] py-3">
        <div className="flex-1">
          <div className="text-xs text-grey">{done ? "Veto terminé" : `Étape ${step + 1} / 7`}</div>
          <div className="font-display text-xl font-bold">{done ? "Ordre des cartes fixé" : `${name(cur[0] as "A" | "B")} ${cur[1] === "ban" ? "bannit" : "choisit"} une carte`}</div>
        </div>
        <span className="text-xs text-grey">{canAct ? "Cliquez une carte disponible" : "Lecture seule"}</span>
      </div>
      <div className="flex flex-wrap gap-1 border-b border-line px-[18px] py-2.5">
        {VSEQ.map(([t, a], i) => (
          <span key={i} className={`border px-2 py-1 text-[11px] font-bold ${i < step ? "border-line text-grey" : i === step ? "border-orange text-orange" : "border-line text-[#5a5a5a]"}`}>
            {t === "-" ? "Décisive" : `${t === "A" ? m.aTag : m.bTag} ${a === "ban" ? "ban" : "pick"}`}
          </span>
        ))}
      </div>
      <div className="grid gap-2 p-[18px] [grid-template-columns:repeat(auto-fill,minmax(120px,1fr))]">
        {VMAPS.map((map) => {
          const s = state[map];
          const chip = s ? (s.st === "ban" ? `Bannie · ${s.team === "A" ? m.aTag : m.bTag}` : s.st === "pick" ? `Carte ${s.no} · ${s.team === "A" ? m.aTag : m.bTag}` : "Décisive · carte 3") : "Disponible";
          return (
            <button key={map} disabled={!!s || done || !canAct} onClick={() => act(map)} className={`cursor-pointer border text-left disabled:cursor-default ${s?.st === "ban" ? "border-line opacity-45" : s ? "border-orange" : "border-line hover:border-orange"}`}>
              <div className="img-placeholder relative h-16"><span>visuel carte</span><span className={`absolute top-1.5 left-1.5 text-[10px] font-bold ${s?.st === "ban" ? "text-red" : s ? "text-orange" : "text-silver"}`}>{chip}</span></div>
              <div className="px-2.5 py-2"><div className={`font-display font-bold ${s?.st === "ban" ? "line-through" : ""}`}>{map}</div></div>
            </button>
          );
        })}
      </div>
      <div className="px-[18px] pb-3 text-xs text-grey">Séquence et pool chargés depuis le règlement (art. V.2). Les actions de veto passent uniquement par cette interface.</div>
    </section>
  );
}

function CodVeto({ m, canAct, onLog }: { m: MatchInfo; canAct: boolean; onLog: (t: string) => void }) {
  const [slots, setSlots] = useState<{ ban?: string; pick?: string }[]>(CSLOTS.map(() => ({})));
  const idx = slots.findIndex((s) => !s.ban || !s.pick);
  const slot = idx >= 0 ? slots[idx] : null;
  const action: "ban" | "pick" | null = slot ? (!slot.ban ? "ban" : "pick") : null;
  const team = idx >= 0 ? (action === "ban" ? (idx % 2 === 0 ? "A" : "B") : idx % 2 === 0 ? "B" : "A") : null;
  const mode = idx >= 0 ? CSLOTS[idx] : null;
  const usedInMode = (md: keyof typeof MODES) => new Set(slots.flatMap((s, i) => (CSLOTS[i] === md ? [s.ban, s.pick] : [])).filter(Boolean) as string[]);
  const pool = mode ? CPOOL[mode].filter((x) => !usedInMode(mode).has(x)) : [];
  const act = (map: string) => {
    if (!canAct || idx < 0 || !action) return;
    const next = slots.map((s, i) => (i === idx ? { ...s, [action]: map } : s));
    setSlots(next);
    onLog(`${team === "A" ? m.a : m.b} a ${action === "ban" ? "banni" : "choisi"} ${map} (${MODES[mode!]}, carte ${idx + 1}).`);
    if (next.every((s) => s.pick)) onLog("Veto de série terminé : les 5 cartes sont fixées.");
  };
  return (
    <section className="card">
      <div className="card-head"><span className="card-title">Veto de série CDL · BO5</span><button className="btn btn-tertiary btn-sm" onClick={() => setSlots(CSLOTS.map(() => ({})))}>Réinitialiser (démo)</button></div>
      <div className="border-b border-line px-[18px] py-3">
        <div className="text-xs text-grey">{idx < 0 ? "Veto terminé" : `Carte ${idx + 1} · ${MODES[mode!]}`}</div>
        <div className="font-display text-xl font-bold">{idx < 0 ? "Les 5 cartes sont fixées" : `${team === "A" ? m.a : m.b} ${action === "ban" ? "bannit" : "choisit"} une carte`}</div>
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-[520px]">
          <div className="grid grid-cols-[40px_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_80px] gap-2 border-b border-line px-[18px] py-2 overline !font-normal">
            <span>Carte</span><span>Mode</span><span>Bannissement</span><span>Sélection</span><span>État</span>
          </div>
          {slots.map((s, i) => (
            <div key={i} className={`grid grid-cols-[40px_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_80px] items-center gap-2 border-b border-surface-2 px-[18px] py-2 text-sm ${i === idx ? "bg-active-tint" : ""}`}>
              <span className="font-display font-bold">{i + 1}</span>
              <span><span className="font-mono text-xs text-grey">{CSLOTS[i]}</span> {MODES[CSLOTS[i]]}</span>
              <span className={s.ban ? "text-red line-through" : "text-grey"}>{s.ban ?? "—"} <span className="text-[11px] no-underline">{s.ban ? (i % 2 === 0 ? m.aTag : m.bTag) : ""}</span></span>
              <span className={s.pick ? "font-semibold" : "text-grey"}>{s.pick ?? "—"} <span className="text-[11px] text-grey">{s.pick ? (i % 2 === 0 ? m.bTag : m.aTag) : ""}</span></span>
              <span className={`text-xs font-bold ${s.pick ? "text-orange" : i === idx ? "text-ink" : "text-grey"}`}>{s.pick ? "✓ Fixée" : i === idx ? "En cours" : "À venir"}</span>
            </div>
          ))}
        </div>
      </div>
      {mode && (
        <>
          <div className="flex flex-wrap items-center gap-2 px-[18px] pt-3 text-xs">
            <span className="overline">Cartes compatibles</span>
            <span className="badge text-orange">Mode · {MODES[mode]}</span>
            <span className="text-grey">Seules les cartes jouables dans ce mode sont proposées.</span>
          </div>
          <div className="grid gap-2 p-[18px] [grid-template-columns:repeat(auto-fill,minmax(120px,1fr))]">
            {pool.map((map) => (
              <button key={map} disabled={!canAct} onClick={() => act(map)} className="cursor-pointer border border-line text-left hover:border-orange disabled:cursor-default">
                <div className="img-placeholder h-14"><span>visuel carte</span></div>
                <div className="px-2.5 py-2 font-display font-bold">{map}</div>
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function RocketLobby({ m, canAct, onLog }: { m: MatchInfo; canAct: boolean; onLog: (t: string) => void }) {
  const [ok, setOk] = useState(false);
  // Démo : mot de passe dérivé des tags (en production, généré côté serveur et visible des seuls participants).
  const pass = `rxp-${(m.aTag + m.bTag).toLowerCase().split("").reverse().join("").slice(0, 5)}`;
  const games = [["3 – 1", "Terminée"], ["1 – 2", "Terminée"], ["—", "En cours"], ["—", "À jouer"], ["—", "Si nécessaire"]];
  return (
    <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr))]">
      <section className="card">
        <div className="card-head"><span className="card-title">Lobby privé</span></div>
        {[["Nom", `RXP-${m.aTag}-${m.bTag}-03`], ["Mot de passe", ok || canAct ? pass : "•••••"], ["Région · Créateur", `EU · ${m.a}`]].map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3 border-b border-surface-2 px-[18px] py-2.5 text-sm"><span className="text-grey">{k}</span><span className="font-mono">{v}</span></div>
        ))}
        <div className="grid grid-cols-2 border-b border-surface-2">
          <div className="border-r border-surface-2 px-[18px] py-2.5"><div className="text-sm font-semibold">{m.a}</div><div className={`text-xs ${ok ? "text-orange" : "text-grey"}`}>{ok ? "✓ Lobby confirmé" : "En attente"}</div></div>
          <div className="px-[18px] py-2.5"><div className="text-sm font-semibold">{m.b}</div><div className="text-xs text-orange">✓ Lobby confirmé</div></div>
        </div>
        {canAct && !ok && <div className="px-[18px] py-3"><button className="btn btn-primary btn-sm" onClick={() => { setOk(true); onLog("Lobby confirmé."); }}>Confirmer le lobby</button></div>}
      </section>
      <section className="card">
        <div className="card-head"><span className="card-title">Série · score par manche</span></div>
        {games.map(([s, st], i) => (
          <div key={i} className="grid grid-cols-[80px_44px_60px_44px_minmax(0,1fr)] items-center gap-2 border-b border-surface-2 px-[18px] py-2 text-sm">
            <span>Manche {i + 1}</span><span className="text-xs text-grey">{m.aTag}</span><span className="text-center font-display text-lg font-bold">{s}</span><span className="text-xs text-grey">{m.bTag}</span>
            <span className={`text-right text-xs font-bold ${st === "En cours" ? "text-orange" : "text-grey"}`}>{st}</span>
          </div>
        ))}
      </section>
    </div>
  );
}

function FcDeclaration({ m, participant, onLog }: { m: MatchInfo; participant: boolean; onLog: (t: string) => void }) {
  const [st, setSt] = useState<"pending" | "ok" | "contested">("pending");
  return (
    <section className="card">
      <div className="card-head"><span className="card-title">Confrontation FUT · aller simple</span></div>
      <div className="grid gap-4 p-[18px] [grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr))]">
        <div className="border border-line p-4">
          <div className="text-xs text-grey">Score déclaré par</div>
          <div className="font-semibold">{m.a}</div>
          <div className="font-display text-4xl font-extrabold">2 – 1</div>
          <div className="text-xs text-grey">Capture jointe · déposée à 19:58</div>
        </div>
        <div className="border border-line p-4">
          <div className="text-xs text-grey">Réponse de l’adversaire · {m.b}</div>
          <div className={`font-display text-xl font-bold ${st === "ok" ? "text-orange" : st === "contested" ? "text-red" : ""}`}>{st === "ok" ? "✓ Confirmé" : st === "contested" ? "Contesté" : "En attente"}</div>
          <div className="text-xs text-grey">{st === "ok" ? "Score validé automatiquement, sous réserve de la lecture de la capture." : st === "contested" ? "Un arbitre tranche à partir des captures des deux joueurs." : "L’adversaire a 24 h pour confirmer (art. 5.1)."}</div>
          {st === "pending" && (
            <div className="mt-3 flex gap-1.5">
              <button className="btn btn-primary btn-sm" onClick={() => { setSt("ok"); onLog(`${m.b} confirme le score 2 – 1.`); }}>Confirmer</button>
              <button className="btn btn-danger btn-sm" onClick={() => { setSt("contested"); onLog(`${m.b} conteste le score.`); }}>Contester</button>
            </div>
          )}
          {st === "pending" && !participant && <div className="mt-1 text-[11px] text-grey">Démo : actions affichées côté adversaire.</div>}
        </div>
      </div>
    </section>
  );
}

function TekkenSet({ m }: { m: MatchInfo }) {
  const games: [string, string, string, string][] = [["Jin", "3 – 1", "Kazuya", "Terminée"], ["Jin", "2 – 3", "Reina", "Terminée"], ["Jin", "—", "Reina", "En cours"], ["—", "—", "—", "À jouer"], ["—", "—", "—", "Si nécessaire"]];
  return (
    <section className="card overflow-x-auto">
      <div className="card-head"><span className="card-title">Set FT3 · manches</span><span className="card-meta">Le perdant d’une manche peut changer de personnage</span></div>
      <div className="min-w-[520px]">
        <div className="grid grid-cols-[90px_minmax(0,1fr)_70px_minmax(0,1fr)_90px] gap-2 border-b border-line px-[18px] py-2 overline !font-normal">
          <span>Manche</span><span>{m.a} · perso</span><span className="text-center">Rounds</span><span>{m.b} · perso</span><span className="text-right">État</span>
        </div>
        {games.map(([ca, s, cb, st], i) => (
          <div key={i} className="grid grid-cols-[90px_minmax(0,1fr)_70px_minmax(0,1fr)_90px] items-center gap-2 border-b border-surface-2 px-[18px] py-2 text-sm">
            <span>Manche {i + 1}</span><span>{ca}</span><span className="text-center font-display text-lg font-bold">{s}</span><span>{cb}</span>
            <span className={`text-right text-xs font-bold ${st === "En cours" ? "text-orange" : "text-grey"}`}>{st}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function TftLobby() {
  const [round, setRound] = useState(3);
  const players = ["Kato", "Lumi", "Miro", "Nalu", "Opal", "Pika", "Quin", "Rawi"];
  const order = useMemo(() => {
    const o = players.map((p, i) => ({ p, i }));
    return o.sort((a, b) => ((a.i * 7 + round * 3) % 8) - ((b.i * 7 + round * 3) % 8));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round]);
  return (
    <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr))] xl:grid-cols-[minmax(0,1fr)_280px]">
      <section className="card">
        <div className="card-head">
          <span className="card-title">Lobby C · 8 joueurs</span>
          <span className="flex gap-1">{[1, 2, 3, 4].map((r) => <button key={r} disabled={r > 3} onClick={() => setRound(r)} className={`btn btn-sm !min-h-8 !px-2.5 ${r === round ? "btn-secondary" : "btn-tertiary"}`}>M{r}</button>)}</span>
        </div>
        <div className="grid grid-cols-[50px_minmax(0,1fr)_80px_70px] gap-2 border-b border-line px-[18px] py-2 overline !font-normal"><span>Place</span><span>Joueur</span><span>Manche</span><span className="text-right">Cumul</span></div>
        {order.map((x, place) => (
          <div key={x.p} className="grid grid-cols-[50px_minmax(0,1fr)_80px_70px] items-center gap-2 border-b border-surface-2 px-[18px] py-2 text-sm">
            <span className={`font-display font-bold ${place === 0 ? "text-yellow" : place < 4 ? "" : "text-grey"}`}>{place + 1}</span>
            <span>{x.p}</span>
            <span className="text-silver">+{8 - place} pts</span>
            <span className="text-right font-bold">{(8 - place) + ((x.i * 5) % 9) * (round - 1)}</span>
          </div>
        ))}
        <div className="px-[18px] py-2.5 text-xs text-grey">Barème de manche : 1re = 8 pts … 8e = 1 pt (configurable dans l’administration).</div>
      </section>
      <section className="card">
        <div className="card-head"><span className="card-title">Prochains lobbys · M4</span></div>
        {["A · places 1 à 8", "B · places 9 à 16", "C · places 17 à 24", "D · places 25 à 32"].map((l) => (
          <div key={l} className="flex justify-between border-b border-surface-2 px-[18px] py-2 text-sm"><span>Lobby {l.split(" · ")[0]}</span><span className="text-xs text-grey">{l.split(" · ")[1]}</span></div>
        ))}
        <div className="px-[18px] py-2.5 text-xs text-grey">Composition publiée après validation de la manche 3.</div>
      </section>
    </div>
  );
}

type Ocr = "idle" | "busy" | "extracted" | "confirm" | "review" | "contested" | "valid";

function ResultFlow({ m, participant, staff, onLog }: { m: MatchInfo; participant: boolean; staff: boolean; onLog: (who: string, t: string) => void }) {
  const [st, setSt] = useState<Ocr>("idle");
  const [low, setLow] = useState(false);
  const [busyStep, setBusyStep] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const score = m.game === "cod" ? "3 – 1" : m.game === "tft" ? "1er · 8 pts" : "2 – 1";
  const steps: [Ocr[], string][] = [[["busy"], "Capture envoyée"], [["extracted"], "Analyse"], [["confirm", "review", "contested"], "Confirmation"], [["valid"], "Validé"]];
  const order: Ocr[] = ["idle", "busy", "extracted", "confirm", "review", "contested", "valid"];
  const reached = (s: Ocr[]) => order.indexOf(st) >= Math.min(...s.map((x) => order.indexOf(x)));
  const start = () => {
    setSt("busy");
    setBusyStep(0);
    onLog(m.a, "Capture du tableau des scores envoyée.");
    timer.current = setTimeout(() => {
      setBusyStep(1);
      timer.current = setTimeout(() => setSt("extracted"), 900);
    }, 900);
  };
  const fields: [string, string, number][] = [["Vainqueur", m.a, low ? 71 : 98], ["Score", score, low ? 58 : 96], ["Durée", "47:21", 93]];

  return (
    <section className="card">
      <div className="card-head"><span className="card-title">Résultat & preuves</span><span className="badge text-silver">Démo · moteur OCR à intégrer</span></div>
      <div className="grid grid-cols-4 border-b border-line">
        {steps.map(([s, l], i) => (
          <div key={l} className={`border-r border-line px-3 py-2.5 text-center last:border-r-0 ${reached(s) ? "text-orange" : "text-grey"}`}>
            <div className="text-xs font-bold">{reached(s) ? "✓" : i + 1}</div>
            <div className="text-[12px]">{l}</div>
          </div>
        ))}
      </div>
      <div className="p-[18px]">
        {st === "idle" &&
          (participant ? (
            <button onClick={start} className="grid w-full cursor-pointer justify-items-center gap-1.5 border border-dashed border-[#5a5a5a] bg-bg px-4 py-8 text-center hover:border-orange">
              <span className="font-display text-lg font-bold">Déposer la capture du tableau des scores</span>
              <span className="text-xs text-grey">Glisser-déposer ou cliquer · PNG / JPG · 10 Mo max · une capture par manche</span>
            </button>
          ) : (
            <p className="text-sm text-grey">Seuls les joueurs du match peuvent déposer un résultat. Aucun résultat soumis pour l’instant.</p>
          ))}
        {st === "busy" && (
          <div className="grid gap-2">
            <div className="text-sm font-semibold">{busyStep === 0 ? "Envoi de capture_resultat.png…" : "Lecture automatique du score…"}</div>
            <div className="h-1 overflow-hidden bg-surface-2"><div className="h-full bg-orange transition-all duration-700" style={{ width: busyStep === 0 ? "35%" : "85%" }} /></div>
            <div className="text-xs text-grey">Le résultat n’est pas officiel tant qu’il n’est pas validé.</div>
          </div>
        )}
        {st === "extracted" && (
          <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr))]">
            <div className="img-placeholder relative aspect-video border border-line">
              {m.game === "val" && <Image src="/assets/ocr-valorant.jpg" alt="Capture d’origine" fill className="object-cover" sizes="400px" />}
              <span className="absolute bottom-1.5 left-2 bg-bg/80 px-1.5 font-mono text-[10px] text-silver">capture d’origine · capture_resultat.jpg</span>
            </div>
            <div className="grid content-start gap-2">
              <div className="flex justify-between gap-2"><span className="badge text-silver">Résultat détecté · non officiel</span><span className={`text-xs font-bold ${low ? "text-red" : "text-orange"}`}>Confiance globale {low ? "71" : "96"} %</span></div>
              {fields.map(([k, v, c]) => (
                <div key={k} className="border-b border-surface-2 pb-2">
                  <div className="flex justify-between text-sm"><span className="text-grey">{k}</span><span className="font-semibold">{v}</span></div>
                  <div className="mt-1 flex items-center gap-2"><div className="h-1 flex-1 bg-surface-2"><div className={`h-full ${c < 80 ? "bg-red" : "bg-orange"}`} style={{ width: `${c}%` }} /></div><span className="text-[11px] text-grey">{c} % · {c < 80 ? "à vérifier" : "lisible"}</span></div>
                </div>
              ))}
              <label className="flex cursor-pointer items-center gap-2 text-xs text-silver"><input type="checkbox" checked={low} onChange={(e) => setLow(e.target.checked)} /> Simuler une faible confiance</label>
              <div className="flex flex-wrap gap-1.5">
                <button className="btn btn-primary btn-sm" onClick={() => { setSt(low ? "review" : "confirm"); onLog(m.a, low ? `Résultat ${score} soumis · confiance faible, contrôle arbitre demandé.` : `Résultat ${score} soumis · en attente de confirmation de ${m.b}.`); }}>Soumettre ce résultat</button>
                <button className="btn btn-tertiary btn-sm" onClick={() => { setSt("review"); onLog(m.a, "Correction manuelle demandée · contrôle arbitre."); }}>Corriger</button>
              </div>
            </div>
          </div>
        )}
        {st === "confirm" && (
          <div className="flex flex-wrap items-center gap-3 border border-line px-4 py-3">
            <div className="flex-1"><div className="font-semibold">En attente de confirmation de {m.b}</div><div className="text-xs text-grey">Score détecté {score} · <b className="text-silver">PROVISOIRE</b>. Sans réponse sous 24 h, un arbitre vérifie.</div></div>
            <div className="grid justify-items-end gap-1">
              <div className="flex gap-1.5">
                <button className="btn btn-primary btn-sm" onClick={() => { setSt("valid"); onLog(m.b, `Résultat ${score} confirmé · validé automatiquement.`); }}>Confirmer</button>
                <button className="btn btn-danger btn-sm" onClick={() => { setSt("contested"); onLog(m.b, "Résultat contesté · transmis à l’arbitre."); }}>Contester</button>
              </div>
              <span className="text-[11px] text-grey">Démo : actions de l’adversaire</span>
            </div>
          </div>
        )}
        {(st === "review" || st === "contested") && (
          <div className="flex flex-wrap items-center gap-3 border border-orange px-4 py-3">
            <div className="flex-1">
              <div className="font-semibold">{st === "review" ? "En vérification par un arbitre" : `Résultat contesté par ${m.b}`}</div>
              <div className="text-xs text-grey">{st === "review" ? "La lecture automatique est incertaine ou une correction a été demandée. Le résultat reste PROVISOIRE." : "Les preuves des deux équipes sont transmises à l’arbitre. Aucun point n’est versé avant la décision."}</div>
            </div>
            {staff ? (
              <div className="flex gap-1.5">
                <button className="btn btn-primary btn-sm" onClick={() => { setSt("valid"); onLog("Arbitre", `Score ${score} validé par l’arbitre.`); }}>Valider le score</button>
                <button className="btn btn-tertiary btn-sm" onClick={() => { setSt("idle"); onLog("Arbitre", "Nouvelle preuve demandée."); }}>Demander une nouvelle preuve</button>
              </div>
            ) : (
              <span className="text-xs text-grey">Arbitre notifié.</span>
            )}
          </div>
        )}
        {st === "valid" && (
          <div className="flex flex-wrap items-center gap-3 border border-orange bg-active-tint px-4 py-3">
            <div className="flex-1">
              <div className="flex items-center gap-2"><span className="badge bg-ink !text-bg">Officiel</span><span className="font-semibold">Résultat validé · {score}</span></div>
              <div className="text-xs text-grey">Classements et historique mis à jour.</div>
            </div>
            <Link href="/rankings" className="btn btn-secondary btn-sm">Voir le classement</Link>
            <button className="btn btn-tertiary btn-sm" onClick={() => setSt("idle")}>Rejouer la démo</button>
          </div>
        )}
      </div>
      {st !== "idle" && st !== "busy" && (
        <div className="px-[18px] pb-[18px]">
          <MatchSheet game={m.game} teamA={m.a} teamB={m.b} score={m.game === "tek" ? "3–1" : undefined} official={st === "valid"} lowConf={low} />
        </div>
      )}
    </section>
  );
}

function MatchChat({ chat, setChat, canWrite, visitor }: { chat: ChatMsg[]; setChat: React.Dispatch<React.SetStateAction<ChatMsg[]>>; canWrite: boolean; visitor: boolean }) {
  const [draft, setDraft] = useState("");
  const [offline, setOffline] = useState(false);
  const [queue, setQueue] = useState<string[]>([]);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest" });
  }, [chat.length]);
  const send = () => {
    const t = draft.trim();
    if (!t) return;
    if (offline) setQueue((q) => [...q, t]);
    else setChat((c) => [...c, { id: Date.now(), kind: "msg", author: "Vous", text: t, time: now(), mine: true }]);
    setDraft("");
  };
  const reconnect = () => {
    setOffline(false);
    setChat((c) => [...c, ...queue.map((t, i) => ({ id: Date.now() + i, kind: "msg" as const, author: "Vous", text: t, time: now(), mine: true }))]);
    setQueue([]);
  };
  return (
    <section className="card">
      <div className="card-head">
        <span className="card-title">Salon du match</span>
        <span className={`flex items-center gap-1.5 text-xs ${offline ? "text-red" : "text-orange"}`}><span className={`h-1.5 w-1.5 ${offline ? "bg-red" : "animate-rxpulse bg-orange"}`} />{offline ? "Hors ligne" : "Connecté"}</span>
      </div>
      <div className="flex items-center justify-between gap-2 border-b border-line px-[18px] py-2 text-[11px]">
        <span className="text-grey">Démo · temps réel à intégrer</span>
        <button className="cursor-pointer text-silver underline-offset-2 hover:underline" onClick={() => (offline ? reconnect() : setOffline(true))}>{offline ? "Rétablir la connexion" : "Simuler une coupure"}</button>
      </div>
      {offline && <div className="border-b border-red bg-[rgba(255,90,42,.08)] px-[18px] py-2 text-xs text-red">Connexion interrompue. Reconnexion en cours… {queue.length ? `${queue.length} message(s) en attente d’envoi.` : "Les messages seront envoyés au retour du réseau."}</div>}
      <div className="grid max-h-[460px] min-h-[260px] content-start gap-2.5 overflow-y-auto p-[18px]" aria-live="polite">
        {chat.map((c) =>
          c.kind === "sys" ? (
            <div key={c.id} className="flex gap-2 border-l-2 border-line pl-2.5 text-xs text-grey"><span className="font-bold text-silver">SYSTÈME</span><span className="flex-1">{c.text}</span><span>{c.time}</span></div>
          ) : c.kind === "ref" ? (
            <div key={c.id} className="flex gap-2 border-l-2 border-yellow bg-[rgba(255,201,40,.06)] py-1 pl-2.5 text-xs"><span className="font-bold text-yellow">ARBITRE</span><span className="flex-1">{c.text}</span><span className="text-grey">{c.time}</span></div>
          ) : (
            <div key={c.id} className="flex gap-2.5">
              <span className="grid h-7 w-7 flex-none place-items-center bg-surface-2 font-display text-xs font-bold">{(c.author ?? "?").slice(0, 2).toUpperCase()}</span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <span className={`font-semibold ${c.mine ? "text-orange" : ""}`}>{c.author}</span>
                  <span className="text-grey">{c.team ? `${c.team} · ` : ""}{c.time}</span>
                  {!c.mine && (
                    <button className="ml-auto cursor-pointer text-[11px] text-grey hover:text-red" onClick={() => setChat((all) => all.map((x) => (x.id === c.id ? { ...x, reported: true } : x)))}>
                      {c.reported ? "Signalé" : "Signaler"}
                    </button>
                  )}
                </div>
                <div className="text-sm">{c.text}</div>
              </div>
            </div>
          ),
        )}
        <div ref={end} />
      </div>
      {canWrite ? (
        <form className="flex gap-2 border-t border-line p-3" onSubmit={(e) => { e.preventDefault(); send(); }}>
          <input className="field !h-10 flex-1" aria-label="Message au salon" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Message au salon…" maxLength={500} />
          <button className="btn btn-primary btn-sm" disabled={!draft.trim()}>Envoyer</button>
        </form>
      ) : (
        <div className="border-t border-line px-[18px] py-3 text-xs text-grey">
          Salon réservé aux participants, arbitres et administrateurs. Lecture seule.{visitor && <> <Link href="/connexion?next=/match">Se connecter</Link></>}
        </div>
      )}
    </section>
  );
}
