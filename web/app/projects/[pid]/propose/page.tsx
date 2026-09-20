"use client";

/**
 * Proposing a milestone, which means writing its equipment schedule.
 *
 * This is the form the whole product turns on. Each line names a
 * manufacturer, a model and a rating, and says whether the nameplate has to
 * be legible in a photograph. That last switch is the strictest thing in the
 * contract and the hardest for a panel to agree on, so the form says what
 * turning it on will cost rather than presenting it as a free tightening.
 *
 * A proposal binds nothing until the installer signs it.
 */
import { useRouter } from "next/navigation";
import { use, useState } from "react";

import { Button, Loading, ReadFailure } from "@/components/bits";
import { TxPanel, type TxOutcome } from "@/components/TxPanel";
import { CONTRACT_ADDRESS } from "@/lib/config";
import { useTransactionKit } from "@/lib/kit";
import { equipmentRole, gen, milestoneType, parseGen } from "@/lib/present";
import { getProject } from "@/lib/read";
import type { Project } from "@/lib/types";
import { useChain } from "@/lib/useChain";
import { useWallet } from "@/lib/wallet";

const ROLES = ["MODULE", "INVERTER", "BATTERY", "MOUNTING", "PROTECTION", "METER", "MONITORING"];
const TYPES = [
  "EQUIPMENT_DELIVERY", "PV_MOUNTING_COMPLETE", "PV_MODULE_INSTALLATION",
  "INVERTER_INSTALLATION", "BATTERY_INSTALLATION", "ELECTRICAL_INTEGRATION",
  "PROTECTION_SYSTEM_INSTALLATION", "MONITORING_SYSTEM_INSTALLATION", "COMMISSIONING",
  "PERFORMANCE_TEST", "FINAL_HANDOVER", "MAINTENANCE_COMPLETION",
];

interface Line {
  role: string;
  manufacturer: string;
  model: string;
  rating: string;
  quantity: string;
  identify: boolean;
}

const blank = (): Line => ({
  role: "INVERTER",
  manufacturer: "",
  model: "",
  rating: "",
  quantity: "1",
  identify: true,
});

const field =
  "w-full rounded-card border border-mist bg-canvas-white px-4 py-3 text-[15px] text-graphite outline-none focus:border-graphite";

