import Link from "next/link";
import { SYSTEM_STATES } from "@/lib/data/content";
import { Logo } from "@/components/Logo";

/** Page affichée au public quand le mode maintenance est actif (message réglé dans l'administration). */
export function MaintenancePage({ message }: { message: string }) {
  const s = SYSTEM_STATES.maintenance;
  return (
    <main className="hero-pattern grid min-h-[70vh] place-items-center px-4 py-16 text-center">
      <div className="grid max-w-[560px] justify-items-center gap-3">
        <Logo size={34} />
        <span className="font-display text-[72px] font-extrabold leading-none text-yellow">{s.code}</span>
        <h1 className="font-display text-[40px] font-extrabold leading-none">{s.title}</h1>
        <p className="text-[15px] text-silver">{message || s.text}</p>
        <Link href="/connexion" className="btn btn-tertiary mt-3">Connexion administrateur</Link>
      </div>
    </main>
  );
}
