"use client";

/**
 * What the connected account is owed, and the way to draw it.
 *
 * A settled milestone credits a ledger inside the contract; nothing is ever
 * pushed to a wallet. That design is only honest if drawing the money is
 * always to hand, so this sits in the frame rather than on one page, and
 * appears only when there is something to draw.
 */
import { useState } from "react";

import { Button } from "./bits";
import { TxPanel, type TxOutcome } from "./TxPanel";
import { CONTRACT_ADDRESS } from "@/lib/config";
import { useTransactionKit } from "@/lib/kit";
import { gen } from "@/lib/present";
import { getBalance } from "@/lib/read";
import { useChain } from "@/lib/useChain";
import { useWallet } from "@/lib/wallet";

export function ClaimBar() {
  const wallet = useWallet();
  const kit = useTransactionKit();
  const [signing, setSigning] = useState(false);

  const balance = useChain(
    wallet.address ? `balance.${wallet.address}` : null,
    () => getBalance(wallet.address, true),
  );

  const owed = (() => {
    try {
      return BigInt(balance.data?.claimable ?? "0");
    } catch {
      return 0n;
    }
  })();

  if (!wallet.address || owed <= 0n) return null;

  function done(outcome: TxOutcome) {
    if (outcome.successful) {
      setSigning(false);
      balance.reload();
    }
  }

  return (
    <div className="mx-auto mt-5 w-full max-w-[1200px] px-5 md:px-10">
      <div className="rounded-tl-[6px] bg-ivory p-8">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div>
            <p className="type-caption text-brass">The contract owes you</p>
            <p className="figure mt-2 text-[32px] leading-none tracking-[-0.02em] text-graphite [font-family:var(--font-display)]">
              {gen(owed)}
            </p>
            <p className="type-caption mt-3 max-w-[54ch]">
              A settled milestone credits this ledger. Nothing is pushed to a wallet, so it waits
              here until you draw it.
            </p>
          </div>
          {!signing ? (
            <Button disabled={!kit || !wallet.chainOk} onClick={() => setSigning(true)}>
              Claim it
            </Button>
          ) : null}
        </div>

        {signing && kit ? (
          <div className="mt-6">
            <TxPanel
              kit={kit}
              tx={{ kind: "write", address: CONTRACT_ADDRESS, method: "claim", args: [] }}
              confirmText="Claim it"
              onDone={done}
              onClose={() => setSigning(false)}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
