"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatDelta, kFactor } from "@/lib/rules/elo";
import { UNJUSTIFIED_REFUSAL_PENALTY } from "@/lib/rules/challenge";
import type { Role } from "@/lib/session-shared";
import { eligibility, fmtScore, ordinal, zoneText, type ChallengeItem, type Eligibility, type RankingRow } from "@/lib/rankings-model";
import {
  answerResultAction,
  cancelChallengeAction,
  enterRankingsAction,
  respondChallengeAction,
  sendChallengeAction,
  type RankResult,
} from "@/lib/rankings/actions";
import { ConfirmDialog, type ConfirmRequest } from "@/components/ConfirmDialog";
import { Modal } from "@/components/ui/interactive";
import { FormError } from "@/components/forms";

export type RankingsTab = "table" | "defis" | "divisions" | "seeding";

interface GameInfo {
  id: string;
  name: string;
  solo: boolean;
  format: string;
}

interface Props {
  tab: RankingsTab;
  game: GameInfo;
  role: Role;
  canAct: boolean;
  rows: RankingRow[];
  challenges: ChallengeItem[];
  enterable: { id: string; label: string }[];
  generalRank: { label: string; structure: string } | null;
  seedingDates: { official: string; preseason: string };
}

const TAB_PATH: Record<RankingsTab, [string, string]> = {
  table: ["Classement", "/rankings"],
  defis: ["Centre des défis", "/rankings/defis"],
  divisions: ["Divisions", "/rankings/divisions"],
  seeding: ["Seeding", "/rankings/seeding"],
};

const STATUS: Record<string, [string, string]> = {
  PENDING: ["En attente", "text-silver"],
  ACCEPTED: ["Accepté", "text-orange"],
  PLANNED: ["Planifié", "text-orange"],
  CHECK_IN: ["Check-in", "text-orange"],
  LIVE: ["En direct", "text-red"],
  SUBMITTED: ["Provisoire", "text-orange"],
  DISPUTED: ["En vérification (arbitre)", "text-red"],
  DONE: ["✓ Validé", "text-grey"],
  REFUSED: ["Refusé", "text-grey"],
  EXPIRED: ["Expiré", "text-grey"],
  CANCELLED: ["Annulé", "text-grey"],
  FORFEIT: ["Forfait", "text-red"],
};

const FINISHED = new Set(["DONE", "REFUSED", "EXPIRED", "CANCELLED", "FORFEIT"]);

/** Valeur d'un champ datetime-local (heure de La Réunion) pour J+n à 20:00. */
function slotDefault(days: number) {
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Indian/Reunion" }).format(new Date(Date.now() + days * 86_400_000));
  return `${day}T20:00`;
}

type Dialog =
  | { kind: "send"; opp: RankingRow }
  | { kind: "refuse"; c: ChallengeItem }
  | { kind: "contest"; c: ChallengeItem }
  | null;

