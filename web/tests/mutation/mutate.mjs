// Mutation sweep for the web rules (pnpm mutate): break one rule at a time
// in web/lib, run the tests that cover it, and require a failure.
//
// The acts layer earned this. Nine faults in it reached a browser past a
// typechecker, a linter and a hundred passing tests, because the tests only
// walked the states the happy path visits. A green suite proves the tests
// run; this proves they would notice.
//
// Every file is restored in a finally block, and the run ends by comparing
// each one against its contents before the sweep began.
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const WEB = fileURLToPath(new URL("../..", import.meta.url));
const NODE = process.execPath;
const VITEST = join(WEB, "node_modules/vitest/vitest.mjs");

const M = [
  // ── who may act: every one of these was wrong in a shipped build ──────
  ["acts", "the installer may propose new terms",
   `  if (who === "OWNER") {\n    acts.push(\n      m.state === "CLOSED" || m.state === "FINALIZED"`,
   `  if (who === "OWNER" || who === "INSTALLER") {\n    acts.push(\n      m.state === "CLOSED" || m.state === "FINALIZED"`],
  ["acts", "the owner may sign the terms they proposed",
   `  if (who === "INSTALLER") {\n    const pending = m.pending_version !== null;`,
   `  if (who === "INSTALLER" || who === "OWNER") {\n    const pending = m.pending_version !== null;`],
  ["acts", "the owner may request an assessment",
   `  if (who === "INSTALLER") {\n    const used = m.version_assessments;`,
   `  if (who === "INSTALLER" || who === "OWNER") {\n    const used = m.version_assessments;`],
  ["acts", "only the owner contests any decision",
   `    standing?.decision === "ACCEPTED" ? "OWNER"\n      : standing?.decision === "REJECTED" ? "INSTALLER"`,
   `    standing?.decision === "ACCEPTED" ? "OWNER"\n      : standing?.decision === "REJECTED" ? "OWNER"`],
  ["acts", "closing belongs to the owner alone",
   `  acts.push(\n    closeBlocked\n      ? no("close_milestone", closeBlocked)`,
   `  if (who === "OWNER") acts.push(\n    closeBlocked\n      ? no("close_milestone", closeBlocked)`],
  ["acts", "only the owner may fund the escrow",
   `  if (addr) {\n    acts.push(\n      p.state === "CANCELLED"\n        ? no("fund_project", "This project was cancelled.")`,
   `  if (who === "OWNER") {\n    acts.push(\n      p.state === "CANCELLED"\n        ? no("fund_project", "This project was cancelled.")`],
  ["acts", "a signed project can still be cancelled",
   `        : p.state !== "PROPOSED"`,
   `        : false`],

  // ── which states allow what: the recovery path was unreachable ────────
  ["acts", "filing shuts outside the evidence window",
   `      m.state === "FINALIZED" || m.state === "CLOSED"\n        ? no("submit_image", "This milestone has settled, so its record is closed.")`,
   `      m.state !== "AWAITING_EVIDENCE"\n        ? no("submit_image", "This milestone has settled, so its record is closed.")`],
  ["acts", "filing survives a standing acceptance",
   `        : m.state === "ACCEPTED"\n          ? no("submit_image", "An acceptance stands.`,
   `        : false\n          ? no("submit_image", "An acceptance stands.`],
  ["acts", "reassessment shuts after a rejection",
   `      m.state === "FINALIZED" || m.state === "CLOSED"\n        ? no("request_assessment", "This milestone has settled.")`,
   `      m.state !== "AWAITING_EVIDENCE"\n        ? no("request_assessment", "This milestone has settled.")`],
  ["acts", "an inspector files before accepting the role",
   `              : who === "INSPECTOR" && !p.inspector_accepted_at`,
   `              : false`],

  // ── the wall-clock boundaries, both sides ─────────────────────────────
  ["acts", "filing ignores the margin before the deadline",
   "const deadlinePassed = !!terms && nowMs > ms(terms.deadline) - MARGIN_MS;",
   "const deadlinePassed = !!terms && nowMs > ms(terms.deadline);"],
  ["acts", "contesting ignores the margin before the window shuts",
   "!!standing?.appealable && !standing.appealed && nowMs < ms(standing.window_ends) - MARGIN_MS;",
   "!!standing?.appealable && !standing.appealed && nowMs < ms(standing.window_ends);"],
  ["acts", "closing ignores the deadline entirely",
   "            : nowMs <= ms(terms.deadline)",
   "            : false"],
  ["acts", "closing ignores a window still open",
   "              : standing?.appealable && standing.window_ends && nowMs <= ms(standing.window_ends)",
   "              : false"],
  ["acts", "an appeal lapses the moment its evidence period ends",
   "      nowMs > lapsesAt",
   "      nowMs > ms(m.appeal.evidence_ends)"],
  ["acts", "an appeal is decided while still taking evidence",
   "      evidenceClosed\n        ? ok(\"decide_appeal\"",
   "      true\n        ? ok(\"decide_appeal\""],
  ["acts", "the assessment cap is off by one",
   "                : used >= cap",
   "                : used > cap"],
  ["acts", "settling does not wait for the window",
   "    (standing.appealed || nowMs > ms(standing.window_ends));",
   "    (standing.appealed || true);"],
  ["acts", "settling pays on a rejection",
   `      : standing?.decision !== "ACCEPTED"
        ? no("finalize", "Nothing pays until a panel accepts the milestone.")`,
   `      : false
        ? no("finalize", "Nothing pays until a panel accepts the milestone.")`],

  // ── the presentation layer: no machine value reaches a page ───────────
  ["present", "item citations left as identifiers",
   String.raw`    .replace(/ev-0*(\d+)/gi, (_m, digits: string) => {`,
   String.raw`    .replace(/ev-NEVER(\d+)/gi, (_m, digits: string) => {`],
  ["present", "schedule citations left as identifiers",
   String.raw`    .replace(/\b([EC]\d{1,2})\b/g, (m: string, id: string) => names[id.toUpperCase()] ?? m);`,
   String.raw`    .replace(/\b([EC]\d{9,})\b/g, (m: string, id: string) => names[id.toUpperCase()] ?? m);`],
  ["present", "a model number lowercased to fit a sentence",
   "    out[l.id] = alone || !l.model ? `the ${role}` : `the ${role} (${l.model})`;",
   "    out[l.id] = alone || !l.model ? `the ${role}` : `the ${role} (${l.model.toLowerCase()})`;"],
  ["present", "a substitution leaves a sentence lowercase",
   "  return written.replace(/(^|[.!?]\\s+)([a-z])/g, (_m, lead: string, ch: string) =>\n    lead + ch.toUpperCase());",
   "  return written;"],
  ["present", "dates read in local time",
   "  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;",
   "  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;"],
  ["present", "hours read in local time",
   "  const hh = String(d.getUTCHours()).padStart(2, \"0\");",
   "  const hh = String(d.getHours()).padStart(2, \"0\");"],
  ["present", "an unreadable amount reads as something",
   "  } catch {\n    return unit ? \"0 GEN\" : \"0\";",
   "  } catch {\n    return unit ? \"1 GEN\" : \"1\";"],
  ["present", "a truncated note is not marked as cut",
   "  return String(text ?? \"\").length >= LINE_NOTE_MAX;",
   "  return false;"],
  ["present", "a value the contract can return has no word",
   "  return map[k] ?? humanize(k);",
   "  return map[k] ?? k;"],
];

