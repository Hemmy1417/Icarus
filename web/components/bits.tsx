/**
 * The vocabulary every page is built from. The reference in docs/design.md
 * fixes three radii, one accent and no shadows; putting them here once means
 * a page cannot quietly invent a fourth radius or a second orange.
 */
import type { ReactNode } from "react";

/* ── bands and column ───────────────────────────────────────────────────── */

/**
 * A full-bleed horizontal band with the 1200px column inside it. Sections
 * alternate white and ash down the page, which is the only depth cue the
 * reference allows apart from hairlines.
 */
export function Band({
  tone = "white",
  children,
  id,
}: {
  tone?: "white" | "ash" | "ivory";
  children: ReactNode;
  id?: string;
}) {
  const bg =
    tone === "ash" ? "bg-ash" : tone === "ivory" ? "bg-ivory" : "bg-canvas-white";
  return (
    <section id={id} className={`${bg} w-full`}>
      <div className="mx-auto w-full max-w-[1200px] px-5 py-[80px] md:px-10">{children}</div>
    </section>
  );
}

/** A section's own heading and standfirst, set in the display face. */
export function Heading({
  eyebrow,
  title,
  lead,
  size = "heading",
}: {
  eyebrow?: string;
  title: string;
  lead?: ReactNode;
  size?: "heading" | "heading-lg" | "display";
}) {
  const cls =
    size === "display" ? "type-display" : size === "heading-lg" ? "type-heading-lg" : "type-heading";
  return (
    <header className="mb-10 max-w-[760px]">
      {eyebrow ? (
        <p className="type-caption mb-5 uppercase tracking-[0.08em] text-slate">{eyebrow}</p>
      ) : null}
      <h2 className={cls}>{title}</h2>
      {lead ? <div className="mt-5 text-[18px] leading-[1.55] text-steel">{lead}</div> : null}
    </header>
  );
}

/* ── surfaces ───────────────────────────────────────────────────────────── */

/** A plain card: 8px, hairline, 40px of padding. */
export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-card border border-mist bg-canvas-white p-10 ${className}`}>
      {children}
    </div>
  );
}

/**
 * A data card: the 20px radius the reference reserves for the surfaces that
 * carry figures. In this product that is the equipment schedule, which is
 * what charts are in the reference it comes from.
 */
export function DataCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-data border border-mist bg-canvas-white ${className}`}>{children}</div>
  );
}

/** The asymmetric featured card: soft at the top left, sharp everywhere else. */
export function FeaturedCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-tl-[6px] rounded-br-none rounded-tr-none rounded-bl-none bg-ash p-10 ${className}`}
    >
      {children}
    </div>
  );
}

export function Hairline({ className = "" }: { className?: string }) {
  return <hr className={`border-0 border-t border-mist ${className}`} />;
}

/* ── small pieces ───────────────────────────────────────────────────────── */

/** A tag: 20px, hairline, never filled with the accent. */
export function Tag({ children, muted = false }: { children: ReactNode; muted?: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-tag border border-mist px-3 py-1 text-[13px] leading-none ${
        muted ? "text-slate" : "text-steel"
      }`}
    >
      {children}
    </span>
  );
}

/** A label above a value, in Inter at 14. */
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="type-caption mb-1 text-slate">{label}</div>
      <div className="text-[15px] leading-[1.5] text-graphite">{children}</div>
    </div>
  );
}

/** A machine value: tabular figures, so columns of them line up. */
export function Figure({ children }: { children: ReactNode }) {
  return <span className="figure">{children}</span>;
}

/**
 * The one filled action on a page, in graphite with a square corner. Ember is
 * never a button fill, which the reference is explicit about, so a primary
 * and a secondary differ by weight of surface and nothing else.
 */
export function Button({
  children,
  onClick,
  type = "button",
  variant = "primary",
  disabled = false,
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  variant?: "primary" | "secondary";
  disabled?: boolean;
  title?: string;
}) {
  const base =
    "display inline-flex items-center justify-center rounded-button px-6 py-3 text-[15px] transition-opacity disabled:opacity-40 disabled:cursor-not-allowed";
  const skin =
    variant === "primary"
      ? "bg-graphite text-canvas-white hover:opacity-90"
      : "border border-graphite text-graphite hover:bg-fog";
  return (
    <button type={type} onClick={onClick} disabled={disabled} title={title} className={`${base} ${skin}`}>
      {children}
    </button>
  );
}

/** A link in reading flow: ember underlines it, and marks nothing else. */
export function EmberLink({
  href,
  children,
  external = false,
}: {
  href: string;
  children: ReactNode;
  external?: boolean;
}) {
  const props = external ? { target: "_blank", rel: "noopener noreferrer" } : {};
  return (
    <a
      href={href}
      {...props}
      className="text-graphite underline decoration-ember decoration-2 underline-offset-4 hover:decoration-graphite"
    >
      {children}
    </a>
  );
}

/* ── states ─────────────────────────────────────────────────────────────── */

/** What a page shows while it is waiting on the chain. */
export function Loading({ what }: { what: string }) {
  return (
    <p className="text-[15px] text-slate" role="status">
      Reading {what} from the chain.
    </p>
  );
}

/**
 * A read that did not answer. It says so rather than rendering an empty
 * section, because a section that vanishes on a failed read tells a reader
 * that there is nothing there, which is a different and false claim.
 */
export function ReadFailure({ what, detail }: { what: string; detail?: string }) {
  return (
    <div className="rounded-card border border-mist bg-fog p-10">
      <p className="text-[15px] text-graphite">Could not read {what}.</p>
      {detail ? <p className="type-caption mt-2">{detail}</p> : null}
      <p className="type-caption mt-2">
        This is a problem reaching the chain, not a statement about the record. Reload in a moment.
      </p>
    </div>
  );
}

/** Nothing is there, and that is the truth rather than a failure. */
export function Empty({ children }: { children: ReactNode }) {
  return <p className="text-[15px] text-slate">{children}</p>;
}
