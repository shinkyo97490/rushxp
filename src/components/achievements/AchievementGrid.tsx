import { ACHIEVEMENT_CATEGORIES, levelProgress, type AchievementCategory, type AchievementDef } from "@/lib/rules/achievements";

export type AchievementView = AchievementDef & { cur: number; done: boolean; unlockedAt: Date | null };

const day = (d: Date) => new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone: "Indian/Reunion" }).format(d);

export function AchievementBadge({ a, size = "md" }: { a: Pick<AchievementView, "ico" | "done">; size?: "sm" | "md" }) {
  const s = size === "sm" ? "h-9 w-9 text-[11px]" : "h-11 w-11 text-sm";
  return <span className={`clip-corner-sm grid flex-none place-items-center font-display font-extrabold ${s} ${a.done ? "bg-orange text-bg" : "border border-line bg-bg text-grey"}`}>{a.ico}</span>;
}

/** Succès groupés par catégorie, avec la progression et le niveau du joueur. */
export function AchievementGrid({ list, xp }: { list: AchievementView[]; xp: number | null }) {
  const done = list.filter((a) => a.done).length;
  const lp = xp != null ? levelProgress(xp) : null;
  const cats = Object.keys(ACHIEVEMENT_CATEGORIES) as AchievementCategory[];
  return (
    <div className="grid gap-5">
      {lp && (
        <div className="grid gap-3 border border-line bg-surface p-4 sm:grid-cols-[auto_auto_minmax(0,1fr)] sm:items-center sm:gap-6">
          <div><div className="text-xs text-grey">Succès</div><div className="font-display text-2xl font-bold">{done} <span className="text-base text-grey">/ {list.length}</span></div></div>
          <div><div className="text-xs text-grey">Niveau</div><div className="font-display text-2xl font-bold text-orange">{lp.level} <span className="text-base text-grey">· {xp} XP</span></div></div>
          <div>
            <div className="flex justify-between text-xs text-grey"><span>Niveau {lp.level + 1}</span><span>{lp.cur} / {lp.need} XP</span></div>
            <div className="mt-1 h-1.5 bg-bg"><div className="h-full bg-orange" style={{ width: `${(lp.cur / lp.need) * 100}%` }} /></div>
          </div>
        </div>
      )}
      {cats.map((c) => {
        const items = list.filter((a) => a.cat === c);
        return (
          <section key={c}>
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <h3 className="font-display text-xl font-bold">{ACHIEVEMENT_CATEGORIES[c]}</h3>
              {lp && <span className="text-xs text-grey">{items.filter((a) => a.done).length} / {items.length}</span>}
            </div>
            <div className="grid gap-2 sm:gap-3 [grid-template-columns:repeat(auto-fill,minmax(min(100%,260px),1fr))]">
              {items.map((x) => (
                <div key={x.code} className={`border bg-surface p-3.5 sm:p-4 ${x.done ? "border-orange" : "border-line"}`}>
                  <div className="flex items-center gap-3">
                    <AchievementBadge a={x} />
                    <span className="min-w-0 flex-1"><span className="block font-semibold">{x.title}</span><span className="block text-xs text-grey">{x.desc}</span></span>
                    <span className="text-xs font-bold whitespace-nowrap text-orange">+{x.xp} XP</span>
                  </div>
                  {lp && (
                    <>
                      <div className="mt-3 h-1 bg-bg"><div className={`h-full ${x.done ? "bg-orange" : "bg-[#6a6a6a]"}`} style={{ width: `${Math.min(100, (x.cur / x.max) * 100)}%` }} /></div>
                      <div className={`mt-1 text-xs ${x.done ? "text-orange" : "text-grey"}`}>{x.done ? `✓ Débloqué${x.unlockedAt ? ` le ${day(x.unlockedAt)}` : ""}` : `${x.cur} / ${x.max}`}</div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
