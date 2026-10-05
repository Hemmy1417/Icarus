"use client";

/**
 * How the decision is made, for somebody deciding whether to trust it.
 *
 * Six rules and six limits. The rules are what the code will not let a
 * model do; the limits are what this cannot do at all. A page that printed
 * only the first half would be marketing, and a page that printed every
 * mechanism would be a manual, so this prints neither.
 */
import { REPO_URL } from "@/lib/config";

const RULES: Array<{ rule: string; says: string }> = [
  {
    rule: "A document cannot show what was installed.",
    says: "A datasheet naming exactly the right model states what was specified, not what is bolted to the wall. Only a photograph, or an independent inspector's report, witnesses the site. A finding that rests on no photograph is downgraded to doubt before the decision is derived, in code.",
  },
  {
    rule: "The same rule protects the installer.",
    says: "Nothing can be found missing on paperwork either. A party cannot file their own statement that the work was not done and have that reject a milestone. A floor that only stops false acceptances would protect one side.",
  },
  {
    rule: "A node that cannot see does not vote.",
    says: "Each validator says whether the photographs reached it, and counts as a reader only when it says so itself and describes what it saw. One that received nothing votes against every outcome rather than guessing at one.",
  },
  {
    rule: "The panel reports; the code decides.",
    says: "Validators are asked what they observed against each piece of equipment, never whether the milestone should pay. Accepted, rejected and undetermined are computed from those observations, so the same observations always give the same decision.",
  },
];

const CHANGES: Array<{ rule: string; says: string }> = [
  {
    rule: "A different product needs a yes, or a page that proves it.",
    says: "When the unit on the schedule cannot be had, the installer may propose another for that line. The owner can agree. Where the line was signed with the words or equivalent, validators each fetch the product page the installer names and say whether it documents that model, of the same kind, at a rating no lower than the line asks. Code turns their answers into the verdict, and anything short of a clear yes leaves the line as signed. On a line signed for one product, only the owner's yes changes it. The terms can also name the sites both parties accept as sources for a product, and then a page anywhere else is refused before a validator is asked.",
  },
  {
    rule: "What a panel found in place stays found.",
    says: "A decision that falls short leaves the installer time to put right what was missing. A cure round judges only the lines and conditions that decision left open, and keeps the rest. That is safe because every finding it keeps is one the whole panel reproduced, not one node's reading. The milestone still pays whole or not at all, and an appeal judges every line again.",
  },
];

const LIMITS: string[] = [
  "A node handed the wrong photograph will describe that photograph rather than report itself unable to read. Only a panel of differing models catches that, and in the live runs it did.",
  "A legible nameplate is close to the edge of what such a panel will agree on. When it splits, nothing is recorded and the milestone is untouched.",
  "An appeal nobody decides within three days lapses, and the milestone is undetermined. An acceptance that was contested and never confirmed does not pay.",
  "This judges evidence, not workmanship. A photograph of the right inverter on the right wall is not an electrical inspection.",
  "Where the terms name no site as a source, who published a product page is each validator's judgment. Code checks that the page loads, sits on a public site and names the model. It cannot tell the maker's site from a convincing copy of it.",
  "An image the owner or the inspector files that a node cannot read is set aside by that node, so it cannot hold a decision up. An image only some nodes can read can still split a panel, and a split records nothing.",
  "Agreeing every finding costs rounds. A line one node reads as installed and another as not identified now records nothing, and has to be asked again.",
];

export default function How() {
  return (
    <div className="mx-auto w-full max-w-[1200px] px-5 md:px-10">
      <header className="py-20">
        <h1 className="max-w-[20ch] text-[clamp(40px,6vw,76px)] font-normal leading-[0.95] tracking-[-0.03em] text-graphite [font-family:var(--font-display)]">
          The question is narrow on purpose.
        </h1>
        <p className="mt-8 max-w-[52ch] text-[19px] leading-[1.5] text-steel">
          Not whether the work was done well. Whether the evidence shows that the equipment this
          contract named was installed. Everything below follows from keeping it that narrow.
        </p>
      </header>

      <section className="border-t border-mist py-20">
        <h2 className="display mb-12 text-[14px] uppercase tracking-[0.12em] text-slate">
          What the code will not let a model do
        </h2>
        <ul className="flex flex-col">
          {RULES.map((r, i) => (
            <li
              key={r.rule}
              className={`grid gap-5 py-10 md:grid-cols-[minmax(0,360px)_minmax(0,1fr)] md:gap-16 ${
                i > 0 ? "border-t border-mist" : ""
              }`}
            >
              <h3 className="text-[24px] leading-[1.2] tracking-[-0.02em] text-graphite [font-family:var(--font-display)]">
                {r.rule}
              </h3>
              <p className="max-w-[58ch] text-[17px] leading-[1.6] text-steel">{r.says}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="border-t border-mist py-20">
        <h2 className="display mb-12 text-[14px] uppercase tracking-[0.12em] text-slate">
          When the job does not go to plan
        </h2>
        <ul className="flex flex-col">
          {CHANGES.map((r, i) => (
            <li
              key={r.rule}
              className={`grid gap-5 py-10 md:grid-cols-[minmax(0,360px)_minmax(0,1fr)] md:gap-16 ${
                i > 0 ? "border-t border-mist" : ""
              }`}
            >
              <h3 className="text-[24px] leading-[1.2] tracking-[-0.02em] text-graphite [font-family:var(--font-display)]">
                {r.rule}
              </h3>
              <p className="max-w-[58ch] text-[17px] leading-[1.6] text-steel">{r.says}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="border-t border-mist py-20">
        <h2 className="display mb-12 text-[14px] uppercase tracking-[0.12em] text-slate">
          What it cannot do
        </h2>
        <ul className="flex max-w-[64ch] flex-col gap-8">
          {LIMITS.map((l) => (
            <li key={l} className="border-l-2 border-ember pl-6 text-[17px] leading-[1.6] text-steel">
              {l}
            </li>
          ))}
        </ul>
        <p className="mt-12">
          <a
            href={`${REPO_URL}/blob/main/docs/PROBE-REPORT.md`}
            target="_blank"
            rel="noopener noreferrer"
            className="display text-[17px] text-graphite underline decoration-ember decoration-2 underline-offset-[6px] hover:decoration-graphite"
          >
            What running this on a real panel actually looks like
          </a>
        </p>
      </section>
    </div>
  );
}
