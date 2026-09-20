"use client";

/**
 * The evidence a milestone was judged on.
 *
 * A photograph is fetched from the contract as bytes and its digest is
 * recomputed in this browser, so the caption under it is not a claim this
 * site is making: it is a check a reader can watch happen. A document shows
 * its text, and is labelled by who wrote it, because who wrote a document is
 * the whole of what it is worth.
 */
import { useEffect, useState } from "react";

import { DataCard, Tag } from "./bits";
import { bytes, itemKind, moment, prose, roleLower, shortDigest } from "@/lib/present";
import { getImage, getItemText } from "@/lib/read";
import type { EvidenceItem } from "@/lib/types";

function Photograph({ item }: { item: EvidenceItem }) {
  const [state, setState] = useState<
    { url: string; matches: boolean } | { error: true } | null
  >(null);

  useEffect(() => {
    let url = "";
    let alive = true;
    getImage(item.item_id)
      .then(({ bytes: raw, digest }) => {
        if (!alive) return;
        url = URL.createObjectURL(new Blob([raw as BlobPart]));
        setState({ url, matches: digest === item.sha256 });
      })
      .catch(() => alive && setState({ error: true }));
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [item.item_id, item.sha256]);

  if (!state) {
    return (
      <div className="flex h-[220px] items-center justify-center rounded-card bg-fog">
        <span className="type-caption">Fetching the bytes from the chain</span>
      </div>
    );
  }
  if ("error" in state) {
    return (
      <div className="flex h-[220px] items-center justify-center rounded-card bg-fog px-5 text-center">
        <span className="type-caption">
          The chain did not return this image. That is a problem reaching it, not a statement
          about the record.
        </span>
      </div>
    );
  }
  return (
    <figure className="m-0">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={state.url}
        alt={prose(item.caption) || "Filed evidence"}
        className="w-full rounded-card border border-mist object-cover"
      />
      <figcaption className="type-caption mt-3">
        {state.matches
          ? "The bytes this browser received hash to the digest the contract recorded."
          : "These bytes do not match the digest the contract recorded; do not rely on this image."}
      </figcaption>
    </figure>
  );
}

/**
 * A document's own words. It is fetched rather than summarised, because the
 * clearest thing this contract does is refuse to pay on a datasheet that
 * names exactly the right model, and a reader who cannot see the datasheet
 * cannot check that.
 */
function DocumentBody({ item }: { item: EvidenceItem }) {
  const [text, setText] = useState<string | null | "error">(null);

  useEffect(() => {
    let alive = true;
    getItemText(item.item_id)
      .then((t) => alive && setText(t))
      .catch(() => alive && setText("error"));
    return () => {
      alive = false;
    };
  }, [item.item_id]);

  if (text === null) return <p className="type-caption mt-5">Fetching the text from the chain.</p>;
  if (text === "error") {
    return (
      <p className="type-caption mt-5">
        The chain did not return this text. That is a problem reaching it, not a statement about
        the record.
      </p>
    );
  }
  return (
    <blockquote className="mt-5 border-l-2 border-mist pl-5 text-[15px] leading-[1.6] text-steel">
      {prose(text)}
    </blockquote>
  );
}

export function EvidenceList({ items }: { items: EvidenceItem[] }) {
  if (!items.length) {
    return <p className="text-[15px] text-slate">Nothing has been filed against these terms.</p>;
  }
  return (
    <div className="flex flex-col gap-5">
      {items.map((item) => (
        <DataCard key={item.item_id} className="p-10">
          <div className="flex flex-col gap-8 md:flex-row">
            {item.kind === "IMAGE" ? (
              <div className="md:w-[320px] md:shrink-0">
                <Photograph item={item} />
              </div>
            ) : null}

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-3">
                <Tag>{itemKind(item.kind, item.origin)}</Tag>
                <Tag muted>Filed by the {roleLower(item.role)}</Tag>
                {item.equipment_id ? (
                  <Tag muted>Offered for line {item.equipment_id}</Tag>
                ) : null}
              </div>

              {item.caption ? (
                <p className="mt-5 text-[17px] leading-[1.45] text-graphite">
                  {prose(item.caption)}
                </p>
              ) : null}

              {item.kind === "DECLARATION" ? (
                <p className="type-caption mt-5">
                  A declaration is recorded for the file and is never put to a panel, so it
                  cannot establish or refute anything.
                </p>
              ) : null}

              {item.kind !== "IMAGE" ? <DocumentBody item={item} /> : null}

              <p className="type-caption mt-5">
                Filed {moment(item.filed_at)}
                {item.kind === "IMAGE" && item.bytes ? `, ${bytes(item.bytes)}` : ""}
              </p>

              {item.claimed_capture || item.claimed_location ? (
                <p className="type-caption mt-3">
                  The filer says it was taken
                  {item.claimed_capture ? ` on ${prose(item.claimed_capture)}` : ""}
                  {item.claimed_location ? ` at ${prose(item.claimed_location)}` : ""}. That is
                  their claim, not something the contract checked.
                </p>
              ) : null}

              <details className="mt-5">
                <summary className="type-caption cursor-pointer select-none hover:text-graphite">
                  What the contract recorded
                </summary>
                <dl className="mt-3 flex flex-col gap-2">
                  <div className="flex gap-3">
                    <dt className="type-caption w-[80px] shrink-0">Item</dt>
                    <dd className="figure text-[13px] text-steel">{item.item_id}</dd>
                  </div>
                  <div className="flex gap-3">
                    <dt className="type-caption w-[80px] shrink-0">Digest</dt>
                    <dd className="figure break-all text-[13px] text-steel">
                      {shortDigest(item.sha256)}
                    </dd>
                  </div>
                  <div className="flex gap-3">
                    <dt className="type-caption w-[80px] shrink-0">Terms</dt>
                    <dd className="figure text-[13px] text-steel">Version {item.version}</dd>
                  </div>
                </dl>
              </details>
            </div>
          </div>
        </DataCard>
      ))}
    </div>
  );
}
