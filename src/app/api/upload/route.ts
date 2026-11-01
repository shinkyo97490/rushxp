import { NextResponse, type NextRequest } from "next/server";
import { getViewer } from "@/lib/auth/viewer";
import { integrations, isUploadedUrl } from "@/lib/integrations";

const TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
const MAX = 4 * 1024 * 1024;

/** Envoi d'une image (logo, affiche, visuel, capture). Membres connectés ; 4 Mo, PNG / JPEG / WebP. */
export async function POST(req: NextRequest) {
  const v = await getViewer();
  if (!v) return NextResponse.json({ error: "Connectez-vous." }, { status: 401 });
  if (!process.env.BLOB_READ_WRITE_TOKEN) return NextResponse.json({ error: "Stockage des images pas encore configuré : indiquez un chemin /assets/… ou un lien https://." }, { status: 503 });
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Aucun fichier." }, { status: 400 });
  const ext = TYPES[file.type];
  if (!ext) return NextResponse.json({ error: "Format accepté : PNG, JPEG ou WebP." }, { status: 400 });
  if (file.size > MAX) return NextResponse.json({ error: "Image trop lourde (4 Mo maximum)." }, { status: 400 });
  const folder = String(form?.get("folder") ?? "medias").replace(/[^a-z-]/g, "").slice(0, 20) || "medias";
  const { url } = await integrations.storage.put(`${folder}/${v.id}.${ext}`, await file.arrayBuffer(), file.type);
  if (!isUploadedUrl(url)) return NextResponse.json({ error: "Envoi impossible." }, { status: 500 });
  return NextResponse.json({ url });
}
