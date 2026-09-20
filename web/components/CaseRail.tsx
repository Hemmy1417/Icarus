"use client";

/**
 * The record as a horizontal rail of cases: one card per milestone that a
 * panel has actually read, carrying its verdict as the largest thing on it.
 *
 * A rail rather than a list, because these are peers to be scanned across,
 * not a hierarchy to be descended. Each card says the outcome and the site,
 * and nothing else; a reader who wants the evidence opens the case.
 */
import Link from "next/link";

import { Loading, ReadFailure } from "./bits";
import { decision, gen, milestoneState } from "@/lib/present";
import { getProject, listProjects } from "@/lib/read";
import type { MilestoneSummary, Project } from "@/lib/types";
import { useChain } from "@/lib/useChain";

interface Case {
  milestone: MilestoneSummary;
  site: string;
}

export function CaseRail({ limit = 8 }: { limit?: number }) {
  const rail = useChain<Case[]>("rail", async (fresh) => {
    const list = await listProjects(0, 12, fresh);
    const projects = (await Promise.all(list.project_ids.map((id) => getProject(id, fresh))))
      .filter((p): p is Project => !!p);
    return projects
      .flatMap((p) => p.milestone_summaries.map((m) => ({ milestone: m, site: p.title })))
      .filter((c) => c.milestone.rounds_count > 0)
      .reverse();
  });

  if (rail.loading) return <Loading what="the record" />;
  if (rail.error) return <ReadFailure what="the record" />;
  if (!rail.data?.length) {
    return <p className="text-[15px] text-slate">No milestone has been read yet.</p>;
  }

  return (
    <ul className="-mx-5 flex snap-x snap-mandatory gap-5 overflow-x-auto px-5 pb-4 md:-mx-10 md:px-10">
      {rail.data.slice(0, limit).map(({ milestone: m, site }) => {
        const said = m.standing ? decision(m.standing.decision) : milestoneState(m.state);
        const paid = m.state === "FINALIZED";
        return (
          <li key={m.milestone_id} className="w-[82vw] shrink-0 snap-start sm:w-[340px]">
            <Link
              href={`/milestones/${m.milestone_id}`}
              className="flex h-full flex-col justify-between rounded-tl-[6px] bg-ash p-8 transition-colors hover:bg-ivory"
            >
              <div>
                <p className="type-caption">{site}</p>
                <p className="mt-6 text-[34px] leading-[1.05] tracking-[-0.02em] text-graphite [font-family:var(--font-display)]">
                  {said}
                </p>
                {paid ? (
                  <p className="type-caption mt-2 text-brass">
                    Settled, and the installer drew the payment.
                  </p>
                ) : null}
              </div>
              <p className="mt-10 text-[15px] leading-[1.4] text-steel">{m.title}</p>
              <p className="type-caption mt-4">{gen(m.payment_wei)}</p>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
