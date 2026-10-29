import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getViewer } from "@/lib/auth/viewer";
import { NOTIF_CATEGORIES, NOTIF_LABEL, resolvePrefs } from "@/lib/account/preferences";
import { Empty, PageHeader } from "@/components/PageHeader";
import { MarkAllRead, NotificationList, NotifPrefsForm } from "@/components/account/NotificationsClient";

export const metadata: Metadata = { title: "Notifications" };

function ago(d: Date) {
  const m = Math.round((Date.now() - d.getTime()) / 60000);
  if (m < 1) return "à l’instant";
  if (m < 60) return `il y a ${m} min`;
  if (m < 1440) return `il y a ${Math.round(m / 60)} h`;
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(d);
}

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<{ cat?: string }> }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/connexion?next=/notifications");
  const { cat } = await searchParams;
  const user = await db.user.findUniqueOrThrow({ where: { id: viewer.id }, select: { notifPrefs: true } });
  const prefs = resolvePrefs(user.notifPrefs);
  const visibleCats = NOTIF_CATEGORIES.filter((c) => prefs[c.key].site).map((c) => c.key);
  const all = await db.notification.findMany({ where: { userId: viewer.id, category: { in: visibleCats } }, orderBy: { createdAt: "desc" }, take: 100 });
  const shown = cat === "non-lues" ? all.filter((n) => !n.readAt) : cat ? all.filter((n) => n.category === cat) : all;
  const unread = all.filter((n) => !n.readAt).length;
  const filters = [
    { k: undefined, l: "Toutes", n: all.length },
    { k: "non-lues", l: "Non lues", n: unread },
    ...NOTIF_CATEGORIES.filter((c) => all.some((n) => n.category === c.key)).map((c) => ({ k: c.key, l: NOTIF_LABEL[c.key], n: all.filter((n) => n.category === c.key).length })),
  ];

  return (
    <main className="mx-auto max-w-[1100px] px-[clamp(16px,3vw,40px)] pt-7 pb-16">
      <PageHeader title="Notifications" actions={<MarkAllRead disabled={unread === 0} />} />
      <div className="mt-4 flex flex-wrap gap-1.5">
        {filters.map((f) => (
          <Link key={f.l} href={f.k ? `/notifications?cat=${f.k}` : "/notifications"} className={`btn btn-sm ${cat === f.k ? "btn-secondary" : "btn-tertiary"}`}>
            {f.l} · {f.n}
          </Link>
        ))}
      </div>
      <div className="mt-4 grid items-start gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr))] lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="card min-w-0">
          <NotificationList
            items={shown.map((n) => ({ id: n.id, category: n.category, categoryLabel: NOTIF_LABEL[n.category] ?? n.category, text: n.text, link: n.link, time: ago(n.createdAt), unread: !n.readAt }))}
          />
          {shown.length === 0 && <Empty>Aucune notification dans cette catégorie.</Empty>}
        </section>
        <div className="grid gap-4">
          <NotifPrefsForm initial={prefs} />
          <Link href="/parametres" className="text-[13px] font-semibold">Paramètres du compte →</Link>
        </div>
      </div>
    </main>
  );
}
