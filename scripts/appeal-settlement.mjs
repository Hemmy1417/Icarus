/**
 * The appeal-to-settlement lifecycle, live, with the interface's own state
 * model in the loop.
 *
 *   node --experimental-strip-types scripts/appeal-settlement.mjs 0x…
 *
 * A reviewer found that the interface could treat an OPEN appeal as though it
 * had been upheld, and that its settlement rule did not match the contract's
 * state after an appeal. Both were true. This run proves the correction the
 * only way that means anything: at each stage it reads the milestone off the
 * chain, asks the interface's real rule (web/lib/acts.ts, imported here, not
 * copied) what it would offer, and then sends the write to show the contract
 * agrees.
 *
 *   1. A fresh case is accepted and the owner appeals it.
 *        the interface: appeal OPEN, settling NOT offered
 *        the contract:  finalize REFUSED, in its own words
 *   2. The evidence period ends and anyone asks for the readjudication.
 *      If the fresh panel upholds the acceptance:
 *        the interface: appeal DECIDED, settling offered at once, no second appeal
 *        the contract:  finalize lands, the payment becomes the installer's claim
 *   3. The record's own leftover. ms-00002 was accepted, appealed and upheld
 *      on 20 Sep and then sat unsettled, because the interface of that day
 *      could not offer to settle it. It is settled here.
 *
 * Resumable: every write is remembered in .data/appeal-settlement-<addr>.json.
 */
import { createAccount, createClient } from "genlayer-js";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { EXPLORER, GEN, chain, leaderOf, loadKeys, plainFees, resultText, sleep,
         transferFees, waitFinal } from "./lib.mjs";

const { milestoneActs, appealStanding } = await import("../web/lib/acts.ts");

