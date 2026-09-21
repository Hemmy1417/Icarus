/**
 * The presentation layer is the one place that decides what a person reads,
 * so it is the one place where a mistake reaches every page at once. These
 * tests pin the vocabulary against the contract's actual enums, and pin the
 * rules that keep machine values out of reading flow.
 */
import { describe, expect, it } from "vitest";

import {
  bytes, criterionStatus, day, decision, duration, equipmentRole, gen, itemKind, itemName,
  lineStatus, lineStatusSaid, milestoneState, milestoneType, moment, parseGen, plural, projectState,
  prose, quality, relative, roleLower, roundName, shortAddress, shortDigest, systemType, wasCut,
} from "@/lib/present";

/*
 * Read off the deployment of record with get_config, not copied from the
 * TypeScript. If the contract's vocabulary changes, these fail.
 */
const LINE_STATUSES = ["INSTALLED", "UNIDENTIFIED", "NOT_SHOWN", "ABSENT", "CONTRADICTED"];
const EQUIPMENT_ROLES = ["MODULE", "INVERTER", "BATTERY", "MOUNTING", "PROTECTION", "METER", "MONITORING"];
const SYSTEM_TYPES = [
  "ROOFTOP_SOLAR", "COMMERCIAL_SOLAR", "UTILITY_SCALE_SOLAR", "SOLAR_PLUS_STORAGE",
  "MICROGRID", "BATTERY_STORAGE", "OFF_GRID_POWER", "RENEWABLE_ENERGY_MAINTENANCE",
];
const MILESTONE_TYPES = [
  "EQUIPMENT_DELIVERY", "PV_MOUNTING_COMPLETE", "PV_MODULE_INSTALLATION", "INVERTER_INSTALLATION",
  "BATTERY_INSTALLATION", "ELECTRICAL_INTEGRATION", "PROTECTION_SYSTEM_INSTALLATION",
  "MONITORING_SYSTEM_INSTALLATION", "COMMISSIONING", "PERFORMANCE_TEST", "FINAL_HANDOVER",
  "MAINTENANCE_COMPLETION",
];
const MILESTONE_STATES = [
  "AWAITING_TERMS", "AWAITING_EVIDENCE", "ACCEPTED", "REJECTED", "UNDETERMINED", "APPEALED",
  "FINALIZED", "CLOSED",
];

/** SCREAMING_SNAKE surviving into a page means a word was never written. */
const isWritten = (s: string) => s.length > 0 && !/[A-Z]{2,}|_/.test(s);

describe("every value the contract can return has a word", () => {
  it.each(LINE_STATUSES)("a line found %s", (v) => {
    expect(isWritten(lineStatus(v))).toBe(true);
    expect(lineStatusSaid(v).length).toBeGreaterThan(20);
  });

  it.each(["MET", "NOT_MET", "UNCLEAR"])("a criterion %s", (v) => {
    expect(isWritten(criterionStatus(v))).toBe(true);
  });

  it.each(["ACCEPTED", "REJECTED", "UNDETERMINED"])("a decision of %s", (v) => {
    expect(isWritten(decision(v))).toBe(true);
  });

  it.each(MILESTONE_STATES)("a milestone %s", (v) => {
    expect(isWritten(milestoneState(v))).toBe(true);
  });

  it.each(["PROPOSED", "ACTIVE", "CANCELLED"])("a project %s", (v) => {
    expect(isWritten(projectState(v))).toBe(true);
  });

  it.each(EQUIPMENT_ROLES)("an equipment role of %s", (v) => {
    expect(isWritten(equipmentRole(v))).toBe(true);
  });

  it.each(SYSTEM_TYPES)("a system type of %s", (v) => {
    expect(isWritten(systemType(v))).toBe(true);
  });

  it.each(MILESTONE_TYPES)("a milestone type of %s", (v) => {
    expect(isWritten(milestoneType(v))).toBe(true);
  });

  it.each(["SUFFICIENT", "INSUFFICIENT", "CONFLICTING"])("evidence rated %s", (v) => {
    expect(isWritten(quality(v))).toBe(true);
  });

  it.each(["OWNER", "INSTALLER", "INSPECTOR"])("a role of %s", (v) => {
    expect(isWritten(roleLower(v))).toBe(true);
  });

  it("names an item by kind, including a declaration", () => {
    expect(itemKind("IMAGE", "NAMEPLATE")).toBe("Nameplate");
    expect(itemKind("IMAGE", "VIDEO_FRAME")).toBe("Video frame");
    expect(itemKind("DOCUMENT")).toBe("Document");
    expect(itemKind("DECLARATION")).toBe("Declaration");
  });

  it("falls back to a written word for a value it has never seen", () => {
    expect(lineStatus("SOME_NEW_FINDING")).toBe("Some new finding");
  });
});

