import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth/viewer";
import { AuthShell } from "@/components/auth/AuthShell";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata: Metadata = { title: "Connexion" };

export default async function ConnexionPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (await getViewer()) redirect("/");
  const { next } = await searchParams;
  return (
    <AuthShell
      photo="/assets/photo-dsc06369.jpg"
      title={
        <>
          Entre dans
          <br />
          la <span className="text-orange">ligue.</span>
        </>
      }
    >
      <LoginForm next={next} />
    </AuthShell>
  );
}
