"use client";

/**
 * The record, as an index.
 *
 * Every milestone a panel has read, one row each, ordered newest first. A
 * row carries the site, what was contracted and what was found, and nothing
 * else; a reader who wants the evidence opens the case. Projects that have
 * nothing to show yet are listed below, quietly.
 */
import Link from "next/link";

import { Loading, ReadFailure } from "@/components/bits";
import { decision, gen, milestoneState, plural } from "@/lib/present";
import { getProject, listProjects } from "@/lib/read";
import type { MilestoneSummary, Project } from "@/lib/types";
import { useChain } from "@/lib/useChain";

interface Row {
  m: MilestoneSummary;
  site: string;
  projectId: string;
}

export default function Record() {
  const page = useChain("record", async (fresh) => {
    const list = await listProjects(0, 24, fresh);
    const projects = (await Promise.all(list.project_ids.map((id) => getProject(id, fresh))))
      .filter((p): p is Project => !!p);
    const rows: Row[] = projects.flatMap((p) =>
      p.milestone_summaries.map((m) => ({ m, site: p.title, projectId: p.project_id })),
    );
    return {
      read: rows.filter((r) => r.m.rounds_count > 0).reverse(),
      waiting: rows.filter((r) => r.m.rounds_count === 0).reverse(),
      projects: projects.length,
    };
  });

  return (
    <div className="mx-auto w-full max-w-[1200px] px-5 md:px-10">
      <header className="py-20">
        <h1 className="text-[clamp(40px,6vw,76px)] font-normal leading-[0.95] tracking-[-0.03em] text-graphite [font-family:var(--font-display)]">
          The record
        </h1>
        <p className="mt-6 max-w-[52ch] text-[18px] leading-[1.55] text-steel">
          Every case on this deployment, read from the contract as this page loads.
        </p>
        <p className="mt-8">
          <Link
            href="/projects/new"
            className="display text-[17px] text-graphite underline decoration-ember decoration-2 underline-offset-[6px] hover:decoration-graphite"
          >
            Open a site of your own
          </Link>
        </p>
      </header>

      {page.loading ? <Loading what="the record" /> : null}
      {page.error ? <ReadFailure what="the record" /> : null}

      {page.data ? (
        <>
          {page.data.read.length === 0 ? (
            <p className="text-[15px] text-slate">No case has been read yet.</p>
          ) : (
            <ul className="border-t border-mist">
              {page.data.read.map(({ m, site }) => {
                const said = m.standing ? decision(m.standing.decision) : milestoneState(m.state);
                return (
                  <li key={m.milestone_id}>
                    <Link
                      href={`/milestones/${m.milestone_id}`}
                      className="group grid gap-4 border-b border-mist py-10 md:grid-cols-[minmax(0,1fr)_minmax(0,320px)] md:items-baseline md:gap-12"
                    >
                      <div className="min-w-0">
                        <p className="type-caption">{site}</p>
                        <p className="mt-3 text-[26px] leading-[1.2] tracking-[-0.02em] text-graphite [font-family:var(--font-display)]">
                          {m.title}
                        </p>
                      </div>
                      <div className="md:text-right">
                        <p className="text-[26px] leading-[1.2] tracking-[-0.02em] text-graphite [font-family:var(--font-display)] group-hover:underline group-hover:decoration-ember group-hover:decoration-2 group-hover:underline-offset-[6px]">
                          {said}
                        </p>
                        <p className="type-caption mt-2">
                          {gen(m.payment_wei)}
                          {m.state === "FINALIZED" ? ", settled" : ""}
                          {m.standing?.appealed ? ", contested" : ""}
                        </p>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}

          {page.data.waiting.length ? (
            <section className="py-20">
              <h2 className="display mb-8 text-[14px] uppercase tracking-[0.12em] text-slate">
                Waiting on evidence
              </h2>
              <ul className="flex flex-col gap-4">
                {page.data.waiting.map(({ m, site }) => (
                  <li key={m.milestone_id}>
                    <Link
                      href={`/milestones/${m.milestone_id}`}
                      className="flex flex-wrap items-baseline justify-between gap-4 text-[15px] text-steel hover:text-graphite"
                    >
                      <span>
                        {m.title}
                        <span className="type-caption"> {site}</span>
                      </span>
                      <span className="type-caption">{milestoneState(m.state)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <p className="type-caption border-t border-mist py-10">
            {plural(page.data.projects, "project")} on this deployment.
          </p>
        </>
      ) : null}
    </div>
  );
}
