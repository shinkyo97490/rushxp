"use client";

import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";

const inputCls =
  "h-11 w-full min-w-0 border border-line bg-bg px-3 text-sm text-ink outline-none transition-colors duration-150 focus:border-orange aria-[invalid=true]:border-red";

interface FieldProps {
  label: ReactNode;
  error?: string;
  hint?: string;
  children: (p: { id: string; "aria-invalid": boolean; "aria-describedby"?: string }) => ReactNode;
}

/** Libellé en overline, champ, puis message d'erreur rouge sous le champ (README · Formulaires). */
export function Field({ label, error, hint, children }: FieldProps) {
  const id = useId();
  const msg = error ? `${id}-err` : hint ? `${id}-hint` : undefined;
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="overline">{label}</label>
      {children({ id, "aria-invalid": !!error, "aria-describedby": msg })}
      {error ? (
        <span id={msg} className="text-[13px] text-red">{error}</span>
      ) : hint ? (
        <span id={msg} className="text-xs text-grey">{hint}</span>
      ) : null}
    </div>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputCls} ${props.className ?? ""}`} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${inputCls} ${props.className ?? ""}`} />;
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${inputCls} !h-auto py-2.5 resize-y ${props.className ?? ""}`} />;
}

export function Checkbox({ checked, onChange, children, error }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode; error?: string }) {
  return (
    <div className="grid gap-1.5">
      <label className="flex cursor-pointer items-start gap-2.5 text-[13px] text-silver">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" aria-invalid={!!error} />
        <span
          aria-hidden
          className={`mt-px grid h-[18px] w-[18px] flex-none place-items-center border text-xs font-extrabold text-bg peer-focus-visible:outline-2 peer-focus-visible:outline-orange ${
            error ? "border-red" : "border-orange"
          } ${checked ? "bg-orange" : ""}`}
        >
          {checked ? "✓" : ""}
        </span>
        <span>{children}</span>
      </label>
      {error && <span className="text-[13px] text-red">{error}</span>}
    </div>
  );
}

/** Sélection en tuile (jeux, profils, chemins). */
export function Tile({ selected, onClick, children, className = "" }: { selected: boolean; onClick: () => void; children: ReactNode; className?: string }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`cursor-pointer border text-left text-ink transition-colors duration-150 ${selected ? "border-orange bg-active-tint" : "border-line bg-bg hover:border-[#5a5a5a]"} ${className}`}
    >
      {children}
    </button>
  );
}

export function Steps({ labels, current }: { labels: string[]; current: number }) {
  return (
    <ol className="grid gap-1 [grid-template-columns:repeat(auto-fit,minmax(110px,1fr))]" aria-label="Étapes">
      {labels.map((l, i) => {
        const c = i < current ? "border-grey text-grey" : i === current ? "border-orange text-orange" : "border-line text-[#5a5a5a]";
        return (
          <li key={l} className={`border-t-[3px] py-2 ${c}`} aria-current={i === current ? "step" : undefined}>
            <div className="text-[11px] font-bold">ÉTAPE {i + 1}{i < current ? " · ✓" : ""}</div>
            <div className={`text-[13px] ${i === current ? "text-ink" : i < current ? "text-silver" : "text-grey"}`}>{l}</div>
          </li>
        );
      })}
    </ol>
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div role="alert" className="border border-red bg-[rgba(255,90,42,.08)] px-3.5 py-2.5 text-[13px] text-red">
      {message}
    </div>
  );
}
