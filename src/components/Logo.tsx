/** Logo RushXP : « RUSH » en blanc et « XP » dans un cartouche orange. `mark` : le cartouche seul (avatars, petits formats). */
export function Logo({ size = 22, mark = false, className = "" }: { size?: number; mark?: boolean; className?: string }) {
  return (
    <span role="img" aria-label="RushXP" className={`inline-flex flex-none items-center gap-[0.14em] leading-none font-extrabold ${className}`} style={{ fontSize: size, fontFamily: "var(--font-logo), Arial Black, sans-serif" }}>
      {!mark && <span className="tracking-[-0.01em] text-white">RUSH</span>}
      <span className="rounded-[0.16em] bg-orange px-[0.2em] pt-[0.12em] pb-[0.1em] tracking-[-0.02em] text-[#0a0a0a]">XP</span>
    </span>
  );
}
