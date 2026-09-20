"use client";

/**
 * One project: who is party to it, what it holds in escrow, and the
 * milestones it will be judged in. The money is stated plainly because an
 * escrow a reader cannot see the shape of is a reason not to trust the
 * thing; reserved, unreserved and paid are three different facts and are
 * shown as three.
 */
import Link from "next/link";
import { use } from "react";

import {
  Band, Card, DataCard, Empty, Field, Heading, Loading, ReadFailure, Tag,
} from "@/components/bits";
import {
  day, decision, gen, milestoneState, milestoneType, moment, plural, projectState, relative,
  roleLower, systemType,
} from "@/lib/present";
import { getEvents, getProject } from "@/lib/read";
import { roleIn } from "@/lib/acts";
import type { MilestoneSummary, Project } from "@/lib/types";
import { useChain } from "@/lib/useChain";
import { eventKind } from "@/lib/present";

function MilestoneRow({ m, nowMs }: { m: MilestoneSummary; nowMs: number }) {
  const standing = m.standing;
  return (
    <li className="border-t border-mist first:border-t-0">
      <Link href={`/milestones/${m.milestone_id}`} className="block px-10 py-6 hover:bg-fog">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0 max-w-[560px]">
            <div className="type-caption mb-1">{milestoneType(m.milestone_type)}</div>
            <h4 className="text-[17px] leading-[1.35] text-graphite">{m.title}</h4>
            <div className="mt-3 flex flex-wrap gap-3">
              <Tag muted>{plural(m.schedule_lines, "schedule line")}</Tag>
              <Tag muted>
                {m.rounds_count
                  ? plural(m.rounds_count, "reading")
                  : "not yet read"}
              </Tag>
              <Tag muted>Due {day(m.deadline)}</Tag>
            </div>
          </div>
          <div className="shrink-0 md:w-[240px] md:text-right">
            <div className="display text-[17px]">{milestoneState(m.state)}</div>
            {standing ? (
              <div className="type-caption mt-1">
                {decision(standing.decision)} on {day(standing.at)}
                {standing.appealed ? ", contested" : ""}
              </div>
            ) : null}
            {standing?.appealable && !standing.appealed && standing.window_ends ? (
              <div className="type-caption mt-1">
                Open to challenge {relative(standing.window_ends, nowMs)}
              </div>
            ) : null}
            <div className="figure mt-3 text-[15px] text-graphite">{gen(m.payment_wei)}</div>
          </div>
        </div>
      </Link>
    </li>
  );
}

export default function ProjectPage({ params }: { params: Promise<{ pid: string }> }) {
  const { pid } = use(params);
  const project = useChain<Project | null>(`project.${pid}`, (fresh) => getProject(pid, fresh));
  const events = useChain(`events.${pid}`, (fresh) => getEvents(pid, 0, 30, fresh));

  if (project.loading) {
    return (
      <Band tone="white">
        <Loading what="this project" />
      </Band>
    );
  }
  if (project.error) {
    return (
      <Band tone="white">
        <ReadFailure what="this project" />
      </Band>
    );
  }
  if (!project.data) {
    return (
      <Band tone="white">
        <Heading title="No such project" lead="Nothing on this deployment carries that name." />
      </Band>
    );
  }

  const p = project.data;
  const nowMs = new Date(p.now).getTime();
  // The log records an address; a page says which party that was, or nothing.
  const actor = (addr: string) => roleIn(p, addr);

  return (
    <>
      <Band tone="white">
        <div className="max-w-[820px]">
          <p className="type-caption mb-5 uppercase tracking-[0.08em] text-slate">
            {systemType(p.system_type)}
          </p>
          <h1 className="type-heading-lg">{p.title}</h1>
          <p className="mt-5 text-[18px] leading-[1.6] text-steel">{p.description}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Tag muted>{projectState(p.state)}</Tag>
            {p.site ? <Tag muted>{p.site}</Tag> : null}
            {p.capacity_kw ? <Tag muted>{p.capacity_kw} kW</Tag> : null}
            <Tag muted>Opened {day(p.created_at)}</Tag>
          </div>
        </div>
      </Band>

      <Band tone="ash">
        <div className="grid gap-5 md:grid-cols-2">
          <Card>
            <h3 className="type-subheading mb-6">The parties</h3>
            <div className="flex flex-col gap-5">
              <Field label="Owner">Opened this project on {day(p.created_at)}</Field>
              <Field label="Installer">
                {p.installer_accepted_at
                  ? `Signed on ${day(p.installer_accepted_at)}`
                  : "Has not signed yet"}
              </Field>
              <Field label="Inspector">
                {!p.inspector
                  ? "None appointed; nothing independent witnesses this site"
                  : p.inspector_accepted_at
                    ? `Accepted on ${day(p.inspector_accepted_at)}`
                    : "Appointed, has not accepted"}
              </Field>
              <Field label="Challenge window">
                A decision can be contested for{" "}
                {Math.round(p.appeal_window_seconds / 60)} minutes after it is recorded
              </Field>
            </div>
          </Card>

          <Card>
            <h3 className="type-subheading mb-6">The escrow</h3>
            <div className="flex flex-col gap-5">
              <Field label="Funded">
                <span className="figure">{gen(p.funded_wei)}</span>
              </Field>
              <Field label="Reserved against milestones">
                <span className="figure">{gen(p.reserved_wei)}</span>
              </Field>
              <Field label="Unreserved">
                <span className="figure">{gen(p.unreserved_wei)}</span>
              </Field>
              <Field label="Paid out">
                <span className="figure">{gen(p.paid_wei)}</span>
              </Field>
            </div>
            <p className="type-caption mt-6">
              A payment is never pushed. It becomes a claim the installer draws from the
              contract themselves.
            </p>
          </Card>
        </div>
      </Band>

      <Band tone="white">
        <Heading
          title="Milestones"
          lead="Each one is judged on its own equipment schedule, against the evidence filed for it."
        />
        {p.milestone_summaries.length === 0 ? (
          <Empty>No milestone has been proposed on this project yet.</Empty>
        ) : (
          <DataCard>
            <ul>
              {p.milestone_summaries.map((m) => (
                <MilestoneRow key={m.milestone_id} m={m} nowMs={nowMs} />
              ))}
            </ul>
          </DataCard>
        )}
      </Band>

      <Band tone="ash">
        <Heading
          title="What has happened"
          lead="The project's own log, in the order the contract recorded it."
        />
        {events.loading ? <Loading what="the log" /> : null}
        {events.error ? <ReadFailure what="the log" /> : null}
        {events.data ? (
          events.data.events.length === 0 ? (
            <Empty>Nothing has been recorded yet.</Empty>
          ) : (
            <DataCard>
              <ul>
                {[...events.data.events].reverse().map((e) => (
                  <li
                    key={e.n}
                    className="flex flex-col gap-2 border-t border-mist px-10 py-5 first:border-t-0 md:flex-row md:items-baseline md:justify-between"
                  >
                    <span className="text-[15px] text-graphite">{eventKind(e.kind)}</span>
                    <span className="type-caption">
                      {actor(e.by) ? `by the ${roleLower(actor(e.by) as string)}, ` : ""}
                      {moment(e.at)}
                    </span>
                  </li>
                ))}
              </ul>
            </DataCard>
          )
        ) : null}
      </Band>
    </>
  );
}
