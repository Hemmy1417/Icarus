"use client";

/**
 * A site, and the cases running on it.
 *
 * The escrow is stated as three separate facts, because reserved, unreserved
 * and paid are three different things and collapsing them would hide which
 * money is actually committed. Everything else here is a list of cases.
 */
import Link from "next/link";
import { use } from "react";

import { Acts } from "@/components/Acts";
import { Loading, ReadFailure } from "@/components/bits";
import { projectActs } from "@/lib/acts";
import { day, decision, gen, milestoneState, projectState, systemType } from "@/lib/present";
import { getProject } from "@/lib/read";
import type { Project } from "@/lib/types";
import { useChain } from "@/lib/useChain";
import { useWallet } from "@/lib/wallet";

export default function Site({ params }: { params: Promise<{ pid: string }> }) {
  const { pid } = use(params);
  const wallet = useWallet();
  const project = useChain<Project | null>(`project.${pid}`, (fresh) => getProject(pid, fresh));

  const frame = "mx-auto w-full max-w-[1200px] px-5 md:px-10";

  if (project.loading) return <div className={`${frame} py-24`}><Loading what="this site" /></div>;
  if (project.error) return <div className={`${frame} py-24`}><ReadFailure what="this site" /></div>;
  if (!project.data) {
    return (
      <div className={`${frame} py-24`}>
        <h1 className="type-heading">Nothing here</h1>
        <p className="mt-4 text-[15px] text-steel">No site on this deployment carries that name.</p>
      </div>
    );
  }

  const p = project.data;
  const acts = projectActs(p, wallet.address);

  return (
    <div className={frame}>
      <header className="border-b border-mist py-20">
        <p className="type-caption">{systemType(p.system_type)}</p>
        <h1 className="mt-6 max-w-[18ch] text-[clamp(40px,6vw,76px)] font-normal leading-[0.95] tracking-[-0.03em] text-graphite [font-family:var(--font-display)]">
          {p.title}
        </h1>
        <p className="mt-8 max-w-[58ch] text-[18px] leading-[1.55] text-steel">{p.description}</p>
        <div className="mt-10 flex flex-wrap items-center gap-6">
          <span className="type-caption">{projectState(p.state)}</span>
          {p.site ? <span className="type-caption">{p.site}</span> : null}
          {p.capacity_kw ? <span className="type-caption">{p.capacity_kw} kW</span> : null}
          <span className="type-caption">
            {p.inspector ? "An inspector is appointed" : "No independent inspector"}
          </span>
        </div>
      </header>

      <section className="py-20">
        <h2 className="display mb-10 text-[14px] uppercase tracking-[0.12em] text-slate">
          The cases
        </h2>
        {p.milestone_summaries.length === 0 ? (
          <p className="text-[15px] text-slate">No case has been proposed on this site yet.</p>
        ) : (
          <ul className="border-t border-mist">
            {p.milestone_summaries.map((m) => {
              const said = m.standing ? decision(m.standing.decision) : milestoneState(m.state);
              return (
                <li key={m.milestone_id}>
                  <Link
                    href={`/milestones/${m.milestone_id}`}
                    className="group grid gap-4 border-b border-mist py-9 md:grid-cols-[minmax(0,1fr)_minmax(0,300px)] md:items-baseline md:gap-12"
                  >
                    <p className="text-[24px] leading-[1.2] tracking-[-0.02em] text-graphite [font-family:var(--font-display)]">
                      {m.title}
                    </p>
                    <div className="md:text-right">
                      <p className="text-[24px] leading-[1.2] tracking-[-0.02em] text-graphite [font-family:var(--font-display)] group-hover:underline group-hover:decoration-ember group-hover:decoration-2 group-hover:underline-offset-[6px]">
                        {said}
                      </p>
                      <p className="type-caption mt-2">
                        {gen(m.payment_wei)}, due {day(m.deadline)}
                      </p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="grid gap-10 border-t border-mist py-20 md:grid-cols-3">
        <div>
          <p className="type-caption">Held in escrow</p>
          <p className="figure mt-3 text-[32px] leading-none tracking-[-0.02em] text-graphite [font-family:var(--font-display)]">
            {gen(p.escrow_wei)}
          </p>
        </div>
        <div>
          <p className="type-caption">Committed to cases</p>
          <p className="figure mt-3 text-[32px] leading-none tracking-[-0.02em] text-graphite [font-family:var(--font-display)]">
            {gen(p.reserved_wei)}
          </p>
        </div>
        <div>
          <p className="type-caption">Paid out</p>
          <p className="figure mt-3 text-[32px] leading-none tracking-[-0.02em] text-graphite [font-family:var(--font-display)]">
            {gen(p.paid_wei)}
          </p>
        </div>
        <p className="type-caption md:col-span-3">
          A payment is never pushed. It becomes a claim the installer draws themselves.
        </p>
      </section>

      {acts.length ? (
        <section className="border-t border-mist py-20">
          <Acts
            acts={acts}
            args={{
              accept_project: [pid],
              accept_inspector_role: [pid],
              fund_project: [pid],
              withdraw_escrow: [pid],
              cancel_project: [pid],
              add_milestone: [pid],
            }}
            heading="What you can do on this site"
          />
        </section>
      ) : null}
    </div>
  );
}
