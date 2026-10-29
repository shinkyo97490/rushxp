import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/lib/db";

const vercelUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined;
const prodUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : undefined;

/**
 * Authentification e-mail + mot de passe (Better Auth, sessions en base).
 * Secret : BETTER_AUTH_SECRET (obligatoire en production).
 * L'URL est déduite de Vercel (production et prévisualisations) ou de BETTER_AUTH_URL.
 */
export const auth = betterAuth({
  appName: "RushXP",
  baseURL: process.env.BETTER_AUTH_URL ?? vercelUrl ?? "http://localhost:3000",
  trustedOrigins: [process.env.BETTER_AUTH_URL, vercelUrl, prodUrl, "http://localhost:3000"].filter((x): x is string => !!x),
  database: prismaAdapter(db, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    autoSignIn: true,
  },
  user: {
    fields: { name: "pseudo" },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
  },
  databaseHooks: {
    session: {
      create: {
        // Un compte suspendu ne peut pas ouvrir de session.
        before: async (session) => {
          const user = await db.user.findUnique({ where: { id: session.userId }, select: { status: true } });
          if (user?.status === "SUSPENDED") throw new APIError("FORBIDDEN", { message: "Compte suspendu." });
        },
      },
    },
  },
  plugins: [nextCookies()],
});
