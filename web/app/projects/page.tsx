"use client";

/**
 * Every project on this deployment. A project is a site with an owner, an
 * installer and an escrow; its milestones are what actually get judged, so
 * each row carries the milestone counts rather than making a reader open it
 * to find out whether anything has happened.
 */
import Link from "next/link";

import { Band, Card, Empty, Heading, Loading, ReadFailure, Tag } from "@/components/bits";
import { gen, milestoneState, plural, projectState, systemType } from "@/lib/present";
import { getProject, listProjects } from "@/lib/read";
import type { Project } from "@/lib/types";
import { useChain } from "@/lib/useChain";

function Row({ p }: { p: Project }) {
  const decided = p.milestone_summaries.filter((m) => m.rounds_count > 0);
  const settled = p.milestone_summaries.filter((m) => m.state === "FINALIZED");
  return (
    <Link href={`/projects/${p.project_id}`} className="block">
      <Card className="transition-colors hover:bg-fog">
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0 max-w-[640px]">
            <h3 className="type-subheading">{p.title}</h3>
            <p className="mt-3 text-[15px] leading-[1.55] text-steel">{p.description}</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Tag muted>{systemType(p.system_type)}</Tag>
              {p.site ? <Tag muted>{p.site}</Tag> : null}
              <Tag muted>{projectState(p.state)}</Tag>
            </div>
          </div>
          <dl className="flex shrink-0 gap-10 md:flex-col md:gap-4 md:text-right">
            <div>
              <dt className="type-caption">Milestones</dt>
              <dd className="figure text-[15px] text-graphite">{p.milestone_summaries.length}</dd>
            </div>
            <div>
              <dt className="type-caption">Decided</dt>
              <dd className="figure text-[15px] text-graphite">{decided.length}</dd>
            </div>
            <div>
              <dt className="type-caption">Settled</dt>
              <dd className="figure text-[15px] text-graphite">{settled.length}</dd>
            </div>
            <div>
              <dt className="type-caption">Escrow</dt>
              <dd className="figure text-[15px] text-graphite">{gen(p.escrow_wei)}</dd>
            </div>
          </dl>
        </div>

        {p.milestone_summaries.length ? (
          <ul className="mt-8 flex flex-wrap gap-3 border-t border-mist pt-5">
            {p.milestone_summaries.map((m) => (
              <li key={m.milestone_id}>
                <Tag muted={m.state !== "FINALIZED"}>
                  {m.title}: {milestoneState(m.state).toLowerCase()}
                </Tag>
              </li>
            ))}
          </ul>
        ) : null}
      </Card>
    </Link>
  );
}

export default function Projects() {
  const page = useChain("projects", async (fresh) => {
    const list = await listProjects(0, 20, fresh);
    const rows = await Promise.all(list.project_ids.map((id) => getProject(id, fresh)));
    return { total: list.total, projects: rows.filter((p): p is Project => !!p) };
  });

  return (
    <Band tone="white">
      <Heading
        eyebrow="The record"
        title="Projects"
        lead="Every project on this deployment, read from the contract as this page loads."
      />

      {page.loading ? <Loading what="the projects" /> : null}
      {page.error ? <ReadFailure what="the projects" /> : null}

      {page.data ? (
        page.data.projects.length === 0 ? (
          <Empty>No project has been opened on this deployment yet.</Empty>
        ) : (
          <>
            <p className="type-caption mb-5">
              {plural(page.data.total, "project")} on this deployment.
            </p>
            <div className="flex flex-col gap-5">
              {page.data.projects.map((p) => (
                <Row key={p.project_id} p={p} />
              ))}
            </div>
          </>
        )
      ) : null}
    </Band>
  );
}
