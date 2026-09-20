/**
 * Every contract call this interface composes, checked against the
 * contract's own signatures.
 *
 * Three real bugs of this exact shape shipped past a typechecker, a linter
 * and a hundred other tests, because a contract call is built as an untyped
 * array and nothing downstream knows how many entries belong in it:
 *
 *   accept_version was sent one argument where the contract takes two
 *   submit_declaration was sent three where the contract takes two
 *   claim was declared as an act and then never offered at all
 *
 * `contract-schema.json` is read from the deployment of record with
 * gen_getContractSchema, so this fails when the interface drifts from the
 * contract rather than when it drifts from a guess about the contract.
 */
import { describe, expect, it } from "vitest";

import schema from "@/lib/contract-schema.json";
import type { ActId } from "@/lib/acts";
import { RECORD_ADDRESS } from "@/lib/config";

const writes = schema.writes as Record<
  string,
  { params: string[]; types: string[]; payable: boolean }
>;

/**
 * What each page passes as the LEADING arguments, and what the person then
 * supplies. Kept beside the pages it mirrors: when one changes, this fails.
 */
const COMPOSED: Record<ActId, { leading: number; fromPerson: number; value?: boolean }> = {
  // the project page
  accept_project: { leading: 1, fromPerson: 0 },
  accept_inspector_role: { leading: 1, fromPerson: 0 },
  fund_project: { leading: 1, fromPerson: 0, value: true },
  withdraw_escrow: { leading: 1, fromPerson: 1 },
  cancel_project: { leading: 1, fromPerson: 0 },
  add_milestone: { leading: 1, fromPerson: 1 },

  // the case sheet
  accept_version: { leading: 2, fromPerson: 0 },
  propose_version: { leading: 1, fromPerson: 1 },
  request_assessment: { leading: 2, fromPerson: 0 },
  open_appeal: { leading: 1, fromPerson: 1 },
  decide_appeal: { leading: 1, fromPerson: 0 },
  lapse_appeal: { leading: 1, fromPerson: 0 },
  finalize: { leading: 1, fromPerson: 0 },
  close_milestone: { leading: 1, fromPerson: 0 },

  // the evidence panel
  submit_image: { leading: 3, fromPerson: 0 },
  submit_document: { leading: 3, fromPerson: 0 },
  submit_declaration: { leading: 2, fromPerson: 0 },

  // the claim bar
  claim: { leading: 0, fromPerson: 0 },
};

/** Writes that live on their own page rather than in an acts list. */
const ON_A_PAGE: Record<string, { leading: number; fromPerson: number; value?: boolean }> = {
  // app/projects/new: the whole form composes one params object, and the
  // opening escrow rides along as the transaction's value.
  create_project: { leading: 0, fromPerson: 1, value: true },
};

type Composed = { leading: number; fromPerson: number; value?: boolean };
const ALL: Record<string, Composed> = { ...COMPOSED, ...ON_A_PAGE };

describe("the schema this is checked against", () => {
  it("was read from the deployment of record", () => {
    expect(schema.address.toLowerCase()).toBe(RECORD_ADDRESS.toLowerCase());
  });

  it("covers every write the contract has", () => {
    expect(Object.keys(writes).length).toBe(19);
  });
});

describe("every call composes the arguments its method takes", () => {
  it.each(Object.keys(ALL))("%s", (id) => {
    const method = writes[id];
    expect(method, `${id} is not a write on this contract`).toBeDefined();
    const composed = ALL[id]!;
    expect(
      composed.leading + composed.fromPerson,
      `${id} takes (${method!.params.join(", ")})`,
    ).toBe(method!.params.length);
  });
});

describe("the contract's writes are all reachable", () => {
  it("offers every one of them somewhere", () => {
    const offered = new Set(Object.keys(ALL));
    const missing = Object.keys(writes).filter((m) => !offered.has(m));
    expect(missing, `no act offers: ${missing.join(", ")}`).toEqual([]);
  });

  it("sends value only where the contract is payable", () => {
    for (const [id, composed] of Object.entries(ALL)) {
      const payable = writes[id]?.payable ?? false;
      if (composed.value) {
        expect(payable, `${id} sends value but is not payable`).toBe(true);
      }
    }
  });

  it("sends value on every payable write the contract has", () => {
    const payable = Object.entries(writes).filter(([, m]) => m.payable).map(([k]) => k).sort();
    expect(payable).toEqual(["create_project", "fund_project"]);
    for (const id of payable) {
      expect(ALL[id]?.value, `${id} is payable but nothing sends value to it`).toBe(true);
    }
  });
});
