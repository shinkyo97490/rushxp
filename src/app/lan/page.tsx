import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getViewer } from "@/lib/auth/viewer";
import { getGame } from "@/lib/data/games";
import { LAN_SCALE_PREVIEW, lanPoints } from "@/lib/rules/scales";
import { countdownTo, euros, getLan, isSoloGame, LAN_STATUS, lanDates, lanOptionsFor, lanPointsFor, listLans, parseProgram, paymentMode, seatsTaken, SERVICE_FEE_CENTS } from "@/lib/lan/queries";
import { Badge, EmptyState, LinkButton } from "@/components/ui";
import { LanRegistration, type LanTour } from "@/components/lan/LanRegistration";

export const metadata: Metadata = { title: "LAN & événements", description: "LAN physiques à La Réunion : tournois, tarifs, inscriptions et points au classement général des structures." };

const TABS = [
  ["info", "Infos"],
  ["tour", "Tournois & tarifs"],
  ["reg", "Inscrits"],
  ["res", "Résultats"],
  ["form", "Inscription"],
] as const;
type Tab = (typeof TABS)[number][0];

const fmtDay = (d: Date) => new Intl.DateTimeFormat("fr-FR", { timeZone: "Indian/Reunion", day: "numeric", month: "long" }).format(d);

export default async function LanPage({ searchParams }: { searchParams: Promise<{ e?: string; tab?: string; ok?: string; t?: string }> }) {
  const sp = await searchParams;
  const viewer = await getViewer();
  const isAdmin = viewer?.role === "admin";
  const lans = await listLans(isAdmin);
  const slug = sp.e ?? lans[0]?.slug;
  const lan = slug ? await getLan(slug) : null;
  if (sp.e && (!lan || (lan.status === "DRAFT" && !isAdmin))) notFound();

  if (!lan)
    return (
      <main className="container-rx pt-10 pb-16">
        <h1 className="font-display text-[clamp(44px,7vw,72px)] font-extrabold leading-none">LAN & événements</h1>
        <div className="card mt-6">
          <EmptyState action={<LinkButton href="/actualites" variant="secondary" size="sm">Suivre les actualités</LinkButton>}>
            Aucun événement annoncé pour le moment. Les prochaines LAN sont publiées ici dès leur annonce par les associations partenaires.
          </EmptyState>
        </div>
      </main>
    );

  const st = LAN_STATUS[lan.status];
  const open = lan.status === "OPEN";
  const tabs = TABS.filter(([k]) => k !== "form" || open || !!sp.ok);
  const tab: Tab = tabs.some(([k]) => k === sp.tab) ? (sp.tab as Tab) : lan.status === "DONE" ? "res" : "info";
  const href = (t: Tab, e = lan.slug) => `/lan?e=${e}&tab=${t}`;
  const program = parseProgram(lan.program);
  const countdown = open && lan.startsAt ? countdownTo(lan.startsAt) : null;
  const points = lan.status === "DONE" ? await lanPointsFor(lan) : [];
  const options = viewer && tab === "form" ? await lanOptionsFor(viewer.id) : [];

  const tours: LanTour[] = lan.tournaments.map((t) => {
    const g = getGame(t.game);
    const taken = seatsTaken(t);
    const solo = isSoloGame(t.game);
    const mine = viewer ? t.registrations.find((r) => r.createdById === viewer.id || r.members.includes(viewer.id)) : undefined;
    return {
      id: t.id,
      game: t.game,
      name: g?.name ?? t.game,
      logo: g?.logo ?? "",
      format: t.format,
      day: t.day ?? "",
      priceCents: t.priceCents,
      price: t.priceCents == null ? "Tarif à venir" : euros(t.priceCents),
      unit: solo ? "par joueur" : "par équipe",
      solo,
      rosterSize: g?.rosterSize ?? 1,
      seats: `${taken} / ${t.capacity} ${solo ? "joueurs" : "équipes"}`,
      fill: Math.min(100, (taken / t.capacity) * 100),
      left: taken >= t.capacity ? "Complet" : `${t.capacity - taken} places`,
      full: taken >= t.capacity,
      mine: mine ? { id: mine.id, name: mine.name, status: mine.status, order: mine.order } : null,
    };
  });

  const okReg = sp.ok ? lan.tournaments.flatMap((t) => t.registrations.map((r) => ({ ...r, game: t.game }))).find((r) => r.id === sp.ok && r.createdById === viewer?.id) : undefined;

  return (
    <main className="pb-16">
      <section className="relative overflow-hidden border-b border-line bg-black">
        <Image src={lan.posterUrl || "/assets/photo-dsc05885.jpg"} alt="" fill priority className="object-cover opacity-50" sizes="100vw" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,#000_20%,rgba(0,0,0,.45))]" />
        <div className="container-rx relative flex flex-wrap items-end justify-between gap-6 py-12">
          <div className="max-w-[720px]">
            <div className="flex flex-wrap gap-2">
              <Badge tone={st.tone === "orange" ? "solid" : st.tone}>{st.label}</Badge>
              {lan.countsForGeneral && <Badge tone="orange">Compte au classement général</Badge>}
              <span className="self-center text-[13px] text-silver">LAN physique · organisé par {lan.organizer}</span>
            </div>
            <h1 className="font-display mt-3 text-[clamp(48px,8vw,84px)] font-extrabold leading-[.9]">{lan.name}</h1>
            <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-[15px]">
              {[["Dates", lanDates(lan.startsAt, lan.endsAt)], ["Lieu", lan.place], ["Tournois", lan.tournaments.length ? `${lan.tournaments.length} jeu${lan.tournaments.length > 1 ? "x" : ""}` : "À annoncer"]].map(([k, v]) => (
                <div key={k} className="flex gap-2"><dt className="overline self-center">{k}</dt><dd>{v}</dd></div>
              ))}
            </dl>
          </div>
          {countdown && (
            <div className="grid gap-3">
              <div className="flex gap-2" aria-label="Compte à rebours">
                {countdown.map(([k, n]) => (
                  <div key={k} className="min-w-[72px] border border-line bg-black/70 px-3 py-2 text-center">
                    <div className="font-display text-4xl font-extrabold leading-none">{String(n).padStart(2, "0")}</div>
                    <div className="text-[11px] uppercase tracking-[.08em] text-grey">{k}</div>
                  </div>
                ))}
              </div>
              <LinkButton href={href("form")}>S’inscrire à la LAN</LinkButton>
            </div>
          )}
        </div>
      </section>

      <div className="container-rx mt-5 grid grid-cols-[minmax(0,1fr)] gap-4">
        {lans.length > 1 && (
          <nav className="flex gap-2 overflow-x-auto pb-1" aria-label="Événements">
            {lans.map((e) => (
              <Link
                key={e.id}
                href={href(e.status === "DONE" ? "res" : "info", e.slug)}
                aria-current={e.id === lan.id ? "page" : undefined}
                className={`grid min-w-[230px] gap-0.5 border px-3.5 py-2.5 text-ink hover:text-ink ${e.id === lan.id ? "border-orange bg-surface-2" : "border-line bg-surface hover:border-[#5a5a5a]"}`}
              >
                <span className={`text-[11px] font-bold uppercase tracking-[.06em] ${e.status === "OPEN" ? "text-orange" : e.status === "ANNOUNCED" ? "text-yellow" : "text-grey"}`}>
                  {e.status === "OPEN" ? "Inscriptions ouvertes" : e.status === "ANNOUNCED" ? "Annoncé" : e.status === "DONE" ? "Terminée" : LAN_STATUS[e.status].label} · {e.organizer}
                </span>
                <span className="font-display text-lg font-bold leading-tight">{e.name}</span>
                <span className="text-xs text-grey">{lanDates(e.startsAt, e.endsAt)} · {e.place}</span>
              </Link>
            ))}
          </nav>
        )}

        <div className="flex gap-0.5 overflow-x-auto border-b border-line" role="tablist">
          {tabs.map(([k, l]) => (
            <Link key={k} href={href(k)} className="tab !h-11 !px-4" aria-current={k === tab ? "page" : undefined}>{l}</Link>
          ))}
        </div>

        {tab === "info" && (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <div className="grid content-start gap-4">
              <section className="card">
                <div className="card-head"><span className="card-title">L’événement</span></div>
                <p className="whitespace-pre-line px-[18px] py-4 text-[15px] text-silver">{lan.description || "Présentation à venir."}</p>
              </section>
              <section className="card">
                <div className="card-head"><span className="card-title">Programme</span></div>
                {program.length === 0 ? (
                  <p className="px-[18px] py-4 text-sm text-grey">Programme annoncé prochainement par l’organisateur.</p>
                ) : (
                  program.map((d) => (
                    <div key={d.day} className="border-b border-surface-2 px-[18px] py-3 last:border-b-0">
                      <div className="overline mb-1.5">{d.day}</div>
                      {d.items.map(([t, l]) => (
                        <div key={t + l} className="flex gap-4 py-1 text-sm"><span className="w-12 font-mono text-orange">{t}</span><span>{l}</span></div>
                      ))}
                    </div>
                  ))
                )}
              </section>
            </div>
            <div className="grid content-start gap-4">
              <section className="card">
                <div className="card-head"><span className="card-title">Points au classement général</span><span className="card-meta">Par jeu · meilleur classement de la structure</span></div>
                <div className="grid grid-cols-3 sm:grid-cols-6">
                  {LAN_SCALE_PREVIEW.map(([k, v], i) => (
                    <div key={k} className="border-r border-b border-surface-2 px-2 py-3 text-center">
                      <div className="text-xs text-grey">{k}</div>
                      <div className={`font-display text-2xl font-extrabold ${i === 0 ? "text-yellow" : ""}`}>{v}</div>
                    </div>
                  ))}
                </div>
                <p className="px-[18px] py-3 text-[13px] text-silver">
                  Barème des Rankings + 50 points. Les résultats sont saisis sur place par les arbitres RushXP, validés à la fin de l’événement, puis ajoutés au classement général des structures. Un joueur solo rapporte ses points à sa structure.
                </p>
              </section>
              <section className="card">
                <div className="card-head"><span className="card-title">Infos pratiques</span></div>
                <dl className="grid">
                  {[
                    ["Lieu", lan.place],
                    ["Accueil", "Pièce d’identité et billet au check-in"],
                    ["Mineurs", "Autorisation parentale obligatoire"],
                    ...(lan.visitorPassCents != null ? [["Visiteurs", `Pass visiteur ${euros(lan.visitorPassCents)} / jour`]] : []),
                    ...(lan.refundUntil ? [["Remboursement", `Jusqu’au ${fmtDay(lan.refundUntil)}`]] : []),
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-4 border-b border-surface-2 px-[18px] py-2.5 text-sm last:border-b-0"><dt className="text-grey">{k}</dt><dd className="text-right">{v}</dd></div>
                  ))}
                </dl>
              </section>
              <section className="card flex items-center gap-3 px-[18px] py-3.5">
                <span className="clip-corner-sm grid h-11 w-11 flex-none place-items-center bg-surface-2 font-mono text-[10px] text-grey">logo</span>
                <div><div className="overline">Organisateur</div><div className="font-semibold">{lan.organizer}</div><div className="text-xs text-grey">Association partenaire de RushXP</div></div>
              </section>
            </div>
          </div>
        )}

        {tab === "tour" && (
          <>
            {tours.length === 0 ? (
              <div className="card"><EmptyState>Les tournois et tarifs de cet événement seront annoncés par l’organisateur.</EmptyState></div>
            ) : (
              <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr))]">
                {tours.map((t) => (
                  <section key={t.id} className="card grid content-start">
                    <div className="flex items-center gap-3 border-b border-line px-[18px] py-3.5">
                      <Image src={t.logo} alt="" width={48} height={32} className="h-8 w-12 object-contain" />
                      <div><div className="font-display text-xl font-bold leading-tight">{t.name}</div><div className="text-xs text-grey">{t.format}</div></div>
                    </div>
                    <div className="grid gap-3 px-[18px] py-3.5">
                      <div className="flex items-baseline gap-1.5"><span className="font-display text-3xl font-extrabold text-yellow">{t.price}</span><span className="text-xs text-grey">{t.priceCents != null ? t.unit : ""}</span></div>
                      <div>
                        <div className="flex justify-between text-xs"><span>{t.seats}</span><span className={t.full ? "text-red" : "text-grey"}>{t.left}</span></div>
                        <div className="mt-1 h-1.5 bg-surface-2"><div className="h-full bg-orange" style={{ width: `${t.fill}%` }} /></div>
                      </div>
                      {t.day && <div className="text-xs text-silver">{t.day}</div>}
                      {t.mine?.status === "PAID" && <div className="text-sm text-orange">✓ Inscrit · {t.mine.name}</div>}
                      {open && !t.mine && !t.full && t.priceCents != null && <LinkButton href={`${href("form")}&t=${t.id}`} size="sm" variant="secondary">S’inscrire</LinkButton>}
                    </div>
                  </section>
                ))}
              </div>
            )}
            {lan.visitorPassCents != null && <p className="text-xs text-grey">Le pass visiteur ({euros(lan.visitorPassCents)} / jour) se prend sur place. Frais de service en ligne : {euros(SERVICE_FEE_CENTS)} par inscription.</p>}
          </>
        )}

        {tab === "reg" && (
          <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr))]">
            {tours.length === 0 && <div className="card"><EmptyState>Aucun tournoi annoncé.</EmptyState></div>}
            {lan.tournaments.map((t, i) => (
              <section key={t.id} className="card">
                <div className="card-head">
                  <span className="card-title flex items-center gap-2"><Image src={tours[i].logo} alt="" width={30} height={20} className="h-5 w-7 object-contain" />{tours[i].name}</span>
                  <span className="card-meta">{tours[i].seats}</span>
                </div>
                {t.registrations.length === 0 ? (
                  <p className="px-[18px] py-4 text-sm text-grey">Aucun inscrit pour le moment.</p>
                ) : (
                  <ul>
                    {t.registrations.map((r) => (
                      <li key={r.id} className={`flex items-center justify-between gap-3 border-b border-surface-2 px-[18px] py-2 text-sm last:border-b-0 ${r.createdById === viewer?.id ? "bg-active-tint" : ""}`}>
                        <span className="min-w-0 truncate">{r.name}{r.createdById === viewer?.id && <span className="text-grey"> · vous</span>}</span>
                        <span className={`flex-none text-xs ${r.status === "PAID" ? "text-grey" : "text-orange"}`}>{r.status === "PAID" ? "Payé" : "Paiement en attente"}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>
        )}

        {tab === "res" &&
          (lan.status !== "DONE" ? (
            <div className="card">
              <EmptyState action={lans.find((e) => e.status === "DONE") ? <LinkButton href={href("res", lans.find((e) => e.status === "DONE")!.slug)} size="sm" variant="secondary">Voir les derniers résultats</LinkButton> : undefined}>
                Résultats publiés après l’événement. Les arbitres saisissent les résultats sur place ; ils deviennent officiels à la validation finale, puis les points sont ajoutés au classement général des structures.
              </EmptyState>
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
              <div className="grid content-start gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr))]">
                {lan.tournaments.map((t, i) => (
                  <section key={t.id} className="card">
                    <div className="card-head">
                      <span className="card-title flex items-center gap-2"><Image src={tours[i].logo} alt="" width={30} height={20} className="h-5 w-7 object-contain" />{tours[i].name}</span>
                      <Badge tone="muted">Validé</Badge>
                    </div>
                    {t.results.length === 0 && <p className="px-[18px] py-3 text-sm text-grey">Aucun participant classé.</p>}
                    {t.results.map((r) => (
                      <div key={r.place} className="flex items-center gap-3 border-b border-surface-2 px-[18px] py-2 text-sm last:border-b-0">
                        <span className={`grid h-7 w-7 flex-none place-items-center border font-display font-bold ${r.place === 1 ? "border-yellow bg-yellow text-bg" : "border-line"}`}>{r.place}</span>
                        <span className="min-w-0 flex-1 truncate">{r.name}</span>
                        <span className="font-display font-bold text-orange">{r.structureId ? `+${lanPoints(r.place)}` : ""}</span>
                      </div>
                    ))}
                  </section>
                ))}
              </div>
              <section className="card content-start">
                <div className="card-head"><span className="card-title">Points ajoutés au classement général</span><Link href="/classement" className="text-[13px]">Voir le classement →</Link></div>
                {points.length === 0 ? (
                  <p className="px-[18px] py-4 text-sm text-grey">Aucune structure classée.</p>
                ) : (
                  points.map((p) => (
                    <div key={p.structure} className="flex items-center justify-between gap-3 border-b border-surface-2 px-[18px] py-2 text-sm last:border-b-0">
                      <span className="min-w-0">
                        {p.tag ? <Link href={`/structure/${p.tag}`} className="text-ink">{p.name}</Link> : p.name}
                        <span className="text-xs text-grey"> · {Object.entries(p.byGame).map(([g, v]) => `${getGame(g)?.short ?? g} ${v}`).join(" · ")}</span>
                      </span>
                      <span className="font-display text-lg font-bold text-orange">+{p.points}</span>
                    </div>
                  ))
                )}
              </section>
            </div>
          ))}

        {tab === "form" && (
          <LanRegistration
            key={sp.ok ?? "form"}
            lanName={lan.name}
            tours={tours.filter((t) => t.priceCents != null)}
            options={options}
            signedIn={!!viewer}
            pseudo={viewer?.pseudo ?? ""}
            club={viewer?.club?.name ?? null}
            payment={paymentMode()}
            refundUntil={lan.refundUntil ? fmtDay(lan.refundUntil) : null}
            initialTour={sp.t}
            serviceCents={SERVICE_FEE_CENTS}
            confirmed={okReg ? { id: okReg.id, tournamentId: okReg.tournamentId, name: okReg.name, game: getGame(okReg.game)?.name ?? okReg.game, order: okReg.order, paid: okReg.status === "PAID", amount: euros(okReg.amountCents) } : null}
          />
        )}
      </div>
    </main>
  );
}