export function RankingsClient({ tab, game, role, canAct, rows, challenges: list, enterable, generalRank, seedingDates }: Props) {
  const router = useRouter();
  const me = rows.find((r) => r.isMe) ?? null;
  const el = useMemo(() => (me ? eligibility(rows, list, canAct, game.solo) : null), [me, rows, list, canAct, game.solo]);
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const q = `?game=${game.id}`;

  const byId = useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows]);
  const label = (r: RankingRow) => (game.solo ? r.name : r.team ? `${r.name} · ${r.team}` : r.name);
  const why = (id: string): string | null => {
    if (role === "visiteur") return id === me?.id ? null : "Connectez-vous pour défier.";
    if (!el) return enterable.length ? "Inscrivez-vous au classement pour défier." : game.solo ? "Inscrivez-vous au classement pour défier." : "Seul le capitaine ou le gestionnaire d’une équipe inscrite peut défier.";
    return el.why(id);
  };
  const blocked = (id: string) => !el || !!el.block(id);

  /** Exécute une action serveur, affiche son message et recharge les données. */
  const run = (p: () => Promise<RankResult>, after?: () => void) =>
    start(async () => {
      const r = await p();
      setFlash(r.ok ? { ok: true, text: r.message ?? "Enregistré." } : { ok: false, text: Object.values(r.errors)[0] ?? "Action impossible." });
      if (r.ok) {
        after?.();
        router.refresh();
      }
    });

  const send = (oppId: string) => {
    if (role === "visiteur") return router.push("/connexion");
    const opp = byId.get(oppId);
    if (!opp || blocked(oppId)) return;
    setDialog({ kind: "send", opp });
  };

  return (
    <>
      <Kpis me={me} participants={rows.length} placement={rows.filter((r) => r.inPlacement).length} received={el?.received ?? 0} general={generalRank} role={role} />

      {flash && (
        <div role="status" className={`mt-3 border px-4 py-2.5 text-sm ${flash.ok ? "border-orange bg-active-tint" : "border-red text-red"}`}>
          {flash.ok ? "✓ " : ""}{flash.text}
        </div>
      )}

      {!me && role !== "visiteur" && enterable.length > 0 && (
        <EnterCard game={game} options={enterable} pending={pending} onEnter={(entityId) => run(() => enterRankingsAction({ game: game.id, entityId }))} />
      )}

      <div className="mt-4 flex overflow-x-auto border-b border-line" role="tablist">
        {(Object.keys(TAB_PATH) as RankingsTab[]).map((k) => (
          <Link key={k} href={TAB_PATH[k][1] + q} className="tab" aria-current={k === tab ? "page" : undefined}>
            {TAB_PATH[k][0]}
            {k === "defis" && (el?.received ?? 0) > 0 && (
              <span className="grid h-[18px] min-w-[18px] place-items-center bg-orange px-1 font-sans text-[11px] text-bg">{el!.received}</span>
            )}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="card mt-4 px-[18px] py-8 text-center text-silver">
          Aucun{game.solo ? " joueur" : "e équipe"} classé{game.solo ? "" : "e"} en {game.name} pour le moment.{" "}
          {role === "visiteur" ? <Link href="/connexion">Connectez-vous</Link> : enterable.length ? "Inscrivez-vous ci-dessus pour être le premier." : game.solo ? "" : <Link href="/recrutement">Créez ou rejoignez une équipe →</Link>}
        </div>
      ) : (
        <>
          {tab === "table" && <RankingTable rows={rows} el={el} me={me} game={game} label={label} send={send} why={why} blocked={blocked} role={role} />}
          {tab === "defis" &&
            (me && el ? (
              <ChallengeCenter
                game={game}
                me={me}
                list={list}
                byId={byId}
                el={el}
                pending={pending}
                send={send}
                rows={rows}
                act={{
                  accept: (c, slot) => run(() => respondChallengeAction({ id: c.id, slot })),
                  refuse: (c) => setDialog({ kind: "refuse", c }),
                  refuseUnjustified: (c) =>
                    setConfirm({
                      title: "Refuser sans motif admis ?",
                      text: `Ce défi est valide. Un refus injustifié entraîne un forfait et une pénalité de ${UNJUSTIFIED_REFUSAL_PENALTY} points, inscrite à votre historique. Un appel reste possible.`,
                      confirm: "Refuser quand même",
                      danger: true,
                      run: () => run(() => respondChallengeAction({ id: c.id, refuse: "unjustified" })),
                    }),
                  cancel: (c) => run(() => cancelChallengeAction(c.id)),
                  declare: (c) => router.push(c.matchId ? `/match?m=${c.matchId}` : "/calendrier"),
                  confirmResult: (c) => run(() => answerResultAction({ id: c.id, confirm: true })),
                  contest: (c) => setDialog({ kind: "contest", c }),
                }}
              />
            ) : (
              <div className="card mt-4 px-[18px] py-6 text-sm text-silver">
                {role === "visiteur" ? <>Connectez-vous pour accéder au Centre des défis. <Link href="/connexion">Se connecter →</Link></> : "Le Centre des défis s’ouvre dès que vous êtes inscrit au classement de ce jeu."}
              </div>
            ))}
          {tab === "divisions" && <Divisions rows={rows} solo={game.solo} />}
          {tab === "seeding" && <Seeding rows={rows} game={game} dates={seedingDates} />}
        </>
      )}

      <ConfirmDialog req={confirm} onClose={() => setConfirm(null)} />
      <ActionDialog gameId={game.id} dialog={dialog} close={() => setDialog(null)} pending={pending} el={el} byId={byId} run={run} />
    </>
  );
}

