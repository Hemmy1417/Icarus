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
  ["acts", "a full assessment ignores the margin before the deadline",
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
   `                  : used >= cap\n                    ? no("request_assessment"`,
   `                  : used > cap\n                    ? no("request_assessment"`],
  ["acts", "the cure round's share of the cap is off by one",
   `                : used >= cap\n                  ? no("request_cure"`,
   `                : used > cap\n                  ? no("request_cure"`],
  ["acts", "settling does not wait for the window",
   "    !!standing?.appealable && !!standing.window_ends && nowMs <= ms(standing.window_ends);",
   "    false;"],
  ["acts", "settling pays on a rejection",
   `        : m.state !== "ACCEPTED"
          ? no("finalize", "Nothing pays until a panel accepts the milestone.")`,
   `        : false
          ? no("finalize", "Nothing pays until a panel accepts the milestone.")`],

  // ── the appeal-to-settlement lifecycle: a reviewer found both of these ───
  ["acts", "an open appeal is offered for settlement (the shipped defect)",
   `      : m.state === "APPEALED"
        ? no("finalize", "An appeal is open. Nothing settles until a fresh panel decides it.")
        : m.state !== "ACCEPTED"`,
   `      : m.state !== "ACCEPTED" && m.state !== "APPEALED"`],
  ["acts", "an acceptance upheld on appeal waits on a window it does not have (the shipped defect)",
   "    !!standing?.appealable && !!standing.window_ends && nowMs <= ms(standing.window_ends);",
   "    !standing?.appealed && !(nowMs > ms(standing?.window_ends ?? null));"],
  ["acts", "an open appeal reads as decided",
   `  if (m.state === "APPEALED") return "OPEN";
`,
   ""],
  ["acts", "a decided appeal is read from the appealed flag",
   `  if (m.standing?.kind === "APPEAL") return "DECIDED";`,
   `  if (m.standing?.appealed) return "DECIDED";`],
  ["acts", "a lapsed appeal reads as nothing",
   `  if (m.standing?.kind === "APPEAL_LAPSED") return "LAPSED";
`,
   ""],

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
  // ── a substitute, and the cure round ──────────────────────────────────
  ["acts", "the owner's yes and no are sent as writes the contract does not have",
   `return id === "agree_substitution" || id === "decline_substitution" ? "answer_substitution" : id;`,
   `return id;`],
  ["acts", "work past the deadline is not heard in a cure period",
   "const workPassed = !!terms && nowMs > workEndsMs(m, terms.deadline) - MARGIN_MS;",
   "const workPassed = !!terms && nowMs > ms(terms.deadline) - MARGIN_MS;"],
  ["acts", "work is offered until the instant its period ends",
   "const workPassed = !!terms && nowMs > workEndsMs(m, terms.deadline) - MARGIN_MS;",
   "const workPassed = !!terms && nowMs > workEndsMs(m, terms.deadline);"],
  ["acts", "a cure period that ended before the deadline cuts the work short",
   "return Number.isNaN(cure) ? end : Math.max(end, cure);",
   "return Number.isNaN(cure) ? end : cure;"],
  ["acts", "a cure round is offered on any milestone",
   `    if (m.state === "REJECTED" || m.state === "UNDETERMINED") {`,
   `    if (true) {`],
  ["acts", "a cure round is offered with nothing filed since",
   "                  : !filedSince(m).length",
   "                  : false"],
  ["acts", "another party's item counts as the installer's new evidence",
   `(it) => it.role === "INSTALLER" && it.kind !== "DECLARATION"\n      && Number(`,
   `(it) => it.kind !== "DECLARATION"\n      && Number(`],
  ["acts", "a declaration counts as new evidence",
   `(it) => it.role === "INSTALLER" && it.kind !== "DECLARATION"\n      && Number(`,
   `(it) => it.role === "INSTALLER"\n      && Number(`],
  ["acts", "an item held back from the decision counts as filed since",
   `Number(it.item_id.split("-")[1]) > mark,`,
   `Number(it.item_id.split("-")[1]) > 0,`],
  ["acts", "a cure round is offered after a decision that found conflict",
   `          : standingConflict\n            ? no("request_cure"`,
   `          : false\n            ? no("request_cure"`],
  ["acts", "a cure round is offered after an appeal that lapsed",
   `        standing?.kind === "APPEAL_LAPSED"\n          ? no("request_cure"`,
   `        false\n          ? no("request_cure"`],
  ["acts", "a cure round is offered while a proposal is open",
   `              : open\n                ? no("request_cure"`,
   `              : false\n                ? no("request_cure"`],
  ["acts", "a cure round is offered past the allowance",
   `                : used >= cap\n                  ? no("request_cure"`,
   `                : false\n                  ? no("request_cure"`],
  ["acts", "an assessment is offered while a proposal is open",
   `                : open\n                  ? no("request_assessment"`,
   `                : false\n                  ? no("request_assessment"`],
  ["acts", "an appeal is offered while a proposal is open",
   `            : open\n              ? no("open_appeal"`,
   `            : false\n              ? no("open_appeal"`],
  ["acts", "a decision about another schedule is offered for appeal",
   "              : scheduleChanged\n",
   "              : false\n"],
  ["acts", "a substitute is proposed against a standing acceptance",
   `      !workOpen\n        ? no("propose_substitution"`,
   `      false\n        ? no("propose_substitution"`],
  ["acts", "a substitute is proposed after the work period",
   `        : workPassed\n          ? no("propose_substitution"`,
   `        : false\n          ? no("propose_substitution"`],
  ["acts", "two proposals are offered at once",
   `          : open\n            ? no("propose_substitution"`,
   `          : false\n            ? no("propose_substitution"`],
  ["acts", "proposals are offered past the allowance",
   "            : proposed >= allowance",
   "            : false"],
  ["acts", "proposals under earlier terms count against these",
   "m.substitutions.filter((s) => s.version === m.current_version).length",
   "m.substitutions.length"],
  ["acts", "a substitute is offered on terms with no schedule",
   "              : !m.schedule.length",
   "              : false"],
  ["acts", "the owner answers a proposal already before the validators",
   `  if (who === "OWNER" && open?.status === "PROPOSED") {`,
   `  if (who === "OWNER" && open) {`],
  ["acts", "anyone answers for the owner",
   `  if (who === "OWNER" && open?.status === "PROPOSED") {`,
   `  if (open?.status === "PROPOSED") {`],
  ["acts", "the owner's answer is offered until the instant the window shuts",
   "const late = nowMs > ms(open.respond_by) - MARGIN_MS;",
   "const late = nowMs > ms(open.respond_by);"],
  ["acts", "a line signed for one product is put to a decision while the owner may answer",
   `        : nowMs <= ms(open.respond_by)\n          ? no("decide_substitution"`,
   `        : false\n          ? no("decide_substitution"`],
  ["acts", "an or-equivalent line waits out the owner's whole window",
   `      open.or_equivalent\n        ? open.status === "PROPOSED"`,
   `      false\n        ? open.status === "PROPOSED"`],
  ["acts", "the validators are offered before the owner can object",
   `open.status === "PROPOSED" && nowMs <= ms(open.decide_from)`,
   `false`],
  ["acts", "an objection on record still waits out the objection period",
   `open.status === "PROPOSED" && nowMs <= ms(open.decide_from)`,
   `nowMs <= ms(open.decide_from)`],
  ["acts", "a settled proposal still counts as open",
   `m.substitutions.find((s) => s.status === "PROPOSED" || s.status === "CONTESTED") ?? null;`,
   `m.substitutions.find(() => true) ?? null;`],
  ["acts", "closing ignores a cure period still running",
   "                : nowMs <= workEndsMs(m, terms.deadline)",
   "                : false"],
];

const files = { acts: "lib/acts.ts", present: "lib/present.ts" };
const tests = {
  acts: "tests/acts.test.ts tests/change.test.ts",
  present: "tests/present.test.ts tests/writeout.test.ts",
};

const [MAJOR, MINOR] = process.versions.node.split(".").map(Number);
const NEEDS_FLAG = MAJOR < 22 || (MAJOR === 22 && MINOR < 12);
const ENV = NEEDS_FLAG
  ? { ...process.env, NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ""} --experimental-require-module`.trim() }
  : process.env;

function run(testFiles) {
  const r = spawnSync(NODE, [VITEST, "run", ...testFiles.split(" ")], { cwd: WEB, encoding: "utf8", env: ENV });
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
