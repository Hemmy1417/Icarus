"use client";

/**
 * A case sheet.
 *
 * The verdict is the first and largest thing on the page, because it is what
 * the reader came for. Under it the schedule stands as a pinned index: one
 * row per piece of equipment the contract named, each carrying what the
 * panel found when it went looking. Selecting a row swaps the pane beside
 * it, so the evidence and the finding are read together rather than a
 * thousand pixels apart.
 *
 * No identifier appears anywhere on this page. A line is known by the
 * equipment it names, an item by the photograph it is, and the panel's own
 * sentences have their references written out before they are shown.
 */
import Link from "next/link";
import { use, useState, useSyncExternalStore } from "react";

import { Acts } from "@/components/Acts";
import { Loading, ReadFailure, Tag } from "@/components/bits";
import { EvidenceFigure } from "@/components/Evidence";
import { FilePanel } from "@/components/FilePanel";
import { currentEvidence, milestoneActs } from "@/lib/acts";
import { getConfig } from "@/lib/read";
import { useWallet } from "@/lib/wallet";
import {
  criterionStatus, day, decision, gen, lineName, lineStatus, lineStatusSaid,
  milestoneState,
  moment, referenceNames, relative, writeOut,
} from "@/lib/present";
import { getMilestone, getProject, getRound } from "@/lib/read";
import { roundTx } from "@/lib/txlog";
import { txUrl } from "@/lib/chain";
import type {
  Config, EvidenceItem, Milestone, Project as ProjectRecord, Round, TermsVersion,
} from "@/lib/types";
import { useChain } from "@/lib/useChain";


