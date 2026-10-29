import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getRole, isStaff } from "@/lib/session";

/**
 * Écrans du prototype pas encore développés (SPEC_METIER §4).
 * Chaque entrée sera remplacée par sa propre route au fil des lots.
 */
const SCREENS: Record<string, { title: string; key: string; points: string; lot: number }> = {
  mvp: { title: "Joueurs & MVP", key: "mvp", points: "Classement individuel (ne donne pas de points), succès XP.", lot: 3 },
  calendrier: { title: "Calendrier", key: "matches", points: "Défis confirmés, RDV mensuels et Playoffs groupés par jour. Filtres : Tout / Mes matchs / Défis / Playoffs.", lot: 2 },
  match: { title: "Match Center", key: "matchcenter", points: "Veto VAL / CDL, manches RL / Tekken, score FC, lobby TFT. Check-in, chat temps réel, preuves (OCR), diffusion.", lot: 2 },
  competitions: { title: "Compétitions", key: "competition", points: "Onglets selon la phase. Arbre et tirage quand ils existent.", lot: 3 },
  playoffs: { title: "Playoffs", key: "playoffs", points: "Arbre QF → finale, qualifiés, cashprize, dates.", lot: 3 },
  rdv: { title: "RDV mensuels", key: "events", points: "Inscription, format, barème, résultats par manche et par lobby (TFT, Warzone, Apex).", lot: 3 },
  actualites: { title: "Actualités", key: "feed", points: "Fil communautaire, publications des structures et des partenaires.", lot: 4 },
  recrutement: { title: "Équipe & recrutement", key: "team", points: "Rosters (plusieurs équipes par jeu), invitations, annonces, mercato de juin.", lot: 2 },
  partenaires: { title: "Partenaires", key: "partners", points: "Partenaires, campagnes, formulaire « Devenir partenaire ».", lot: 4 },
  "le-circuit": { title: "Le circuit", key: "guide", points: "Guide : saison, jeux, défis, divisions, Playoffs.", lot: 4 },
  reglement: { title: "Règlement", key: "rules", points: "Règles générales et propres à chaque jeu, versionnées.", lot: 4 },
  profil: { title: "Profil joueur", key: "player", points: "Structure et équipe, statistiques propres au jeu, forme, parcours, comptes liés.", lot: 3 },
  structure: { title: "Profil structure", key: "structure", points: "Bannière, KPI, points par jeu, progression, palmarès, rosters, historique des points.", lot: 3 },
  messages: { title: "Messages", key: "messages", points: "Messagerie temps réel, signalement.", lot: 4 },
  notifications: { title: "Notifications", key: "notifications", points: "Liste, préférences site / e-mail.", lot: 4 },
  parametres: { title: "Paramètres", key: "settings", points: "Profil, sécurité (2FA, sessions), comptes liés, confidentialité.", lot: 4 },
  arbitrage: { title: "Espace arbitre", key: "referee", points: "File priorisée, preuve, comparaison des valeurs, décision motivée.", lot: 3 },
  admin: { title: "Administration", key: "admin", points: "Navigation latérale, saisie des RDV, paramètres Rankings, barèmes, audit.", lot: 3 },
};

export async function generateMetadata({ params }: { params: Promise<{ slug: string[] }> }): Promise<Metadata> {
  const { slug } = await params;
  return { title: SCREENS[slug[0]]?.title ?? "Page introuvable" };
}

export default async function Upcoming({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const s = SCREENS[slug[0]];
  if (!s) notFound();
  // Outils d'équipe : invisibles pour les autres rôles (contrôle serveur, pas seulement masquage).
  if ((slug[0] === "admin" || slug[0] === "arbitrage") && !isStaff(await getRole())) notFound();
  if (slug[0] === "admin" && (await getRole()) !== "admin") notFound();
  return (
    <main className="container-rx pt-7 pb-16">
      <div className="text-[13px] font-semibold uppercase tracking-[.14em] text-grey">Écran en cours de développement · lot {s.lot}</div>
      <h1 className="font-display mt-1 text-[clamp(40px,6vw,56px)] font-extrabold leading-none">{s.title}</h1>
      <div className="card hero-pattern mt-6 max-w-3xl">
        <div className="card-head">
          <span className="card-title">Contenu prévu</span>
          <span className="card-meta font-mono">page : {s.key}</span>
        </div>
        <p className="px-[18px] py-4 text-sm leading-relaxed text-silver">{s.points}</p>
        <div className="flex flex-wrap gap-2 border-t border-line px-[18px] py-3">
          <Link href="/rankings/defis" className="btn btn-primary btn-sm">Centre des défis</Link>
          <Link href="/" className="btn btn-tertiary btn-sm">Retour à l’accueil</Link>
        </div>
      </div>
    </main>
  );
}
