import Link from "next/link";

export default function NotFound() {
  return (
    <main className="hero-pattern grid min-h-[60vh] place-items-center px-4 py-16 text-center">
      <div>
        <div className="font-display text-[clamp(96px,18vw,180px)] font-extrabold leading-[.9] text-orange">404</div>
        <h1 className="font-display mt-2 text-[34px] font-extrabold">Page introuvable</h1>
        <p className="mx-auto mt-2 max-w-md text-silver">Cette page n’existe pas ou a été déplacée.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link href="/" className="btn btn-primary">Retour à l’accueil</Link>
          <Link href="/rankings" className="btn btn-tertiary">RushXP Rankings</Link>
        </div>
      </div>
    </main>
  );
}