const files = { acts: "lib/acts.ts", present: "lib/present.ts" };
const tests = {
  acts: "tests/acts.test.ts",
  present: "tests/present.test.ts tests/writeout.test.ts",
};

function run(testFiles) {
  const r = spawnSync(NODE, [VITEST, "run", ...testFiles.split(" ")], { cwd: WEB, encoding: "utf8" });
  const tail = `${r.stdout}${r.stderr}`.match(/Tests\s+[^\n]+/)?.[0] ?? "no summary";
  return { ok: r.status === 0, tail: tail.replace(/\s+/g, " ").trim() };
}

const snapshot = Object.fromEntries(
  Object.values(files).map((f) => [f, readFileSync(join(WEB, f), "utf8")]),
);

let killed = 0;
const survivors = [];
for (const [area, name, from, to] of M) {
  const path = join(WEB, files[area]);
  const original = readFileSync(path, "utf8");
  const count = original.split(from).length - 1;
  if (count !== 1) {
    console.log(`BAD      ${name}: pattern found ${count} times`);
    survivors.push(name);
    continue;
  }
  try {
    writeFileSync(path, original.replace(from, to));
    const r = run(tests[area]);
    if (r.ok) {
      survivors.push(name);
      console.log(`SURVIVED ${name}  (${r.tail})`);
    } else {
      killed++;
      console.log(`killed   ${name}  (${r.tail})`);
    }
  } finally {
    writeFileSync(path, original);
  }
}

const control = run("tests");
console.log(`control, the code as written: ${control.ok ? "passes" : "FAILS"} (${control.tail})`);

const changed = Object.entries(snapshot)
  .filter(([f, text]) => readFileSync(join(WEB, f), "utf8") !== text)
  .map(([f]) => f);
console.log(`files after restore: ${changed.length ? `CHANGED ${changed.join(", ")}` : "as they were"}`);
console.log(`${killed}/${M.length} mutants killed${survivors.length ? `; survivors: ${survivors.join(", ")}` : ""}`);

if (survivors.length || !control.ok || changed.length) process.exit(1);
