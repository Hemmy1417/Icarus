"use client";

/**
 * The frame every page sits in. The reference asks for a floating ash pill
 * centred at the top, the wordmark on the left and one graphite button on
 * the right; that button is the wallet, because it is the only action that
 * belongs on every page.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { WalletDock } from "./WalletDock";
import { CONTRACT_CONFIGURED, IS_RECORD } from "@/lib/config";

const NAV = [
  { href: "/projects", label: "Projects" },
  { href: "/how", label: "How it decides" },
  { href: "/verify", label: "Verify" },
];

function Wordmark() {
  return (
    <Link href="/" className="flex items-center gap-3" aria-label="Icarus, home">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icon.svg" alt="" width={26} height={26} aria-hidden="true" />
      <span className="display text-[19px] leading-none">Icarus</span>
    </Link>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="flex min-h-screen flex-col">
      <div className="sticky top-0 z-40 w-full px-5 pt-5">
        <header className="mx-auto flex w-full max-w-[1200px] items-center justify-between gap-5 rounded-pill bg-ash px-6 py-3">
          <Wordmark />
          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`display rounded-pill px-4 py-2 text-[15px] ${
                    active ? "bg-canvas-white text-graphite" : "text-steel hover:text-graphite"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <WalletDock />
        </header>
      </div>

      {!CONTRACT_CONFIGURED ? (
        <div className="mx-auto mt-5 w-full max-w-[1200px] px-5">
          <p className="rounded-card border border-mist bg-fog p-5 text-[15px] text-graphite">
            This build has no deployment configured, so there is nothing to read.
          </p>
        </div>
      ) : null}

      {CONTRACT_CONFIGURED && !IS_RECORD ? (
        <div className="mx-auto mt-5 w-full max-w-[1200px] px-5">
          <p className="rounded-card border border-mist bg-fog p-5 text-[15px] text-graphite">
            This build is pointed at a deployment other than the one of record, so what you read
            here is a test, not the published record.
          </p>
        </div>
      ) : null}

      <main className="flex-1">{children}</main>

      <footer className="border-t border-mist">
        <div className="mx-auto flex w-full max-w-[1200px] flex-wrap items-center justify-between gap-6 px-5 py-12 md:px-10">
          <Wordmark />
          <nav className="flex flex-wrap items-center gap-6">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} className="type-caption hover:text-graphite">
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </footer>
    </div>
  );
}
