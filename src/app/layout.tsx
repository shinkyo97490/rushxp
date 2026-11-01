import type { Metadata } from "next";
import { Barlow, JetBrains_Mono, Saira_Condensed } from "next/font/google";
import { DemoBar } from "@/components/DemoBar";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { getViewer } from "@/lib/auth/viewer";
import { pendingReceivedCount } from "@/lib/rankings/queries";
import { headers } from "next/headers";
import { getMaintenance } from "@/lib/site/settings";
import { MaintenancePage } from "@/components/MaintenancePage";
import { ToastProvider } from "@/components/ui/interactive";
import "./globals.css";

const saira = Saira_Condensed({ variable: "--font-saira", subsets: ["latin"], weight: ["500", "600", "700", "800"] });
const barlow = Barlow({ variable: "--font-barlow", subsets: ["latin"], weight: ["400", "500", "600", "700"] });
const jetbrains = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"], weight: ["400", "500"] });

export const metadata: Metadata = {
  title: { default: "RushXP · Esports à La Réunion", template: "%s · RushXP" },
  description: "Classement permanent multi-jeux, défis classés, rendez-vous mensuels et Playoffs à La Réunion.",
  icons: { icon: "/assets/rushxp-logo-sm.png" },
};

/** Pages accessibles pendant la maintenance (connexion des administrateurs). */
const MAINTENANCE_OPEN = ["/connexion", "/etat"];

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const viewer = await getViewer();
  const maintenance = await getMaintenance();
  const path = (await headers()).get("x-pathname") ?? "/";
  const blocked = maintenance.on && viewer?.role !== "admin" && !MAINTENANCE_OPEN.some((p) => path.startsWith(p));
  return (
    <html lang="fr" className={`${saira.variable} ${barlow.variable} ${jetbrains.variable}`}>
      <body className="min-h-screen flex flex-col">
        <ToastProvider>
          <DemoBar />
          <Header viewer={viewer} received={viewer ? await pendingReceivedCount(viewer).catch(() => 0) : 0} />
          {maintenance.on && viewer?.role === "admin" && (
            <div className="border-b border-red bg-[rgba(255,90,42,.1)] px-4 py-1.5 text-center text-xs text-red">Mode maintenance actif : le public voit la page de maintenance.</div>
          )}
          <div className="flex-1">{blocked ? <MaintenancePage message={maintenance.message} /> : children}</div>
          <Footer />
        </ToastProvider>
      </body>
    </html>
  );
}
