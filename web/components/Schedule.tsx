"use client";

/**
 * The equipment schedule, which is this product's chart.
 *
 * The reference this interface follows treats charts as the imagery of a
 * page. ICARUS has no charts worth drawing: what it has is a list of
 * equipment a contract named, each line set against what a panel found when
 * it went looking. So the schedule is given the 20px data card, the tabular
 * figures and the hairline separation the reference reserves for figures,
 * and it is the thing a reader looks at first.
 *
 * Ember marks the finding, never the verdict: the one line that decided the
 * outcome is underlined, and an accepted milestone does not turn orange.
 */
import { DataCard, Figure, Tag } from "./bits";
import { equipmentRole, lineStatus, lineStatusSaid } from "@/lib/present";
import type { EquipmentLine, LineStatus } from "@/lib/types";

export function Schedule({
  lines,
  found,
  decisive = [],
  notes,
}: {
  lines: EquipmentLine[];
  /** What the panel found, by line id. Absent when no panel has looked yet. */
  found?: Record<string, LineStatus>;
  /** The line ids that actually drove the decision. */
  decisive?: string[];
  /** The panel's sentence about each line. */
  notes?: Record<string, string>;
}) {
  const decided = new Set(decisive);
  return (
    <DataCard>
      <div className="flex items-baseline justify-between gap-5 px-10 pt-10">
        <h3 className="type-subheading">Equipment schedule</h3>
        <span className="type-caption">
          {lines.length} {lines.length === 1 ? "line" : "lines"}
        </span>
      </div>

      <ul className="mt-6">
        {lines.map((line) => {
          const status = found?.[line.id];
          const drove = decided.has(line.id);
          return (
            <li key={line.id} className="border-t border-mist px-10 py-6 first:border-t-0">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <div className="type-caption mb-1 text-slate">{equipmentRole(line.role)}</div>
                  <div className="text-[17px] leading-[1.35] text-graphite">
                    {[line.manufacturer, line.model].filter(Boolean).join(" ") || "Not specified"}
                  </div>
                  <div className="type-caption mt-1">
                    {line.rating ? <Figure>{line.rating}</Figure> : null}
                    {line.rating && line.quantity > 1 ? ", " : null}
                    {line.quantity > 1 ? (
                      <>
                        <Figure>{line.quantity}</Figure> required
                      </>
                    ) : null}
                  </div>
                  {line.identify ? (
                    <div className="mt-3">
                      <Tag muted>Nameplate must be legible</Tag>
                    </div>
                  ) : null}
                </div>

                <div className="shrink-0 md:w-[220px] md:text-right">
                  {status ? (
                    <>
                      <div
                        className={`display text-[17px] ${
                          drove
                            ? "underline decoration-ember decoration-2 underline-offset-4"
                            : ""
                        }`}
                      >
                        {lineStatus(status)}
                      </div>
                      {drove ? (
                        <div className="type-caption mt-1">This line decided the outcome.</div>
                      ) : null}
                    </>
                  ) : (
                    <div className="type-caption">Not yet assessed</div>
                  )}
                </div>
              </div>

              {status ? (
                notes?.[line.id] ? (
                  <blockquote className="mt-4 max-w-[720px] border-l-2 border-mist pl-5 text-[15px] leading-[1.55] text-steel">
                    {notes[line.id]}
                    <cite className="type-caption mt-2 block not-italic">
                      The panel&apos;s own words.
                    </cite>
                  </blockquote>
                ) : (
                  <p className="mt-4 max-w-[720px] text-[15px] leading-[1.55] text-steel">
                    {lineStatusSaid(status)}
                  </p>
                )
              ) : null}
            </li>
          );
        })}
      </ul>
      <div className="h-4" />
    </DataCard>
  );
}
