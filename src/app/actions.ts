"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { ROLES, ROLE_COOKIE, type Role } from "@/lib/session-shared";

/** Démonstration uniquement : change le rôle simulé. */
export async function setDemoRole(role: Role) {
  if (!(ROLES as readonly string[]).includes(role)) return;
  (await cookies()).set(ROLE_COOKIE, role, { path: "/", sameSite: "lax" });
  revalidatePath("/", "layout");
}
