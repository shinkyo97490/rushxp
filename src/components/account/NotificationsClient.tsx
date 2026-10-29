"use client";

import Link from "next/link";
import { useState } from "react";
import { markAllReadAction, markReadAction, updateNotifPrefsAction } from "@/lib/account/actions";
import { NOTIF_CATEGORIES, type NotifPrefs } from "@/lib/account/preferences";
import { FormError } from "@/components/forms";
import { useServerAction } from "@/components/useServerAction";

export interface NotificationView {
  id: string;
  category: string;
  categoryLabel: string;
  text: string;
  link: string | null;
  time: string;
  unread: boolean;
}

export function MarkAllRead({ disabled }: { disabled: boolean }) {
  const a = useServerAction(markAllReadAction);
  return (
    <button className="btn btn-tertiary" disabled={disabled || a.pending} onClick={() => a.run()}>
      Tout marquer comme lu
    </button>
  );
}

export function NotificationList({ items }: { items: NotificationView[] }) {
  const a = useServerAction(markReadAction);
  return (
    <>
      {items.map((n) => (
        <div key={n.id} className={`flex flex-wrap items-center gap-3 border-b border-surface-2 px-[18px] py-3 ${n.unread ? "bg-active-tint" : ""}`}>
          <span className={`h-1.5 w-1.5 flex-none ${n.unread ? "bg-orange" : "bg-transparent"}`} aria-hidden />
          <span className="badge w-[110px] text-center text-silver">{n.categoryLabel}</span>
          <span className="min-w-0 flex-[1_1_240px]">
            <span className={`block text-sm ${n.unread ? "font-semibold" : "text-silver"}`}>{n.text}</span>
            <span className="block text-xs text-grey">
              {n.time}
              {n.unread ? " · non lue" : ""}
            </span>
          </span>
          {n.link ? (
            <Link href={n.link} onClick={() => n.unread && a.run(n.id)} className="btn btn-secondary btn-sm">Voir</Link>
          ) : n.unread ? (
            <button className="btn btn-tertiary btn-sm" onClick={() => a.run(n.id)} disabled={a.pending}>Marquer comme lue</button>
          ) : null}
        </div>
      ))}
    </>
  );
}

export function NotifPrefsForm({ initial }: { initial: NotifPrefs }) {
  const [prefs, setPrefs] = useState(initial);
  const a = useServerAction(updateNotifPrefsAction);
  const toggle = (k: string, ch: "site" | "email") => setPrefs({ ...prefs, [k]: { ...prefs[k], [ch]: !prefs[k][ch] } });
  const Switch = ({ on, onClick, disabled, label }: { on: boolean; onClick: () => void; disabled?: boolean; label: string }) => (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`flex h-[22px] w-10 cursor-pointer items-center border p-0.5 transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-45 ${on ? "justify-end border-orange bg-orange" : "justify-start border-line bg-bg"}`}
    >
      <span className={`h-4 w-4 ${on ? "bg-bg" : "bg-[#5a5a5a]"}`} />
    </button>
  );
  return (
    <section className="card">
      <div className="card-head"><span className="card-title">Préférences</span></div>
      <div className="grid grid-cols-[minmax(0,1fr)_56px_56px] gap-2 px-[18px] pt-3 pb-1 overline !font-normal">
        <span>Catégorie</span><span className="text-center">Site</span><span className="text-center">E-mail</span>
      </div>
      {NOTIF_CATEGORIES.map((c) => (
        <div key={c.key} className="grid grid-cols-[minmax(0,1fr)_56px_56px] items-center gap-2 border-b border-surface-2 px-[18px] py-2.5 text-[13px]">
          <span>{c.label}</span>
          <span className="grid place-items-center"><Switch on={prefs[c.key].site} disabled={c.locked} onClick={() => toggle(c.key, "site")} label={`${c.label} sur le site`} /></span>
          <span className="grid place-items-center"><Switch on={prefs[c.key].email} onClick={() => toggle(c.key, "email")} label={`${c.label} par e-mail`} /></span>
        </div>
      ))}
      <div className="grid gap-2 px-[18px] py-3">
        <FormError message={a.errors._} />
        <span className="text-xs text-grey">Les notifications de match et de compte restent toujours actives sur le site. L’envoi d’e-mails sera activé avec le service d’envoi.</span>
        <div className="flex items-center gap-3">
          <button className="btn btn-primary btn-sm" disabled={a.pending} onClick={() => a.run(prefs)}>Enregistrer</button>
          {a.message && <span className="text-[13px] text-orange">{a.message}</span>}
        </div>
      </div>
    </section>
  );
}
