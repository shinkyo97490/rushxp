"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  addCommentAction,
  createPostAction,
  deleteCommentAction,
  deletePostAction,
  reportCommentAction,
  toggleLikeAction,
  togglePinAction,
  votePollAction,
} from "@/lib/feed/actions";
import { POST_IMAGES } from "@/lib/feed/images";
import { Field, FormError, Select, TextArea, TextInput } from "@/components/forms";
import { useServerAction } from "@/components/useServerAction";

export interface CommentView {
  id: string;
  author: string;
  text: string;
  time: string;
  mine: boolean;
  official: boolean;
  replies: CommentView[];
}

export function PostActions({
  postId,
  likes,
  liked,
  comments,
  signedIn,
  canModerate,
  isAuthor,
  pinned,
  isAdmin,
}: {
  postId: string;
  likes: number;
  liked: boolean;
  comments: CommentView[];
  signedIn: boolean;
  canModerate: boolean;
  isAuthor: boolean;
  pinned: boolean;
  isAdmin: boolean;
}) {
  const [open, setOpen] = useState(false);
  const like = useServerAction(toggleLikeAction);
  const del = useServerAction(deletePostAction);
  const pin = useServerAction(togglePinAction);
  const [copied, setCopied] = useState(false);
  const count = comments.reduce((a, c) => a + 1 + c.replies.length, 0);
  return (
    <>
      <div className="flex flex-wrap items-center gap-1 border-t border-surface-2 px-[18px] py-2">
        {signedIn ? (
          <button className={`btn btn-sm !min-h-9 ${liked ? "btn-secondary" : "btn-tertiary"}`} disabled={like.pending} onClick={() => like.run(postId)} aria-pressed={liked}>
            {liked ? "♥ J’aime" : "♡ J’aime"} · {likes}
          </button>
        ) : (
          <span className="px-2 text-[13px] text-grey">♡ {likes}</span>
        )}
        <button className="btn btn-tertiary btn-sm !min-h-9" onClick={() => setOpen((o) => !o)} aria-expanded={open}>Commentaires · {count}</button>
        <button
          className="btn btn-tertiary btn-sm !min-h-9"
          onClick={() => {
            navigator.clipboard?.writeText(`${location.origin}/actualites#${postId}`).then(() => setCopied(true), () => {});
          }}
        >
          {copied ? "Lien copié" : "Partager"}
        </button>
        <span className="flex-1" />
        {isAdmin && <button className="btn btn-tertiary btn-sm !min-h-9" disabled={pin.pending} onClick={() => pin.run(postId)}>{pinned ? "Désépingler" : "Épingler"}</button>}
        {(isAuthor || isAdmin) && <button className="btn btn-danger btn-sm !min-h-9" disabled={del.pending} onClick={() => confirm("Supprimer cette publication ?") && del.run(postId)}>Supprimer</button>}
      </div>
      {open && <Comments postId={postId} comments={comments} signedIn={signedIn} canModerate={canModerate} />}
    </>
  );
}

function Comments({ postId, comments, signedIn, canModerate }: { postId: string; comments: CommentView[]; signedIn: boolean; canModerate: boolean }) {
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<{ id: string; author: string } | null>(null);
  const add = useServerAction(addCommentAction);
  const report = useServerAction(reportCommentAction);
  const del = useServerAction(deleteCommentAction);
  const One = ({ c, child }: { c: CommentView; child?: boolean }) => (
    <div className={`flex gap-2.5 ${child ? "ml-10" : ""}`}>
      <span className="grid h-8 w-8 flex-none place-items-center bg-surface-2 font-display text-xs font-bold">{c.author.slice(0, 2).toUpperCase()}</span>
      <div className="min-w-0 flex-1">
        <div className="text-[13px]">
          <b>{c.author}</b> {c.official && <span className="badge text-orange">Officiel</span>} <span className="text-xs text-grey">{c.time}</span>
        </div>
        <div className="text-sm whitespace-pre-line text-silver">{c.text}</div>
        <div className="mt-0.5 flex gap-3 text-xs text-grey">
          {signedIn && !child && <button className="cursor-pointer hover:text-orange" onClick={() => setReplyTo({ id: c.id, author: c.author })}>Répondre</button>}
          {signedIn && !c.mine && <button className="cursor-pointer hover:text-red" onClick={() => report.run(c.id)}>Signaler</button>}
          {(c.mine || canModerate) && <button className="cursor-pointer hover:text-red" onClick={() => del.run(c.id)}>Supprimer</button>}
        </div>
      </div>
    </div>
  );
  return (
    <div className="grid gap-3 border-t border-surface-2 bg-bg px-[18px] py-3">
      {report.message && <span role="status" className="text-xs text-orange">{report.message}</span>}
      {comments.map((c) => (
        <div key={c.id} className="grid gap-2">
          <One c={c} />
          {c.replies.map((r) => <One key={r.id} c={r} child />)}
        </div>
      ))}
      {comments.length === 0 && <span className="text-[13px] text-grey">Aucun commentaire. Lancez la discussion.</span>}
      {signedIn ? (
        <form
          className="grid gap-1.5"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await add.run({ postId, text: draft, parentId: replyTo?.id })) {
              setDraft("");
              setReplyTo(null);
            }
          }}
        >
          {replyTo && (
            <span className="text-xs text-grey">Réponse à {replyTo.author} · <button type="button" className="cursor-pointer text-orange" onClick={() => setReplyTo(null)}>annuler</button></span>
          )}
          <div className="flex gap-2">
            <TextInput aria-label="Commentaire" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Écrire un commentaire…" maxLength={600} className="!h-10" />
            <button className="btn btn-primary btn-sm" disabled={add.pending || draft.trim().length < 2}>Publier</button>
          </div>
          <FormError message={add.errors._} />
        </form>
      ) : (
        <Link href="/connexion?next=/actualites" className="text-[13px] font-semibold">Connectez-vous pour commenter →</Link>
      )}
    </div>
  );
}

