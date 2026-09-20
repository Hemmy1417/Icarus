"use client";

/**
 * Filing evidence.
 *
 * A photograph is redrawn and re-encoded here before it is signed, because
 * the runner's decoder reads PNG and JFIF-headed JPEG only and a camera
 * usually produces an EXIF JPEG. Filing bytes no validator can decode would
 * put evidence on the record that the panel cannot read, which is worse than
 * refusing the upload.
 *
 * The capture date and place are read out of the original file and filed as
 * what they are: the submitter's claims. Nothing in any decision rests on
 * them, and every page that shows them says so.
 */
import { useState } from "react";

import { Button, Card, Tag } from "./bits";
import { TxPanel, type TxOutcome } from "./TxPanel";
import { CONTRACT_ADDRESS } from "@/lib/config";
import { IMAGE_MAX_BYTES, preparePhoto, type PreparedImage } from "@/lib/images";
import { useTransactionKit } from "@/lib/kit";
import { bytes, equipmentRole } from "@/lib/present";
import type { EquipmentLine, EvidenceRequirement } from "@/lib/types";
import { useWallet } from "@/lib/wallet";

type Kind = "IMAGE" | "DOCUMENT" | "DECLARATION";

const ORIGINS = [
  { value: "PHOTO", label: "Photograph" },
  { value: "NAMEPLATE", label: "Nameplate" },
  { value: "VIDEO_FRAME", label: "Video frame" },
  { value: "SCAN", label: "Scan" },
] as const;

const WHAT: Record<Kind, { title: string; says: string }> = {
  IMAGE: {
    title: "A photograph",
    says: "The only kind of evidence that witnesses the site. Its bytes are held and hashed by the contract, so every validator judges exactly these.",
  },
  DOCUMENT: {
    title: "A document",
    says: "A datasheet, a drawing, an inspection or a commissioning report. It can state what was specified. It can never, by itself, establish what was installed.",
  },
  DECLARATION: {
    title: "A statement for the file",
    says: "Recorded and shown to anybody reading this milestone, and never put to a panel. It cannot establish or refute anything.",
  },
};