export default function CaseSheet({ params }: { params: Promise<{ mid: string }> }) {
  const { mid } = use(params);
  const [selected, setSelected] = useState<string | null>(null);

  const wallet = useWallet();
  const config = useChain("config", () => getConfig());
  const milestone = useChain<Milestone | null>(`milestone.${mid}`, (fresh) =>
    getMilestone(mid, fresh),
  );
  const n = milestone.data?.standing?.round ?? milestone.data?.rounds_count ?? 0;
  const round = useChain<Round | null>(n ? `round.${mid}.${n}` : null, () => getRound(mid, n));

  const frame = "mx-auto w-full max-w-[1200px] px-5 md:px-10";

  if (milestone.loading) return <div className={`${frame} py-24`}><Loading what="this case" /></div>;
  if (milestone.error) return <div className={`${frame} py-24`}><ReadFailure what="this case" /></div>;
  if (!milestone.data) {
    return (
      <div className={`${frame} py-24`}>
        <h1 className="type-heading">Nothing here</h1>
        <p className="mt-4 text-[15px] text-steel">No case on this deployment carries that name.</p>
      </div>
    );
  }

  const m = milestone.data;
  const terms = m.versions.find((v) => v.version === m.current_version);
  if (!terms) return <div className={`${frame} py-24`}><ReadFailure what="the terms in force" /></div>;

  const r = round.data ?? null;
  const names = referenceNames(terms.equipment, terms.criteria);
  const items = currentEvidence(m);
  const nowMs = new Date(m.now).getTime();
  const active = selected ?? terms.equipment[0]?.id ?? null;
  const line = terms.equipment.find((l) => l.id === active) ?? null;

  /* The photographs the panel rested this line on, in the order they were filed. */
  const restedOn: EvidenceItem[] = line && r
    ? (r.notes.basis[line.id] ?? [])
        .map((id) => items.find((it) => it.item_id === id))
        .filter((it): it is EvidenceItem => !!it)
    : [];
  const shown = restedOn.length ? restedOn : items.filter((it) => it.kind === "IMAGE");

  const said = r ? decision(r.decision) : milestoneState(m.state);

  return (
    <div className={frame}>
      {/* the verdict */}
      <header className="border-b border-mist py-20">
        <p className="type-caption">{terms.title}</p>
        <h1 className="mt-6 text-[clamp(44px,7vw,92px)] font-normal leading-[0.92] tracking-[-0.03em] text-graphite [font-family:var(--font-display)]">
          {said}
        </h1>
        {r ? (
          <p className="mt-8 max-w-[62ch] text-[18px] leading-[1.55] text-steel">
            {writeOut(r.notes.reasoning, names)}
          </p>
        ) : (
          <p className="mt-8 max-w-[62ch] text-[18px] leading-[1.55] text-steel">
            No panel has read this case yet.
          </p>
        )}
        <div className="mt-10 flex flex-wrap items-center gap-6">
          <span className="type-caption">{gen(terms.payment_wei)}</span>
          <span className="type-caption">Due {day(terms.deadline)}</span>
          {m.standing?.appealable && !m.standing.appealed && m.standing.window_ends ? (
            <span className="type-caption">
              Open to challenge {relative(m.standing.window_ends, nowMs)}
            </span>
          ) : null}
          {m.standing?.appealed ? <span className="type-caption">Contested once, upheld</span> : null}
          <Link href={`/projects/${m.project_id}`} className="type-caption hover:text-graphite">
            The project
          </Link>
        </div>
      </header>

      {/* the schedule, pinned, against the evidence for the selected line */}
      <section className="grid gap-10 py-20 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] lg:gap-16">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <h2 className="display mb-8 text-[14px] uppercase tracking-[0.12em] text-slate">
            What was contracted
          </h2>
          <ul>
            {terms.equipment.map((l) => {
              const status = r?.lines[l.id];
              const drove = r?.decisive.lines.includes(l.id);
              const on = l.id === active;
              return (
                <li key={l.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(l.id)}
                    className={`w-full border-t border-mist py-6 text-left transition-colors ${
                      on ? "" : "opacity-55 hover:opacity-100"
                    }`}
                  >
                    <span className="block text-[20px] leading-[1.25] tracking-[-0.02em] text-graphite [font-family:var(--font-display)]">
                      {lineName(l)}
                    </span>
                    <span className="mt-2 flex flex-wrap items-baseline gap-3">
                      <span
                        className={`text-[15px] text-steel ${
                          drove ? "underline decoration-ember decoration-2 underline-offset-4" : ""
                        }`}
                      >
                        {status ? lineStatus(status) : "Not yet assessed"}
                      </span>
                      {l.identify ? <span className="type-caption">Nameplate must be legible</span> : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          {terms.criteria.length && r ? (
            <div className="mt-12">
              <h2 className="display mb-6 text-[14px] uppercase tracking-[0.12em] text-slate">
                And the conditions
              </h2>
              <ul className="flex flex-col gap-5">
                {terms.criteria.map((c) => (
                  <li key={c.id} className="border-t border-mist pt-5">
                    <p className="text-[15px] leading-[1.5] text-steel">{c.text}</p>
                    <p className="mt-2 text-[15px] text-graphite">
                      {criterionStatus(r.criteria[c.id] ?? "")}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="min-w-0">
          {line ? (
            <>
              <h2 className="text-[32px] leading-[1.15] tracking-[-0.02em] text-graphite [font-family:var(--font-display)]">
                {lineName(line)}
              </h2>
              <p className="mt-5 max-w-[60ch] text-[17px] leading-[1.6] text-steel">
                {r?.notes.line_notes[line.id]
                  ? writeOut(r.notes.line_notes[line.id], names)
                  : r?.lines[line.id]
                    ? lineStatusSaid(r.lines[line.id]!)
                    : "Nothing has been put to a panel yet."}
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                {line.rating ? <Tag muted>{line.rating}</Tag> : null}
                {line.quantity > 1 ? <Tag muted>{line.quantity} required</Tag> : null}
                {restedOn.length ? (
                  <Tag muted>
                    Rested on {restedOn.length === 1 ? "one item" : `${restedOn.length} items`}
                  </Tag>
                ) : null}
              </div>

              <div className="mt-12 grid gap-8 sm:grid-cols-2">
                {shown.slice(0, 4).map((it) => (
                  <EvidenceFigure key={it.item_id} item={it} />
                ))}
              </div>
              {!shown.length ? (
                <p className="mt-12 text-[15px] text-slate">
                  No photograph has been filed against these terms.
                </p>
              ) : null}
            </>
          ) : (
            <p className="text-[15px] text-slate">These terms name no equipment.</p>
          )}
        </div>
      </section>

      <ActionArea
        mid={mid}
        m={m}
        terms={terms}
        addr={wallet.address}
        config={config.data ?? null}
        nowMs={nowMs}
      />

      {r ? <Footer mid={mid} round={r} /> : null}
    </div>
  );
}

/**
 * What this viewer can do to this case, kept at the foot of the page so the
 * record is read before it is acted on.
 */
function ActionArea({
  mid,
  m,
  terms,
  addr,
  config,
  nowMs,
}: {
  mid: string;
  m: Milestone;
  terms: TermsVersion;
  addr: string;
  config: Config | null;
  nowMs: number;
}) {
  const project = useChain<ProjectRecord | null>(`project.${m.project_id}`, (fresh) =>
    getProject(m.project_id, fresh),
  );
  if (!project.data) return null;

  const acts = milestoneActs({
    project: project.data,
    milestone: m,
    addr,
    config,
    nowMs,
  });
  const canFile = acts.some((a) => a.id === "submit_image" && a.available);

  return (
    <section className="flex flex-col gap-8 border-t border-mist py-20">
      <Acts
        acts={acts}
        args={{
          // accept_version names the version being signed, not just the
          // milestone: signing "whatever is pending" would be ambiguous the
          // moment a second revision existed.
          accept_version: [mid, m.pending_version ?? m.current_version],
          propose_version: [mid],
          request_assessment: [mid, "[]"],
          open_appeal: [mid],
          decide_appeal: [mid],
          lapse_appeal: [mid],
          finalize: [mid],
          close_milestone: [mid],
        }}
        heading="What you can do with this case"
      />
      {canFile ? (
        <FilePanel
          milestoneId={mid}
          lines={terms.equipment}
          requirements={terms.evidence_requirements}
        />
      ) : null}
    </section>
  );
}

/**
 * Where a decision came from. A contract cannot know its own transaction
 * hash, so the pairing is either one this browser watched land or one from
 * the published proof log, and the page says which rather than presenting
 * either as the chain's own word.
 */
function Footer({ mid, round: r }: { mid: string; round: Round }) {
  /*
   * Read through useSyncExternalStore rather than an effect: the pairing
   * lives in this browser's storage, which is an external store, and it
   * changes when a write this page watched lands. The snapshot is a string
   * so it stays referentially stable across renders.
   */
  const packed = useSyncExternalStore(
    (onChange) => {
      window.addEventListener("icarus:changed", onChange);
      return () => window.removeEventListener("icarus:changed", onChange);
    },
    () => {
      const found = roundTx(mid, r.round);
      return found ? `${found.hash}|${found.source}` : "";
    },
    () => "",
  );
  const [hash, source] = packed.split("|");
  const tx = hash ? { hash, source: source ?? "" } : null;

  return (
    <footer className="border-t border-mist py-14">
      <div className="flex flex-wrap items-center gap-8">
        <span className="type-caption">Read {moment(r.at)}</span>
        <Link
          href={`/milestones/${mid}/rounds/${r.round}`}
          className="display text-[15px] text-graphite underline decoration-ember decoration-2 underline-offset-[6px] hover:decoration-graphite"
        >
          What each node saw
        </Link>
        {tx ? (
          <a
            href={txUrl(tx.hash)}
            target="_blank"
            rel="noopener noreferrer"
            className="display text-[15px] text-graphite underline decoration-ember decoration-2 underline-offset-[6px] hover:decoration-graphite"
          >
            The transaction that decided it
          </a>
        ) : null}
      </div>
      {tx ? (
        <p className="type-caption mt-4">
          Paired from {tx.source}, because a contract cannot know its own transaction hash.
        </p>
      ) : null}
    </footer>
  );
}
