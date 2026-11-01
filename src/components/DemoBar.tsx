export function DemoBar() {
  return (
    <div className="bg-black border-b border-line text-xs text-silver">
      <div className="container-rx flex items-center gap-x-3 gap-y-2 py-1.5 sm:gap-x-5">
        <span className="font-mono text-[11px] tracking-[.08em] bg-silver text-bg px-1.5 py-0.5">BÊTA</span>
        <span className="min-w-0 truncate sm:hidden">Version bêta : signalez un problème dans Paramètres.</span>
        <span className="hidden sm:inline">Première saison en ligne : signalez tout problème depuis la page Paramètres ou par message à l’équipe RushXP.</span>
      </div>
    </div>
  );
}
