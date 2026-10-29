import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";
import { getViewer } from "@/lib/auth/viewer";
import { db } from "@/lib/db";
import { resolvePrivacy } from "@/lib/account/preferences";
import { PageHeader, TabLinks } from "@/components/PageHeader";
import { DataSection, LinkedAccounts, PasswordForm, PrivacyForm, ProfileForm, SessionsList } from "@/components/account/SettingsClient";

export const metadata: Metadata = { title: "Paramètres" };

const TABS = [
  { key: "profil", label: "Profil", href: "/parametres" },
  { key: "securite", label: "Sécurité", href: "/parametres?tab=securite" },
  { key: "comptes", label: "Comptes liés", href: "/parametres?tab=comptes" },
  { key: "confidentialite", label: "Confidentialité", href: "/parametres?tab=confidentialite" },
];

function device(ua: string | null) {
  if (!ua) return "Appareil inconnu";
  const os = /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Mac OS X/.test(ua) ? "macOS" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "Autre";
  const br = /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Navigateur";
  return `${br} · ${os}`;
}

export default async function ParametresPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/connexion?next=/parametres");
  const { tab: t } = await searchParams;
  const tab = TABS.some((x) => x.key === t) ? t! : "profil";
  const user = await db.user.findUniqueOrThrow({ where: { id: viewer.id }, include: { gameAccounts: true } });

  let content: React.ReactNode;
  if (tab === "profil") {
    content = <ProfileForm email={user.email} initial={{ pseudo: user.pseudo, bio: user.bio ?? "", region: user.region === "RE" ? "Île de La Réunion" : user.region, availability: user.availability }} />;
  } else if (tab === "securite") {
    const h = await headers();
    const [list, current] = await Promise.all([auth.api.listSessions({ headers: h }), auth.api.getSession({ headers: h })]);
    const fmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
    content = (
      <div className="grid items-start gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,360px),1fr))]">
        <PasswordForm />
        <SessionsList
          sessions={list
            .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt))
            .map((s) => ({ token: s.token, device: device(s.userAgent ?? null), when: `Dernière activité ${fmt.format(new Date(s.updatedAt))}`, current: s.token === current?.session.token }))}
        />
      </div>
    );
  } else if (tab === "comptes") {
    content = <LinkedAccounts links={Object.fromEntries(user.gameAccounts.map((g) => [g.game, { id: g.externalId, verified: !!g.verifiedAt }]))} />;
  } else {
    content = (
      <div className="grid items-start gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,360px),1fr))]">
        <PrivacyForm initial={resolvePrivacy(user.privacy)} />
        <DataSection />
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-[1100px] px-[clamp(16px,3vw,40px)] pt-7 pb-16">
      <PageHeader title="Paramètres" />
      <TabLinks tabs={TABS} active={tab} />
      <div className="mt-4">{content}</div>
    </main>
  );
}
