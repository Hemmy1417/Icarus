"use client";

/**
 * Opening a site.
 *
 * The owner names the installer and escrows the opening balance in one
 * signed write. The escrow is sent with the transaction, so the review panel
 * shows it leaving the wallet before anything is signed.
 */
import { useState } from "react";

import { Button } from "@/components/bits";
import { TxPanel, type TxOutcome } from "@/components/TxPanel";
import { CONTRACT_ADDRESS } from "@/lib/config";
import { useTransactionKit } from "@/lib/kit";
import { gen, parseGen, systemType } from "@/lib/present";
import { useWallet } from "@/lib/wallet";

const SYSTEMS = [
  "ROOFTOP_SOLAR",
  "COMMERCIAL_SOLAR",
  "UTILITY_SCALE_SOLAR",
  "SOLAR_PLUS_STORAGE",
  "MICROGRID",
  "BATTERY_STORAGE",
  "OFF_GRID_POWER",
  "RENEWABLE_ENERGY_MAINTENANCE",
];

const WINDOWS = [
  { seconds: 600, label: "10 minutes, for a demonstration" },
  { seconds: 86_400, label: "A day" },
  { seconds: 3 * 86_400, label: "Three days" },
  { seconds: 7 * 86_400, label: "A week" },
];

const field =
  "w-full rounded-card border border-mist bg-canvas-white px-4 py-3 text-[15px] text-graphite outline-none focus:border-graphite";

