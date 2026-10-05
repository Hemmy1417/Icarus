"use client";

/**
 * Proposing a substitute for one line of the schedule.
 *
 * The form asks for exactly what the contract records: which line, the
 * product that would take its place, a public page that documents it, and
 * why the signed product cannot be fitted. What the installer types about
 * the product is their claim. If the owner objects on a line signed with
 * "or equivalent", validators fetch the page themselves and judge from it.
 */
import { useState } from "react";

import { Button, Card } from "./bits";
import { TxPanel, type TxOutcome } from "./TxPanel";
import { CONTRACT_ADDRESS } from "@/lib/config";
import { useTransactionKit } from "@/lib/kit";
import { lineName } from "@/lib/present";
import type { EquipmentLine } from "@/lib/types";
import { useWallet } from "@/lib/wallet";

const field =
  "w-full rounded-card border border-mist bg-canvas-white px-4 py-3 text-[15px] text-graphite outline-none focus:border-graphite";

export interface ProposalDraft {
  line: EquipmentLine | null;
  manufacturer: string;
  model: string;
  rating: string;
  page: string;
  reason: string;
}

/**
 * What is wrong with a proposal before it is signed, in the contract's own
 * terms, or "" when it can go. Checked here so a person is told at the form
 * rather than by a refused transaction they paid a fee for.
 */
export function proposalProblem(d: ProposalDraft, modelKeyMin = 4, urlMax = 300): string {
  if (!d.line) return "Choose the line the substitute is for.";
  if (!d.manufacturer.trim() || !d.model.trim()) return "Name the substitute's maker and model.";
  const key = d.model.replace(/[^A-Za-z0-9]/g, "");
  if (key.length < modelKeyMin) {
    return `The model needs at least ${modelKeyMin} letters or digits, so a page can be checked for it.`;
  }
  if (d.line.rating && !d.rating.trim()) {
    return "State the substitute's rating. The line it would replace has one.";
  }
  const page = d.page.trim();
  if (!/^https:\/\/[A-Za-z0-9\-._~:/?#[\]@!$&()*+,;=%]+$/.test(page) || page.length > urlMax) {
    return "The product page must be a plain https link.";
  }
  if (!d.reason.trim()) return "Say why the product on the line cannot be fitted.";
  return "";
}

export function SubstitutePanel({
  milestoneId,
  lines,
  modelKeyMin,
  urlMax,
}: {
  milestoneId: string;
  /** The schedule in force. */
  lines: EquipmentLine[];
  modelKeyMin?: number;
  urlMax?: number;
}) {
  const kit = useTransactionKit();
  const wallet = useWallet();
  const [lineId, setLineId] = useState(lines[0]?.id ?? "");
  const [manufacturer, setManufacturer] = useState("");
  const [model, setModel] = useState("");
  const [rating, setRating] = useState("");
  const [page, setPage] = useState("");
  const [reason, setReason] = useState("");
  const [shown, setShown] = useState(false);
  const [signing, setSigning] = useState<unknown[] | null>(null);

  const canSign = !!wallet.address && wallet.chainOk && !!kit;
  const line = lines.find((l) => l.id === lineId) ?? null;
  const problem = proposalProblem({ line, manufacturer, model, rating, page, reason }, modelKeyMin, urlMax);

  const begin = () => {
    setShown(true);
    if (problem || !line) return;
    setSigning([
      milestoneId,
      line.id,
      JSON.stringify({
        manufacturer: manufacturer.trim(),
        model: model.trim(),
        rating: rating.trim(),
        page: page.trim(),
        reason: reason.trim(),
      }),
    ]);
  };

  const done = (outcome: TxOutcome) => {
    if (outcome.successful) {
      setSigning(null);
      setShown(false);
      setManufacturer("");
      setModel("");
      setRating("");
      setPage("");
      setReason("");
    }
  };

  return (
    <Card>
      <h3 className="type-subheading">Propose a substitute</h3>
      <p className="mt-4 max-w-[640px] text-[15px] leading-[1.6] text-steel">
        Ask to fit a different product on one line. The owner may agree. Where the line was signed
        with &ldquo;or equivalent&rdquo; and the owner objects or does not answer, validators each
        read the page you name and decide whether the product is one. Nothing is judged on this
        milestone while a proposal is open.
      </p>

      <div className="mt-8 flex max-w-[640px] flex-col gap-5">
        <div>
          <label className="type-caption mb-2 block" htmlFor="sub-line">
            The line it is for
          </label>
          <select
            id="sub-line"
            value={lineId}
            onChange={(e) => setLineId(e.target.value)}
            className={field}
            disabled={!!signing}
          >
            {lines.map((l) => (
              <option key={l.id} value={l.id}>
                {lineName(l)}
              </option>
            ))}
          </select>
          {line ? (
            <p className="type-caption mt-2">
              {line.or_equivalent
                ? "Signed with or equivalent: if the owner objects, validators decide."
                : "Signed for this product only: the substitute needs the owner's yes."}
            </p>
          ) : null}
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className="type-caption mb-2 block" htmlFor="sub-maker">
              Its maker
            </label>
            <input
              id="sub-maker"
              value={manufacturer}
              onChange={(e) => setManufacturer(e.target.value)}
              className={field}
              disabled={!!signing}
            />
          </div>
          <div>
            <label className="type-caption mb-2 block" htmlFor="sub-model">
              Its model
            </label>
            <input
              id="sub-model"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className={field}
              disabled={!!signing}
            />
          </div>
        </div>

        <div>
          <label className="type-caption mb-2 block" htmlFor="sub-rating">
            Its rating
          </label>
          <input
            id="sub-rating"
            value={rating}
            onChange={(e) => setRating(e.target.value)}
            className={field}
            disabled={!!signing}
          />
          <p className="type-caption mt-2">
            This is your statement of it. A panel takes the figures from the page, not from here.
          </p>
        </div>

        <div>
          <label className="type-caption mb-2 block" htmlFor="sub-page">
            A public page that documents it
          </label>
          <input
            id="sub-page"
            value={page}
            onChange={(e) => setPage(e.target.value)}
            inputMode="url"
            className={field}
            disabled={!!signing}
          />
          <p className="type-caption mt-2">
            The maker&apos;s own page, an established seller&apos;s catalogue or a certification
            register. It must name the model in ordinary text. A page nobody answerable for the
            product published approves nothing.
          </p>
        </div>

        <div>
          <label className="type-caption mb-2 block" htmlFor="sub-reason">
            Why the product on the line cannot be fitted
          </label>
          <textarea
            id="sub-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            className={`${field} leading-[1.6]`}
            disabled={!!signing}
          />
        </div>
      </div>

      {shown && problem ? <p className="mt-5 text-[15px] text-graphite">{problem}</p> : null}

      {!signing ? (
        <div className="mt-8">
          <Button
            disabled={!canSign}
            onClick={begin}
            title={canSign ? undefined : "Connect a wallet on this network first"}
          >
            Continue
          </Button>
        </div>
      ) : kit ? (
        <div className="mt-8">
          <TxPanel
            kit={kit}
            tx={{ kind: "write", address: CONTRACT_ADDRESS, method: "propose_substitution", args: signing }}
            confirmText="Propose the substitute"
            onDone={done}
            onClose={() => setSigning(null)}
          />
        </div>
      ) : null}
    </Card>
  );
}