const ADDRESS = process.argv[2];
if (!/^0x[0-9a-fA-F]{40}$/.test(ADDRESS ?? "")) throw new Error("usage: appeal-settlement.mjs 0x…");
const OUT = fileURLToPath(new URL(`../.data/appeal-settlement-${ADDRESS}.json`, import.meta.url));
const IMG = (name) => new Uint8Array(readFileSync(fileURLToPath(new URL(`../fixtures/images/${name}.jpg`, import.meta.url))));
const KEYS = loadKeys();
const run = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf-8")) : { address: ADDRESS, steps: {} };
const save = () => writeFileSync(OUT, JSON.stringify(run, null, 2));
const say = (m) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${m}`);
const clientFor = (role) => createClient({ chain, account: createAccount(KEYS[role].pk) });
const reader = createClient({ chain, account: createAccount(KEYS.STRANGER.pk) });
let failures = 0;
const expect = (cond, label, extra = "") => {
  say(`${cond ? "ok   " : "FAIL "} ${label}${extra ? `  (${extra})` : ""}`);
  if (!cond) failures++;
};
const jsonFrom = (text) => { const i = text.indexOf("{"); return i >= 0 ? JSON.parse(text.slice(i)) : null; };

async function readJson(fn, args) {
  for (let i = 0; i < 6; i++) {
    try { return JSON.parse(await reader.readContract({ address: ADDRESS, functionName: fn, args })); }
    catch (e) { if (i === 5) throw e; await sleep(5000 * (i + 1)); }
  }
}

const ROUNDS = new Set(["request_assessment", "decide_appeal"]);
async function step(name, role, fn, args, { value = 0n, transfer = false, refused = null } = {}) {
  if (run.steps[name]) { say(`${name}: done earlier`); return run.steps[name]; }
  run.pending ??= {};
  const attempts = ROUNDS.has(fn) ? 3 : 1;
  let hash, t;
  for (let ask = 1; ; ask++) {
    hash = run.pending[name];
    if (!hash) {
      const client = clientFor(role);
      const fees = transfer ? await transferFees(client, { address: ADDRESS, functionName: fn, args, value })
                            : await plainFees(client);
      hash = await client.writeContract({ address: ADDRESS, functionName: fn, args, value, fees });
      run.pending[name] = hash; save();
      say(`${name}: ${role} ${fn} sent`);
    }
    try { t = await waitFinal(hash, { label: name, tries: ROUNDS.has(fn) ? 450 : 150 }); break; }
    catch (e) {
      if (!/UNDETERMINED|CANCELED/.test(e.message)) throw e;
      delete run.pending[name]; save();
      if (ask >= attempts) throw e;
      say(`${name}: no majority, so nothing was recorded; asking again (${ask + 1} of ${attempts})`);
      await sleep(15000);
    }
  }
  delete run.pending[name];
  const leader = leaderOf(t);
  const ok = leader?.execution_result === "SUCCESS";
  const text = resultText(leader);
  if (refused) {
    expect(!ok && text.includes(refused), `the contract refused: ${name}`, text.replace(/\s+/g, " ").slice(0, 110));
  } else if (!ok) {
    say(`ASSERTION FAILED: ${name}: ${text.slice(0, 300)}`); process.exit(2);
  }
  run.steps[name] = { name, role, fn, hash, ok, text: text.slice(0, 500), explorer: `${EXPLORER}/tx/${hash}` };
  save();
  return run.steps[name];
}

async function waitUntil(iso, label) {
  const target = Date.parse(iso) + 8000;
  while (Date.now() < target) {
    say(`waiting for ${label} (${Math.ceil((target - Date.now()) / 1000)} s)`);
    await sleep(Math.min(60000, target - Date.now()));
  }
}

/** What the interface would offer a viewer, computed by its own rule from
 *  state read off the chain this instant. */
async function interfaceSays(mid, role) {
  const m = await readJson("get_milestone", [mid]);
  const p = await readJson("get_project", [m.project_id]);
  const config = await readJson("get_config", []);
  const acts = milestoneActs({ project: p, milestone: m, addr: KEYS[role].addr, config, nowMs: Date.now() });
  const find = (id) => acts.find((a) => a.id === id);
  return { m, appeal: appealStanding(m), finalize: find("finalize"), openAppeal: find("open_appeal") };
}

say(`appeal-to-settlement verification on ${ADDRESS}`);

// ── 3 first, because it needs no panel: the record's own leftover ───────────
{
  const before = await interfaceSays("ms-00002", "STRANGER");
  if (before.m.state === "ACCEPTED") {
    say(`ms-00002 on the record: ${before.m.state}, standing kind ${before.m.standing.kind}, `
      + `appealable ${before.m.standing.appealable}, appealed ${before.m.standing.appealed}, `
      + `window ${before.m.standing.window_ends}, reserved ${before.m.reserved_wei}`);
    expect(before.appeal === "DECIDED", "leftover: the interface reads the upheld appeal as DECIDED", before.appeal);
    expect(before.finalize?.available === true, "leftover: the interface now offers to settle it", before.finalize?.reason);
    await step("leftover.finalize", "STRANGER", "finalize", ["ms-00002"]);
  }
  const after = await interfaceSays("ms-00002", "STRANGER");
  expect(after.m.state === "FINALIZED" && after.m.reserved_wei === "0",
    "leftover: settled on-chain, nothing left reserved", `${after.m.state}, reserved ${after.m.reserved_wei}`);
  expect(after.finalize?.available === false, "leftover: the interface no longer offers to settle it", after.finalize?.reason);
}

// ── 1. a fresh acceptance, appealed ─────────────────────────────────────────
const params = JSON.stringify({
  title: "Inverter installation, appeal to settlement (demonstration)",
  description: "A demonstration written to show how the record works, not anyone's contract. "
    + "The photographs are from Wikimedia Commons; see fixtures/ATTRIBUTION.md.",
  site: "Demonstration site", system_type: "COMMERCIAL_SOLAR", capacity_kw: "4",
  installer: KEYS.INSTALLER.addr, inspector: "", appeal_window_seconds: 600,
});
const created = await step("case.create", "OWNER", "create_project", [params], { value: 3n * GEN });
const pid = jsonFrom(created.text).project_id;
const termsJson = JSON.stringify({
  milestone_type: "INVERTER_INSTALLATION",
  title: "String inverter installed and identifiable",
  description: "Installed equipment, photographed on site for settlement.",
  requirements: "The equipment named in the schedule is installed on this site, and where "
    + "the schedule requires it, identifiable from its own markings.",
  specification: "One string inverter mounted on the plant room wall, its d.c. and a.c. "
    + "connections made at the underside of the unit.",
  equipment: [{ role: "INVERTER", manufacturer: "Growatt", model: "MOD 4000TL3-X",
                rating: "4000 W", quantity: 1, identify: true }],
  criteria: [{ text: "The inverter is mounted on a wall with its cabling connected at the underside of the unit." }],
  evidence_requirements: [{ text: "Photographs of the installed equipment", kind: "IMAGE",
                            from_role: "INSTALLER", min_count: 2 }],
  payment_wei: (2n * GEN).toString(),
  deadline: new Date(Date.now() + 14 * 86400000).toISOString().replace(/\.\d+Z$/, "Z"),
});
let mid = run.mid;
if (!mid) {
  mid = jsonFrom((await step("case.milestone", "OWNER", "add_milestone", [pid, termsJson])).text).milestone_id;
  run.mid = mid; save();
}
await step("case.sign", "INSTALLER", "accept_project", [pid]);
const meta = (caption, origin) => JSON.stringify({ requirement_id: "R1", equipment_id: "E1", caption, origin,
  claimed_capture: "September 2026", claimed_location: "Demonstration site" });
const front = jsonFrom((await step("case.inverter", "INSTALLER", "submit_image",
  [mid, meta("The string inverter on the plant room wall", "PHOTO"), IMG("growatt-inverter")])).text).item_id;
const plate = jsonFrom((await step("case.plate", "INSTALLER", "submit_image",
  [mid, meta("The rating plate on the same unit", "NAMEPLATE"), IMG("growatt-nameplate")])).text).item_id;
const first = jsonFrom((await step("case.assess", "INSTALLER", "request_assessment",
  [mid, JSON.stringify([front, plate])])).text);
say(`${mid}: first panel decided ${first.decision}`);
if (first.decision !== "ACCEPTED") {
  say("the first panel did not accept, so there is no acceptance to appeal; run again for a fresh case");
  process.exit(3);
}
await step("appeal.open", "OWNER", "open_appeal", [mid, "The unit on the wall is not the one we specified."]);

console.log("");
say("1. AN OPEN APPEAL CANNOT BE FINALIZED");
{
  const s = await interfaceSays(mid, "STRANGER");
  say(`chain: state ${s.m.state}, standing decision ${s.m.standing.decision}, appealed flag ${s.m.standing.appealed}`);
  expect(s.m.state === "APPEALED" && s.m.standing.appealed === true,
    "chain: the appeal is open, and the appealed flag is TRUE (the flag the old rule misread as 'upheld')");
  expect(s.appeal === "OPEN", "interface: reads the appeal as OPEN, not decided", s.appeal);
  expect(s.finalize?.available === false && /appeal is open/i.test(s.finalize?.reason ?? ""),
    "interface: does NOT offer to settle, and says why", s.finalize?.reason);
  await step("open.finalize_refused", "STRANGER", "finalize", [mid],
    { refused: "only a standing acceptance is finalized" });
  const still = await readJson("get_milestone", [mid]);
  expect(still.state === "APPEALED" && still.reserved_wei === (2n * GEN).toString(),
    "chain: nothing moved; the payment is still reserved", `${still.state}, reserved ${still.reserved_wei}`);
}

// ── 2. the readjudication ───────────────────────────────────────────────────
const open = await readJson("get_milestone", [mid]);
if (open.state === "APPEALED") await waitUntil(open.appeal.evidence_ends, "the appeal's evidence period");
const decided = jsonFrom((await step("appeal.decide", "STRANGER", "decide_appeal", [mid])).text);

console.log("");
say(`2. THE APPEAL IS DECIDED: ${decided.decision} (round ${decided.round}, reviewing round ${decided.reviewed_round})`);
{
  const s = await interfaceSays(mid, "STRANGER");
  say(`chain: state ${s.m.state}, standing kind ${s.m.standing?.kind}, appealable ${s.m.standing?.appealable}, `
    + `appealed flag ${s.m.standing?.appealed}, window ${s.m.standing?.window_ends}`);
  expect(s.appeal === "DECIDED", "interface: reads the appeal as DECIDED", s.appeal);
  if (decided.decision === "ACCEPTED") {
    expect(s.m.state === "ACCEPTED" && s.m.standing.appealed === false && s.m.standing.window_ends === null,
      "chain: an upheld acceptance stands with the appealed flag FALSE and no window (the state the old rule could never settle)");
    expect(s.finalize?.available === true, "interface: offers to settle at once", s.finalize?.reason);
    const owner = await interfaceSays(mid, "OWNER");
    expect(owner.openAppeal?.available !== true, "interface: offers the owner no second appeal", owner.openAppeal?.reason);
    await step("upheld.second_appeal_refused", "OWNER", "open_appeal", [mid, "We would like another panel."],
      { refused: "there is no decision open to appeal" });
    const claimBefore = await readJson("get_balance", [KEYS.INSTALLER.addr]);
    await step("upheld.finalize", "STRANGER", "finalize", [mid]);
    const done = await interfaceSays(mid, "STRANGER");
    const claimAfter = await readJson("get_balance", [KEYS.INSTALLER.addr]);
    expect(done.m.state === "FINALIZED" && done.m.reserved_wei === "0", "chain: settled; nothing left reserved", done.m.state);
    expect(BigInt(claimAfter.claimable) - BigInt(claimBefore.claimable) === 2n * GEN,
      "chain: the installer's claim grew by exactly the milestone's payment",
      `${claimBefore.claimable} -> ${claimAfter.claimable}`);
    expect(done.finalize?.available === false, "interface: no longer offers to settle", done.finalize?.reason);
  } else {
    // A fresh panel is entitled to disagree. Then the honest result is that
    // nothing settles, and the interface must say the same.
    expect(s.finalize?.available === false, `interface: offers no settlement after a ${decided.decision} appeal`, s.finalize?.reason);
    await step("overturned.finalize_refused", "STRANGER", "finalize", [mid],
      { refused: "only a standing acceptance is finalized" });
    say("the fresh panel did not uphold the acceptance, so the upheld path was not exercised on this case; "
      + "the leftover above is the upheld path on the record");
  }
}

console.log("");
say(failures === 0 ? "EVERY CHECK PASSED" : `${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
