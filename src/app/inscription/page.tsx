import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth/viewer";
import { AuthShell } from "@/components/auth/AuthShell";
import { SignupWizard } from "@/components/auth/SignupWizard";

export const metadata: Metadata = { title: "Inscription" };

export default async function InscriptionPage() {
  const viewer = await getViewer();
  if (viewer?.onboarded) redirect("/");
  return (
    <AuthShell
      photo="/assets/photo-dsc07373.jpg"
      title="Rejoindre le circuit"
      subtitle="Inscription ouverte toute l’année. Vous entrez en placement avec un score provisoire dès que votre roster est complet."
    >
      {/* Compte déjà créé mais parcours non terminé : reprise à l'étape 2. */}
      <SignupWizard initialStep={viewer ? 1 : 0} initialPseudo={viewer?.pseudo} />
    </AuthShell>
  );
}
