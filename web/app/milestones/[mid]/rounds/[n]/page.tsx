"use client";

/**
 * What each node actually saw.
 *
 * This is the page for a reader who does not believe the verdict. Before
 * judging anything, every node is asked only to describe what is visible and
 * transcribe any text on a label, without being shown the schedule; those
 * readings are kept, and they are reproduced here verbatim. A node that
 * received no image says so, and says nothing else.
 */
import Link from "next/link";
import { use } from "react";

import { Loading, ReadFailure } from "@/components/bits";
import {
  decision, lineName, lineStatus, moment, prose, quality, referenceNames, roleLower, roundName, writeOut,
} from "@/lib/present";
import { getMilestone, getRound } from "@/lib/read";
import type { ImageReading, Milestone, Round } from "@/lib/types";
import { useChain } from "@/lib/useChain";


function Reading({ r, n }: { r: ImageReading; n: number }) {
  const ordinal = ["first", "second", "third", "fourth", "fifth", "sixth"][n] ?? `${n + 1}th`;
  return (
    <li className="border-t border-mist py-10">
      <p className="type-caption">
        The {ordinal} item, filed by the {roleLower(r.role)}
      </p>

      {r.readable ? (
        <>
          <p className="mt-5 max-w-[62ch] text-[17px] leading-[1.6] text-steel">
            {prose(r.shows)}
          </p>
          {r.labels.length ? (
            <div className="mt-8">
              <p className="type-caption mb-3">Text it could read on a label</p>
              <ul className="flex flex-col gap-1.5">
                {r.labels.map((label, i) => (
                  <li key={i} className="figure text-[15px] leading-[1.45] text-graphite">
                    {prose(label)}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="type-caption mt-4">No text on a label was legible.</p>
          )}
          {r.concerns.length ? (
            <div className="mt-8">
              <p className="type-caption mb-3">What it thought worth flagging</p>
              <ul className="flex flex-col gap-1.5">
                {r.concerns.map((c, i) => (
                  <li key={i} className="text-[15px] leading-[1.5] text-steel">
                    {prose(c)}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      ) : (
        <p className="mt-5 max-w-[62ch] text-[17px] leading-[1.6] text-steel">
          This node never received the photograph, so it could see nothing either way. A node
          that cannot see the evidence votes against every outcome rather than guessing at one.
        </p>
      )}
    </li>
  );
}

export default function ReadingPage({
  params,
}: {
  params: Promise<{ mid: string; n: string }>;
}) {
  const { mid, n } = use(params);
  const number = Number(n);
  const round = useChain<Round | null>(`round.${mid}.${number}`, () => getRound(mid, number));
  const milestone = useChain<Milestone | null>(`milestone.${mid}`, (fresh) =>
    getMilestone(mid, fresh),
  );

  const frame = "mx-auto w-full max-w-[1200px] px-5 md:px-10";

  if (round.loading) return <div className={`${frame} py-24`}><Loading what="this reading" /></div>;
  if (round.error) return <div className={`${frame} py-24`}><ReadFailure what="this reading" /></div>;
  if (!round.data) {
    return (
      <div className={`${frame} py-24`}>
        <h1 className="type-heading">Nothing here</h1>
        <p className="mt-4 text-[15px] text-steel">This case has no reading by that number.</p>
      </div>
    );
  }

  const r = round.data;
  const terms = milestone.data?.versions.find((v) => v.version === r.version);
  const lines = terms?.equipment ?? [];
  const names = referenceNames(lines, terms?.criteria ?? []);

  return (
    <div className={frame}>
      <header className="border-b border-mist py-20">
        <p className="type-caption">
          {roundName(r.kind, r.round)}
          {r.reviewed_round ? ", judging the case again from the start" : ""}
        </p>
        <h1 className="mt-6 text-[clamp(44px,7vw,92px)] font-normal leading-[0.92] tracking-[-0.03em] text-graphite [font-family:var(--font-display)]">
          {decision(r.decision)}
        </h1>
        <p className="mt-8 max-w-[62ch] text-[18px] leading-[1.55] text-steel">
          {writeOut(r.notes.reasoning, names)}
        </p>
        {r.appeal_reason ? (
          <div className="mt-10 max-w-[62ch] border-l-2 border-ember pl-6">
            <p className="type-caption mb-2">The owner contested the earlier decision, saying</p>
            <p className="text-[17px] leading-[1.6] text-steel">{prose(r.appeal_reason)}</p>
            <p className="type-caption mt-3">
              The panel is told this is an argument about the evidence, and cannot itself
              establish or refute anything.
            </p>
          </div>
        ) : null}
        <div className="mt-10 flex flex-wrap items-center gap-6">
          <span className="type-caption">Evidence {quality(r.quality).toLowerCase()}</span>
          <span className="type-caption">Read {moment(r.at)}</span>
          <Link href={`/milestones/${mid}`} className="type-caption hover:text-graphite">
            Back to the case
          </Link>
        </div>
      </header>

      <section className="py-20">
        <h2 className="display mb-4 text-[14px] uppercase tracking-[0.12em] text-slate">
          Before it judged anything
        </h2>
        <p className="mb-10 max-w-[62ch] text-[17px] leading-[1.6] text-steel">
          Each node was asked only to describe what it could see and transcribe any text on a
          label. It was not shown the schedule, so it could not read the expected answer into the
          picture.
        </p>
        {r.notes.images.length === 0 ? (
          <p className="text-[15px] text-slate">No photograph was put to this panel.</p>
        ) : (
          <ul>
            {r.notes.images.map((reading, i) => (
              <Reading key={`${reading.item_id}-${i}`} r={reading} n={i} />
            ))}
          </ul>
        )}
      </section>

      {lines.length ? (
        <section className="border-t border-mist py-20">
          <h2 className="display mb-10 text-[14px] uppercase tracking-[0.12em] text-slate">
            Then, line by line
          </h2>
          <ul>
            {lines.map((l) => {
              const drove = r.decisive.lines.includes(l.id);
              const note = r.notes.line_notes[l.id];
              return (
                <li
                  key={l.id}
                  className="grid gap-4 border-t border-mist py-8 md:grid-cols-[minmax(0,1fr)_minmax(0,300px)] md:gap-12"
                >
                  <div className="min-w-0">
                    <p className="text-[20px] leading-[1.25] tracking-[-0.02em] text-graphite [font-family:var(--font-display)]">
                      {lineName(l)}
                    </p>
                    {note ? (
                      <p className="mt-3 max-w-[58ch] text-[15px] leading-[1.55] text-steel">
                        {writeOut(note, names)}
                      </p>
                    ) : null}
                  </div>
                  <p
                    className={`text-[20px] leading-[1.25] tracking-[-0.02em] text-graphite [font-family:var(--font-display)] md:text-right ${
                      drove ? "underline decoration-ember decoration-2 underline-offset-[6px]" : ""
                    }`}
                  >
                    {r.lines[l.id] ? lineStatus(r.lines[l.id]!) : "Not rated"}
                  </p>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
