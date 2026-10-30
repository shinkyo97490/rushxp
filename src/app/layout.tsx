import type { Metadata } from "next";
import { Barlow, JetBrains_Mono, Saira_Condensed } from "next/font/google";
import { DemoBar } from "@/components/DemoBar";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { getViewer } from "@/lib/auth/viewer";
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

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const viewer = await getViewer();
  return (
    <html lang="fr" className={`${saira.variable} ${barlow.variable} ${jetbrains.variable}`}>
      <body className="min-h-screen flex flex-col">
        <ToastProvider>
          <DemoBar />
          <Header viewer={viewer} />
          <div className="flex-1">{children}</div>
          <Footer />
        </ToastProvider>
      </body>
    </html>
  );
}
