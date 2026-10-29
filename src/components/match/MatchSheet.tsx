"use client";

import { useState } from "react";

/**
 * Feuille de match : statistiques lues sur la capture de fin de partie (OCR) ou l'API éditeur.
 * Contenu de DÉMONSTRATION, structure définitive par jeu.
 */

const POOL = ["Akio", "Bastet", "Cyra", "Dorn", "Elko", "Fenn", "Gaïa", "Hiro", "Isko", "Jory", "Kato", "Lumi", "Miro", "Nalu", "Opal", "Pika", "Quin", "Rawi", "Selo", "Tiko"];
function names(team: string) {
  let h = 0;
  for (const ch of team) h = (h * 31 + ch.charCodeAt(0)) % 997;
  return Array.from({ length: 5 }, (_, i) => POOL[(h + i * 3) % POOL.length]);
}

type Cell = string | number;
interface Row {
  name: string;
  sub: string;
  agent?: string;
  cells: Cell[];
  mvp?: boolean;
  low?: number; // index de cellule peu lisible
}

function TeamTable({ name, score, win, heads, rows, lowConf }: { name: string; score: string; win: boolean; heads: string[]; rows: Row[]; lowConf: boolean }) {
  return (
    <div className={`min-w-0 border border-line ${win ? "border-l-[3px] border-l-orange" : "border-l-[3px] border-l-[#3a3a3a]"}`}>
      <div className={`flex items-center gap-3 px-4 py-2.5 ${win ? "bg-active-tint" : ""}`}>
        <span className="flex-1 font-display text-lg font-bold">{name}</span>
        <span className={`text-[11px] font-bold tracking-[.08em] ${win ? "text-orange" : "text-grey"}`}>{win ? "VICTOIRE" : "DÉFAITE"}</span>
        <span className="font-display text-2xl font-extrabold">{score}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse text-sm">
          <thead>
            <tr className="overline !font-normal">
              {heads.map((h, i) => (
                <th key={h} className={`border-t border-line px-3 py-2 font-normal ${i === 0 ? "text-left" : "text-center"}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name} className={`border-t border-surface-2 ${r.mvp ? "bg-[rgba(255,201,40,.06)]" : ""}`}>
                <td className="px-3 py-2">
                  <span className="flex items-center gap-2">
                    {r.agent && <span title={r.agent} className="grid h-7 w-7 flex-none place-items-center bg-surface-2 font-display text-xs font-bold">{r.agent.slice(0, 2).toUpperCase()}</span>}
                    <span>
                      <span className="block font-semibold">
                        {r.name} {r.mvp && <span className="text-[11px] font-bold text-yellow">★ MVP</span>}
                      </span>
                      {r.sub && <span className="block text-xs text-grey">{r.sub}</span>}
                    </span>
                  </span>
                </td>
                {r.cells.map((c, i) => (
                  <td key={i} className={`px-3 py-2 text-center ${i === 0 ? "font-bold" : "text-silver"} ${lowConf && r.low === i ? "outline outline-1 outline-red bg-[rgba(255,90,42,.15)]" : ""}`}>{c}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function VersusBars({ rows }: { rows: [string, string, string, number][] }) {
  return (
    <div className="grid gap-2.5">
      {rows.map(([k, a, b, wa]) => (
        <div key={k} className="grid grid-cols-[56px_minmax(0,1fr)_56px] items-center gap-3 text-sm">
          <span className="text-right font-bold">{a}</span>
          <div>
            <div className="text-center text-xs text-grey">{k}</div>
            <div className="mt-1 flex h-1.5 bg-surface-2"><span className="bg-orange" style={{ width: `${wa}%` }} /><span className="flex-1 bg-silver/40" /></div>
          </div>
          <span className="font-bold text-silver">{b}</span>
        </div>
      ))}
    </div>
  );
}

const FC_A = { formation: "4-3-3", style: "Possession · pressing haut", players: [["GB", "Vasquez", 6.8], ["DG", "Mendy", 7.0], ["DC", "Kanté-Ruiz", 7.2], ["DC", "Okafor", 6.9], ["DD", "Lambert", 7.4], ["MC", "Valdés", 7.1], ["MDC", "Hoarau", 7.6], ["MC", "Paquin", 7.9], ["AG", "Doré", 8.1, "⚽"], ["BU", "Mbaye", 8.6, "⚽"], ["AD", "Riviera", 7.3]] as [string, string, number, string?][], subs: "Rempl. : Ferro (72’), Ndiaye (80’)" };
const FC_B = { formation: "4-2-3-1", style: "Équilibré · contre", players: [["GB", "Kessler", 7.4], ["DG", "Arnaud", 6.5], ["DC", "Batista", 6.7], ["DC", "Ivanov", 6.4], ["DD", "Moreau", 6.6], ["MDC", "Leclerc", 6.9], ["MDC", "Duarte", 6.8], ["MOG", "Sané-Roy", 7.0], ["MOC", "Ortega", 7.5, "⚽"], ["MOD", "Bianchi", 6.6], ["BU", "Tchami", 6.3]] as [string, string, number, string?][], subs: "Rempl. : Nkoulou (61’), Pires (75’)" };
const LAYOUT: Record<string, [number, number][]> = {
  "4-3-3": [[5, 50], [18, 15], [16, 38], [16, 62], [18, 85], [31, 25], [27, 50], [31, 75], [41, 14], [43, 40], [41, 86]],
  "4-2-3-1": [[5, 50], [18, 15], [16, 38], [16, 62], [18, 85], [26, 36], [26, 64], [37, 16], [36, 62], [37, 84], [43, 60]],
};
const ratingColor = (r: number) => (r >= 8 ? "text-yellow" : r >= 7 ? "text-orange" : "text-silver");

const TFT: [number, number, string, [string, number][], [string, number, number][]][] = [
  [1, 9, "Vainqueur du lobby", [["Arcaniste", 6], ["Gardien", 4], ["Érudit", 2]], [["Ahri", 3, 3], ["Lux", 2, 2], ["Syndra", 2, 1], ["Braum", 2, 2], ["Taric", 2, 0], ["Zoé", 2, 1], ["Karma", 2, 0], ["Nami", 2, 1], ["Soraka", 1, 0]]],
  [2, 9, "Éliminé tour 34", [["Duelliste", 6], ["Bagarreur", 2], ["Vif", 2]], [["Yasuo", 3, 3], ["Fiora", 2, 2], ["Irelia", 2, 1], ["Vi", 2, 1], ["Sett", 2, 0], ["Akali", 2, 1], ["Kayn", 1, 0], ["Riven", 2, 1]]],
  [3, 8, "Éliminé tour 31", [["Tireur", 4], ["Chasseur", 3], ["Gardien", 2]], [["Jinx", 2, 3], ["Caitlyn", 2, 2], ["Ashe", 2, 1], ["Leona", 2, 1], ["Braum", 2, 0], ["Varus", 2, 1], ["Taric", 1, 0], ["Kindred", 1, 0]]],
  [4, 8, "Éliminé tour 29", [["Assassin", 4], ["Ombre", 3]], [["Katarina", 2, 3], ["Talon", 2, 1], ["Zed", 2, 2], ["Evelynn", 2, 1], ["Kha’Zix", 1, 0], ["Pyke", 2, 0], ["Shaco", 1, 0], ["Elise", 1, 0]]],
  [5, 8, "Éliminé tour 27", [["Mage", 3], ["Colosse", 2]], [["Veigar", 2, 2], ["Annie", 2, 1], ["Cho’Gath", 2, 1], ["Malphite", 1, 0], ["Brand", 2, 1], ["Ziggs", 1, 0], ["Lulu", 1, 0]]],
  [6, 7, "Éliminé tour 25", [["Bagarreur", 4], ["Gardien", 2]], [["Sett", 2, 2], ["Volibear", 2, 1], ["Rek’Sai", 1, 0], ["Braum", 2, 1], ["Leona", 1, 0], ["Vi", 1, 0], ["Nunu", 1, 0]]],
  [7, 7, "Éliminé tour 23", [["Tireur", 2], ["Vif", 2]], [["Ezreal", 2, 1], ["Kai’Sa", 1, 1], ["Lucian", 1, 0], ["Draven", 2, 1], ["Kennen", 1, 0], ["Leona", 1, 0], ["Lulu", 1, 0]]],
  [8, 6, "Éliminé tour 20", [["Colosse", 2]], [["Malphite", 1, 0], ["Cho’Gath", 1, 1], ["Nunu", 1, 0], ["Annie", 1, 0], ["Ziggs", 1, 0], ["Lux", 1, 0]]],
];

export function MatchSheet({ game, teamA, teamB, score, official, lowConf }: { game: string; teamA: string; teamB: string; score?: string; official: boolean; lowConf: boolean }) {
  const [tftSel, setTftSel] = useState(0);
  const pr = (score ?? "").split(/[–-]/).map((x) => parseInt(x, 10));
  const bWins = pr.length === 2 && pr[1] > pr[0];
  const W = bWins ? teamB : teamA;
  const L = bWins ? teamA : teamB;
  const nW = names(W);
  const nL = names(L);
  let chips: [string, string][] = [];
  let body: React.ReactNode = null;
  let foot = "";

  if (game === "val") {
    chips = [...(score ? [["Série", score] as [string, string]] : []), ["Carte 1", "Ascent"], ["Score", "15 – 13"], ["Rounds", "28"], ["Durée", "47:21"]];
    const A = [["Jett", "Duelliste", 28, 17, 19, 486, 31, 6], ["Omen", "Contrôleur", 40, 19, 4, 479, 24, 11], ["Sova", "Initiateur", 27, 18, 3, 344, 22, 3], ["Killjoy", "Sentinelle", 27, 22, 4, 341, 19, 5], ["Skye", "Initiateur", 20, 20, 12, 337, 17, 2]] as const;
    const B = [["Raze", "Duelliste", 19, 23, 5, 223, 21, 3], ["Viper", "Contrôleur", 16, 22, 10, 214, 18, 2], ["Fade", "Initiateur", 12, 24, 2, 123, 14, 1], ["Cypher", "Sentinelle", 13, 25, 3, 113, 12, 1], ["Breach", "Initiateur", 10, 23, 3, 85, 9, 0]] as const;
    const top = Math.max(...[...A, ...B].map((r) => r[5]));
    const rows = (src: typeof A | typeof B, n: string[], ti: number): Row[] =>
      src.map((r, i) => ({ name: n[i], sub: `${r[0]} · ${r[1]}`, agent: r[0], mvp: r[5] === top, cells: [r[2], r[3], r[4], r[5], `${r[6]} %`, r[7]], low: ti === 1 && i === 2 ? 1 : undefined }));
    const heads = ["Joueur · agent", "K", "D", "A", "ACS", "HS %", "1st kills"];
    body = (
      <div className="grid min-w-0 gap-3">
        <TeamTable name={W} score="15" win heads={heads} rows={rows(A, nW, 0)} lowConf={lowConf} />
        <TeamTable name={L} score="13" win={false} heads={heads} rows={rows(B, nL, 1)} lowConf={lowConf} />
      </div>
    );
    foot = "K / D / A : éliminations, morts, assistances · ACS : score de combat moyen · lu sur le tableau des scores de fin de partie.";
  } else if (game === "cod") {
    chips = [["Carte 1", "Protocol"], ["Mode", "Hardpoint"], ["Score", "250 – 198"], ["Durée", "10:00"], ["Série", score || "1 – 0"]];
    const A = [["AR", 31, 22, 4120, "1:42", 6], ["SMG", 27, 25, 3610, "1:18", 5], ["SMG", 24, 21, 3240, "0:55", 3], ["AR", 22, 20, 2980, "0:31", 2]] as const;
    const B = [["AR", 26, 25, 3550, "1:05", 4], ["SMG", 22, 26, 3120, "0:48", 3], ["SMG", 21, 27, 2870, "0:37", 2], ["AR", 19, 26, 2460, "0:21", 1]] as const;
    const top = Math.max(...[...A, ...B].map((r) => r[1] - r[2]));
    const rows = (src: typeof A | typeof B, n: string[], ti: number): Row[] =>
      src.map((r, i) => ({ name: n[i], sub: `Rôle ${r[0]}`, mvp: r[1] - r[2] === top, cells: [r[1], r[2], (r[1] / r[2]).toFixed(2).replace(".", ","), r[3].toLocaleString("fr-FR"), r[4], r[5]], low: ti === 1 && i === 1 ? 3 : undefined }));
    const heads = ["Joueur", "K", "D", "K/D", "Dégâts", "Temps zone", "Captures"];
    body = (
      <div className="grid min-w-0 gap-3">
        <TeamTable name={W} score="250" win heads={heads} rows={rows(A, nW, 0)} lowConf={lowConf} />
        <TeamTable name={L} score="198" win={false} heads={heads} rows={rows(B, nL, 1)} lowConf={lowConf} />
      </div>
    );
    foot = "Colonnes adaptées au mode : Hardpoint (temps en zone, captures) · Recherche & Destruction (plants, désamorçages, premiers kills) · Contrôle (captures, vies restantes).";
  } else if (game === "rl") {
    chips = [...(score ? [["Série", score] as [string, string]] : []), ["Manche", "3"], ["Score", "3 – 1"], ["Durée", "5:00"], ["Arène", "DFH Stadium"]];
    const A = [[612, 2, 1, 2, 5], [438, 1, 1, 1, 3], [371, 0, 1, 3, 2]];
    const B = [[402, 1, 0, 2, 4], [288, 0, 1, 1, 2], [215, 0, 0, 3, 1]];
    const rows = (src: number[][], n: string[], ti: number): Row[] => src.map((r, i) => ({ name: n[i], sub: "", mvp: r[0] === 612, cells: r, low: ti === 1 && i === 2 ? 3 : undefined }));
    const heads = ["Joueur", "Score", "Buts", "Passes", "Arrêts", "Tirs"];
    body = (
      <div className="grid min-w-0 gap-3">
        <TeamTable name={W} score="3" win heads={heads} rows={rows(A, nW, 0)} lowConf={lowConf} />
        <TeamTable name={L} score="1" win={false} heads={heads} rows={rows(B, nL, 1)} lowConf={lowConf} />
      </div>
    );
    foot = "Statistiques lues sur l’écran de fin de manche.";
  } else if (game === "fc") {
    chips = [["Mode", "FUT · Division Rivals"], ["Score", "2 – 1"], ["Durée", "90:00"], ["Homme du match", "Mbaye · 8,6"]];
    const place = (t: typeof FC_A, side: "a" | "b") =>
      t.players.map((p, i) => {
        const [x, y] = LAYOUT[t.formation][i];
        return { x: side === "a" ? x : 100 - x, y: side === "a" ? y : 100 - y, p, side };
      });
    body = (
      <div className="grid gap-4">
        <div className="flex items-center justify-center gap-6 text-center">
          <div><div className="font-display text-xl font-bold">{W}</div><div className="text-xs text-grey">Schéma {FC_A.formation}</div></div>
          <span className="font-display text-4xl font-extrabold">2 – 1</span>
          <div><div className="font-display text-xl font-bold">{L}</div><div className="text-xs text-grey">Schéma {FC_B.formation}</div></div>
        </div>
        <div>
          <div className="overline mb-2">Compositions & schémas tactiques</div>
          <div className="relative aspect-[16/10] overflow-hidden border border-line bg-[repeating-linear-gradient(90deg,#122016_0_10%,#0f1a12_10%_20%)]">
            <span className="absolute inset-y-0 left-1/2 w-px bg-white/20" />
            <span className="absolute top-1/2 left-1/2 h-[22%] w-[14%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/20" />
            {[...place(FC_A, "a"), ...place(FC_B, "b")].map(({ x, y, p, side }) => (
              <div key={`${side}-${p[1]}`} className="absolute grid -translate-x-1/2 -translate-y-1/2 justify-items-center gap-0.5" style={{ left: `${x}%`, top: `${y}%` }}>
                <span className={`relative grid h-7 w-7 place-items-center text-[10px] font-bold text-bg ${side === "a" ? "bg-orange" : "bg-ink"}`}>
                  {p[0]}
                  <span className={`absolute -top-2 -right-3 bg-bg px-0.5 text-[9px] font-bold ${ratingColor(p[2])}`}>{p[2].toFixed(1).replace(".", ",")}</span>
                </span>
                <span className="text-[10px] whitespace-nowrap text-ink drop-shadow">{p[1]}{p[3] ? ` ${p[3]}` : ""}</span>
              </div>
            ))}
          </div>
          <div className="mt-1.5 flex flex-wrap justify-between gap-2 text-xs text-grey">
            <span><span className="inline-block h-2 w-2 bg-orange" /> {W} · attaque →</span>
            <span><span className="inline-block h-2 w-2 bg-ink" /> {L} · ← attaque</span>
            <span>Pastille : note du match · ⚽ but</span>
          </div>
        </div>
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr))]">
          {[[FC_A, W], [FC_B, L]].map(([t, n]) => {
            const team = t as typeof FC_A;
            return (
              <div key={n as string} className="border border-line">
                <div className="border-b border-line px-3 py-2"><b>{n as string}</b> <span className="text-xs text-grey">{team.formation} · {team.style}</span></div>
                {team.players.map((p) => (
                  <div key={p[1]} className="grid grid-cols-[44px_minmax(0,1fr)_40px] gap-2 border-b border-surface-2 px-3 py-1.5 text-[13px]">
                    <span className="text-grey">{p[0]}</span>
                    <span>{p[1]} {p[3]}</span>
                    <span className={`text-right font-bold ${ratingColor(p[2])}`}>{p[2].toFixed(1).replace(".", ",")}</span>
                  </div>
                ))}
                <div className="px-3 py-2 text-xs text-grey">{team.subs}</div>
              </div>
            );
          })}
        </div>
        <VersusBars rows={[["Possession", "56 %", "44 %", 56], ["Tirs", "14", "9", 61], ["Tirs cadrés", "7", "4", 64], ["xG", "2,1", "1,0", 68], ["Passes réussies", "88 %", "81 %", 52], ["Fautes", "8", "11", 42]]} />
      </div>
    );
    foot = "Compositions, schémas, notes et statistiques lus sur l’écran de fin de match (ou via l’API éditeur si disponible).";
  } else if (game === "tek") {
    chips = [...(score ? [["Set", score] as [string, string]] : []), ["Format", "FT3"], ["Manches", "4"], ["Durée", "14:38"]];
    const rows: [string, string, string, string, boolean][] = [["Jin", "Kazuya", "3 – 1", "Arène Yakushima", true], ["Jin", "Reina", "2 – 3", "Ortiz Farm", false], ["Jin", "Reina", "3 – 0", "Rebel Hangar", true], ["Jin", "Reina", "3 – 2", "Fallen Destiny", true]];
    body = (
      <div className="grid gap-4">
        <div className="flex items-center justify-center gap-6 text-center">
          <div><div className="font-display text-xl font-bold">{W}</div><div className="text-xs text-grey">Main : Jin</div></div>
          <span className="font-display text-4xl font-extrabold">3 – 1</span>
          <div><div className="font-display text-xl font-bold">{L}</div><div className="text-xs text-grey">Main : Kazuya · Reina</div></div>
        </div>
        <div className="overflow-x-auto border border-line">
          <table className="w-full min-w-[520px] text-sm">
            <thead><tr className="overline !font-normal"><th className="px-3 py-2 text-left font-normal">Manche</th><th className="px-3 py-2 font-normal">Personnage</th><th className="px-3 py-2 font-normal">Rounds</th><th className="px-3 py-2 font-normal">Personnage</th><th className="px-3 py-2 text-left font-normal">Scène</th></tr></thead>
            <tbody>
              {rows.map(([a, b, s, st, wa], i) => (
                <tr key={i} className="border-t border-surface-2">
                  <td className="px-3 py-2">Manche {i + 1}</td>
                  <td className={`px-3 py-2 text-center ${wa ? "font-bold text-orange" : ""}`}>{a}</td>
                  <td className="px-3 py-2 text-center font-display text-lg font-bold">{s}</td>
                  <td className={`px-3 py-2 text-center ${!wa ? "font-bold text-orange" : ""}`}>{b}</td>
                  <td className="px-3 py-2 text-xs text-grey">{st}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <VersusBars rows={[["Rounds gagnés", "11", "6", 65], ["Rage Arts réussies", "3", "2", 60], ["Heat Smash", "5", "3", 62], ["Perfects", "1", "0", 75]]} />
      </div>
    );
    foot = "Personnages, rounds et scènes lus sur l’écran de fin de manche. Le perdant d’une manche peut changer de personnage.";
  } else if (game === "tft") {
    chips = [["Lobby", "C"], ["Manche", "3 / 6"], ["Durée", "36:12"], ["Joueurs", "8"]];
    const players = POOL.slice(3, 11);
    const sel = TFT[tftSel];
    body = (
      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr))] md:grid-cols-[220px_minmax(0,1fr)]">
        <div className="border border-line">
          {TFT.map((t, i) => (
            <button key={i} onClick={() => setTftSel(i)} className={`flex w-full cursor-pointer items-center gap-2.5 border-b border-l-[3px] border-b-surface-2 px-3 py-2 text-left text-sm ${i === tftSel ? "border-l-orange bg-surface-2" : "border-l-transparent"}`}>
              <span className={`w-5 font-display font-bold ${t[0] === 1 ? "text-yellow" : t[0] <= 4 ? "text-ink" : "text-grey"}`}>{t[0]}</span>
              <span className="flex-1">{players[i]}</span>
              <span className="text-xs text-grey">+{9 - t[0]}</span>
            </button>
          ))}
        </div>
        <div className="grid content-start gap-3">
          <div>
            <span className={`font-display text-2xl font-extrabold ${sel[0] === 1 ? "text-yellow" : ""}`}>{sel[0] === 1 ? "1er" : `${sel[0]}e`}</span>{" "}
            <span className="font-display text-2xl font-bold">{players[tftSel]}</span>
            <div className="text-xs text-grey">Niveau {sel[1]} · {sel[2]} · +{9 - sel[0]} pts</div>
          </div>
          <div className="overline">Synergies actives</div>
          <div className="flex flex-wrap gap-1.5">{sel[3].map(([n, c]) => <span key={n} className="border border-line px-2 py-1 text-xs"><b className="text-orange">{c}</b> {n}</span>)}</div>
          <div className="overline">Composition finale</div>
          <div className="grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(70px,1fr))]">
            {sel[4].map(([n, stars, items]) => (
              <div key={n} className="grid justify-items-center gap-1 border border-line bg-bg p-2 text-center">
                <span className="text-[10px] text-yellow">{"★".repeat(stars)}</span>
                <span className="img-placeholder grid h-9 w-9 place-items-center font-display text-sm text-ink">{n.slice(0, 2).toUpperCase()}</span>
                <span className="text-[11px]">{n}</span>
                <span className="flex gap-0.5">{Array.from({ length: items }, (_, k) => <span key={k} className="h-1.5 w-1.5 bg-orange" />)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
    foot = "Placement, niveau, synergies, unités et objets lus sur l’écran de fin de partie (ou via l’API éditeur). Cliquer un joueur pour voir sa composition.";
  }

  return (
    <section className="card">
      <div className="card-head">
        <span className="card-title">Feuille de match détaillée</span>
        <span className={`badge ${official ? "bg-ink !text-bg" : "text-silver"}`}>{official ? "Officiel" : "Non officiel · en attente"}</span>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 p-[18px]">
        <div className="flex flex-wrap gap-1.5">
          {chips.map(([k, v]) => (
            <span key={k} className="border border-line px-2.5 py-1 text-xs"><span className="text-grey">{k}</span> <b>{v}</b></span>
          ))}
        </div>
        {lowConf && <div className="border border-red bg-[rgba(255,90,42,.08)] px-3 py-2 text-[13px] text-red">▲ Certaines valeurs sont peu lisibles sur la capture (encadrées). Un arbitre les vérifie avant publication.</div>}
        {body}
        <div className="text-xs text-grey">{foot}</div>
      </div>
    </section>
  );
}
