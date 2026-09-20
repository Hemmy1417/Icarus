"use client";

/**
 * One milestone, read end to end: the terms it was written under, the
 * evidence filed against them, what the panel found line by line, and what
 * the contract derived from that.
 *
 * The order is deliberate. A reader meets the schedule before the decision,
 * because the decision is only meaningful as an answer to the schedule.
 */
import Link from "next/link";
import { use } from "react";

import {
  Band, Card, DataCard, EmberLink, Empty, Field, Heading, Loading, ReadFailure, Tag,
} from "@/components/bits";
import { EvidenceList } from "@/components/Evidence";
import { Schedule } from "@/components/Schedule";
import { currentEvidence } from "@/lib/acts";
import {
  criterionStatus, day, decision, decisionNoun, gen, milestoneState, milestoneType, moment,
  plural, quality, relative, roundName,
} from "@/lib/present";
import { getMilestone, getRound } from "@/lib/read";
import type { Milestone, Round } from "@/lib/types";
import { useChain } from "@/lib/useChain";

function Verdict({ m, round, nowMs }: { m: Milestone; round: Round | null; nowMs: number }) {
  const standing = m.standing;
  if (!standing || !round) {
    return (
      <Card>
        <h3 className="type-subheading">No panel has read this yet</h3>
        <p className="mt-4 text-[15px] leading-[1.6] text-steel">
          Nothing is decided until evidence is filed and an assessment is asked for. Until then
          this milestone holds its payment and nothing else.
        </p>
      </Card>
    );
  }

  return (
    <div className="rounded-tl-[6px] bg-ivory p-10">
      <p className="type-caption mb-5 uppercase tracking-[0.08em] text-brass">
        {roundName(round.kind, round.round)}
        {round.reviewed_round ? `, reviewing round ${round.reviewed_round}` : ""}
      </p>
      <h3 className="type-heading-lg">{decision(round.decision)}</h3>

      <blockquote className="mt-6 border-l-2 border-mist pl-5 text-[15px] leading-[1.6] text-steel">
        {round.notes.reasoning}
        <cite className="type-caption mt-2 block not-italic">The panel&apos;s own words.</cite>
      </blockquote>

      {round.appeal_reason ? (
        <>
          <p className="type-caption mt-8">The owner contested the earlier decision, saying</p>
          <blockquote className="mt-2 border-l-2 border-mist pl-5 text-[15px] leading-[1.6] text-steel">
            {round.appeal_reason}
          </blockquote>
          <p className="type-caption mt-2">
            That is an argument about the evidence, and the panel is told so. It cannot itself
            establish or refute a line.
          </p>
        </>
      ) : null}

      {round.conflicts_detected ? (
        <p className="mt-6 text-[15px] leading-[1.6] text-steel">
          The panel found that the evidence disagreed with itself.{" "}
          {round.notes.conflict_note}
        </p>
      ) : null}

      <dl className="mt-8 flex flex-col gap-4">
        <div className="flex items-baseline justify-between gap-5 border-t border-mist pt-4">
          <dt className="type-caption">Evidence</dt>
          <dd className="text-[15px] text-graphite">{quality(round.quality)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-5 border-t border-mist pt-4">
          <dt className="type-caption">Recorded</dt>
          <dd className="text-[15px] text-graphite">{moment(round.at)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-5 border-t border-mist pt-4">
          <dt className="type-caption">Now standing</dt>
          <dd className="text-[15px] text-graphite">{milestoneState(m.state)}</dd>
        </div>
      </dl>

      {standing.appealable && !standing.appealed && standing.window_ends ? (
        <p className="type-caption mt-8">
          The owner may contest this {decisionNoun(standing.decision)} until{" "}
          {moment(standing.window_ends)}, {relative(standing.window_ends, nowMs)}.
        </p>
      ) : null}
      {standing.appealed ? (
        <p className="type-caption mt-8">
          This decision was contested, so it can no longer be contested again.
        </p>
      ) : null}
    </div>
  );
}

export default function MilestonePage({ params }: { params: Promise<{ mid: string }> }) {
  const { mid } = use(params);
  const milestone = useChain<Milestone | null>(`milestone.${mid}`, (fresh) =>
    getMilestone(mid, fresh),
  );
  const n = milestone.data?.standing?.round ?? milestone.data?.rounds_count ?? 0;
  const round = useChain<Round | null>(n ? `round.${mid}.${n}` : null, () => getRound(mid, n));

  if (milestone.loading) {
    return (
      <Band tone="white">
        <Loading what="this milestone" />
      </Band>
    );
  }
  if (milestone.error) {
    return (
      <Band tone="white">
        <ReadFailure what="this milestone" />
      </Band>
    );
  }
  if (!milestone.data) {
    return (
      <Band tone="white">
        <Heading title="No such milestone" lead="Nothing on this deployment carries that name." />
      </Band>
    );
  }

  const m = milestone.data;
  const nowMs = new Date(m.now).getTime();
  const terms = m.versions.find((v) => v.version === m.current_version);
  const items = currentEvidence(m);
  const decided = round.data ?? null;

  if (!terms) {
    return (
      <Band tone="white">
        <ReadFailure what="the terms in force on this milestone" />
      </Band>
    );
  }

  return (
    <>
      <Band tone="white">
        <div className="max-w-[820px]">
          <p className="type-caption mb-5 uppercase tracking-[0.08em] text-slate">
            {milestoneType(terms.milestone_type)}
          </p>
          <h1 className="type-heading-lg">{terms.title}</h1>
          <p className="mt-5 text-[18px] leading-[1.6] text-steel">{terms.description}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Tag muted>{milestoneState(m.state)}</Tag>
            <Tag muted>{gen(terms.payment_wei)}</Tag>
            <Tag muted>Due {day(terms.deadline)}</Tag>
            <Tag muted>
              {m.rounds_count ? plural(m.rounds_count, "reading") : "Not yet read"}
            </Tag>
          </div>
          <p className="type-caption mt-8">
            <EmberLink href={`/projects/${m.project_id}`}>Back to the project</EmberLink>
          </p>
        </div>
      </Band>

      <Band tone="ash">
        <Heading
          eyebrow="What was contracted"
          title="The schedule, and what was found"
          lead={
            decided
              ? "Each line as the terms name it, set against what the panel reported when it went looking."
              : "Each line as the terms name it. No panel has looked yet."
          }
        />
        <Schedule
          lines={terms.equipment}
          found={decided?.lines}
          decisive={decided?.decisive.lines ?? []}
          notes={decided?.notes.line_notes}
        />

        {terms.specification ? (
          <div className="mt-10 max-w-[760px]">
            <h3 className="type-subheading mb-4">The specification</h3>
            <p className="text-[15px] leading-[1.6] text-steel">{terms.specification}</p>
          </div>
        ) : null}

        {terms.criteria.length ? (
          <div className="mt-10">
            <h3 className="type-subheading mb-5">Acceptance criteria</h3>
            <DataCard>
              <ul>
                {terms.criteria.map((crit) => {
                  const found = decided?.criteria[crit.id];
                  const drove = decided?.decisive.criteria.includes(crit.id);
                  return (
                    <li
                      key={crit.id}
                      className="flex flex-col gap-4 border-t border-mist px-10 py-6 first:border-t-0 md:flex-row md:items-start md:justify-between"
                    >
                      <p className="max-w-[720px] text-[15px] leading-[1.55] text-steel">
                        {crit.text}
                      </p>
                      <div className="shrink-0 md:w-[160px] md:text-right">
                        {found ? (
                          <span
                            className={`display text-[17px] ${
                              drove ? "underline decoration-ember decoration-2 underline-offset-4" : ""
                            }`}
                          >
                            {criterionStatus(found)}
                          </span>
                        ) : (
                          <span className="type-caption">Not yet assessed</span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </DataCard>
          </div>
        ) : null}
      </Band>

      <Band tone="white">
        <div className="grid gap-10 lg:grid-cols-[1fr_420px] lg:items-start">
          <div>
            <Heading
              eyebrow="What was filed"
              title="The evidence"
              lead="Photographs are held and hashed by the contract, so every validator judged these exact bytes."
            />
            {items.length === 0 ? (
              <Empty>Nothing has been filed against the terms in force.</Empty>
            ) : (
              <EvidenceList items={items} />
            )}
          </div>

          <div className="lg:sticky lg:top-28">
            <Verdict m={m} round={decided} nowMs={nowMs} />
          </div>
        </div>
      </Band>

      <Band tone="ash">
        <Heading
          eyebrow="What the terms require"
          title="Evidence the schedule asks for"
          lead="A milestone cannot be assessed until these are filed, which stops a thin record from being judged at all."
        />
        {terms.evidence_requirements.length === 0 ? (
          <Empty>These terms name no specific evidence requirement.</Empty>
        ) : (
          <div className="grid gap-5 md:grid-cols-2">
            {terms.evidence_requirements.map((r) => (
              <Card key={r.id}>
                <div className="flex flex-wrap gap-3">
                  <Tag muted>{r.kind === "IMAGE" ? "Photograph" : "Document"}</Tag>
                  <Tag muted>From the {r.from_role.toLowerCase()}</Tag>
                  <Tag muted>{plural(r.min_count, "item")}</Tag>
                </div>
                <p className="mt-5 text-[15px] leading-[1.55] text-steel">{r.text}</p>
              </Card>
            ))}
          </div>
        )}
      </Band>

      {m.rounds_count > 1 ? (
        <Band tone="white">
          <Heading
            title="Every reading"
            lead="A milestone can be read more than once. Each reading is kept, including the ones that were superseded."
          />
          <DataCard>
            <ul>
              {Array.from({ length: m.rounds_count }, (_, i) => i + 1).map((k) => (
                <li key={k} className="border-t border-mist first:border-t-0">
                  <Link
                    href={`/milestones/${mid}/rounds/${k}`}
                    className="flex items-baseline justify-between gap-5 px-10 py-5 hover:bg-fog"
                  >
                    <span className="text-[15px] text-graphite">Reading {k}</span>
                    <span className="type-caption">Read what this panel found</span>
                  </Link>
                </li>
              ))}
            </ul>
          </DataCard>
        </Band>
      ) : null}

      <Band tone={m.rounds_count > 1 ? "ash" : "white"}>
        <div className="grid gap-5 md:grid-cols-3">
          <Field label="Terms in force">Version {m.current_version}</Field>
          <Field label="Readings used">
            {m.version_assessments} of the assessments these terms allow
          </Field>
          <Field label="Reserved for this milestone">
            <span className="figure">{gen(m.reserved_wei)}</span>
          </Field>
        </div>
      </Band>
    </>
  );
}
