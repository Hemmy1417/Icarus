/**
 * The claim bar.
 *
 * A settled milestone credits a ledger inside the contract and pushes
 * nothing, so being able to draw the money is not a nicety: it is the other
 * half of that design. This shipped missing entirely, which is why it is
 * tested by rendering rather than by reasoning about it.
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const balance = vi.fn();
const wallet = vi.fn();

vi.mock("@/lib/read", () => ({ getBalance: (...a: unknown[]) => balance(...a) }));
vi.mock("@/lib/wallet", () => ({ useWallet: () => wallet() }));
vi.mock("@/lib/kit", () => ({ useTransactionKit: () => ({}) }));
vi.mock("@/components/TxPanel", () => ({ TxPanel: () => <div>signing</div> }));

const { ClaimBar } = await import("@/components/ClaimBar");

const connected = (over = {}) => ({
  address: "0x5C1dc346DD687DD43708BE4992256b4Bcbc98062",
  chainOk: true,
  ...over,
});

/** useChain reads on mount, so a render has to settle before asserting. */
async function show() {
  render(<ClaimBar />);
  await screen.findByText(/owes you|^$/i).catch(() => null);
  await new Promise((r) => setTimeout(r, 50));
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("what it shows", () => {
  it("offers the money when the ledger owes some", async () => {
    wallet.mockReturnValue(connected());
    balance.mockResolvedValue({ claimable: "2000000000000000000", claimed: "0" });
    await show();
    expect(screen.getByText(/The contract owes you/i)).toBeTruthy();
    expect(screen.getByText("2 GEN")).toBeTruthy();
    expect(screen.getByRole("button", { name: /claim it/i })).toBeTruthy();
  });

  it("says nothing at all when nothing is owed", async () => {
    wallet.mockReturnValue(connected());
    balance.mockResolvedValue({ claimable: "0", claimed: "2000000000000000000" });
    await show();
    expect(screen.queryByText(/The contract owes you/i)).toBeNull();
  });

  it("says nothing when no wallet is connected", async () => {
    wallet.mockReturnValue({ address: "", chainOk: false });
    balance.mockResolvedValue({ claimable: "5000000000000000000", claimed: "0" });
    await show();
    expect(screen.queryByText(/The contract owes you/i)).toBeNull();
    expect(balance).not.toHaveBeenCalled();
  });

  it("survives a ledger value it cannot read, rather than throwing", async () => {
    wallet.mockReturnValue(connected());
    balance.mockResolvedValue({ claimable: "not a number", claimed: "0" });
    await show();
    expect(screen.queryByText(/The contract owes you/i)).toBeNull();
  });

  it("cannot be signed from a wallet on the wrong network", async () => {
    wallet.mockReturnValue(connected({ chainOk: false }));
    balance.mockResolvedValue({ claimable: "1000000000000000000", claimed: "0" });
    await show();
    expect(screen.getByRole("button", { name: /claim it/i }).hasAttribute("disabled")).toBe(true);
  });
});
