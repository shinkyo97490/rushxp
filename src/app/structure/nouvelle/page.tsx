import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth/viewer";
import { StructureWizard } from "@/components/structure/StructureWizard";

export const metadata: Metadata = { title: "Créer une structure" };

export default async function NewStructurePage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/connexion?next=/structure/nouvelle");
  return (
    <main className="mx-auto max-w-[1100px] px-[clamp(16px,3vw,40px)] pt-7 pb-16">
      <h1 className="font-display text-[clamp(40px,6vw,52px)] font-extrabold leading-none">Créer une structure</h1>
      <p className="mt-2 max-w-[680px] text-[15px] text-silver">
        Une structure regroupe vos rosters sur plusieurs jeux et cumule leurs points au classement général. Elle est vérifiée par l’équipe RushXP avant publication.
      </p>
      {viewer.structure ? (
        <div className="card mt-6 max-w-2xl p-[18px] text-sm text-silver">
          Vous gérez déjà <strong className="text-ink">{viewer.structure.name}</strong>
          {viewer.structure.status === "PENDING" ? " (en cours de vérification)" : ""}. Une seule structure par gestionnaire.{" "}
          <Link href="/recrutement">Gérer ma structure →</Link>
        </div>
      ) : (
        <StructureWizard />
      )}
    </main>
  );
}
