import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getViewer } from "@/lib/auth/viewer";
import { PageHeader } from "@/components/PageHeader";
import { Composer } from "@/components/feed/FeedClient";

export const metadata: Metadata = { title: "Nouvelle publication" };

export default async function NouvellePublication() {
  const v = await getViewer();
  if (!v) redirect("/connexion?next=/actualites/nouvelle");
  const official = v.role === "admin";
  if (!official && v.structure?.status !== "VERIFIED") notFound();
  return (
    <main className="mx-auto max-w-[1100px] px-[clamp(16px,3vw,40px)] pt-7 pb-16">
      <PageHeader title="Nouvelle publication">
        {official ? "Publication officielle RushXP, visible par tous." : `Actualité de ${v.structure!.name}, visible dans le fil et sur votre page.`}
      </PageHeader>
      <div className="mt-5">
        <Composer official={official} structureName={v.structure?.name ?? null} />
      </div>
    </main>
  );
}
