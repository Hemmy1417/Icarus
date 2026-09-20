"use client";

/**
 * A filed item, shown as what it is rather than as a record of one.
 *
 * A photograph is fetched from the contract as bytes and its digest is
 * recomputed in this browser; the caption under it reports whether that
 * matched, which is a check the reader watches happen rather than a claim
 * this site makes. The digest itself is not printed here. It belongs on
 * /verify, where a reader has asked to see exactly what was recorded.
 */
import { useEffect, useState } from "react";

import { moment, prose, roleLower } from "@/lib/present";
import { getImage, getItemText } from "@/lib/read";
import type { EvidenceItem } from "@/lib/types";

function useStoredImage(item: EvidenceItem) {
  const [state, setState] = useState<{ url: string; matches: boolean } | "error" | null>(null);

  useEffect(() => {
    let url = "";
    let alive = true;
    getImage(item.item_id)
      .then(({ bytes: raw, digest }) => {
        if (!alive) return;
        url = URL.createObjectURL(new Blob([raw as BlobPart]));
        setState({ url, matches: digest === item.sha256 });
      })
      .catch(() => alive && setState("error"));
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [item.item_id, item.sha256]);

  return state;
}

/** One piece of evidence: a photograph, or a document's own words. */
export function EvidenceFigure({ item }: { item: EvidenceItem }) {
  const image = useStoredImage(item.kind === "IMAGE" ? item : item);
  const [text, setText] = useState<string | null | "error">(null);

  useEffect(() => {
    if (item.kind === "IMAGE") return;
    let alive = true;
    getItemText(item.item_id)
      .then((t) => alive && setText(t))
      .catch(() => alive && setText("error"));
    return () => {
      alive = false;
    };
  }, [item.item_id, item.kind]);

  if (item.kind !== "IMAGE") {
    return (
      <figure className="m-0">
        <div className="rounded-tl-[6px] bg-ivory p-8">
          <p className="type-caption mb-4 text-brass">
            {item.kind === "DECLARATION" ? "A statement, never put to a panel" : "A document"}
          </p>
          {text === null ? (
            <p className="type-caption">Fetching the text from the chain.</p>
          ) : text === "error" ? (
            <p className="type-caption">
              The chain did not return this text. That is a problem reaching it, not a statement
              about the record.
            </p>
          ) : (
            <p className="text-[15px] leading-[1.6] text-steel">{prose(text)}</p>
          )}
        </div>
        <figcaption className="type-caption mt-3">
          {prose(item.caption) || "Filed"} by the {roleLower(item.role)}, {moment(item.filed_at)}.
          {item.kind === "DOCUMENT"
            ? " A document states what was specified; it cannot show what was installed."
            : ""}
        </figcaption>
      </figure>
    );
  }

  return (
    <figure className="m-0">
      {image === null ? (
        <div className="flex aspect-[4/3] items-center justify-center rounded-card bg-fog">
          <span className="type-caption">Fetching it from the chain</span>
        </div>
      ) : image === "error" ? (
        <div className="flex aspect-[4/3] items-center justify-center rounded-card bg-fog px-6 text-center">
          <span className="type-caption">
            The chain did not return this photograph. That is a problem reaching it, not a
            statement about the record.
          </span>
        </div>
      ) : (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={image.url}
          alt={prose(item.caption) || "Filed evidence"}
          className="w-full rounded-card border border-mist object-cover"
        />
      )}
      <figcaption className="type-caption mt-3">
        {prose(item.caption) || "Filed"} by the {roleLower(item.role)}.
        {image && image !== "error"
          ? image.matches
            ? " These are the bytes the contract holds."
            : " These bytes do not match what the contract recorded; do not rely on this."
          : ""}
      </figcaption>
      {item.claimed_capture || item.claimed_location ? (
        <p className="type-caption mt-1">
          They say it was taken
          {item.claimed_capture ? ` ${prose(item.claimed_capture)}` : ""}
          {item.claimed_location ? ` at ${prose(item.claimed_location)}` : ""}, which is their
          claim and not something the contract checked.
        </p>
      ) : null}
    </figure>
  );
}

/** Every item filed against the terms in force. */
export function EvidenceList({ items }: { items: EvidenceItem[] }) {
  if (!items.length) {
    return <p className="text-[15px] text-slate">Nothing has been filed against these terms.</p>;
  }
  return (
    <div className="grid gap-8 sm:grid-cols-2">
      {items.map((item) => (
        <EvidenceFigure key={item.item_id} item={item} />
      ))}
    </div>
  );
}