export default function NewSite() {
  const kit = useTransactionKit();
  const wallet = useWallet();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [site, setSite] = useState("");
  const [system, setSystem] = useState("COMMERCIAL_SOLAR");
  const [capacity, setCapacity] = useState("");
  const [installer, setInstaller] = useState("");
  const [inspector, setInspector] = useState("");
  const [appealWindow, setAppealWindow] = useState(600);
  const [escrow, setEscrow] = useState("");
  const [problem, setProblem] = useState("");
  const [signing, setSigning] = useState<{ params: string; value: bigint } | null>(null);

  const canSign = !!wallet.address && wallet.chainOk && !!kit;

  function begin() {
    setProblem("");
    if (!title.trim()) return setProblem("The site needs a name.");
    if (!/^0x[0-9a-fA-F]{40}$/.test(installer.trim())) {
      return setProblem("The installer's account must be a full address.");
    }
    if (inspector.trim() && !/^0x[0-9a-fA-F]{40}$/.test(inspector.trim())) {
      return setProblem("If you name an inspector, it must be a full address.");
    }
    const wei = parseGen(escrow);
    if (wei === null || wei <= 0n) return setProblem("Escrow something to pay the work from.");

    setSigning({
      params: JSON.stringify({
        title: title.trim(),
        description: description.trim(),
        site: site.trim(),
        system_type: system,
        capacity_kw: capacity.trim(),
        installer: installer.trim(),
        inspector: inspector.trim(),
        appeal_window_seconds: appealWindow,
      }),
      value: wei,
    });
  }

  function done(outcome: TxOutcome) {
    if (outcome.successful) reset();
  }

  function reset() {
    setTitle("");
    setDescription("");
    setSite("");
    setCapacity("");
    setInstaller("");
    setInspector("");
    setEscrow("");
  }

  return (
    <div className="mx-auto w-full max-w-[1200px] px-5 md:px-10">
      <header className="py-20">
        <h1 className="max-w-[16ch] text-[clamp(40px,6vw,76px)] font-normal leading-[0.95] tracking-[-0.03em] text-graphite [font-family:var(--font-display)]">
          Open a site.
        </h1>
        <p className="mt-8 max-w-[52ch] text-[19px] leading-[1.5] text-steel">
          You name the installer and escrow what the work will be paid from. Nothing is judged
          until you propose a milestone and they sign its schedule.
        </p>
      </header>

      <section className="grid gap-10 border-t border-mist py-16 md:grid-cols-[minmax(0,360px)_minmax(0,1fr)] md:gap-16">
        <h2 className="text-[24px] leading-[1.2] tracking-[-0.02em] text-graphite [font-family:var(--font-display)]">
          The site
        </h2>
        <div className="flex max-w-[560px] flex-col gap-5">
          <div>
            <label className="type-caption mb-2 block" htmlFor="p-title">
              What this project is
            </label>
            <input id="p-title" value={title} onChange={(e) => setTitle(e.target.value)} className={field} />
          </div>
          <div>
            <label className="type-caption mb-2 block" htmlFor="p-desc">
              A sentence about it
            </label>
            <textarea
              id="p-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={`${field} leading-[1.6]`}
            />
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className="type-caption mb-2 block" htmlFor="p-site">
                Where it is
              </label>
              <input id="p-site" value={site} onChange={(e) => setSite(e.target.value)} className={field} />
            </div>
            <div>
              <label className="type-caption mb-2 block" htmlFor="p-cap">
                Capacity in kW
              </label>
              <input
                id="p-cap"
                inputMode="decimal"
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                className={`${field} figure`}
              />
            </div>
          </div>
          <div>
            <label className="type-caption mb-2 block" htmlFor="p-sys">
              What kind of system
            </label>
            <select id="p-sys" value={system} onChange={(e) => setSystem(e.target.value)} className={field}>
              {SYSTEMS.map((s) => (
                <option key={s} value={s}>
                  {systemType(s)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="grid gap-10 border-t border-mist py-16 md:grid-cols-[minmax(0,360px)_minmax(0,1fr)] md:gap-16">
        <div>
          <h2 className="text-[24px] leading-[1.2] tracking-[-0.02em] text-graphite [font-family:var(--font-display)]">
            Who is party to it
          </h2>
          <p className="type-caption mt-4 max-w-[38ch]">
            An account is the only thing the contract knows a party by, so these are the one
            place an address has to be typed.
          </p>
        </div>
        <div className="flex max-w-[560px] flex-col gap-5">
          <div>
            <label className="type-caption mb-2 block" htmlFor="p-inst">
              The installer&apos;s account
            </label>
            <input
              id="p-inst"
              value={installer}
              onChange={(e) => setInstaller(e.target.value)}
              className={`${field} figure`}
              placeholder="0x"
            />
          </div>
          <div>
            <label className="type-caption mb-2 block" htmlFor="p-insp">
              An inspector&apos;s account, if there is one
            </label>
            <input
              id="p-insp"
              value={inspector}
              onChange={(e) => setInspector(e.target.value)}
              className={`${field} figure`}
              placeholder="0x"
            />
            <p className="type-caption mt-2">
              Only an inspector&apos;s report can witness the site in writing. Without one, every
              document on this project is a party&apos;s own account.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-10 border-t border-mist py-16 md:grid-cols-[minmax(0,360px)_minmax(0,1fr)] md:gap-16">
        <h2 className="text-[24px] leading-[1.2] tracking-[-0.02em] text-graphite [font-family:var(--font-display)]">
          The money and the window
        </h2>
        <div className="flex max-w-[560px] flex-col gap-5">
          <div>
            <label className="type-caption mb-2 block" htmlFor="p-escrow">
              Escrow to open with
            </label>
            <input
              id="p-escrow"
              inputMode="decimal"
              value={escrow}
              onChange={(e) => setEscrow(e.target.value)}
              className={`${field} figure`}
              placeholder="3"
            />
            {parseGen(escrow) ? (
              <p className="type-caption mt-2">
                <span className="figure">{gen(parseGen(escrow) ?? 0n)}</span> leaves your wallet
                with this transaction. Anything no milestone reserves can be withdrawn again.
              </p>
            ) : null}
          </div>
          <div>
            <label className="type-caption mb-2 block" htmlFor="p-win">
              How long a decision can be contested
            </label>
            <select
              id="p-win"
              value={appealWindow}
              onChange={(e) => setAppealWindow(Number(e.target.value))}
              className={field}
            >
              {WINDOWS.map((w) => (
                <option key={w.seconds} value={w.seconds}>
                  {w.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="border-t border-mist py-16">
        {!canSign ? (
          <p className="text-[15px] text-steel">Connect a wallet on this network to open a site.</p>
        ) : problem ? (
          <p className="mb-5 text-[15px] text-graphite">{problem}</p>
        ) : null}

        {!signing ? (
          <Button disabled={!canSign} onClick={begin}>
            Open the site
          </Button>
        ) : kit ? (
          <TxPanel
            kit={kit}
            tx={{ kind: "write", address: CONTRACT_ADDRESS, method: "create_project", args: [signing.params] }}
            value={signing.value}
            confirmText="Open the site"
            onDone={done}
            onClose={() => setSigning(null)}
          />
        ) : null}
      </section>
    </div>
  );
}
