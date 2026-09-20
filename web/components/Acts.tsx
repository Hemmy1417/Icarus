"use client";

/**
 * What this viewer can do here, and what they are told instead.
 *
 * An act the contract would refuse is never rendered as a button that fails:
 * `lib/acts.ts` decides availability by mirroring the contract's own checks,
 * and an unavailable act is listed with its reason in words. That way a
 * person learns why a window has closed without paying a fee to find out.
 */
import { useState } from "react";

import { Button, Card, Hairline } from "./bits";
import { TxPanel, type TxOutcome } from "./TxPanel";
import type { Act, ActId } from "@/lib/acts";
import { CONTRACT_ADDRESS } from "@/lib/config";
import { useTransactionKit } from "@/lib/kit";
import { gen, parseGen } from "@/lib/present";
import { useWallet } from "@/lib/wallet";

/** How each act reads as a button, and what it needs from the person first. */
const LABEL: Record<ActId, string> = {
  accept_project: "Sign the project",
  accept_inspector_role: "Accept the inspector role",
  fund_project: "Fund the escrow",
  withdraw_escrow: "Withdraw unreserved escrow",
  cancel_project: "Cancel the project",
  add_milestone: "Propose a milestone",
  propose_version: "Propose new terms",
  accept_version: "Sign the proposed terms",
  submit_image: "File a photograph",
  submit_document: "File a document",
  submit_declaration: "Record a statement",
  request_assessment: "Ask a panel to assess it",
  open_appeal: "Contest this decision",
  decide_appeal: "Have a fresh panel decide",
  lapse_appeal: "Close the undecided appeal",
  finalize: "Settle the milestone",
  close_milestone: "Close the milestone",
  claim: "Claim what you are owed",
};

/** Acts that take one value from the person before they can be signed. */
type Input = { kind: "gen"; label: string; help: string } | { kind: "text"; label: string; help: string };

const INPUT: Partial<Record<ActId, Input>> = {
  fund_project: {
    kind: "gen",
    label: "Amount to add to the escrow",
    help: "This leaves your wallet and is held by the contract against this project's milestones.",
  },
  withdraw_escrow: {
    kind: "gen",
    label: "Amount to take back",
    help: "Only escrow that no milestone has reserved can be withdrawn.",
  },
  open_appeal: {
    kind: "text",
    label: "Why you are contesting this",
    help: "A fresh panel reads this as your argument. It is told that your reason is not evidence and cannot itself establish or refute a line.",
  },
};

/** Acts handled by their own page, because they need a whole form. */
const ELSEWHERE: Partial<Record<ActId, string>> = {
  add_milestone: "Propose it with its equipment schedule",
  propose_version: "Revise the schedule",
  submit_image: "File it with the evidence panel below",
  submit_document: "File it with the evidence panel below",
  submit_declaration: "Record it with the evidence panel below",
};

/** The round writes take minutes, so the panel says what is happening. */
const WORKING: Partial<Record<ActId, string>> = {
  request_assessment: "Each validator is reading the photographs and matching them to the schedule.",
  decide_appeal: "A fresh panel is judging the milestone from the start.",
};

