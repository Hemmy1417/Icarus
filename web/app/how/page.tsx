"use client";

/**
 * How the decision is made, written for somebody deciding whether to trust
 * it. It states the rules and it states the limits, because a page that
 * lists only the rules is marketing.
 */
import { Band, Card, DataCard, EmberLink, Heading, Tag } from "@/components/bits";
import { REPO_URL } from "@/lib/config";

const STEPS: Array<{ n: string; title: string; body: string }> = [
  {
    n: "01",
    title: "The terms name equipment, not outcomes",
    body:
      "A milestone is written as an equipment schedule: a manufacturer, a model, a rating and a "
      + "quantity for each line, and a note on whether the nameplate has to be legible in a "
      + "photograph. Both parties sign the schedule before any evidence is filed, so nobody is "
      + "judged against terms they did not agree to.",
  },
  {
    n: "02",
    title: "Evidence is held by the contract",
    body:
      "A photograph is stored and hashed on chain. Every validator judges the same bytes, and a "
      + "later reader can fetch those bytes and recompute the digest themselves. Nothing points "
      + "at a link that could change after the fact.",
  },
  {
    n: "03",
    title: "The panel looks before it judges",
    body:
      "Each node is first asked only to describe what is visible and transcribe any text it can "
      + "read on a label. It is not shown the schedule at this step, so it cannot read the "
      + "expected answer into the picture. Only then is it asked to match what it read against "
      + "what was contracted.",
  },
  {
    n: "04",
    title: "The contract derives the decision",
    body:
      "A node reports a finding per line and per criterion. It is never asked whether the "
      + "milestone should pay. Accepted, rejected and undetermined are computed in code from "
      + "those findings, which is why the same findings always give the same decision.",
  },
  {
    n: "05",
    title: "A decision can be contested once",
    body:
      "The owner may appeal within the window the project set. A fresh panel judges the "
      + "milestone again from the start, and may read evidence filed during the appeal. The "
      + "appellant's reason is put to the panel as argument, and the panel is told it is not "
      + "evidence.",
  },
  {
    n: "06",
    title: "Payment is drawn, never pushed",
    body:
      "A settled milestone credits the installer's balance in the contract. They withdraw it "
      + "themselves. Nothing is transferred by a round, so a failed transfer can never wedge a "
      + "decision.",
  },
];

const FLOORS: Array<{ title: string; body: string }> = [
  {
    title: "A document cannot establish a line",
    body:
      "Only a photograph, or an independent inspector's report, witnesses the site. A datasheet "
      + "naming exactly the right model does not show that the model was installed. A document "
      + "written by the owner or the installer is that party's own account, whichever party "
      + "wrote it. A line rated installed whose basis holds no image is downgraded to doubt "
      + "before the decision is derived, in code.",
  },
  {
    title: "An adverse finding needs an observation too",
    body:
      "The floor has a mirror. A line cannot be rated absent, and a criterion cannot be rated "
      + "not met, on paperwork alone either. Otherwise the rule would protect installers from "
      + "false acceptances while leaving them open to false rejections.",
  },
  {
    title: "A node that cannot see cannot vote",
    body:
      "A validator that did not receive the images says so, and votes against every outcome "
      + "rather than guessing at one. It counts as a reader only when it affirmatively says it "
      + "saw the evidence and describes what it saw.",
  },
  {
    title: "Doubt does not pay",
    body:
      "One line left unshown or unidentified leaves the whole milestone undetermined. One line "
      + "found absent rejects it. Nothing pays on a maybe.",
  },
  {
    title: "A declaration is never read",
    body:
      "A party may record a statement for the file. It is stored, it is shown to any reader, and "
      + "it is never put to a panel. Anybody can check that for themselves, because the text is "
      + "readable from the contract.",
  },
];

export default function How() {
  return (
    <>
      <Band tone="white">
        <div className="max-w-[820px] pt-6">
          <h1 className="type-heading-lg">How a milestone is decided</h1>
          <p className="mt-6 text-[18px] leading-[1.6] text-steel">
            The question is never &ldquo;was the work done well&rdquo;. It is narrower and
            answerable: does the evidence show that the equipment this contract named was
            installed? Everything below follows from keeping the question that narrow.
          </p>
        </div>
      </Band>

      <Band tone="ash">
        <Heading eyebrow="The path" title="Six steps, in order" />
        <div className="grid gap-5 md:grid-cols-2">
          {STEPS.map((s) => (
            <Card key={s.n}>
              <div className="figure type-caption mb-4 text-brass">{s.n}</div>
              <h3 className="type-subheading">{s.title}</h3>
              <p className="mt-4 text-[15px] leading-[1.6] text-steel">{s.body}</p>
            </Card>
          ))}
        </div>
      </Band>

      <Band tone="white">
        <Heading
          eyebrow="The floors"
          title="What the code will not let a model do"
          lead="These are enforced after the panel reports and before the decision is derived. They are not instructions in a prompt that a model may or may not follow."
        />
        <DataCard>
          <ul>
            {FLOORS.map((f) => (
              <li key={f.title} className="border-t border-mist px-10 py-8 first:border-t-0">
                <h3 className="type-subheading">{f.title}</h3>
                <p className="mt-4 max-w-[760px] text-[15px] leading-[1.6] text-steel">{f.body}</p>
              </li>
            ))}
          </ul>
        </DataCard>
      </Band>

      <Band tone="ivory">
        <div className="max-w-[820px]">
          <Heading
            eyebrow="The limits"
            title="What this does not claim"
            lead="Stated here rather than left for a reader to discover."
          />
          <div className="flex flex-col gap-6 text-[15px] leading-[1.6] text-steel">
            <p>
              <strong className="font-medium text-graphite">
                A panel can be handed the wrong image and describe it.
              </strong>{" "}
              The blindness check rests on a node reporting that it could see. A node given a
              different picture will describe that picture rather than report itself unable to
              read. Consensus across a diverse panel is what catches that, not the check.
            </p>
            <p>
              <strong className="font-medium text-graphite">
                A legible nameplate is a hard ask.
              </strong>{" "}
              The strictest line in a schedule, the one that requires a model number to be
              readable in a photograph, is also where models of different families disagree
              most. A round can fail to reach a majority for that reason, and when it does,
              nothing is recorded.
            </p>
            <p>
              <strong className="font-medium text-graphite">
                An undecided appeal does not pay.
              </strong>{" "}
              If no panel decides an appeal within three days of its evidence period, the appeal
              lapses and the milestone is undetermined. An acceptance that was contested and
              never confirmed does not settle.
            </p>
            <p>
              <strong className="font-medium text-graphite">
                This judges evidence, not workmanship.
              </strong>{" "}
              A photograph showing the right inverter on the right wall is not a safety
              inspection. Where that matters, the terms name an inspector, and the inspector&apos;s
              report is the only document that can witness the site.
            </p>
          </div>
          <p className="mt-10">
            <EmberLink href={`${REPO_URL}/blob/main/docs/PROBE-REPORT.md`} external>
              What running this on a real panel actually looks like
            </EmberLink>
          </p>
        </div>
      </Band>

      <Band tone="white">
        <div className="flex flex-wrap items-center gap-3">
          <Tag muted>Evidence held on chain</Tag>
          <Tag muted>Reading separated from judging</Tag>
          <Tag muted>Decision derived in code</Tag>
          <Tag muted>One appeal, judged afresh</Tag>
          <Tag muted>Payment drawn, not pushed</Tag>
        </div>
      </Band>
    </>
  );
}
