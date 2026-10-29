import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth/viewer";

export default async function MonProfil() {
  const v = await getViewer();
  redirect(v ? `/joueur/${encodeURIComponent(v.pseudo)}` : "/connexion?next=/profil");
}
