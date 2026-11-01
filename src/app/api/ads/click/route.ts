import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";

/** Clic sur une publicité : compté, puis redirection vers le lien de la campagne. */
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("c") ?? "";
  const c = await db.adCampaign.findUnique({ where: { id } });
  if (!c) return NextResponse.redirect(new URL("/partenaires", req.nextUrl));
  await db.adCampaign.update({ where: { id }, data: { clicks: { increment: 1 } } });
  const target = c.link.startsWith("/") ? new URL(c.link, req.nextUrl) : /^https:\/\//.test(c.link) ? new URL(c.link) : new URL("/partenaires", req.nextUrl);
  return NextResponse.redirect(target);
}
