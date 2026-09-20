"use client";

/**
 * One reading, in full: what each node saw in each photograph, what it made
 * of each line and each criterion, and which of those the contract actually
 * used. This is the page a sceptic reads, so it withholds nothing and
 * summarises nothing.
 */
import { use } from "react";

import {
  Band, DataCard, EmberLink, Empty, Field, Heading, Loading, ReadFailure, Tag,
} from "@/components/bits";
import {
  criterionStatus, decision, itemKind, itemName, lineStatus, moment, prose, quality, roleLower,
  roundName, shortDigest, wasCut,
} from "@/lib/present";
import { getRound } from "@/lib/read";
import type { ImageReading, Round } from "@/lib/types";
import { useChain } from "@/lib/useChain";

function Reading({ r }: { r: ImageReading }) {
  return (
    <li className="border-t border-mist px-10 py-6 first:border-t-0">
      <div className="flex flex-wrap items-center gap-3">
        <Tag>{itemKind("IMAGE", r.origin)}</Tag>
        <Tag muted>Filed by the {roleLower(r.role)}</Tag>
        {r.claimed_line ? <Tag muted>Offered for line {r.claimed_line}</Tag> : null}
      </div>

      {r.readable ? (
        <>
          <p className="mt-5 text-[15px] leading-[1.6] text-steel">{prose(r.shows)}</p>
          {r.labels.length ? (
            <div className="mt-5">
              <p className="type-caption mb-2">Text read on labels, transcribed as it was read</p>
              <ul className="flex flex-col gap-1">
                {r.labels.map((label, i) => (
                  <li key={i} className="figure text-[14px] leading-[1.5] text-graphite">
                    {prose(label)}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="type-caption mt-4">No text on a label was legible.</p>
          )}
          {r.concerns.length ? (
            <div className="mt-5">
              <p className="type-caption mb-2">What the panel thought worth flagging</p>
              <ul className="flex flex-col gap-1">
                {r.concerns.map((concern, i) => (
                  <li key={i} className="text-[15px] leading-[1.5] text-steel">
                    {prose(concern)}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      ) : (
        <p className="mt-5 text-[15px] leading-[1.6] text-steel">
          This node did not receive the image, so it could see nothing either way. A node that
          cannot see the evidence votes against every outcome rather than guessing at one.
        </p>
      )}
    </li>
  );
}

export default function RoundPage({
  params,
}: {
  params: Promise<{ mid: string; n: string }>;
}) {
  const { mid, n } = use(params);
  const number = Number(n);
  const round = useChain<Round | null>(`round.${mid}.${number}`, () => getRound(mid, number));

  if (round.loading) {
    return (
      <Band tone="white">
        <Loading what="this reading" />
      </Band>
    );
  }
  if (round.error) {
    return (
      <Band tone="white">
        <ReadFailure what="this reading" />
      </Band>
    );
  }
  if (!round.data) {
    return (
      <Band tone="white">
        <Heading title="No such reading" lead="This milestone has no reading by that number." />
      </Band>
    );
  }

  const r = round.data;
  const lineIds = Object.keys(r.lines).sort();
  const critIds = Object.keys(r.criteria).sort();

  return (
    <>
      <Band tone="white">
        <div className="max-w-[820px]">
          <p className="type-caption mb-5 uppercase tracking-[0.08em] text-slate">
            {roundName(r.kind, r.round)}
            {r.reviewed_round ? `, reviewing round ${r.reviewed_round}` : ""}
          </p>
          <h1 className="type-heading-lg">{decision(r.decision)}</h1>
          <blockquote className="mt-6 border-l-2 border-mist pl-5 text-[18px] leading-[1.6] text-steel">
            {r.notes.reasoning}
            <cite className="type-caption mt-2 block not-italic">The panel&apos;s own words.</cite>
          </blockquote>
          <div className="mt-8 flex flex-wrap gap-3">
            <Tag muted>Evidence {quality(r.quality).toLowerCase()}</Tag>
            <Tag muted>Recorded {moment(r.at)}</Tag>
            <Tag muted>Terms version {r.version}</Tag>
          </div>
          <p className="type-caption mt-8">
            <EmberLink href={`/milestones/${mid}`}>Back to the milestone</EmberLink>
          </p>
        </div>
      </Band>

      <Band tone="ash">
        <Heading
          eyebrow="Line by line"
          title="What the panel found"
          lead="The lines and criteria the contract used to derive the decision are marked; the others were recorded but did not change the outcome."
        />
        <DataCard>
          <ul>
            {lineIds.map((id) => {
              const drove = r.decisive.lines.includes(id);
              const basis = r.notes.basis[id] ?? [];
              return (
                <li key={id} className="border-t border-mist px-10 py-6 first:border-t-0">
                  <div className="flex flex-col gap-3 md:flex-row md:items-baseline md:justify-between">
                    <span className="figure text-[15px] text-slate">Line {id}</span>
                    <span
                      className={`display text-[17px] ${
                        drove ? "underline decoration-ember decoration-2 underline-offset-4" : ""
                      }`}
                    >
                      {lineStatus(r.lines[id] ?? "")}
                    </span>
                  </div>
                  {r.notes.line_notes[id] ? (
                    <blockquote className="mt-4 max-w-[720px] border-l-2 border-mist pl-5 text-[15px] leading-[1.55] text-steel">
                      {prose(r.notes.line_notes[id])}
                      {wasCut(r.notes.line_notes[id]) ? "…" : ""}
                      <cite className="type-caption mt-2 block not-italic">
                        The panel&apos;s own words
                        {wasCut(r.notes.line_notes[id])
                          ? ", cut where the contract caps a note at 200 characters."
                          : "."}
                      </cite>
                    </blockquote>
                  ) : null}
                  <p className="type-caption mt-3">
                    {basis.length
                      ? `Rested on ${basis.map((e) => itemName(e)).join(", ")}.`
                      : "Rested on nothing the panel cited."}
                    {r.notes.lines_raw[id] && r.notes.lines_raw[id] !== r.lines[id]
                      ? ` The panel said ${lineStatus(r.notes.lines_raw[id] ?? "").toLowerCase()}; the contract downgraded it because what it rested on could not carry that finding.`
                      : ""}
                  </p>
                </li>
              );
            })}
          </ul>
        </DataCard>

        {critIds.length ? (
          <div className="mt-10">
            <h3 className="type-subheading mb-5">Criteria</h3>
            <DataCard>
              <ul>
                {critIds.map((id) => {
                  const drove = r.decisive.criteria.includes(id);
                  const basis = r.notes.criteria_basis[id] ?? [];
                  return (
                    <li
                      key={id}
                      className="border-t border-mist px-10 py-6 first:border-t-0"
                    >
                      <div className="flex flex-col gap-3 md:flex-row md:items-baseline md:justify-between">
                        <span className="figure text-[15px] text-slate">Criterion {id}</span>
                        <span
                          className={`display text-[17px] ${
                            drove ? "underline decoration-ember decoration-2 underline-offset-4" : ""
                          }`}
                        >
                          {criterionStatus(r.criteria[id] ?? "")}
                        </span>
                      </div>
                      <p className="type-caption mt-3">
                        {basis.length
                          ? `Rested on ${basis.map((e) => itemName(e)).join(", ")}.`
                          : "Rested on nothing the panel cited."}
                      </p>
                    </li>
                  );
                })}
              </ul>
            </DataCard>
          </div>
        ) : null}
      </Band>

      <Band tone="white">
        <Heading
          eyebrow="The reading itself"
          title="What the panel saw in each photograph"
          lead="Before judging anything, the panel is asked only to describe what is visible and transcribe any text it can read. It is not told what the schedule says, so it cannot read the answer into the picture."
        />
        {r.notes.images.length === 0 ? (
          <Empty>No photograph was put to this panel.</Empty>
        ) : (
          <DataCard>
            <ul>
              {r.notes.images.map((reading, i) => (
                <Reading key={`${reading.item_id}-${i}`} r={reading} />
              ))}
            </ul>
          </DataCard>
        )}
      </Band>

      <Band tone="ash">
        <Heading
          title="The evidence this reading held"
          lead="Recorded with the round, so a later reader knows exactly which items were in front of the panel."
        />
        <DataCard>
          <ul>
            {r.evidence.map((e) => (
              <li
                key={e.item_id}
                className="flex flex-col gap-2 border-t border-mist px-10 py-5 first:border-t-0 md:flex-row md:items-baseline md:justify-between"
              >
                <span className="text-[15px] text-graphite">
                  {itemName(e.item_id)}, {itemKind(e.kind).toLowerCase()} from the{" "}
                  {roleLower(e.role)}
                  {e.new ? ", filed for the appeal" : ""}
                </span>
                <span className="figure text-[13px] text-slate">{shortDigest(e.sha256)}</span>
              </li>
            ))}
          </ul>
        </DataCard>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          <Field label="Reading">{roundName(r.kind, r.round)}</Field>
          <Field label="Asked for by">a party to the project</Field>
          <Field label="Evidence judged">
            {r.evidence.length} {r.evidence.length === 1 ? "item" : "items"}
          </Field>
        </div>
      </Band>
    </>
  );
}
