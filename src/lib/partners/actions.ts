"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { toFieldErrors, type FieldErrors } from "@/lib/validation";

export type LeadResult = { ok: true } | { ok: false; errors: FieldErrors };

const GOALS = ["Visibilité de marque", "Sponsoring d’une compétition", "Partenariat d’une structure", "Événement / LAN"] as const;

/** Demande « Devenir partenaire » (formulaire public). Le champ `website` est un piège à robots. */
export async function submitLeadAction(input: unknown): Promise<LeadResult> {
  const p = z
    .object({
      company: z.string().trim().min(2, "Indiquez l’entreprise.").max(100),
      email: z.string().trim().toLowerCase().email("E-mail professionnel invalide."),
      goal: z.enum(GOALS),
      message: z.string().trim().max(1500, "1 500 caractères maximum.").optional().default(""),
      website: z.string().max(0).optional(),
    })
    .safeParse(input);
  if (!p.success) return { ok: false, errors: toFieldErrors(p.error) };
  const recent = await db.partnerLead.count({ where: { email: p.data.email, createdAt: { gt: new Date(Date.now() - 86_400_000) } } });
  if (recent >= 3) return { ok: false, errors: { _: "Demande déjà reçue : l’équipe vous répond sous 48 h." } };
  await db.partnerLead.create({ data: { company: p.data.company, email: p.data.email, goal: p.data.goal, message: p.data.message || null } });
  return { ok: true };
}
