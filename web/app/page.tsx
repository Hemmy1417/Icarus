"use client";

/**
 * The cover. It makes one argument and then shows the argument being made:
 * a milestone pays when the evidence shows the equipment the contract named
 * was installed, and a document saying so is not that evidence.
 *
 * The worked example is read from the chain when the page loads. It has a
 * loading state and a failure state, because a section that quietly vanishes
 * on a failed read tells a reader there is nothing there, which is a
 * different and false claim.
 */
import Link from "next/link";

import { Band, Button, Card, DataCard, EmberLink, Heading, Loading, ReadFailure, Tag } from "@/components/bits";
import { Schedule } from "@/components/Schedule";
import { FEATURED_MILESTONE, IS_RECORD, REPO_URL } from "@/lib/config";
import { decision, gen, lineStatus, milestoneState, moment, quality, roundName } from "@/lib/present";
import { getMilestone, getRound } from "@/lib/read";
import type { Milestone, Round } from "@/lib/types";
import { useChain } from "@/lib/useChain";

const FINDINGS: Array<{ status: string; when: string }> = [
  { status: "INSTALLED", when: "A photograph shows the item, and where the line asks for it, the nameplate identifies it." },
  { status: "UNIDENTIFIED", when: "Something of that kind is shown, but nothing identifies it as the item named." },
  { status: "NOT_SHOWN", when: "Nothing in the evidence establishes the line either way." },
  { status: "ABSENT", when: "The evidence shows that what is installed is not what the schedule names." },
  { status: "CONTRADICTED", when: "Two pieces of evidence disagree with each other about the line." },
];

function WorkedExample() {
  const example = useChain<{ milestone: Milestone; round: Round | null } | null>(
    FEATURED_MILESTONE || null,
    async () => {
      const milestone = await getMilestone(FEATURED_MILESTONE, true);
      if (!milestone) return null;
      const n = milestone.standing?.round ?? milestone.rounds_count;
      const round = n ? await getRound(FEATURED_MILESTONE, n) : null;
      return { milestone, round };
    },
  );

  if (!FEATURED_MILESTONE) return null;

  if (example.loading) return <Loading what="the worked example" />;
  if (example.error) {
    return <ReadFailure what="the worked example" detail="The chain did not answer in time." />;
  }
  if (!example.data) return null;

  const { milestone, round } = example.data;
  const terms = milestone.versions.find((v) => v.version === milestone.current_version);
  if (!terms) return null;

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_420px] lg:items-start">
      <Schedule
        lines={terms.equipment}
        found={round?.lines}
        decisive={round?.decisive.lines ?? []}
        notes={round?.notes.line_notes}
      />

      <div className="rounded-tl-[6px] bg-ivory p-10">
        <p className="type-caption mb-5 uppercase tracking-[0.08em] text-brass">
          The decision record
        </p>
        <h3 className="type-heading-lg">{terms.title}</h3>
        <p className="mt-5 text-[15px] leading-[1.6] text-steel">{terms.specification}</p>

        {round ? (
          <>
            <dl className="mt-8 flex flex-col gap-4">
              <div className="flex items-baseline justify-between gap-5 border-t border-mist pt-4">
                <dt className="type-caption">Decision</dt>
                <dd className="display text-[17px]">{decision(round.decision)}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-5 border-t border-mist pt-4">
                <dt className="type-caption">Read by</dt>
                <dd className="text-[15px] text-graphite">{roundName(round.kind, round.round)}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-5 border-t border-mist pt-4">
                <dt className="type-caption">Evidence</dt>
                <dd className="text-[15px] text-graphite">{quality(round.quality)}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-5 border-t border-mist pt-4">
                <dt className="type-caption">Payment</dt>
                <dd className="figure text-[15px] text-graphite">{gen(terms.payment_wei)}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-5 border-t border-mist pt-4">
                <dt className="type-caption">Standing</dt>
                <dd className="text-[15px] text-graphite">{milestoneState(milestone.state)}</dd>
              </div>
            </dl>

            <blockquote className="mt-8 border-l-2 border-mist pl-5 text-[15px] leading-[1.6] text-steel">
              {round.notes.reasoning}
            </blockquote>
            <p className="type-caption mt-4">
              The panel&apos;s own words, recorded {moment(round.at)}.
            </p>

            <div className="mt-8">
              <EmberLink href={`/milestones/${milestone.milestone_id}`}>
                Read the whole record
              </EmberLink>
            </div>
          </>
        ) : (
          <p className="mt-8 text-[15px] text-steel">No panel has read this milestone yet.</p>
        )}
      </div>
    </div>
  );
}