describe("identifiers never reach reading flow as identifiers", () => {
  it("gives an item a person's handle", () => {
    expect(itemName("ev-000013")).toBe("Item 13");
    expect(itemName("ev-000001")).toBe("Item 1");
  });

  it("names a round by what it was and which one", () => {
    expect(roundName("ASSESSMENT", 1)).toBe("Assessment 1");
    expect(roundName("APPEAL", 2)).toBe("Appeal 2");
  });

  it("shortens an address and a digest only for verification views", () => {
    expect(shortAddress("0x38b195DF0E491F2B53347fb856D50090cE1C7823")).toBe("0x38b1…7823");
    expect(shortDigest("0d421a1b277171b27e69fe95034ef5525335c2497873f45ea0b3f1cd3621d0bc"))
      .toBe("0d421a1b…3621d0bc");
  });
});

describe("money", () => {
  it("writes whole and fractional GEN without trailing zeros", () => {
    expect(gen("2000000000000000000")).toBe("2 GEN");
    expect(gen("50000000000000000")).toBe("0.05 GEN");
    expect(gen("1999873695249999177")).toBe("1.9998 GEN");
    expect(gen("0")).toBe("0 GEN");
  });

  it("round-trips an amount a person typed", () => {
    expect(parseGen("2")).toBe(2_000_000_000_000_000_000n);
    expect(parseGen("0.05")).toBe(50_000_000_000_000_000n);
    expect(parseGen("")).toBeNull();
    expect(parseGen("two")).toBeNull();
    expect(parseGen("1.1234567890123456789")).toBeNull();
  });

  it("never throws on something the chain did not return cleanly", () => {
    expect(gen(null)).toBe("0 GEN");
    expect(gen("not a number")).toBe("0 GEN");
  });
});

describe("time, always in the chain's own UTC", () => {
  it("spells a day out rather than printing a machine date", () => {
    expect(day("2026-09-20T18:23:00Z")).toBe("20 Sep 2026");
    expect(moment("2026-09-20T18:23:00Z")).toBe("20 Sep 2026, 18:23 UTC");
  });

  it("reads UTC even when the machine running it does not", () => {
    /*
     * Asserting a formatted date only catches a local-time reading when the
     * runner's own offset happens to cross a boundary at that instant, so it
     * passes on most machines and in CI. This instead makes the local
     * accessors lie: if the code reaches for one, the output changes.
     */
    const proto = Date.prototype;
    const real = {
      getDate: proto.getDate, getMonth: proto.getMonth, getFullYear: proto.getFullYear,
      getHours: proto.getHours, getMinutes: proto.getMinutes,
    };
    Object.assign(proto, {
      getDate: () => 1, getMonth: () => 0, getFullYear: () => 1999,
      getHours: () => 3, getMinutes: () => 4,
    });
    try {
      expect(day("2026-09-20T18:23:00Z")).toBe("20 Sep 2026");
      expect(moment("2026-09-20T18:23:00Z")).toBe("20 Sep 2026, 18:23 UTC");
    } finally {
      Object.assign(proto, real);
    }
  });

  it("says nothing rather than Invalid Date", () => {
    expect(day("")).toBe("");
    expect(day(null)).toBe("");
    expect(moment("not a date")).toBe("");
  });

  it("writes a window as a person would say it", () => {
    expect(duration(600)).toBe("10 minutes");
    expect(duration(3600)).toBe("1 hour");
    expect(duration(3 * 86400)).toBe("3 days");
  });

  it("places a moment against a clock the caller supplies", () => {
    const now = Date.parse("2026-09-20T18:00:00Z");
    expect(relative("2026-09-20T18:42:00Z", now)).toBe("in 42 minutes");
    expect(relative("2026-09-20T15:00:00Z", now)).toBe("3 hours ago");
  });
});

describe("a party's own words are not rewritten", () => {
  it("strips control characters and collapses runs of spaces, nothing else", () => {
    expect(prose("  The  inverter on the wall  ")).toBe("The inverter on the wall");
  });

  it("leaves the wording of a caption alone", () => {
    const said = "Model name MOD 4000TL3-X, as supplied.";
    expect(prose(said)).toBe(said);
  });
});

describe("a note the contract cut is marked as cut", () => {
  it("knows a note that hit the cap", () => {
    expect(wasCut("a".repeat(200))).toBe(true);
    expect(wasCut("a short note")).toBe(false);
    expect(wasCut(null)).toBe(false);
  });
});

describe("counting", () => {
  it("agrees its noun with its number", () => {
    expect(plural(1, "line")).toBe("1 line");
    expect(plural(3, "line")).toBe("3 lines");
    expect(plural(2, "reading")).toBe("2 readings");
  });

  it("writes a size a person can judge", () => {
    expect(bytes(328_900)).toBe("328.9 kB");
    expect(bytes(512)).toBe("512 bytes");
  });
});