export function Poll({ postId, options, myVote, total, signedIn, closed }: { postId: string; options: { id: string; label: string; votes: number }[]; myVote: string | null; total: number; signedIn: boolean; closed: boolean }) {
  const vote = useServerAction(votePollAction);
  const showResults = !!myVote || closed || !signedIn;
  return (
    <div className="grid gap-1.5 px-[18px] pb-3">
      {options.map((o) => {
        const pct = total ? Math.round((o.votes / total) * 100) : 0;
        return (
          <button
            key={o.id}
            disabled={!signedIn || closed || vote.pending}
            onClick={() => vote.run({ postId, optionId: o.id })}
            className={`relative cursor-pointer overflow-hidden border px-3 py-2.5 text-left text-sm disabled:cursor-default ${myVote === o.id ? "border-orange" : "border-line hover:border-[#5a5a5a]"}`}
          >
            {showResults && <span className="absolute inset-y-0 left-0 bg-active-tint" style={{ width: `${pct}%` }} />}
            <span className="relative flex justify-between gap-3">
              <span>{o.label} {myVote === o.id && <span className="text-xs text-orange">· votre vote</span>}</span>
              {showResults && <span className="font-bold">{pct} %</span>}
            </span>
          </button>
        );
      })}
      <FormError message={vote.errors._} />
    </div>
  );
}

const KINDS_ADMIN = [["ANNONCE", "Annonce"], ["RESULTAT", "Résultat"], ["VIDEO", "Vidéo"], ["GALERIE", "Galerie"], ["SONDAGE", "Sondage"]] as const;

export function Composer({ official, structureName }: { official: boolean; structureName: string | null }) {
  const router = useRouter();
  const [f, setF] = useState({ kind: official ? "ANNONCE" : "STRUCTURE", title: "", body: "", image: "", options: ["", ""], pinned: false });
  const a = useServerAction(createPostAction);
  return (
    <form
      className="card grid max-w-3xl gap-3.5 p-[18px]"
      onSubmit={async (e) => {
        e.preventDefault();
        if (await a.run({ ...f, options: f.options.filter((o) => o.trim()) })) router.push("/actualites");
      }}
    >
      <FormError message={a.errors._} />
      <div className="text-sm text-silver">Publié par <b className="text-ink">{official ? "RushXP · officiel" : structureName}</b></div>
      {official && (
        <Field label="Type" error={a.errors.kind}>
          {(p) => (
            <Select {...p} value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>
              {KINDS_ADMIN.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </Select>
          )}
        </Field>
      )}
      <Field label={f.kind === "SONDAGE" ? "Question" : "Titre"} error={a.errors.title}>
        {(p) => <TextInput {...p} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} maxLength={140} />}
      </Field>
      {f.kind !== "SONDAGE" && (
        <Field label="Texte" error={a.errors.body}>
          {(p) => <TextArea {...p} rows={4} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} />}
        </Field>
      )}
      {f.kind === "SONDAGE" && (
        <div className="grid gap-2">
          <span className="overline">Options (2 à 6)</span>
          {f.options.map((o, i) => (
            <TextInput key={i} aria-label={`Option ${i + 1}`} value={o} onChange={(e) => setF({ ...f, options: f.options.map((x, j) => (j === i ? e.target.value : x)) })} placeholder={`Option ${i + 1}`} />
          ))}
          {f.options.length < 6 && <button type="button" className="btn btn-tertiary btn-sm justify-self-start" onClick={() => setF({ ...f, options: [...f.options, ""] })}>+ Ajouter une option</button>}
          {a.errors.options && <span className="text-[13px] text-red">{a.errors.options}</span>}
        </div>
      )}
      <div className="grid gap-1.5">
        <span className="overline">Visuel (facultatif)</span>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-7">
          <button type="button" onClick={() => setF({ ...f, image: "" })} className={`grid aspect-video cursor-pointer place-items-center border text-xs ${!f.image ? "border-orange text-orange" : "border-line text-grey"}`}>Aucun</button>
          {POST_IMAGES.map((src) => (
            <button type="button" key={src} onClick={() => setF({ ...f, image: src })} className={`relative aspect-video cursor-pointer overflow-hidden border ${f.image === src ? "border-orange" : "border-line"}`} aria-pressed={f.image === src}>
              <Image src={src} alt="" fill className="object-cover" sizes="120px" />
            </button>
          ))}
        </div>
        <span className="text-xs text-grey">L’envoi de vos propres images arrive avec le stockage des médias.</span>
      </div>
      {official && (
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.pinned} onChange={(e) => setF({ ...f, pinned: e.target.checked })} /> Épingler en haut du fil</label>
      )}
      <div className="flex gap-2">
        <button className="btn btn-primary" disabled={a.pending}>Publier</button>
        <Link href="/actualites" className="btn btn-tertiary">Annuler</Link>
      </div>
    </form>
  );
}