export function Acts({
  acts,
  args,
  heading = "What you can do here",
}: {
  acts: Act[];
  /** The leading arguments each write takes, before any the person supplies. */
  args: Partial<Record<ActId, unknown[]>>;
  heading?: string;
}) {
  const kit = useTransactionKit();
  const wallet = useWallet();
  const [open, setOpen] = useState<ActId | null>(null);
  const [draft, setDraft] = useState("");
  const [signing, setSigning] = useState<{ id: ActId; args: unknown[]; value?: bigint } | null>(null);

  if (!acts.length) return null;

  const start = (id: ActId) => {
    setDraft("");
    setOpen(open === id ? null : id);
  };

  const submit = (id: ActId) => {
    const base = args[id] ?? [];
    const input = INPUT[id];
    if (!input) {
      setSigning({ id, args: base });
      return;
    }
    if (input.kind === "gen") {
      const wei = parseGen(draft);
      if (wei === null || wei <= 0n) return;
      // fund_project carries its value; withdraw takes it as an argument.
      setSigning(
        id === "fund_project"
          ? { id, args: base, value: wei }
          : { id, args: [...base, wei.toString()] },
      );
      return;
    }
    if (!draft.trim()) return;
    setSigning({ id, args: [...base, draft.trim()] });
  };

  const done = (outcome: TxOutcome) => {
    if (outcome.successful) {
      setOpen(null);
      setDraft("");
    }
  };

  return (
    <Card>
      <h3 className="type-subheading">{heading}</h3>

      {!wallet.address ? (
        <p className="mt-4 text-[15px] leading-[1.6] text-steel">
          Connect a wallet to act here. Reading this record never needs one.
        </p>
      ) : !wallet.chainOk ? (
        <p className="mt-4 text-[15px] leading-[1.6] text-steel">
          Your wallet is on another network, so it cannot sign here. Switch it from the button in
          the header.
        </p>
      ) : null}

      <ul className="mt-6 flex flex-col">
        {acts.map((a, i) => {
          const elsewhere = ELSEWHERE[a.id];
          const input = INPUT[a.id];
          const isOpen = open === a.id;
          const canSign = !!wallet.address && wallet.chainOk && !!kit;
          return (
            <li key={a.id}>
              {i > 0 ? <Hairline className="my-5" /> : null}
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0 max-w-[520px]">
                  <p className="text-[15px] text-graphite">{LABEL[a.id]}</p>
                  <p className="type-caption mt-1">{a.reason}</p>
                </div>
                <div className="shrink-0">
                  {!a.available ? (
                    <span className="type-caption">Not available</span>
                  ) : elsewhere ? (
                    <span className="type-caption">{elsewhere}</span>
                  ) : (
                    <Button
                      variant={isOpen ? "secondary" : "primary"}
                      disabled={!canSign}
                      onClick={() => start(a.id)}
                      title={canSign ? undefined : "Connect a wallet on this network first"}
                    >
                      {isOpen ? "Cancel" : LABEL[a.id]}
                    </Button>
                  )}
                </div>
              </div>

              {isOpen && !signing ? (
                <div className="mt-5">
                  {input ? (
                    <div className="max-w-[520px]">
                      <label className="type-caption mb-2 block" htmlFor={`in-${a.id}`}>
                        {input.label}
                      </label>
                      {input.kind === "gen" ? (
                        <input
                          id={`in-${a.id}`}
                          inputMode="decimal"
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          placeholder="2"
                          className="figure w-full rounded-card border border-mist bg-canvas-white px-4 py-3 text-[15px] text-graphite outline-none focus:border-graphite"
                        />
                      ) : (
                        <textarea
                          id={`in-${a.id}`}
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          rows={4}
                          className="w-full rounded-card border border-mist bg-canvas-white px-4 py-3 text-[15px] leading-[1.55] text-graphite outline-none focus:border-graphite"
                        />
                      )}
                      <p className="type-caption mt-2">{input.help}</p>
                      {input.kind === "gen" && parseGen(draft) ? (
                        <p className="type-caption mt-1">
                          That is <span className="figure">{gen(parseGen(draft) ?? 0n)}</span>.
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                  <div className="mt-5">
                    <Button onClick={() => submit(a.id)}>Continue</Button>
                  </div>
                </div>
              ) : null}

              {isOpen && signing && kit ? (
                <div className="mt-5">
                  <TxPanel
                    kit={kit}
                    tx={{ kind: "write", address: CONTRACT_ADDRESS, method: signing.id, args: signing.args }}
                    value={signing.value}
                    confirmText={LABEL[signing.id]}
                    working={WORKING[signing.id]}
                    onDone={done}
                    onClose={() => {
                      setSigning(null);
                      setOpen(null);
                    }}
                  />
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