function EnterCard({ game, options, pending, onEnter }: { game: GameInfo; options: { id: string; label: string }[]; pending: boolean; onEnter: (id: string) => void }) {
  const [id, setId] = useState(options[0].id);
  return (
    <section className="card mt-4 border-t-2 !border-t-orange">
      <div className="card-head"><span className="card-title">Entrer au classement {game.name}</span><span className="card-meta">800 pts · 5 matchs de placement à K = 40</span></div>
      <div className="flex flex-wrap items-center gap-2 px-[18px] py-3.5">
        {options.length > 1 ? (
          <select className="field" aria-label="Équipe à inscrire" value={id} onChange={(e) => setId(e.target.value)}>
            {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        ) : (
          <span className="font-semibold">{options[0].label}</span>
        )}
        <button className="btn btn-primary btn-sm" disabled={pending} aria-busy={pending || undefined} onClick={() => onEnter(id)}>
          {game.solo ? "M’inscrire au classement" : "Inscrire l’équipe"}
        </button>
        <span className="text-xs text-grey">Vos 5 premiers adversaires sont appariés par le système.{game.solo ? "" : " Roster complet requis."}</span>
      </div>
    </section>
  );
}

/** Fenêtres d'action : créneaux d'un défi, déclaration du résultat, refus motivé, contestation. */
function ActionDialog({ gameId, dialog, close, pending, el, byId, run }: { gameId: string; dialog: Dialog; close: () => void; pending: boolean; el: Eligibility | null; byId: Map<string, RankingRow>; run: (p: () => Promise<RankResult>, after?: () => void) => void }) {
  const [slots, setSlots] = useState(() => [2, 3, 4].map(slotDefault));
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | undefined>();
  const reset = () => {
    setSlots([2, 3, 4].map(slotDefault));
    setText("");
    setErr(undefined);
    close();
  };
  if (!dialog) return <Modal open={false} onClose={reset} title="">{null}</Modal>;
  const submit = (p: () => Promise<RankResult>) =>
    run(async () => {
      const r = await p();
      if (!r.ok) setErr(Object.values(r.errors)[0]);
      return r;
    }, reset);
  const btn = (label: string, go: () => void, danger = false) => (
    <button className={`btn btn-sm ${danger ? "btn-danger" : "btn-primary"}`} disabled={pending} aria-busy={pending || undefined} onClick={go}>{label}</button>
  );

  if (dialog.kind === "send") {
    const st = el?.stakesFor(dialog.opp.id);
    return (
      <Modal open onClose={reset} title={`Défier ${dialog.opp.name}`} footer={btn("Envoyer le défi", () => submit(() => sendChallengeAction({ game: gameId, oppId: dialog.opp.id, slots: slots.map((v) => `${v}:00+04:00`) })))}>
        <p>Proposez 3 créneaux (heure de La Réunion), entre 24 h et 9 jours à l’avance. L’adversaire en choisit un sous 48 h.</p>
        {st && <p className="mt-1 text-silver">Enjeux : victoire {formatDelta(st.win)} · défaite {formatDelta(st.loss)} pts.</p>}
        <div className="mt-3 grid gap-2">
          {slots.map((v, i) => (
            <label key={i} className="grid gap-1 text-xs text-grey">
              Créneau {i + 1}
              <input type="datetime-local" className="field" value={v} onChange={(e) => setSlots(slots.map((x, j) => (j === i ? e.target.value : x)))} />
            </label>
          ))}
        </div>
        <div className="mt-2"><FormError message={err} /></div>
      </Modal>
    );
  }
  const refuse = dialog.kind === "refuse";
  return (
    <Modal
      open
      onClose={reset}
      title={refuse ? "Refuser avec un motif admis" : "Contester le résultat"}
      footer={btn(refuse ? "Refuser sans pénalité" : "Envoyer à l’arbitre", () => submit(() => (refuse ? respondChallengeAction({ id: dialog.c.id, refuse: "justified", reason: text }) : answerResultAction({ id: dialog.c.id, confirm: false, reason: text }))), !refuse)}
    >
      <p>{refuse ? "Motifs admis : indisponibilité déclarée, congé, panne majeure, défi hors zone ou abusif." : "Le résultat est suspendu jusqu’à la décision d’un arbitre. Joignez vos preuves dans le chat du match."}</p>
      <textarea className="field mt-3 !h-auto w-full py-2" rows={3} maxLength={500} value={text} onChange={(e) => setText(e.target.value)} placeholder={refuse ? "Indisponibilité déclarée" : "Ex. score inversé, capture à l’appui"} aria-label="Motif" />
      <div className="mt-2"><FormError message={err} /></div>
    </Modal>
  );
}

function Kpis({ me, participants, placement, received, general, role }: { me: RankingRow | null; participants: number; placement: number; received: number; general: Props["generalRank"]; role: Role }) {
  const member = role !== "visiteur" && !!me;
  const items: { k: string; v: string; s: string; c?: string; href?: string }[] = [
    { k: "Votre rang", v: me && member ? ordinal(me.rank) : "—", s: me && member ? `${me.name} · Division ${me.division}` : role === "visiteur" ? "Connectez-vous" : "Non classé", c: "text-orange" },
    { k: "Score", v: me && member ? fmtScore(me.score) : "—", s: me ? `K = ${kFactor(me)} · Elo` : "Elo · départ à 800" },
    { k: "Participants", v: String(participants), s: `${placement} en placement` },
    { k: "Défis reçus", v: member ? String(received) : "—", s: "réponse sous 48 h", c: received && member ? "text-orange" : undefined },
    { k: "Classement général", v: general && member ? (general.label === "1" ? "1er" : `${general.label}e`) : "—", s: general ? `${general.structure} · tous jeux` : "", href: "/classement" },
  ];
  return (
    <div className="mt-3.5 grid border border-line bg-surface [grid-template-columns:repeat(auto-fit,minmax(min(100%,170px),1fr))]">
      {items.map((it) => {
        const body = (
          <>
            <div className="overline !font-normal">{it.k}</div>
            <div className={`font-display text-[26px] font-extrabold leading-[1.15] ${it.c ?? "text-ink"}`}>{it.v}</div>
            <div className="text-xs text-grey">{it.s}</div>
          </>
        );
        return it.href ? (
          <Link key={it.k} href={it.href} className="border-r border-b border-line px-4 py-3 text-ink hover:bg-surface-2 hover:text-ink">{body}</Link>
        ) : (
          <div key={it.k} className="border-r border-b border-line px-4 py-3">{body}</div>
        );
      })}
    </div>
  );
}

function activity(r: RankingRow, solo: boolean): [string, string] {
  const lim = solo ? 7 : 14;
  const d = r.daysSinceMatch;
  if (d > lim + 21) return [`Inactif · ${d} j`, "text-red"];
  if (d > lim + 7) return [`Pénalisé · ${d} j sans match`, "text-red"];
  if (d > lim) return [`Avertissement · ${d} j`, "text-orange"];
  return [`Actif · il y a ${d} j`, "text-grey"];
}

const GRID = "grid grid-cols-[48px_minmax(0,1fr)_64px_44px_150px_52px_96px] gap-2.5 items-center";

function RankingTable({ rows, el, me, game, label, send, why, blocked, role }: { rows: RankingRow[]; el: Eligibility | null; me: RankingRow | null; game: GameInfo; label: (r: RankingRow) => string; send: (id: string) => void; why: (id: string) => string | null; blocked: (id: string) => boolean; role: Role }) {
  const [div, setDiv] = useState("all");
  const [query, setQuery] = useState("");
  const [selId, setSelId] = useState<string | null>(null);
  const nDiv = Math.max(1, ...rows.map((r) => r.division));
  const shown = rows.filter((r) => (div === "all" || String(r.division) === div) && (!query || label(r).toLowerCase().includes(query.toLowerCase())));
  const sel = rows.find((r) => r.id === selId) ?? me ?? rows[0];
  const selWhy = why(sel.id);
  const st = el && !selWhy ? el.stakesFor(sel.id) : null;

  return (
    <div className="mt-4">
      <div className="mb-3 flex flex-wrap gap-2">
        <select className="field" aria-label="Division" value={div} onChange={(e) => setDiv(e.target.value)}>
          <option value="all">Toutes les divisions</option>
          {Array.from({ length: nDiv }, (_, i) => (
            <option key={i} value={String(i + 1)}>Division {i + 1}</option>
          ))}
        </select>
        <input className="field w-[200px]" placeholder="Rechercher…" aria-label="Rechercher dans le classement" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      <div className="flex flex-wrap items-start gap-4">
        <div className="card min-w-0 flex-[999_1_640px] overflow-x-auto">
          <div className="min-w-[720px]">
            <div className={`${GRID} border-b border-line px-4 py-2.5 overline !font-normal`}>
              <span>Rang</span><span>{game.solo ? "Joueur" : "Équipe"}</span><span className="text-right">Score</span><span className="text-center">Div.</span><span>Activité</span><span className="text-center">Var.</span><span />
            </div>
            {shown.map((r) => {
              const [act, ac] = activity(r, game.solo);
              const v = r.prevRank - r.rank;
              const can = !blocked(r.id);
              const divBreak = r.rank > 1 && (r.rank - 1) % 8 === 0;
              return (
                <div
                  key={r.id}
                  onClick={() => setSelId(r.id)}
                  className={`${GRID} cursor-pointer px-4 py-[9px] text-sm transition-colors duration-150 hover:bg-surface-2 border-t ${divBreak ? "border-[#5a5a5a]" : "border-surface-2"} ${r.isMe ? "bg-active-tint" : sel.id === r.id ? "bg-surface-2" : ""}`}
                >
                  <span className={`font-display text-xl font-extrabold ${r.rank === 1 ? "text-yellow" : ""}`}>{r.rank}</span>
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate font-semibold">{r.name}</span>
                      {r.team && <span className="truncate text-xs text-grey">{r.team}</span>}
                    </span>
                    {r.isMe && role !== "visiteur" && <span className="badge !border-orange bg-orange !text-bg">Vous</span>}
                    {r.inPlacement && <span className="badge text-silver">Placement {r.placementMatches}/5</span>}
                    {!r.rosterComplete && <span className="badge text-red">Incomplet</span>}
                  </span>
                  <span className="text-right font-display text-lg font-bold">{fmtScore(r.score)}</span>
                  <span className={`text-center text-xs font-bold ${r.division === 1 ? "text-yellow" : r.division === 2 ? "text-orange" : "text-silver"}`}>D{r.division}</span>
                  <span className={`flex items-center gap-1.5 text-xs ${ac}`}><span className="h-1.5 w-1.5 flex-none bg-current" />{act}</span>
                  <span className={`text-center text-xs font-bold ${r.inPlacement ? "text-silver" : v > 0 ? "text-orange" : v < 0 ? "text-red" : "text-grey"}`}>
                    {r.inPlacement ? "NEW" : v > 0 ? `▲ ${v}` : v < 0 ? `▼ ${-v}` : "="}
                  </span>
                  <span className="text-right">
                    {can && (
                      <button className="btn btn-primary btn-sm" onClick={(e) => { e.stopPropagation(); send(r.id); }}>Défier</button>
                    )}
                  </span>
                </div>
              );
            })}
            {shown.length === 0 && <div className="px-4 py-7 text-center text-grey">Aucun participant ne correspond à ces filtres.</div>}
            <div className="border-t border-line px-4 py-2.5 text-xs leading-normal text-grey">
              {zoneText(el?.widened ?? false)} Égalité de score départagée par résultat direct, puis différence de manches. Rangs calculés à partir du score, jamais saisis à la main.
            </div>
          </div>
        </div>

        <aside className="card sticky top-[88px] max-w-full flex-[1_1_300px]" aria-label="Profil de classement">
          <div className="border-b border-line px-[18px] py-4">
            <div className="overline">Profil de classement</div>
            <div className="font-display mt-1 text-[28px] font-extrabold leading-[1.05]">{sel.name}</div>
            {sel.team && <div className="text-sm text-grey">{sel.team}</div>}
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <span className={`badge ${sel.inPlacement ? "text-silver" : activity(sel, game.solo)[1]}`}>{sel.inPlacement ? "Placement · K = 40" : activity(sel, game.solo)[0].split(" ·")[0]}</span>
              <span className="badge text-silver !border-line">Division {sel.division}</span>
            </div>
          </div>
          <div className="grid grid-cols-3 border-b border-line">
            {[["Rang", String(sel.rank)], ["Score", fmtScore(sel.score)], ["Bilan", `${sel.wins}–${sel.losses}`]].map(([k, v], i) => (
              <div key={k} className={`px-4 py-3 ${i < 2 ? "border-r border-line" : ""}`}>
                <div className="text-[11px] text-grey">{k}</div>
                <div className="font-display text-[26px] font-extrabold">{v}</div>
              </div>
            ))}
          </div>
          <div className="px-[18px] py-3">
            {!selWhy && st ? (
              <button className="btn btn-primary w-full" onClick={() => send(sel.id)}>
                Défier · V {formatDelta(st.win)} / D {formatDelta(st.loss)}
              </button>
            ) : role === "visiteur" && !sel.isMe ? (
              <Link href="/connexion" className="btn btn-secondary w-full">Connectez-vous pour défier</Link>
            ) : (
              <p className="text-[13px] leading-snug text-grey">{selWhy}</p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

interface Acts {
  accept: (c: ChallengeItem, slotIso: string) => void;
  refuse: (c: ChallengeItem) => void;
  refuseUnjustified: (c: ChallengeItem) => void;
  cancel: (c: ChallengeItem) => void;
  declare: (c: ChallengeItem) => void;
  confirmResult: (c: ChallengeItem) => void;
  contest: (c: ChallengeItem) => void;
}

interface CenterProps {
  game: GameInfo;
  me: RankingRow;
  rows: RankingRow[];
  list: ChallengeItem[];
  byId: Map<string, RankingRow>;
  el: Eligibility;
  pending: boolean;
  send: (id: string) => void;
  act: Acts;
}

type Action = { l: string; kind: "p" | "t" | "d"; go: () => void };

function ChallengeCenter({ game, me, rows, list, byId, el, pending, send, act }: CenterProps) {
  const targets = rows.filter((r) => !el.block(r.id));
  const stakesTxt = (id: string) => {
    const s = el.stakesFor(id);
    return `Victoire ${formatDelta(s.win)} · défaite ${formatDelta(s.loss)} pts`;
  };
  const noTargetsTxt =
    !el.ctx.canAct ? "Seul le capitaine ou le gestionnaire peut lancer un défi."
    : !el.ctx.me.rosterComplete ? "Roster incomplet : complétez votre équipe pour lancer ou accepter un défi."
    : me.inPlacement ? "Matchs de placement en cours : vos adversaires sont appariés par le système."
    : el.pendingOut >= 2 ? "Vous avez déjà 2 défis en attente : attendez une réponse avant d’en lancer un autre."
    : "Aucun adversaire disponible dans votre zone pour le moment.";

  const actionsFor = (c: ChallengeItem): Action[] => {
    if (!el.ctx.canAct) return [];
    if (c.status === "PENDING" && c.dir === "in")
      return [
        ...(c.slots ?? []).map((s, j): Action => ({ l: s, kind: j === 0 ? "p" : "t", go: () => act.accept(c, c.slotIsos![j]) })),
        { l: "Refuser · motif admis", kind: "t", go: () => act.refuse(c) },
        { l: "Refuser sans motif", kind: "d", go: () => act.refuseUnjustified(c) },
      ];
    if (c.status === "PENDING" && c.dir === "out") return [{ l: "Annuler", kind: "t", go: () => act.cancel(c) }];
    if (c.status === "PLANNED" && c.canDeclare) return [{ l: "Déclarer le résultat (Match Center)", kind: "p", go: () => act.declare(c) }];
    if (c.status === "SUBMITTED" && c.canConfirm)
      return [
        { l: "Confirmer le résultat", kind: "p", go: () => act.confirmResult(c) },
        { l: "Contester", kind: "d", go: () => act.contest(c) },
      ];
    return [];
  };

  const groups: [string, ChallengeItem[]][] = [
    ["Défis reçus", list.filter((c) => c.dir === "in" && c.status === "PENDING")],
    ["En cours", list.filter((c) => !FINISHED.has(c.status) && !(c.dir === "in" && c.status === "PENDING"))],
    ["Terminés", list.filter((c) => FINISHED.has(c.status))],
  ];
  const upcoming = list.filter((c) => (c.status === "PLANNED" || c.status === "SUBMITTED") && c.slot);
  const lim = game.solo ? 7 : 14;

  return (
    <div className="mt-4 grid items-start gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr))] lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="grid min-w-0 gap-4">
        <section className="card border-t-2 !border-t-orange">
          <div className="card-head">
            <span className="card-title flex-1">Lancer un défi</span>
            <span className="card-meta">{zoneText(el.widened)}</span>
          </div>
          {targets.length > 0 ? (
            <div className="grid [grid-template-columns:repeat(auto-fill,minmax(220px,1fr))]">
              {targets.map((t) => (
                <div key={t.id} className="grid gap-1 border-r border-b border-surface-2 px-[18px] py-3.5">
                  <div className="flex items-baseline gap-2">
                    <span className="font-display text-2xl font-extrabold text-orange">{ordinal(t.rank)}</span>
                    <span className="truncate font-semibold">{t.name}</span>
                  </div>
                  <div className="text-xs text-grey">{fmtScore(t.score)} pts · Division {t.division}{t.team ? ` · ${t.team}` : ""}</div>
                  <div className="text-xs text-silver">{stakesTxt(t.id)}</div>
                  <button className="btn btn-primary btn-sm mt-1.5" disabled={pending} onClick={() => send(t.id)}>Défier · proposer 3 créneaux</button>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-[18px] py-4 text-sm text-silver">
              {noTargetsTxt}
            </div>
          )}
          <NonEligible rows={rows} el={el} me={me} />
        </section>

        {groups.map(([title, items]) => (
          <section key={title} className="card">
            <div className="card-head"><span className="card-title">{title}</span><span className="card-meta">{items.length} défi(s)</span></div>
            {items.map((c) => {
              const o = byId.get(c.oppId);
              const [stl, stc] = STATUS[c.status];
              return (
                <div key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-2.5 border-b border-surface-2 px-[18px] py-3">
                  <div className="min-w-0 flex-[1_1_260px]">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{c.dir === "in" ? "Reçu de " : "Envoyé à "}{o?.name ?? "?"} · {o ? ordinal(o.rank) : "?"}</span>
                      <span className={`badge ${stc}`}>{stl}</span>
                    </div>
                    <div className="mt-0.5 text-xs text-grey">{c.meta}{c.slot && !FINISHED.has(c.status) ? ` · ${c.slot}` : ""}</div>
                    <div className="mt-0.5 text-xs text-silver">{c.result ?? (FINISHED.has(c.status) || !o ? "" : stakesTxt(c.oppId))}</div>
                  </div>
                  <div className="flex flex-auto flex-wrap justify-end gap-1.5">
                    {actionsFor(c).map((a) => (
                      <button key={a.l} onClick={a.go} disabled={pending} className={`btn btn-sm ${a.kind === "p" ? "btn-primary" : a.kind === "d" ? "btn-danger" : "btn-tertiary"}`}>{a.l}</button>
                    ))}
                  </div>
                </div>
              );
            })}
            {items.length === 0 && <div className="px-[18px] py-4 text-[13px] text-grey">Aucun défi.</div>}
          </section>
        ))}
      </div>

      <div className="grid gap-4">
        <section className="card">
          <div className="card-head"><span className="card-title">Vos prochains matchs</span></div>
          {upcoming.map((c) => (
            <div key={c.id} className="border-b border-surface-2 px-[18px] py-2.5">
              <div className="text-[13px] font-semibold text-orange">{c.slot}</div>
              <div className="text-sm font-semibold">vs {byId.get(c.oppId)?.name}</div>
              <div className="text-xs text-grey">{stakesTxt(c.oppId)}</div>
            </div>
          ))}
          {upcoming.length === 0 && <div className="px-[18px] py-3 text-[13px] text-grey">Aucun match confirmé.</div>}
          <Link href="/calendrier" className="block px-[18px] py-2.5 text-[13px] font-semibold">Voir le calendrier complet →</Link>
        </section>

        <section className="card">
          <div className="card-head"><span className="card-title">Vos limites</span></div>
          {[
            ["Défis envoyés en attente", `${el.pendingOut} / 2`, el.pendingOut / 2, el.pendingOut >= 2 ? "bg-red text-red" : "bg-orange text-orange"],
            ["Matchs de placement", me.placementMatches >= 5 ? "Terminé" : `${me.placementMatches} / 5`, Math.min(1, me.placementMatches / 5), "bg-grey text-grey"],
            ["Dernier match officiel", `il y a ${me.daysSinceMatch} j / ${lim}`, Math.min(1, me.daysSinceMatch / lim), me.daysSinceMatch > lim ? "bg-orange text-orange" : "bg-grey text-grey"],
          ].map(([k, v, w, c]) => (
            <div key={k as string} className="border-b border-surface-2 px-[18px] py-2.5">
              <div className="flex justify-between text-[13px]"><span className="text-silver">{k}</span><span className={`font-bold ${(c as string).split(" ")[1]}`}>{v}</span></div>
              <div className="mt-1.5 h-1 bg-bg"><div className={`h-full ${(c as string).split(" ")[0]}`} style={{ width: `${Math.round((w as number) * 100)}%` }} /></div>
            </div>
          ))}
        </section>

        <section className="card">
          <div className="card-head"><span className="card-title">Règles</span></div>
          {[
            ["Zone de défi", "2 rangs au-dessus, 1 en dessous. Élargie à 3 / 2 si moins de 2 adversaires disponibles. Hors zone = bloqué."],
            ["Créneaux", "Le challenger propose 3 créneaux, le défendeur en choisit un. 48 h pour répondre (relance à 24 h), 7 jours pour jouer, 24 h pour confirmer."],
            ["Revanche et immunité", "Pas de revanche avant 14 jours. Après une défense réussie, immunité de 72 h."],
            ["Points", "Elo : K = 40 pendant les 5 matchs de placement, puis K = 32. Au plus 2 matchs comptés contre un même adversaire sur 30 jours glissants."],
            ["Refus injustifié", "Forfait et −40 pts. Les défis hors zone, doublons et abusifs ne pénalisent jamais."],
            ["Résultats", "Un résultat reste PROVISOIRE jusqu’à confirmation adverse ou décision d’un arbitre."],
          ].map(([t, d]) => (
            <div key={t} className="border-b border-surface-2 px-[18px] py-2.5">
              <div className="text-[13px] font-semibold">{t}</div>
              <div className="mt-0.5 text-xs leading-snug text-grey">{d}</div>
            </div>
          ))}
        </section>

        <section className="card">
          <div className="card-head"><span className="card-title">Inactivité</span></div>
          {[
            [`1–${lim} j`, "Activité normale", "text-grey"],
            [`${lim + 1}–${lim + 7} j`, "Avertissement", "text-orange"],
            [`${lim + 8}–${lim + 14} j`, "−20 pts", "text-red"],
            [`${lim + 15}–${lim + 21} j`, "−20 pts supplémentaires", "text-red"],
            [`> ${lim + 21} j`, "−40 pts · statut inactif", "text-red"],
          ].map(([d, t, c]) => (
            <div key={d} className="grid grid-cols-[80px_1fr] gap-2.5 border-b border-surface-2 px-[18px] py-2 text-[13px]">
              <span className={`font-bold ${c}`}>{d}</span><span className="text-silver">{t}</span>
            </div>
          ))}
          <div className="px-[18px] py-2.5 text-xs leading-snug text-grey">
            Seuil {game.solo ? "7 jours en 1v1" : "14 jours pour les équipes"}. Aucune pénalité sans adversaire disponible, pendant un congé déclaré, en cas de panne majeure ou de report autorisé.
          </div>
        </section>
      </div>
    </div>
  );
}

/** Adversaires proches mais non éligibles, avec la raison affichée. */
function NonEligible({ rows, el, me }: { rows: RankingRow[]; el: Eligibility; me: RankingRow }) {
  const near = rows.filter((r) => !r.isMe && Math.abs(r.rank - me.rank) <= 3 && el.block(r.id));
  if (!near.length) return null;
  return (
    <div className="border-t border-line">
      <div className="overline px-[18px] pt-3 pb-1">Non éligibles autour de vous</div>
      {near.map((r) => (
        <div key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-surface-2 px-[18px] py-2 text-[13px] opacity-80">
          <span className="w-8 font-display text-base font-bold text-grey">{ordinal(r.rank)}</span>
          <span className="min-w-0 flex-1 truncate font-semibold">{r.name}{r.team ? <span className="font-normal text-grey"> · {r.team}</span> : null}</span>
          <span className="text-grey">{el.why(r.id)}</span>
        </div>
      ))}
    </div>
  );
}

function Divisions({ rows, solo }: { rows: RankingRow[]; solo: boolean }) {
  const nDiv = Math.max(1, ...rows.map((r) => r.division));
  return (
    <>
      <div className="mt-4 border border-line bg-surface px-4 py-3 text-[13px] text-silver">
        Divisions de 8, recalculées après chaque match validé ; une division s’ouvre par tranche de 8 inscrits ({rows.length} inscrits = {nDiv} division{nDiv > 1 ? "s" : ""}). Au <strong className="text-ink">31 août à 23:59</strong>, le seeding est figé : les 8 premiers de la Division 1 sont qualifiés pour les Playoffs. Les nouveaux entrants sont placés dans la dernière division, à titre provisoire, le temps de leurs 5 matchs de placement.
      </div>
      <div className="mt-3 grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr))]">
        {Array.from({ length: nDiv }, (_, i) => i + 1).map((d) => {
          const rr = rows.filter((r) => r.division === d);
          return (
            <section key={d} className="card">
              <div className="flex items-center justify-between border-b border-line px-4 py-3">
                <span className={`font-display text-[22px] font-extrabold ${d === 1 ? "text-yellow" : d === 2 ? "text-orange" : "text-silver"}`}>Division {d}</span>
                <span className="text-xs text-grey">{rr.length} / 8 {solo ? "joueurs" : "équipes"}</span>
              </div>
              {rr.map((r) => {
                const playoffs = d === 1 && !r.inPlacement;
                return (
                  <div key={r.id} className={`grid grid-cols-[34px_minmax(0,1fr)_60px_100px] items-center gap-2 border-b border-surface-2 px-4 py-2 text-sm ${r.isMe ? "bg-active-tint" : ""}`}>
                    <span className="font-display text-base font-bold text-grey">{r.rank}</span>
                    <span className={`truncate ${r.isMe ? "font-extrabold" : ""}`}>{r.name}{r.team ? <span className="text-xs text-grey"> · {r.team}</span> : null}</span>
                    <span className="text-right text-silver">{fmtScore(r.score)}</span>
                    <span className={`text-right text-[11px] font-bold ${playoffs ? "text-yellow" : "text-silver"}`}>
                      {r.inPlacement ? "PROVISOIRE" : playoffs ? "ZONE PLAYOFFS" : ""}
                    </span>
                  </div>
                );
              })}
            </section>
          );
        })}
      </div>
    </>
  );
}

function Seeding({ rows, game, dates }: { rows: RankingRow[]; game: GameInfo; dates: Props["seedingDates"] }) {
  const seeds = rows.filter((r) => !r.inPlacement);
  return (
    <div className="mt-4 grid items-start gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr))] lg:grid-cols-[320px_minmax(0,1fr)]">
      <section className="card">
        <div className="card-head"><span className="card-title">Seedings</span></div>
        {[
          ["Seeding officiel · fin de saison régulière", `Officiel · ${dates.official}`, "Tableau des Playoffs (top 8 D1)", true],
          ["Seeding · fin de pré-saison", `Indicatif · ${dates.preseason}`, "Divisions de départ de la saison régulière", false],
        ].map(([n, d, u, on]) => (
          <div key={n as string} className={`border-b border-l-[3px] border-b-surface-2 px-[18px] py-3 ${on ? "border-l-orange bg-surface-2" : "border-l-transparent"}`}>
            <div className="text-sm font-semibold">{n}</div>
            <div className="text-xs text-grey">{d}</div>
            <div className="mt-0.5 text-xs text-silver">{u}</div>
          </div>
        ))}
      </section>
      <section className="card min-w-0 overflow-x-auto">
        <div className="card-head">
          <div className="min-w-[220px] flex-1">
            <div className="card-title">Seeding officiel · fin de saison régulière</div>
            <div className="text-xs text-grey">Référence {dates.official} · {game.name} · Océan Indien</div>
          </div>
          <span className="badge text-orange">Aperçu</span>
        </div>
        <div className="min-w-[520px]">
          <div className="grid grid-cols-[50px_minmax(0,1fr)_70px_56px] gap-2.5 px-[18px] py-2 overline !font-normal">
            <span>Seed</span><span>Participant</span><span className="text-right">Score</span><span className="text-center">Div.</span>
          </div>
          {seeds.slice(0, 16).map((r, i) => (
            <div key={r.id} className="grid grid-cols-[50px_minmax(0,1fr)_70px_56px] items-center gap-2.5 border-t border-surface-2 px-[18px] py-2 text-sm">
              <span className={`font-display text-lg font-extrabold ${i === 0 ? "text-yellow" : ""}`}>{i + 1}</span>
              <span className="truncate font-semibold">{r.name}{r.team ? <span className="font-normal text-xs text-grey"> · {r.team}</span> : null}</span>
              <span className="text-right">{fmtScore(r.score)}</span>
              <span className="text-center text-xs text-silver">D{r.division}</span>
            </div>
          ))}
        </div>
        <div className="border-t border-line px-[18px] py-2.5 text-xs text-grey">
          Le seeding officiel est un instantané immuable (horodatage + empreinte SHA-256), figé automatiquement à la date de référence. Les résultats postérieurs modifient le classement permanent, pas ce seeding.
        </div>
      </section>
    </div>
  );
}