export function FilePanel({
  milestoneId,
  lines,
  requirements,
}: {
  milestoneId: string;
  lines: EquipmentLine[];
  requirements: EvidenceRequirement[];
}) {
  const kit = useTransactionKit();
  const wallet = useWallet();

  const [kind, setKind] = useState<Kind>("IMAGE");
  const [caption, setCaption] = useState("");
  const [line, setLine] = useState("");
  const [requirement, setRequirement] = useState("");
  const [origin, setOrigin] = useState<string>("PHOTO");
  const [body, setBody] = useState("");
  const [reference, setReference] = useState("");
  const [image, setImage] = useState<PreparedImage | null>(null);
  const [problem, setProblem] = useState("");
  const [preparing, setPreparing] = useState(false);
  const [signing, setSigning] = useState<{ args: unknown[]; method: string } | null>(null);

  const canSign = !!wallet.address && wallet.chainOk && !!kit;

  async function choose(file: File | undefined) {
    if (!file) return;
    setProblem("");
    setImage(null);
    setPreparing(true);
    try {
      setImage(await preparePhoto(file));
    } catch (e) {
      setProblem((e as Error).message || "That file could not be prepared for the record.");
    } finally {
      setPreparing(false);
    }
  }

  function begin() {
    setProblem("");
    const meta: Record<string, string> = {};
    if (caption.trim()) meta.caption = caption.trim();
    if (line) meta.equipment_id = line;
    if (requirement) meta.requirement_id = requirement;

    if (kind === "IMAGE") {
      if (!image) {
        setProblem("Choose a photograph first.");
        return;
      }
      meta.origin = origin;
      if (image.claimedCapture) meta.claimed_capture = image.claimedCapture;
      if (image.claimedLocation) meta.claimed_location = image.claimedLocation;
      setSigning({
        method: "submit_image",
        args: [milestoneId, JSON.stringify(meta), image.bytes],
      });
      return;
    }

    if (!body.trim()) {
      setProblem("A document needs its text.");
      return;
    }
    // A declaration takes only its text: the contract records it and never
    // puts it to a panel, so there is no metadata for it to be described by.
    if (kind === "DECLARATION") {
      setSigning({ method: "submit_declaration", args: [milestoneId, body.trim()] });
      return;
    }
    if (reference.trim()) meta.reference = reference.trim();
    setSigning({
      method: "submit_document",
      args: [milestoneId, JSON.stringify(meta), body.trim()],
    });
  }

  function done(outcome: TxOutcome) {
    if (!outcome.successful) return;
    setCaption("");
    setBody("");
    setReference("");
    setImage(null);
    setLine("");
    setRequirement("");
  }

  const field =
    "w-full rounded-card border border-mist bg-canvas-white px-4 py-3 text-[15px] text-graphite outline-none focus:border-graphite";

  return (
    <Card>
      <h3 className="type-subheading">File evidence</h3>

      <div className="mt-6 flex flex-wrap gap-2">
        {(Object.keys(WHAT) as Kind[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => {
              // Clear what belongs to the kind being left. Carrying a
              // reference typed under "a document" into a declaration would
              // file something the person never meant to say.
              setKind(k);
              setSigning(null);
              setProblem("");
              setReference("");
              if (k === "IMAGE") setBody("");
              else setImage(null);
            }}
            className={`display rounded-pill px-4 py-2 text-[15px] ${
              kind === k ? "bg-graphite text-canvas-white" : "border border-mist text-steel hover:bg-fog"
            }`}
          >
            {WHAT[k].title}
          </button>
        ))}
      </div>

      <p className="mt-5 max-w-[640px] text-[15px] leading-[1.6] text-steel">{WHAT[kind].says}</p>

      {!canSign ? (
        <p className="type-caption mt-5">
          Connect a wallet on this network to file anything.
        </p>
      ) : null}

      <div className="mt-8 flex max-w-[640px] flex-col gap-5">
        {kind === "IMAGE" ? (
          <div>
            <label className="type-caption mb-2 block" htmlFor="file-image">
              The photograph
            </label>
            <input
              id="file-image"
              type="file"
              accept="image/*"
              onChange={(e) => void choose(e.target.files?.[0])}
              className="block w-full text-[15px] text-steel file:mr-4 file:rounded-button file:border-0 file:bg-graphite file:px-5 file:py-2.5 file:text-canvas-white"
            />
            {preparing ? (
              <p className="type-caption mt-2">Preparing it for the record.</p>
            ) : image ? (
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Tag muted>{bytes(image.bytes.length)}</Tag>
                {image.claimedCapture ? <Tag muted>Says it was taken {image.claimedCapture}</Tag> : null}
                {image.claimedLocation ? <Tag muted>Says it was taken at {image.claimedLocation}</Tag> : null}
              </div>
            ) : null}
            <p className="type-caption mt-2">
              It is redrawn and re-encoded so the panel can decode it, and held under{" "}
              {bytes(IMAGE_MAX_BYTES)}. A capture date or place found in the file is filed as your
              claim, not as something the contract checked.
            </p>
          </div>
        ) : null}

        {kind === "IMAGE" ? (
          <div>
            <label className="type-caption mb-2 block" htmlFor="file-origin">
              What it is
            </label>
            <select
              id="file-origin"
              value={origin}
              onChange={(e) => setOrigin(e.target.value)}
              className={field}
            >
              {ORIGINS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div>
          <label className="type-caption mb-2 block" htmlFor="file-caption">
            {kind === "IMAGE" ? "What it shows, in your words" : "Its title"}
          </label>
          <input
            id="file-caption"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            className={field}
            placeholder={kind === "IMAGE" ? "The string inverter on the plant room wall" : "Inverter datasheet"}
          />
          <p className="type-caption mt-2">
            The panel is shown this as your caption, and told that it is your claim rather than
            something observed.
          </p>
        </div>

        {kind !== "IMAGE" ? (
          <>
            {kind === "DOCUMENT" ? (
              <div>
                <label className="type-caption mb-2 block" htmlFor="file-ref">
                  Its reference, if it has one
                </label>
                <input
                  id="file-ref"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  className={field}
                  placeholder="DS-MOD4000"
                />
              </div>
            ) : null}
            <div>
              <label className="type-caption mb-2 block" htmlFor="file-body">
                Its text
              </label>
              <textarea
                id="file-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={7}
                className={`${field} leading-[1.6]`}
              />
              <p className="type-caption mt-2">
                Filed exactly as written. It is fenced before it reaches a panel, so it cannot
                speak in the contract&apos;s voice.
              </p>
            </div>
          </>
        ) : null}

        {lines.length ? (
          <div>
            <label className="type-caption mb-2 block" htmlFor="file-line">
              The schedule line you are offering it for
            </label>
            <select
              id="file-line"
              value={line}
              onChange={(e) => setLine(e.target.value)}
              className={field}
            >
              <option value="">Not offered for a particular line</option>
              {lines.map((l) => (
                <option key={l.id} value={l.id}>
                  {equipmentRole(l.role)}
                  {l.manufacturer || l.model ? `, ${[l.manufacturer, l.model].filter(Boolean).join(" ")}` : ""}
                </option>
              ))}
            </select>
            <p className="type-caption mt-2">
              This is your claim about which line it answers. The panel judges from the content.
            </p>
          </div>
        ) : null}

        {requirements.length ? (
          <div>
            <label className="type-caption mb-2 block" htmlFor="file-req">
              The requirement it answers
            </label>
            <select
              id="file-req"
              value={requirement}
              onChange={(e) => setRequirement(e.target.value)}
              className={field}
            >
              <option value="">Not answering a particular requirement</option>
              {requirements.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.text}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>

      {problem ? <p className="mt-5 text-[15px] text-graphite">{problem}</p> : null}

      {!signing ? (
        <div className="mt-8">
          <Button disabled={!canSign || preparing} onClick={begin}>
            Continue
          </Button>
        </div>
      ) : kit ? (
        <div className="mt-8">
          <TxPanel
            kit={kit}
            tx={{ kind: "write", address: CONTRACT_ADDRESS, method: signing.method, args: signing.args }}
            confirmText="File it"
            onDone={done}
            onClose={() => setSigning(null)}
          />
        </div>
      ) : null}
    </Card>
  );
}
