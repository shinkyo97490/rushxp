"use client";

import { useState } from "react";
import { Modal, Tabs, useToast } from "@/components/ui/interactive";
import { Button, Card } from "@/components/ui/primitives";
import { ChatMessage } from "@/components/ui/blocks";
import { Field, Select, TextInput } from "@/components/forms";

/** Démonstrations interactives de la page /admin/ui (modale, toasts, onglets, chargement). */
export function InteractiveShowcase() {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => setOpen(true)}>Ouvrir une modale</Button>
        <Button variant="tertiary" onClick={() => toast("success", "Défi envoyé : réponse attendue sous 48 h.")}>Toast succès</Button>
        <Button variant="tertiary" onClick={() => toast("warning", "Votre roster est incomplet.")}>Toast avertissement</Button>
        <Button variant="danger" onClick={() => toast("error", "Connexion perdue. Nouvelle tentative…")}>Toast erreur</Button>
        <Button
          loading={loading}
          onClick={() => {
            setLoading(true);
            setTimeout(() => setLoading(false), 1500);
          }}
        >
          {loading ? "Envoi…" : "Bouton avec chargement"}
        </Button>
      </div>
      <Tabs tabs={[{ key: "a", label: "Classement" }, { key: "b", label: "Centre des défis", badge: 2 }, { key: "c", label: "Divisions" }]}>
        {(k) => <p className="text-sm text-silver">Contenu de l’onglet « {k === "a" ? "Classement" : k === "b" ? "Centre des défis" : "Divisions"} ».</p>}
      </Tabs>
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr))]">
        <Field label="Normal" hint="Texte d’aide.">{(p) => <TextInput {...p} placeholder="Pseudo" />}</Field>
        <Field label="Succès" success="Pseudo disponible.">{(p) => <TextInput {...p} defaultValue="Kapitène" />}</Field>
        <Field label="Avertissement" warning="Identifiant non vérifié.">{(p) => <TextInput {...p} defaultValue="Kapi#EUW" className="font-mono" />}</Field>
        <Field label="Erreur" error="Ce pseudo est déjà pris.">{(p) => <TextInput {...p} defaultValue="Admin" />}</Field>
        <Field label="Désactivé" hint="Indisponible pendant un match.">{(p) => <TextInput {...p} disabled defaultValue="—" />}</Field>
        <Field label="Liste">{(p) => <Select {...p}><option>Valorant</option><option>Rocket League</option></Select>}</Field>
      </div>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Refuser sans motif admis ?"
        footer={
          <>
            <Button variant="tertiary" size="sm" onClick={() => setOpen(false)}>Annuler</Button>
            <Button variant="danger" size="sm" onClick={() => { setOpen(false); toast("error", "Refus enregistré : −40 pts."); }}>Refuser quand même</Button>
          </>
        }
      >
        Ce défi est valide. Un refus injustifié entraîne un forfait et une pénalité de 40 points, inscrite à votre historique.
      </Modal>
    </div>
  );
}

/** Chat de match : messages système, arbitre, joueurs et fichiers, avec signalement. */
export function ChatDemo() {
  const [reported, setReported] = useState(false);
  return (
    <Card title="Salon du match">
      <div className="grid gap-2.5 p-[18px]">
        <ChatMessage line={{ kind: "system", text: "Salon du match ouvert.", time: "19:42" }} />
        <ChatMessage line={{ kind: "user", author: "Capitaine", team: "ALP", text: "Prêts de notre côté.", time: "19:44", mine: true }} />
        <ChatMessage line={{ kind: "user", author: "Adversaire", team: "ECH", text: "Pareil, on lance.", time: "19:45", reported }} onReport={() => setReported(true)} />
        <ChatMessage line={{ kind: "file", author: "Adversaire", file: "roster.png", size: "312 Ko", time: "19:45" }} />
        <ChatMessage line={{ kind: "referee", author: "Arbitre", text: "Présence validée, le veto peut commencer.", time: "19:46" }} />
      </div>
    </Card>
  );
}