export default function Propose({ params }: { params: Promise<{ pid: string }> }) {
  const { pid } = use(params);
  const router = useRouter();
  const kit = useTransactionKit();
  const wallet = useWallet();
  const project = useChain<Project | null>(`project.${pid}`, (fresh) => getProject(pid, fresh));

  const [title, setTitle] = useState("");
  const [type, setType] = useState("INVERTER_INSTALLATION");
  const [spec, setSpec] = useState("");
  const [lines, setLines] = useState<Line[]>([blank()]);
  const [criteria, setCriteria] = useState<string[]>([""]);
  const [photos, setPhotos] = useState("2");
  const [payment, setPayment] = useState("");
  const [days, setDays] = useState("14");
  const [problem, setProblem] = useState("");
  const [signing, setSigning] = useState<string | null>(null);

  const canSign = !!wallet.address && wallet.chainOk && !!kit;
  const frame = "mx-auto w-full max-w-[1200px] px-5 md:px-10";

  if (project.loading) return <div className={`${frame} py-24`}><Loading what="this site" /></div>;
  if (project.error) return <div className={`${frame} py-24`}><ReadFailure what="this site" /></div>;
  if (!project.data) {
    return (
      <div className={`${frame} py-24`}>
        <h1 className="type-heading">Nothing here</h1>
      </div>
    );
  }

  const p = project.data;
  const set = (i: number, patch: Partial<Line>) =>
    setLines(lines.map((l, k) => (k === i ? { ...l, ...patch } : l)));

  function begin() {
    setProblem("");
    if (!title.trim()) return setProblem("The milestone needs a name.");
    const kept = lines.filter((l) => l.manufacturer.trim() || l.model.trim());
    if (!kept.length) return setProblem("A schedule needs at least one piece of equipment.");
    if (kept.some((l) => !l.manufacturer.trim() || !l.model.trim())) {
      return setProblem("Every line needs a manufacturer and a model, or the panel has nothing to match.");
    }
    const wei = parseGen(payment);
    if (wei === null || wei <= 0n) return setProblem("Say what this milestone pays.");
    const unreserved = BigInt(p.unreserved_wei);
    if (wei > unreserved) {
      return setProblem(
        `This site holds ${gen(unreserved)} that no milestone has reserved. Fund it further first.`,
      );
    }
    const ahead = Number(days);
    if (!Number.isFinite(ahead) || ahead < 1) return setProblem("Give it a deadline in days.");

    const deadline = new Date(Date.now() + ahead * 86_400_000).toISOString().replace(/\.\d+Z$/, "Z");
    setSigning(
      JSON.stringify({
        milestone_type: type,
        title: title.trim(),
        description: "Installed equipment, photographed on site for settlement.",
        requirements:
          "The equipment named in the schedule is installed on this site, and where the "
          + "schedule requires it, identifiable from its own markings.",
        specification: spec.trim(),
        equipment: kept.map((l) => ({
          role: l.role,
          manufacturer: l.manufacturer.trim(),
          model: l.model.trim(),
          rating: l.rating.trim(),
          quantity: Math.max(1, Number(l.quantity) || 1),
          identify: l.identify,
        })),
        criteria: criteria.filter((c) => c.trim()).map((c) => ({ text: c.trim() })),
        evidence_requirements: [
          {
            text: "Photographs of the installed equipment",
            kind: "IMAGE",
            from_role: "INSTALLER",
            min_count: Math.max(1, Number(photos) || 1),
          },
        ],
        payment_wei: wei.toString(),
        deadline,
      }),
    );
  }

  function done(outcome: TxOutcome) {
    if (outcome.successful) router.push(`/projects/${pid}`);
  }

  return (
    <div className={frame}>
      <header className="py-20">
        <h1 className="max-w-[16ch] text-[clamp(40px,6vw,76px)] font-normal leading-[0.95] tracking-[-0.03em] text-graphite [font-family:var(--font-display)]">
          Write the schedule.
        </h1>
        <p className="mt-8 max-w-[52ch] text-[19px] leading-[1.5] text-steel">
          A milestone is the equipment it names. Whatever you write here is what a panel will go
          looking for in the photographs, and nothing else.
        </p>
        <p className="type-caption mt-6">
          {p.title}. <span className="figure">{gen(p.unreserved_wei)}</span> unreserved.
        </p>
      </header>

      <section className="grid gap-10 border-t border-mist py-16 md:grid-cols-[minmax(0,360px)_minmax(0,1fr)] md:gap-16">
        <h2 className="text-[24px] leading-[1.2] tracking-[-0.02em] text-graphite [font-family:var(--font-display)]">
          What it is
        </h2>
        <div className="flex max-w-[560px] flex-col gap-5">
          <div>
            <label className="type-caption mb-2 block" htmlFor="m-title">
              What this milestone is called
            </label>
            <input id="m-title" value={title} onChange={(e) => setTitle(e.target.value)} className={field} />
          </div>
          <div>
            <label className="type-caption mb-2 block" htmlFor="m-type">
              What kind of work
            </label>
            <select id="m-type" value={type} onChange={(e) => setType(e.target.value)} className={field}>
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {milestoneType(t)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="type-caption mb-2 block" htmlFor="m-spec">
              How it should be installed
            </label>
            <textarea
              id="m-spec"
              rows={3}
              value={spec}
              onChange={(e) => setSpec(e.target.value)}
              className={`${field} leading-[1.6]`}
              placeholder="One string inverter mounted on the plant room wall, its connections made at the underside."
            />
          </div>
        </div>
      </section>

      <section className="border-t border-mist py-16">
        <div className="mb-10 flex flex-wrap items-baseline justify-between gap-5">
          <h2 className="text-[24px] leading-[1.2] tracking-[-0.02em] text-graphite [font-family:var(--font-display)]">
            The equipment schedule
          </h2>
          <button
            type="button"
            onClick={() => setLines([...lines, blank()])}
            className="type-caption hover:text-graphite"
          >
            Add another line
          </button>
        </div>

        <ul className="flex flex-col">
          {lines.map((l, i) => (
            <li key={i} className={`py-8 ${i > 0 ? "border-t border-mist" : ""}`}>
              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <label className="type-caption mb-2 block">What it is</label>
                  <select
                    value={l.role}
                    onChange={(e) => set(i, { role: e.target.value })}
                    className={field}
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {equipmentRole(r)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="type-caption mb-2 block">Manufacturer</label>
                  <input
                    value={l.manufacturer}
                    onChange={(e) => set(i, { manufacturer: e.target.value })}
                    className={field}
                    placeholder="Growatt"
                  />
                </div>
                <div>
                  <label className="type-caption mb-2 block">Model</label>
                  <input
                    value={l.model}
                    onChange={(e) => set(i, { model: e.target.value })}
                    className={`${field} figure`}
                    placeholder="MOD 4000TL3-X"
                  />
                </div>
                <div className="grid grid-cols-2 gap-5">
                  <div>
                    <label className="type-caption mb-2 block">Rating</label>
                    <input
                      value={l.rating}
                      onChange={(e) => set(i, { rating: e.target.value })}
                      className={`${field} figure`}
                      placeholder="4000 W"
                    />
                  </div>
                  <div>
                    <label className="type-caption mb-2 block">How many</label>
                    <input
                      inputMode="numeric"
                      value={l.quantity}
                      onChange={(e) => set(i, { quantity: e.target.value })}
                      className={`${field} figure`}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-start gap-4">
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={l.identify}
                    onChange={(e) => set(i, { identify: e.target.checked })}
                    className="mt-1"
                  />
                  <span className="max-w-[52ch] text-[15px] leading-[1.5] text-steel">
                    The nameplate must be legible in a photograph.{" "}
                    <span className="type-caption">
                      This is the strictest line a schedule can carry, and the one a panel of
                      differing models agrees on least readily. Without it, a unit of the right
                      kind is enough.
                    </span>
                  </span>
                </label>
                {lines.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => setLines(lines.filter((_, k) => k !== i))}
                    className="type-caption ml-auto hover:text-graphite"
                  >
                    Remove
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="grid gap-10 border-t border-mist py-16 md:grid-cols-[minmax(0,360px)_minmax(0,1fr)] md:gap-16">
        <div>
          <h2 className="text-[24px] leading-[1.2] tracking-[-0.02em] text-graphite [font-family:var(--font-display)]">
            And any conditions
          </h2>
          <p className="type-caption mt-4 max-w-[38ch]">
            Each is judged on its own, on the same evidence as a schedule line. One left unclear
            leaves the whole milestone undetermined.
          </p>
        </div>
        <div className="flex max-w-[560px] flex-col gap-4">
          {criteria.map((c, i) => (
            <input
              key={i}
              value={c}
              onChange={(e) => setCriteria(criteria.map((x, k) => (k === i ? e.target.value : x)))}
              className={field}
              placeholder="The inverter is mounted on a wall with its cabling connected at the underside."
            />
          ))}
          <button
            type="button"
            onClick={() => setCriteria([...criteria, ""])}
            className="type-caption self-start hover:text-graphite"
          >
            Add another condition
          </button>
        </div>
      </section>

      <section className="grid gap-10 border-t border-mist py-16 md:grid-cols-[minmax(0,360px)_minmax(0,1fr)] md:gap-16">
        <h2 className="text-[24px] leading-[1.2] tracking-[-0.02em] text-graphite [font-family:var(--font-display)]">
          What it pays, and by when
        </h2>
        <div className="grid max-w-[560px] gap-5 sm:grid-cols-3">
          <div>
            <label className="type-caption mb-2 block" htmlFor="m-pay">
              Payment
            </label>
            <input
              id="m-pay"
              inputMode="decimal"
              value={payment}
              onChange={(e) => setPayment(e.target.value)}
              className={`${field} figure`}
              placeholder="2"
            />
          </div>
          <div>
            <label className="type-caption mb-2 block" htmlFor="m-days">
              Days to file
            </label>
            <input
              id="m-days"
              inputMode="numeric"
              value={days}
              onChange={(e) => setDays(e.target.value)}
              className={`${field} figure`}
            />
          </div>
          <div>
            <label className="type-caption mb-2 block" htmlFor="m-photos">
              Photographs needed
            </label>
            <input
              id="m-photos"
              inputMode="numeric"
              value={photos}
              onChange={(e) => setPhotos(e.target.value)}
              className={`${field} figure`}
            />
          </div>
          <p className="type-caption sm:col-span-3">
            The payment is reserved from this site&apos;s escrow the moment you propose it, so two
            milestones can never be funded from the same GEN.
          </p>
        </div>
      </section>

      <section className="border-t border-mist py-16">
        {!canSign ? (
          <p className="text-[15px] text-steel">
            Connect a wallet on this network to propose a milestone.
          </p>
        ) : problem ? (
          <p className="mb-5 max-w-[60ch] text-[15px] text-graphite">{problem}</p>
        ) : null}

        {!signing ? (
          <Button disabled={!canSign} onClick={begin}>
            Propose it
          </Button>
        ) : kit ? (
          <TxPanel
            kit={kit}
            tx={{ kind: "write", address: CONTRACT_ADDRESS, method: "add_milestone", args: [pid, signing] }}
            confirmText="Propose it"
            onDone={done}
            onClose={() => setSigning(null)}
          />
        ) : null}
      </section>
    </div>
  );
}
