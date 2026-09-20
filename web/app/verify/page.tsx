"use client";

/**
 * Verification. This is the one page where identifiers, addresses and
 * digests belong in the reading flow, because checking them is the whole
 * purpose of it. Everything here is either read from the chain now or is a
 * constant this build was compiled with, and the page says which.
 */
import {
  Band, Card, DataCard, EmberLink, Heading, Loading, ReadFailure, Tag,
} from "@/components/bits";
import { addressUrl, CHAIN_ID, EXPLORER, RPC_URL } from "@/lib/chain";
import {
  CONTRACT_ADDRESS, IS_RECORD, RECORD_ADDRESS, REPO_URL, SOURCE_SHA256, SOURCE_URL,
} from "@/lib/config";
import { gen, plural } from "@/lib/present";
import proofLog from "@/lib/proof-log.json";
import { getConfig, getStats } from "@/lib/read";
import { useChain } from "@/lib/useChain";

interface ProofRow {
  step: string;
  milestone_id: string;
  round: number;
  decision: string | null;
  lines: Record<string, string> | null;
  seconds: number | null;
  hash: string;
  explorer: string;
}

interface NoConsensusRow {
  step: string;
  hash: string;
  at: string;
  explorer: string;
}

const log = proofLog as {
  address?: string;
  source_commit?: string;
  finished_at?: string;
  proofs?: ProofRow[];
  no_consensus?: NoConsensusRow[];
};

function Line({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-t border-mist px-10 py-5 first:border-t-0 md:flex-row md:items-baseline md:justify-between md:gap-10">
      <dt className="type-caption shrink-0">{label}</dt>
      <dd className="figure break-all text-[14px] text-graphite md:text-right">{children}</dd>
    </div>
  );
}

