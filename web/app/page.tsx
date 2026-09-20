"use client";

/**
 * The cover states one thing and then shows it happening.
 *
 * It is deliberately not a stack of explanatory sections: the record is the
 * argument, so the page is a single held statement followed by a rail of
 * live cases a reader can walk straight into. Everything that explains
 * rather than shows lives on /how.
 */
import Link from "next/link";

import { CaseRail } from "@/components/CaseRail";
import { IS_RECORD } from "@/lib/config";

export default function Cover() {
  return (
    <div className="mx-auto w-full max-w-[1200px] px-5 md:px-10">
      <section className="flex min-h-[76vh] flex-col justify-center py-20">
        <h1 className="max-w-[16ch] text-[clamp(52px,9vw,116px)] font-normal leading-[0.88] tracking-[-0.03em] text-graphite [font-family:var(--font-display)]">
          Paperwork
          <br />
          does not
          <br />
          <span className="text-slate">pay.</span>
        </h1>

        <p className="mt-12 max-w-[46ch] text-[19px] leading-[1.5] text-steel">
          A milestone settles when a panel of validators can see, in the photographs, the
          equipment the contract named. Not when a datasheet says so.
        </p>

        <div className="mt-12 flex flex-wrap items-center gap-8">
          <Link
            href="/how"
            className="display text-[17px] text-graphite underline decoration-ember decoration-2 underline-offset-[6px] hover:decoration-graphite"
          >
            How it decides
          </Link>
          <Link href="/projects" className="display text-[17px] text-slate hover:text-graphite">
            The record
          </Link>
          <Link href="/projects/new" className="display text-[17px] text-slate hover:text-graphite">
            Open a site of your own
          </Link>
        </div>
      </section>

      {IS_RECORD ? (
        <section className="border-t border-mist py-20">
          <div className="mb-10 flex items-baseline justify-between gap-5">
            <h2 className="display text-[14px] uppercase tracking-[0.12em] text-slate">
              Live cases
            </h2>
            <Link href="/projects" className="type-caption hover:text-graphite">
              All of them
            </Link>
          </div>
          <CaseRail />
        </section>
      ) : null}
    </div>
  );
}
