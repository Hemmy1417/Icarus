/**
 * No machine identifier reaches a page.
 *
 * A panel writes in the record's own vocabulary, citing items as ev-000001
 * and schedule lines as E1, because that is what it was shown. Those
 * sentences are reproduced on the case sheet, so they have to be written out
 * first. These tests pin that, and pin the two things it must not do:
 * change the panel's wording, or mangle a model number to fit a sentence.
 */
import { describe, expect, it } from "vitest";

import { referenceNames, writeOut } from "@/lib/present";

const LINES = [
  { id: "E1", role: "INVERTER", model: "MOD 4000TL3-X" },
  { id: "E2", role: "BATTERY", model: "RESU10H" },
];
const CRITERIA = [{ id: "C1" }, { id: "C2" }];

/** What must never survive into reading flow. */
const MACHINE = /ev-\d+|\b[EC]\d{1,2}\b|\bms-\d{5}\b|\bpr-\d{5}\b/;

describe("a panel's references are written out", () => {
  const names = referenceNames(LINES, CRITERIA);

  it("turns an item citation into the words for it", () => {
    expect(writeOut("ev-000001 shows an inverter.", names)).toBe(
      "The first item shows an inverter.",
    );
    expect(writeOut("ev-000002 confirms the plate.", names)).toBe(
      "The second item confirms the plate.",
    );
  });

  it("turns a schedule line into the equipment it names", () => {
    expect(writeOut("E1 is installed.", names)).toBe("The inverter is installed.");
    expect(writeOut("No evidence shows E2.", names)).toBe("No evidence shows the battery.");
  });

  it("turns a criterion into the condition it is", () => {
    expect(writeOut("For C1, the unit is wall mounted.", names)).toBe(
      "For the first condition, the unit is wall mounted.",
    );
  });

  it("capitalises a sentence a substitution reopened", () => {
    const said = writeOut("ev-000001 shows it. ev-000002 confirms it.", names);
    expect(said).toBe("The first item shows it. The second item confirms it.");
  });

  it("leaves nothing machine readable behind, on a real panel sentence", () => {
    const real =
      "ev-000001 shows a Growatt inverter mounted on a white wall, but no model number is "
      + "legible from that image. ev-000002 shows the rating plate, satisfying the nameplate "
      + "legibility requirement for E1. For C1, ev-000001 clearly shows it wall mounted.";
    const said = writeOut(real, names);
    expect(said).not.toMatch(MACHINE);
  });
});

describe("what writing out must not do", () => {
  const names = referenceNames(LINES, CRITERIA);

  it("never alters the panel's own wording", () => {
    const said = "The two images are consistent with each other, so they establish installation.";
    expect(writeOut(said, names)).toBe(said);
  });

  it("never lowercases a model number to fit a sentence", () => {
    // The model is the thing the schedule is about; mangling it would be worse
    // than printing the identifier this function exists to remove.
    const mapped = referenceNames(
      [
        { id: "E1", role: "INVERTER", model: "MOD 4000TL3-X" },
        { id: "E2", role: "INVERTER", model: "MOD 10KTL3-X" },
      ],
      [],
    );
    expect(mapped.E1).toBe("the inverter (MOD 4000TL3-X)");
    expect(mapped.E2).toBe("the inverter (MOD 10KTL3-X)");
  });

  it("names a line by role alone when no other line shares that role", () => {
    expect(referenceNames(LINES).E1).toBe("the inverter");
    expect(referenceNames(LINES).E2).toBe("the battery");
  });

  it("leaves a reference it has no word for alone rather than inventing one", () => {
    expect(writeOut("E9 was not in these terms.", referenceNames(LINES))).toBe(
      "E9 was not in these terms.",
    );
  });

  it("survives a panel that cited nothing", () => {
    expect(writeOut("", {})).toBe("");
    expect(writeOut(null, {})).toBe("");
  });
});
