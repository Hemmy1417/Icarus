import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";

import { Shell } from "@/components/Shell";
import { WalletProvider } from "@/lib/wallet";

import "./globals.css";

/*
 * Two faces, and the contrast between them is the whole typographic idea.
 * Space Grotesk stands in for PolySans: it is the closest widely available
 * grotesque with the same slightly mechanical warmth, and like PolySans it is
 * used at weight 400 and never heavier. Inter carries body copy and every
 * machine value.
 */
const display = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-space-grotesk",
  display: "swap",
});

const body = Inter({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Icarus",
  description:
    "Renewable energy installation milestones, settled against the equipment "
    + "schedule they were written from, on evidence a panel of validators read "
    + "for itself.",
  icons: { icon: "/icon.svg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>
        <WalletProvider>
          <Shell>{children}</Shell>
        </WalletProvider>
      </body>
    </html>
  );
}
