"use client";

/**
 * The wallet, as the one graphite button the reference puts on the right of
 * the nav pill. A connected address is machine text, so it is shortened and
 * set in Inter with tabular figures: the only identifier the interface shows
 * outside a verification view, because a person needs to know which account
 * is about to sign.
 */
import { useEffect, useRef, useState } from "react";

import { Button } from "./bits";
import { useWallet } from "@/lib/wallet";
import { shortAddress } from "@/lib/present";

export function WalletDock() {
  const w = useWallet();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  if (w.restoring) {
    return <span className="type-caption">Reconnecting</span>;
  }

  if (w.address) {
    return (
      <div className="relative" ref={box}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="display rounded-pill bg-canvas-white px-4 py-2 text-[14px] text-graphite"
        >
          <span className="figure">{shortAddress(w.address)}</span>
        </button>
        {open ? (
          <div className="absolute right-0 top-[calc(100%+8px)] w-[300px] rounded-card border border-mist bg-canvas-white p-5">
            <p className="type-caption">Signing as</p>
            <p className="figure mt-1 break-all text-[13px] text-graphite">{w.address}</p>
            {!w.chainOk ? (
              <div className="mt-4">
                <p className="type-caption mb-2">
                  This wallet is on another network, so it cannot sign here.
                </p>
                <Button variant="secondary" onClick={() => void w.switchNetwork()}>
                  Switch network
                </Button>
              </div>
            ) : null}
            <div className="mt-4">
              <Button
                variant="secondary"
                onClick={() => {
                  w.disconnect();
                  setOpen(false);
                }}
              >
                Disconnect
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="relative" ref={box}>
      <Button onClick={() => setOpen((v) => !v)} disabled={w.connecting}>
        {w.connecting ? "Connecting" : "Connect wallet"}
      </Button>
      {open ? (
        <div className="absolute right-0 top-[calc(100%+8px)] w-[300px] rounded-card border border-mist bg-canvas-white p-5">
          {w.wallets.length === 0 ? (
            <p className="type-caption">
              No wallet was offered to this page. Install one that speaks to GenLayer, then
              reload.
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {w.wallets.map((d) => (
                <li key={d.info.rdns ?? d.info.uuid}>
                  <button
                    type="button"
                    onClick={() => {
                      void w.connect(d);
                      setOpen(false);
                    }}
                    className="flex w-full items-center gap-3 rounded-card px-3 py-2 text-left text-[15px] text-graphite hover:bg-fog"
                  >
                    {d.info.icon ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={d.info.icon} alt="" width={20} height={20} aria-hidden="true" />
                    ) : null}
                    {d.info.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {w.error ? <p className="type-caption mt-3 text-graphite">{w.error}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
