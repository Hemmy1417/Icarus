"use client";

/**
 * Verification.
 *
 * The rest of this interface keeps machine values off the page. Here they
 * are the point, so they are present, but recessed: the page states in
 * words what can be checked, and the addresses and digests needed to check
 * it sit behind a disclosure for the reader who opens it.
 */
import { Loading, ReadFailure } from "@/components/bits";
import { addressUrl, CHAIN_ID, RPC_URL } from "@/lib/chain";
import { CONTRACT_ADDRESS, IS_RECORD, REPO_URL, SOURCE_SHA256, SOURCE_URL } from "@/lib/config";
import { gen } from "@/lib/present";
import proofLog from "@/lib/proof-log.json";
import { getStats } from "@/lib/read";
import { useChain } from "@/lib/useChain";

interface ProofRow {
  milestone_id: string;
  round: number;
  decision: string | null;
  seconds: number | null;
  hash: string;
  explorer: string;
}

const log = proofLog as {
  address?: string;
  source_commit?: string;
  proofs?: ProofRow[];
  no_consensus?: Array<{ step: string; hash: string; explorer: string }>;
};

function Machine({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-t border-mist py-4 md:flex-row md:items-baseline md:justify-between md:gap-10">
      <dt className="type-caption shrink-0">{label}</dt>
      <dd className="figure break-all text-[13px] text-steel md:text-right">{children}</dd>
    </div>
  );
}

export default function Verify() {
  const stats = useChain("stats", (fresh) => getStats(fresh));
  const mine = log.address?.toLowerCase() === CONTRACT_ADDRESS.toLowerCase();

  return (
    <div className="mx-auto w-full max-w-[1200px] px-5 md:px-10">
      <header className="py-20">
        <h1 className="max-w-[18ch] text-[clamp(40px,6vw,76px)] font-normal leading-[0.95] tracking-[-0.03em] text-graphite [font-family:var(--font-display)]">
          Take none of this on trust.
        </h1>
        <p className="mt-8 max-w-[54ch] text-[19px] leading-[1.5] text-steel">
          Nothing on these pages is a claim this site makes. The contract is public, its source
          is published, and every decision was produced by a transaction you can open on the
          explorer.
        </p>
      </header>

      <section className="border-t border-mist py-16">
        <div className="grid gap-10 md:grid-cols-[minmax(0,360px)_minmax(0,1fr)] md:gap-16">
          <h2 className="text-[24px] leading-[1.2] tracking-[-0.02em] text-graphite [font-family:var(--font-display)]">
            The contract running here is the one in the repository.
          </h2>
          <div className="max-w-[58ch]">
            <p className="text-[17px] leading-[1.6] text-steel">
              Its code can be fetched from the chain and hashed. That digest matches the source
              file byte for byte, and the repository&apos;s deploy script does exactly this check
              for you.
            </p>
            {!IS_RECORD ? (
              <p className="mt-5 text-[17px] leading-[1.6] text-steel">
                This build is pointed at a deployment other than the one of record, so what you
                are reading is a test.
              </p>
            ) : null}
            <details className="mt-8">
              <summary className="type-caption cursor-pointer select-none hover:text-graphite">
                The addresses and digests to check it with
              </summary>
              <dl className="mt-4">
                <Machine label="Contract">
                  <a
                    href={addressUrl(CONTRACT_ADDRESS)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline decoration-ember decoration-2 underline-offset-4"
                  >
                    {CONTRACT_ADDRESS}
                  </a>
                </Machine>
                <Machine label="Chain">GenLayer Studio Next, {CHAIN_ID}</Machine>
                <Machine label="Node this page reads">{RPC_URL}</Machine>
                <Machine label="Source digest">{SOURCE_SHA256}</Machine>
                <Machine label="Check it yourself">
                  node scripts/deploy.mjs verify {CONTRACT_ADDRESS}
                </Machine>
              </dl>
              <p className="type-caption mt-4">
                <a
                  href={SOURCE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-graphite"
                >
                  The source file
                </a>
              </p>
            </details>
          </div>
        </div>
      </section>

      <section className="border-t border-mist py-16">
        {stats.loading ? <Loading what="the contract's own figures" /> : null}
        {stats.error ? <ReadFailure what="the contract's figures" /> : null}
        {stats.data ? (
          <div className="grid grid-cols-2 gap-10 md:grid-cols-4">
            {[
              ["Cases", stats.data.milestones],
              ["Readings", stats.data.rounds],
              ["Settled", stats.data.finalized],
              ["Paid out", gen(stats.data.paid_wei)],
            ].map(([label, value]) => (
              <div key={String(label)}>
                <p className="type-caption">{label}</p>
                <p className="figure mt-3 text-[32px] leading-none tracking-[-0.02em] text-graphite [font-family:var(--font-display)]">
                  {value}
                </p>
              </div>
            ))}
          </div>
        ) : null}
        <p className="type-caption mt-8">Read from the chain as this page loaded.</p>
      </section>

      {mine && log.proofs?.length ? (
        <section className="border-t border-mist py-16">
          <div className="grid gap-10 md:grid-cols-[minmax(0,360px)_minmax(0,1fr)] md:gap-16">
            <h2 className="text-[24px] leading-[1.2] tracking-[-0.02em] text-graphite [font-family:var(--font-display)]">
              Every reading was produced by a transaction.
            </h2>
            <div className="max-w-[58ch]">
              <p className="text-[17px] leading-[1.6] text-steel">
                A contract cannot know its own transaction hash, so the pairing below was
                recorded from the run&apos;s receipts and committed with it. Open one and read
                what the panel actually did.
              </p>
              <details className="mt-8">
                <summary className="type-caption cursor-pointer select-none hover:text-graphite">
                  The {log.proofs.length} transactions
                </summary>
                <ul className="mt-4">
                  {log.proofs.map((p) => (
                    <li
                      key={p.hash}
                      className="flex flex-wrap items-baseline justify-between gap-4 border-t border-mist py-4"
                    >
                      <span className="type-caption">
                        {p.decision}
                        {p.seconds ? `, ${p.seconds} s` : ""}
                      </span>
                      <a
                        href={p.explorer}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="figure text-[13px] text-steel underline decoration-ember decoration-2 underline-offset-4"
                      >
                        {p.hash.slice(0, 14)}
                        {"…"}
                      </a>
                    </li>
                  ))}
                </ul>
                {log.no_consensus?.length ? (
                  <p className="type-caption mt-5">
                    {log.no_consensus.length} round(s) reached no majority, recorded nothing, and
                    were asked again. They are kept in the log rather than dropped.
                  </p>
                ) : (
                  <p className="type-caption mt-5">
                    Every round reached a majority on its first asking.
                  </p>
                )}
              </details>
            </div>
          </div>
        </section>
      ) : null}

      <section className="border-t border-mist py-16">
        <a
          href={REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="display text-[17px] text-graphite underline decoration-ember decoration-2 underline-offset-[6px] hover:decoration-graphite"
        >
          The source, the tests and the full proof run
        </a>
      </section>
    </div>
  );
}
