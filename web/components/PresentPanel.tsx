"use client";

/**
 * Choosing what to put to a panel.
 *
 * The installer presents the items they rely on; everything the owner and
 * the inspector filed is read beside them whatever is chosen here. The same
 * panel serves a full assessment and a cure round, because the choice is the
 * same choice: which of your own items should the validators read.
 *
 * A cure round must rest on something filed since the decision it answers,
 * so those items are marked and chosen to begin with, and the round cannot
 * be asked for without at least one of them.
 */
import { useState } from "react";

import { Button, Card, Tag } from "./bits";
import { TxPanel, type TxOutcome } from "./TxPanel";
import { CONTRACT_ADDRESS } from "@/lib/config";
import { useTransactionKit } from "@/lib/kit";
import { itemKind, plural, prose } from "@/lib/present";
import type { EvidenceItem } from "@/lib/types";
import { useWallet } from "@/lib/wallet";

export type PresentMode = "request_assessment" | "request_cure";

const SAYS: Record<PresentMode, { heading: string; lead: string; confirm: string; working: string }> = {
  request_assessment: {
    heading: "Put your evidence to a panel",
    lead: "Every line of the schedule and every condition is judged on what you choose here, beside whatever the other parties have filed.",
    confirm: "Ask a panel to assess it",
    working: "Each validator is reading the photographs and matching them to the schedule.",
  },
  request_cure: {
    heading: "Put right what the last decision left open",
    lead: "The panel judges only what that decision did not find in place. What it did find is kept and is not read again.",
    confirm: "Ask for a cure round",
    working: "Each validator is reading what you filed since, against the lines still open.",
  },
};

/** How many of each kind one round reads from the installer. */
export function withinCaps(
  chosen: EvidenceItem[],
  caps: Record<string, number>,
): { ok: boolean; images: number; texts: number } {
  const images = chosen.filter((it) => it.kind === "IMAGE").length;
  const texts = chosen.length - images;
  return { ok: images <= (caps.IMAGE ?? 4) && texts <= (caps.TEXT ?? 4), images, texts };
}

export function PresentPanel({
  milestoneId,
  mode,
  items,
  since,
  caps,
}: {
  milestoneId: string;
  mode: PresentMode;
  /** The installer's own images and documents on the terms in force, oldest first. */
  items: EvidenceItem[];
  /** The ids filed since the standing decision. */
  since: string[];
  caps: Record<string, number>;
}) {
  const kit = useTransactionKit();
  const wallet = useWallet();
  const says = SAYS[mode];
  const start = mode === "request_cure" ? since : items.map((it) => it.item_id);
  const [picked, setPicked] = useState<string[]>(start.slice(0, 8));
  const [signing, setSigning] = useState<string[] | null>(null);

  const canSign = !!wallet.address && wallet.chainOk && !!kit;
  const chosen = items.filter((it) => picked.includes(it.item_id));
  const counts = withinCaps(chosen, caps);
  const hasNew = chosen.some((it) => since.includes(it.item_id));
  const problem = !chosen.length
    ? "Choose at least one item."
    : !counts.ok
      ? `One round reads at most ${plural(caps.IMAGE ?? 4, "photograph")} and ${plural(caps.TEXT ?? 4, "document")} from you.`
      : mode === "request_cure" && !hasNew
        ? "Include at least one item filed since the decision."
        : "";

  const toggle = (id: string) =>
    setPicked((now) => (now.includes(id) ? now.filter((x) => x !== id) : [...now, id]));

  const done = (outcome: TxOutcome) => {
    if (outcome.successful) setSigning(null);
  };

  return (
    <Card>
      <h3 className="type-subheading">{says.heading}</h3>
      <p className="mt-4 max-w-[640px] text-[15px] leading-[1.6] text-steel">{says.lead}</p>

      {!items.length ? (
        <p className="mt-6 text-[15px] text-slate">You have filed nothing a panel can read yet.</p>
      ) : (
        <ul className="mt-8 flex max-w-[640px] flex-col">
          {items.map((it) => (
            <li key={it.item_id} className="border-t border-mist py-4">
              <label className="flex cursor-pointer items-start gap-4">
                <input
                  type="checkbox"
                  checked={picked.includes(it.item_id)}
                  onChange={() => toggle(it.item_id)}
                  disabled={!!signing}
                  className="mt-1"
                />
                <span className="min-w-0">
                  <span className="block text-[15px] text-graphite">
                    {prose(it.caption) || itemKind(it.kind, it.origin)}
                  </span>
                  <span className="mt-2 flex flex-wrap gap-2">
                    <Tag muted>{itemKind(it.kind, it.origin)}</Tag>
                    {since.includes(it.item_id) ? <Tag>Filed since the decision</Tag> : null}
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}

      {items.length ? (
        <p className="type-caption mt-5">
          {plural(counts.images, "photograph")} and {plural(counts.texts, "document")} chosen.
          {problem ? ` ${problem}` : ""}
        </p>
      ) : null}

      {!signing ? (
        <div className="mt-8">
          <Button
            disabled={!canSign || !!problem || !items.length}
            onClick={() => setSigning(chosen.map((it) => it.item_id))}
            title={canSign ? undefined : "Connect a wallet on this network first"}
          >
            Continue
          </Button>
        </div>
      ) : kit ? (
        <div className="mt-8">
          <TxPanel
            kit={kit}
            tx={{ kind: "write", address: CONTRACT_ADDRESS, method: mode,
                  args: [milestoneId, JSON.stringify(signing)] }}
            confirmText={says.confirm}
            working={says.working}
            onDone={done}
            onClose={() => setSigning(null)}
          />
        </div>
      ) : null}
    </Card>
  );
}