export default function Cover() {
  return (
    <>
      <Band tone="white">
        <div className="max-w-[900px] pt-6">
          <h1 className="type-display">
            A milestone pays when the evidence shows it.
          </h1>
          <p className="mt-8 max-w-[640px] text-[18px] leading-[1.6] text-steel">
            Icarus settles renewable energy installation milestones against the equipment
            schedule they were written from. A panel of validators reads the photographs for
            itself, line by line, and the contract derives the decision from what they found.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-5">
            <Link href="/projects">
              <Button>Read the record</Button>
            </Link>
            <EmberLink href="/how">How it decides</EmberLink>
          </div>
        </div>
      </Band>

      <Band tone="ash">
        <Heading
          eyebrow="The unit of judgment"
          title="Every line, found or not found"
          lead={
            <>
              A schedule line is a piece of equipment the contract named: a manufacturer, a
              model, a rating. A panel reports one of five findings against each line, and it
              reports what it saw rather than what it concludes. The contract turns those
              findings into the decision, so no model is ever asked whether a milestone should
              pay.
            </>
          }
        />
        <DataCard>
          <ul>
            {FINDINGS.map((f) => (
              <li key={f.status} className="border-t border-mist px-10 py-6 first:border-t-0">
                <div className="flex flex-col gap-3 md:flex-row md:items-baseline md:gap-8">
                  <div className="display w-[180px] shrink-0 text-[17px]">
                    {lineStatus(f.status)}
                  </div>
                  <p className="text-[15px] leading-[1.55] text-steel">{f.when}</p>
                </div>
              </li>
            ))}
          </ul>
        </DataCard>
        <p className="mt-8 max-w-[720px] text-[15px] leading-[1.6] text-steel">
          A single line found absent rejects the milestone. A single line left in doubt leaves
          it undetermined, and nothing pays on doubt.
        </p>
      </Band>

      <Band tone="white">
        <Heading
          eyebrow="The floor"
          title="A document is not a photograph"
          lead={
            <>
              A datasheet naming exactly the right model does not establish that the model was
              installed. Only an image, or an independent inspector&apos;s report, witnesses the
              site; a document written by the owner or the installer is that party&apos;s own
              account, whichever party wrote it. This is enforced in code, not asked of a model:
              a line rated installed whose basis holds no image is downgraded to doubt before
              the decision is derived.
            </>
          }
        />
        <div className="grid gap-5 md:grid-cols-3">
          <Card>
            <h3 className="type-subheading">The bytes are on chain</h3>
            <p className="mt-4 text-[15px] leading-[1.55] text-steel">
              A photograph is stored and hashed by the contract, so every validator judges the
              same bytes and no later round has to trust a link that could have changed.
            </p>
          </Card>
          <Card>
            <h3 className="type-subheading">A blind node cannot vote</h3>
            <p className="mt-4 text-[15px] leading-[1.55] text-steel">
              A validator that did not receive the images says so, and a node that cannot see
              the evidence votes against every outcome rather than guessing at one.
            </p>
          </Card>
          <Card>
            <h3 className="type-subheading">The panel reports, the code decides</h3>
            <p className="mt-4 text-[15px] leading-[1.55] text-steel">
              Validators are asked what they observed against each line. Accepted, rejected and
              undetermined are derived from those findings by the contract.
            </p>
          </Card>
        </div>
      </Band>

      {IS_RECORD ? (
        <Band tone="ash">
          <Heading
            eyebrow="A worked example"
            title="One milestone, read end to end"
            lead={
              <>
                This is read from the deployment of record as the page loads. It is not a
                mock-up: the schedule, the findings and the reasoning below are what the panel
                recorded.
              </>
            }
          />
          <WorkedExample />
        </Band>
      ) : null}

      <Band tone="white">
        <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <div className="max-w-[560px]">
            <h2 className="type-heading">Check it yourself</h2>
            <p className="mt-5 text-[15px] leading-[1.6] text-steel">
              Every decision on these pages names the round that produced it and the evidence it
              rested on. The contract source, the tests and the live proof run are in the
              repository.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Tag muted>Studio Next</Tag>
              <Tag muted>Evidence held on chain</Tag>
              <Tag muted>Decision derived in code</Tag>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-5">
            <Link href="/verify">
              <Button variant="secondary">Verify the deployment</Button>
            </Link>
            <EmberLink href={REPO_URL} external>
              The source
            </EmberLink>
          </div>
        </div>
      </Band>
    </>
  );
}
