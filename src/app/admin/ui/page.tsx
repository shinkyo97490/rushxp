import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getViewer } from "@/lib/auth/viewer";
import { AdSlot, Alert, Badge, Button, Card, EmptyState, ErrorState, LinkButton, PostCard, ProgressSteps, Skeleton, Table } from "@/components/ui";
import { PageHeader } from "@/components/PageHeader";
import { ChatDemo, InteractiveShowcase } from "./Showcase";

export const metadata: Metadata = { title: "Bibliothèque de composants" };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-3">
      <h2 className="font-display text-2xl font-bold">{title}</h2>
      {children}
    </section>
  );
}

/** Revue visuelle de la bibliothèque (admins uniquement). */
export default async function UiShowcase() {
  const v = await getViewer();
  if (v?.role !== "admin") notFound();
  return (
    <main className="container-rx grid gap-10 pt-7 pb-16">
      <PageHeader overline="Administration · revue visuelle" title="Composants">
        Chaque composant dans tous ses états : normal, survol, actif, focus clavier (Tab), désactivé avec raison, chargement, succès, erreur, avertissement.
      </PageHeader>

      <Section title="Boutons">
        <div className="flex flex-wrap items-center gap-2">
          <Button>Primaire</Button>
          <Button variant="secondary">Secondaire</Button>
          <Button variant="tertiary">Tertiaire</Button>
          <Button variant="danger">Destructif</Button>
          <Button loading>Chargement</Button>
          <Button disabledReason="Roster incomplet">Défier</Button>
          <Button variant="secondary" disabledReason="Hors zone de défi">Défier</Button>
          <LinkButton href="/admin/ui" variant="tertiary">Lien bouton</LinkButton>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm">Petit primaire</Button>
          <Button size="sm" variant="secondary">Petit secondaire</Button>
          <Button size="sm" variant="tertiary">Petit tertiaire</Button>
          <Button size="sm" variant="danger">Petit destructif</Button>
          <Button size="sm" loading>Envoi</Button>
          <Button size="sm" disabledReason="Délai dépassé">Indisponible</Button>
        </div>
      </Section>

      <Section title="Badges de statut">
        <div className="flex flex-wrap gap-2">
          <Badge>En attente</Badge>
          <Badge tone="orange">✓ Validé</Badge>
          <Badge tone="orange">Provisoire</Badge>
          <Badge tone="yellow">Capitaine</Badge>
          <Badge tone="red">● En direct</Badge>
          <Badge tone="red">Contesté</Badge>
          <Badge tone="muted">Terminé</Badge>
          <Badge tone="solid">Vous</Badge>
        </div>
      </Section>

      <Section title="Messages d’état">
        <div className="grid gap-2">
          <Alert>Les inscriptions ouvrent le 1er janvier.</Alert>
          <Alert kind="success">Résultat validé : classements recalculés.</Alert>
          <Alert kind="warning">Lecture automatique incertaine : un arbitre vérifie.</Alert>
          <Alert kind="error">Paiement refusé par la banque. Aucun montant n’a été prélevé.</Alert>
        </div>
      </Section>

      <Section title="Champs, onglets, modale, toasts">
        <InteractiveShowcase />
      </Section>

      <Section title="Cartes et tableaux">
        <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr))]">
          <Card title="Défis reçus" meta="2 défi(s)" accent>
            <Table
              head={["Adversaire", "Rang", "Statut"]}
              minWidth={320}
              rows={[
                ["Équipe A", "4e", <Badge key="a">En attente</Badge>],
                ["Équipe B", "6e", <Badge key="b" tone="orange">Planifié</Badge>],
              ]}
            />
          </Card>
          <Card title="Vide"><EmptyState action={<LinkButton href="/rankings/defis" size="sm" variant="secondary">Lancer un défi</LinkButton>}>Aucun défi pour le moment.</EmptyState></Card>
          <Card title="Erreur"><ErrorState retryHref="/admin/ui">Impossible de charger le classement.</ErrorState></Card>
          <Card title="Chargement"><Skeleton /></Card>
        </div>
      </Section>

      <Section title="Étapes">
        <Card><ProgressSteps steps={["Capture envoyée", "Analyse", "Confirmation", "Validé"]} current={2} /></Card>
      </Section>

      <Section title="Chat de match">
        <ChatDemo />
      </Section>

      <Section title="Publications">
        <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr))]">
          <PostCard author="RushXP" official logo="/assets/rushxp-logo-sm.png" date="30 oct." kind="Annonce" title="Les Playoffs démarrent" body="Huit équipes par jeu, élimination directe." pinned />
          <PostCard author="McDonald’s" sponsored logo="/assets/partner-mcdo.png" date="30 oct." kind="Partenaire" title="Soirée de match ? McDelivery." image="/assets/campaign-mcdelivery.png" />
        </div>
      </Section>

      <Section title="Emplacement publicitaire">
        <AdSlot>
          <div className="grid h-full place-items-center font-display text-xl text-grey">Bannière d’accueil · 1360×160</div>
        </AdSlot>
      </Section>
    </main>
  );
}