export default function Verify() {
  const stats = useChain("stats", (fresh) => getStats(fresh));
  const config = useChain("config", () => getConfig());
  const logMatches = log.address?.toLowerCase() === CONTRACT_ADDRESS.toLowerCase();

  return (
    <>
      <Band tone="white">
        <div className="max-w-[820px] pt-6">
          <h1 className="type-heading-lg">Verify this deployment</h1>
          <p className="mt-6 text-[18px] leading-[1.6] text-steel">
            Nothing on these pages is a claim this site is making. The contract is public, its
            source is published, and the transactions that produced every decision are named
            below so you can read them on the explorer rather than take this page&apos;s word.
          </p>
        </div>
      </Band>

      <Band tone="ash">
        <Heading title="The contract" />
        <DataCard>
          <dl>
            <Line label="Address">
              <EmberLink href={addressUrl(CONTRACT_ADDRESS)} external>
                {CONTRACT_ADDRESS}
              </EmberLink>
            </Line>
            <Line label="Is this the deployment of record">
              {IS_RECORD ? "Yes" : `No. The record is ${RECORD_ADDRESS}`}
            </Line>
            <Line label="Chain">GenLayer Studio Next, chain {CHAIN_ID}</Line>
            <Line label="Node this page reads from">{RPC_URL}</Line>
            <Line label="Source">
              <EmberLink href={SOURCE_URL} external>
                contracts/icarus.py
              </EmberLink>
            </Line>
            <Line label="Source digest">{SOURCE_SHA256}</Line>
          </dl>
        </DataCard>
        <p className="type-caption mt-5 max-w-[760px]">
          To check the digest yourself, fetch the contract&apos;s code from the chain and hash it.
          The repository&apos;s deploy script does exactly that:{" "}
          <span className="figure">node scripts/deploy.mjs verify {CONTRACT_ADDRESS}</span>
        </p>
      </Band>

      <Band tone="white">
        <Heading title="What the contract holds now" lead="Read from the chain as this page loads." />
        {stats.loading || config.loading ? <Loading what="the contract's own figures" /> : null}
        {stats.error ? <ReadFailure what="the contract's figures" /> : null}
        {stats.data ? (
          <div className="grid gap-5 md:grid-cols-3">
            <Card>
              <div className="type-caption">Projects</div>
              <div className="figure mt-2 type-heading">{stats.data.projects}</div>
            </Card>
            <Card>
              <div className="type-caption">Milestones</div>
              <div className="figure mt-2 type-heading">{stats.data.milestones}</div>
            </Card>
            <Card>
              <div className="type-caption">Readings recorded</div>
              <div className="figure mt-2 type-heading">{stats.data.rounds}</div>
            </Card>
            <Card>
              <div className="type-caption">Milestones settled</div>
              <div className="figure mt-2 type-heading">{stats.data.finalized}</div>
            </Card>
            <Card>
              <div className="type-caption">Evidence items held</div>
              <div className="figure mt-2 type-heading">{stats.data.evidence_items}</div>
            </Card>
            <Card>
              <div className="type-caption">Paid out</div>
              <div className="figure mt-2 type-heading">{gen(stats.data.paid_wei)}</div>
            </Card>
          </div>
        ) : null}

        {config.data ? (
          <div className="mt-10 flex flex-wrap gap-3">
            <Tag muted>{config.data.ruleset}</Tag>
            <Tag muted>{plural(config.data.images_per_prompt, "image")} per prompt</Tag>
            <Tag muted>
              {Math.round(config.data.max_image_bytes / 1000)} kB per image at most
            </Tag>
            <Tag muted>
              {plural(config.data.max_assessments_per_version, "assessment")} per version
            </Tag>
            <Tag muted>
              An appeal lapses after {Math.round(config.data.appeal_lapse_seconds / 86400)} days
            </Tag>
          </div>
        ) : null}
      </Band>

      <Band tone="ash">
        <Heading
          title="The published proof run"
          lead={
            logMatches
              ? "Every reading below was produced by the transaction named beside it, on this deployment. Open one and read what the panel actually did."
              : "The published proof run was recorded against a different deployment, so it is not shown against this one."
          }
        />
        {logMatches && log.proofs?.length ? (
          <>
            <DataCard>
              <ul>
                {log.proofs.map((p) => (
                  <li key={p.hash} className="border-t border-mist px-10 py-5 first:border-t-0">
                    <div className="flex flex-col gap-2 md:flex-row md:items-baseline md:justify-between md:gap-10">
                      <div className="min-w-0">
                        <span className="text-[15px] text-graphite">
                          {p.milestone_id}, reading {p.round}
                        </span>
                        <span className="type-caption ml-3">
                          {p.decision}
                          {p.lines ? `, ${JSON.stringify(p.lines)}` : ""}
                          {p.seconds ? `, ${p.seconds} s` : ""}
                        </span>
                      </div>
                      <EmberLink href={p.explorer} external>
                        <span className="figure text-[13px]">
                          {p.hash.slice(0, 10)}
                          {"…"}
                        </span>
                      </EmberLink>
                    </div>
                  </li>
                ))}
              </ul>
            </DataCard>

            {log.no_consensus?.length ? (
              <div className="mt-10">
                <h3 className="type-subheading mb-4">
                  Rounds that reached no majority
                </h3>
                <p className="mb-5 max-w-[760px] text-[15px] leading-[1.6] text-steel">
                  These are published because a proof log that shows only the attempt that
                  carried is not a proof log. A round that reaches no majority records nothing
                  and leaves the milestone untouched, so it was simply asked again.
                </p>
                <DataCard>
                  <ul>
                    {log.no_consensus.map((r) => (
                      <li
                        key={r.hash}
                        className="flex flex-col gap-2 border-t border-mist px-10 py-5 first:border-t-0 md:flex-row md:items-baseline md:justify-between"
                      >
                        <span className="text-[15px] text-graphite">{r.step}</span>
                        <EmberLink href={r.explorer} external>
                          <span className="figure text-[13px]">
                            {r.hash.slice(0, 10)}
                            {"…"}
                          </span>
                        </EmberLink>
                      </li>
                    ))}
                  </ul>
                </DataCard>
              </div>
            ) : null}

            <p className="type-caption mt-5">
              Recorded from commit{" "}
              <span className="figure">{log.source_commit || "unrecorded"}</span>.
            </p>
          </>
        ) : null}
      </Band>

      <Band tone="white">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <p className="max-w-[560px] text-[15px] leading-[1.6] text-steel">
            The contract source, the test suite, the mutation sweep and the full log of the live
            proof run are all in the repository.
          </p>
          <div className="flex flex-wrap items-center gap-5">
            <EmberLink href={REPO_URL} external>
              The repository
            </EmberLink>
            <EmberLink href={`${EXPLORER}/address/${CONTRACT_ADDRESS}`} external>
              The contract on the explorer
            </EmberLink>
          </div>
        </div>
      </Band>
    </>
  );
}
