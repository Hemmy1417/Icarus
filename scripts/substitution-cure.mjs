/**
 * Live run of the two rules added in icarus-rules-2: a substitute for one
 * line of the schedule, and the cure round. Every claim is an assertion; an
 * observation that is not asserted is logged as an observation.
 *
 *   node scripts/substitution-cure.mjs 0x…        run every case in order (resumable)
 *
 * SELF_PUBLISHED_URL must name the commit-pinned raw address of
 * fixtures/pages/self-published-datasheet.txt: a page that says everything a
 * datasheet says and is published by nobody answerable for the product.
 *
 * Results go to .data/substitution-cure-<address>.json. Signers are the roles
 * in .data/keys.json (gitignored, never printed).
 */
import { createAccount, createClient } from "genlayer-js";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { EXPLORER, GEN, chain, dumpReceipt, leaderOf, loadKeys, plainFees, resultText, rpc, sleep,
         transferFees, waitFinal } from "./lib.mjs";

const ADDRESS = process.argv[2];
if (!/^0x[0-9a-fA-F]{40}$/.test(ADDRESS ?? "")) {
  throw new Error("usage: node scripts/substitution-cure.mjs 0x…");
}
const SELF_PUBLISHED = process.env.SELF_PUBLISHED_URL ?? "";
const CATALOGUE = "https://sun.store/en/product/growatt-mod-4000tl3-x-53591";
const OTHER_MAKER = "https://www.victronenergy.com/inverters-chargers/multiplus-ii";

const OUT = fileURLToPath(new URL(`../.data/substitution-cure-${ADDRESS}.json`, import.meta.url));
const IMG = (name) => new Uint8Array(readFileSync(fileURLToPath(new URL(`../fixtures/images/${name}.jpg`, import.meta.url))));
const KEYS = loadKeys();
const run = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf-8")) : { address: ADDRESS, steps: {}, checks: [] };
const save = () => writeFileSync(OUT, JSON.stringify(run, null, 2));
const say = (m) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${m}`);
const clientFor = (role) => createClient({ chain, account: createAccount(KEYS[role].pk) });
const reader = createClient({ chain, account: createAccount(KEYS.STRANGER.pk) });

/**
 * A claim the run makes. A false one stops it; a true one is counted. A claim
 * that held in an earlier sitting stands: the record has moved on since, and
 * asking the same question of a later state would test something else.
 */
function check(cond, claim) {
  if (run.checks.includes(claim)) {
    say(`  ok, in an earlier sitting: ${claim}`);
    return;
  }
  if (!cond) {
    say(`CHECK FAILED: ${claim}`);
    process.exit(2);
  }
  if (!run.checks.includes(claim)) run.checks.push(claim);
  save();
  say(`  ok: ${claim}`);
}

function jsonFrom(text) {
  const i = text.indexOf("{");
  return i >= 0 ? JSON.parse(text.slice(i)) : null;
}

async function readJson(fn, args) {
  for (let i = 0; ; i++) {
    try {
      return JSON.parse(await reader.readContract({ address: ADDRESS, functionName: fn, args }));
    } catch (e) {
      if (i === 5) throw e;
      await sleep(5000 * (i + 1));
    }
  }
}

async function balance(role) {
  return BigInt((await rpc("eth_getBalance", [KEYS[role].addr, "latest"])).result ?? "0x0");
}

// Writes a panel decides. When a panel reaches no majority nothing is
// recorded, so asking again is safe and draws a fresh panel.
const PANEL = new Set(["request_assessment", "request_cure", "decide_substitution"]);
const PANEL_ATTEMPTS = 4;

async function step(name, role, fn, args, { value = 0n, transfer = false, refused = null } = {}) {
  if (run.steps[name]) {
    say(`${name}: done earlier (${run.steps[name].hash})`);
    return run.steps[name];
  }
  run.pending ??= {};
  const attempts = PANEL.has(fn) ? PANEL_ATTEMPTS : 1;
  let hash, t, secs;
  for (let ask = 1; ; ask++) {
    hash = run.pending[name];
    if (hash) {
      say(`${name}: waiting again on ${hash}, sent earlier`);
    } else {
      for (let attempt = 0; ; attempt++) {
        try {
          const client = clientFor(role);
          const fees = transfer
            ? await transferFees(client, { address: ADDRESS, functionName: fn, args, value })
            : await plainFees(client);
          hash = await client.writeContract({ address: ADDRESS, functionName: fn, args, value, fees });
          break;
        } catch (e) {
          if (attempt >= 4) throw e;
          say(`${name}: send failed (${String(e.message).slice(0, 80)}), retrying`);
          await sleep(8000 * (attempt + 1));
        }
      }
      run.pending[name] = hash;
      save();
      say(`${name}: ${role} ${fn} ${hash}`);
    }
    const t0 = Date.now();
    try {
      t = await waitFinal(hash, { label: name, tries: PANEL.has(fn) ? 450 : 150 });
      secs = Math.round((Date.now() - t0) / 1000);
      break;
    } catch (e) {
      if (!/UNDETERMINED|CANCELED/.test(e.message)) throw e;
      delete run.pending[name];
      (run.no_consensus ??= []).push({ name, hash, at: new Date().toISOString() });
      save();
      if (ask >= attempts) throw e;
      say(`${name}: no majority, so nothing was recorded; asking again (${ask + 1} of ${attempts})`);
      await sleep(15000);
    }
  }
  delete run.pending[name];
  const leader = leaderOf(t);
  const ok = leader?.execution_result === "SUCCESS";
  const text = resultText(leader);
  say(`${name}: ${t.status} ${t.result_name} leader=${leader?.execution_result} in ${secs} s`);
  if (refused) {
    check(!ok && text.includes(refused), `${name} is refused: "${refused}"`);
  } else if (!ok) {
    say(`${name} failed: ${text.slice(0, 300)}`);
    process.exit(2);
  }
  const rec = { name, role, fn, hash, secs, ok, text: text.slice(0, 600), explorer: `${EXPLORER}/tx/${hash}`,
                rotations: t.consensus_history?.consensus_results?.length ?? null };
  if (PANEL.has(fn) && ok) {
    const { nodes } = await dumpReceipt(hash, ["[SUBSTITUTE]", "[ROUND]", "[DISAGREE]"]);
    rec.nodes = nodes.map((n) => ({ rotation: n.rotation, from: n.from, vote: n.vote, model: n.model }));
  }
  run.steps[name] = rec;
  save();
  return rec;
}

async function waitUntil(iso, label) {
  const target = Date.parse(iso) + 5000;
  while (Date.now() < target) {
    say(`waiting for ${label} (${Math.ceil((target - Date.now()) / 1000)} s)`);
    await sleep(Math.min(60000, target - Date.now()));
  }
}

// ── the demonstration ────────────────────────────────────────────────────────
//
// One real site: a Growatt MOD 4000TL3-X on a plant room wall, with its plate.
// The terms below were written for the smaller unit of the same range, which
// is how a substitution starts on a real job.

const SIGNED = { role: "INVERTER", manufacturer: "Growatt", model: "MOD 3000TL3-X",
                 rating: "3 kW", quantity: 1, identify: true, or_equivalent: true };
const FITTED = { manufacturer: "Growatt", model: "MOD 4000TL3-X", rating: "4 kW" };
const LARGER = { role: "INVERTER", manufacturer: "Growatt", model: "MOD 10KTL3-X",
                 rating: "10 kW", quantity: 1, identify: true, or_equivalent: true };
const ISOLATOR = { role: "PROTECTION", manufacturer: "Kripal", model: "DC isolator switch",
                   quantity: 1, identify: false };
const WALL_CRITERION = [{ text: "The inverter is mounted on a wall with its cabling connected "
                                + "at the underside of the unit." }];

function terms({ equipment, title, spec, payment = 2n * GEN, images = 2 }) {
  return JSON.stringify({
    milestone_type: "INVERTER_INSTALLATION",
    title,
    description: "Installed equipment, photographed on site for settlement.",
    requirements: "The equipment named in the schedule is installed on this site, and where "
      + "the schedule requires it, identifiable from its own markings.",
    specification: spec,
    equipment,
    criteria: WALL_CRITERION,
    evidence_requirements: [
      { text: "Photographs of the installed equipment", kind: "IMAGE",
        from_role: "INSTALLER", min_count: images },
    ],
    payment_wei: payment.toString(),
    deadline: new Date(Date.now() + 14 * 86400000).toISOString().replace(/\.\d+Z$/, "Z"),
  });
}

async function signedMilestone(key, title, termsJson) {
  const params = JSON.stringify({
    title,
    description: "A demonstration written to show how the record works, not anyone's contract. "
      + "The photographs are from Wikimedia Commons; see fixtures/ATTRIBUTION.md.",
    site: "Demonstration site", system_type: "COMMERCIAL_SOLAR", capacity_kw: "4",
    installer: KEYS.INSTALLER.addr, inspector: "", appeal_window_seconds: 600,
  });
  const created = await step(`${key}.create`, "OWNER", "create_project", [params], { value: 3n * GEN });
  const pid = jsonFrom(created.text)?.project_id;
  const added = await step(`${key}.milestone`, "OWNER", "add_milestone", [pid, termsJson]);
  const mid = jsonFrom(added.text)?.milestone_id;
  await step(`${key}.sign`, "INSTALLER", "accept_project", [pid]);
  return { pid, mid };
}

async function image(key, mid, file, caption, origin = "PHOTO") {
  const meta = JSON.stringify({ requirement_id: "R1", equipment_id: "E1", caption, origin,
                                claimed_capture: "October 2026",
                                claimed_location: "Demonstration site" });
  return jsonFrom((await step(key, "INSTALLER", "submit_image", [mid, meta, IMG(file)])).text)?.item_id;
}

async function propose(key, mid, line, substitute, page, reason) {
  const rec = await step(key, "INSTALLER", "propose_substitution",
                         [mid, line, JSON.stringify({ ...substitute, page, reason })]);
  return jsonFrom(rec.text);
}

async function contestAndDecide(key, mid, objection) {
  await step(`${key}.objection`, "OWNER", "answer_substitution", [mid, false, objection]);
  const rec = await step(`${key}.decide`, "STRANGER", "decide_substitution", [mid]);
  const out = jsonFrom(rec.text);
  const m = await readJson("get_milestone", [mid]);
  const s = m.substitutions.find((x) => x.id === out.substitution_id);
  say(`${key}: ${s.status} ${s.verdict}  ${JSON.stringify({ ...s.findings, reasoning: undefined })}`);
  say(`${key}: why: ${s.findings.reasoning}`);
  run.steps[`${key}.decide`].verdict = s.verdict;
  run.steps[`${key}.decide`].findings = s.findings;
  save();
  return { m, s };
}

say(`substitution and cure on ${ADDRESS}`);
const cfg = await readJson("get_config", []);
check(cfg.ruleset === "icarus-rules-2", "the deployment runs icarus-rules-2");

// ── 1. The whole story ───────────────────────────────────────────────────────

const { mid } = await signedMilestone("story", "Inverter installation, plant room (demonstration)", terms({
  equipment: [SIGNED], title: "String inverter installed and identifiable",
  spec: "One three-phase string inverter of at least 3 kW output on the plant room wall, its "
      + "d.c. and a.c. connections made at the underside of the unit." }));
const front = await image("story.front", mid, "growatt-inverter", "The string inverter on the plant room wall");
const plate = await image("story.plate", mid, "growatt-nameplate", "The rating plate on the same unit", "NAMEPLATE");

const first = jsonFrom((await step("story.assess", "INSTALLER", "request_assessment",
                                   [mid, JSON.stringify([front, plate])])).text);
say(`story.assess: ${first.decision} lines ${JSON.stringify(first.lines)} criteria ${JSON.stringify(first.criteria)}`);
check(first.decision !== "ACCEPTED" && first.lines.E1 !== "INSTALLED",
      "a unit that is not the model the terms name is not accepted as that line");
let m = await readJson("get_milestone", [mid]);
check(Boolean(m.cure_until), "a decision that fell short opens a cure period");

await step("story.cure_on_nothing_new", "INSTALLER", "request_cure", [mid, JSON.stringify([front, plate])],
           { refused: "filed since the decision" });
await step("story.stranger_proposes", "STRANGER", "propose_substitution",
           [mid, "E1", JSON.stringify({ ...FITTED, page: CATALOGUE, reason: "x" })],
           { refused: "only the installer proposes a substitute" });

// A page that never names the product settles in code; no model is asked.
await propose("story.wrong_page.propose", mid, "E1", FITTED, OTHER_MAKER,
              "The 3 kW unit of this range was not available from the supplier.");
const wrongPage = await contestAndDecide("story.wrong_page", mid,
                                         "That page is about another maker's inverter.");
check(wrongPage.s.status === "REFUSED" && wrongPage.s.verdict === "UNPROVEN"
      && wrongPage.s.findings.names_model === false,
      "a page that never names the proposed model proves nothing, and code says so");
check(wrongPage.m.schedule[0].model === "MOD 3000TL3-X", "a refused substitute changes no line");

// The real proposal, on a seller's catalogue page.
const proposed = await propose("story.propose", mid, "E1", FITTED, CATALOGUE,
                               "The 3 kW unit of this range was not available from the supplier; "
                               + "the 4 kW unit of the same range was fitted in its place.");
check(proposed.substitution_id === "S2", "the proposal is recorded");
await step("story.assess_while_open", "INSTALLER", "request_assessment", [mid, JSON.stringify([front, plate])],
           { refused: "a substitution is open on this milestone" });
const real = await contestAndDecide("story", mid, "We signed for the 3 kW unit and did not agree to another.");
check(real.s.status === "APPROVED" && real.s.verdict === "EQUIVALENT",
      "validators who each read the page approve a substitute of the same role and a higher rating");
check(real.s.findings.names_model === true && real.s.findings.publisher !== "UNKNOWN",
      "the approval rests on a page that names the model and has an answerable publisher");
check(real.m.schedule[0].model === "MOD 4000TL3-X" && real.m.schedule[0].substitution === "S2",
      "the approved substitute is the line every later round judges against");
check(real.m.versions[0].equipment[0].model === "MOD 3000TL3-X", "the signed terms are not rewritten");

// The cure: only what was left open is judged, on something filed since.
const plateAgain = await image("story.plate_again", mid, "growatt-nameplate",
                               "The rating plate, photographed again after the substitution", "NAMEPLATE");
const cured = jsonFrom((await step("story.cure", "INSTALLER", "request_cure",
                                   [mid, JSON.stringify([front, plateAgain])])).text);
say(`story.cure: ${cured.decision} lines ${JSON.stringify(cured.lines)} carried ${JSON.stringify(cured.carried)}`);
check(cured.decision === "ACCEPTED" && cured.lines.E1 === "INSTALLED",
      "the cure round finds the substituted line installed and the milestone is accepted");
const cureRound = await readJson("get_round", [mid, cured.round]);
check(cureRound.kind === "CURE" && cureRound.carried.from_round === first.round,
      "the round is recorded as a cure of the decision it answers");
check(cureRound.schedule[0].model === "MOD 4000TL3-X", "the round records the schedule it judged against");
check(JSON.stringify(cureRound.chain) === JSON.stringify([front, plate, plateAgain]),
      "the record names every item the decision rests on, for an appeal to read");
check(cureRound.carried.criteria.length === 0 && cureRound.criteria.C1 === "MET",
      "the condition is judged again with the new unit in place, not carried from the old");
check(cureRound.carried.lines.length === 0,
      "the substituted line is open, so nothing on this one-line schedule is carried");

await step("story.finalize_early", "STRANGER", "finalize", [mid], { refused: "the appeal window is still open" });
m = await readJson("get_milestone", [mid]);
await waitUntil(m.standing.window_ends, "the cured acceptance's appeal window");
await step("story.finalize", "STRANGER", "finalize", [mid]);
// A balance can only be compared around a claim made in this sitting; on a
// resumed run the claim landed earlier and the check it made then stands.
const claimedEarlier = Boolean(run.steps["story.claim"]);
const before = await balance("INSTALLER");
await step("story.claim", "INSTALLER", "claim", [], { transfer: true });
if (!claimedEarlier) {
  // The transfer lands a moment after the claim is final: read until it moves.
  let gained = (await balance("INSTALLER")) - before;
  for (let i = 0; i < 18 && gained <= GEN; i++) {
    await sleep(5000);
    gained = (await balance("INSTALLER")) - before;
  }
  say(`story.claim: the installer's balance moved by ${gained} atto`);
  check(gained > GEN, "the installer is paid the milestone, whole");
}

// ── 2. Substitutes that do not pass ──────────────────────────────────────────

const refusals = await signedMilestone("refusals", "Inverter and isolator, plant room (demonstration)", terms({
  equipment: [LARGER, ISOLATOR], title: "10 kW string inverter and d.c. isolator installed",
  spec: "One three-phase string inverter of 10 kW output on the plant room wall with a d.c. "
      + "isolator beside it." }));

await propose("refusals.plain.propose", refusals.mid, "E2",
              { manufacturer: "Projoy", model: "PEDS150-HM4 isolator", rating: "" }, CATALOGUE,
              "The isolator named in the schedule is out of stock.");
const plain = jsonFrom((await step("refusals.plain.no", "OWNER", "answer_substitution",
                                   [refusals.mid, false, "We want the isolator we signed for."])).text);
check(plain.status === "DECLINED",
      "on a line signed without or-equivalent the owner's no ends the matter; no panel sits");

await propose("refusals.smaller.propose", refusals.mid, "E1",
              { ...FITTED, rating: "10 kW" }, CATALOGUE,
              "The 10 kW unit is on a long lead time; this unit does the same job.");
const smaller = await contestAndDecide("refusals.smaller", refusals.mid,
                                       "The design needs 10 kW of inverter capacity.");
check(smaller.s.status === "REFUSED",
      "a substitute whose own page shows a lower rating than the line is refused, "
      + "whatever rating the installer states for it");
say(`observation: the panel's label for the smaller unit was ${smaller.s.verdict}`);
check(smaller.m.schedule[0].model === "MOD 10KTL3-X", "the line is unchanged");

if (!SELF_PUBLISHED) {
  say("SELF_PUBLISHED_URL is not set: the self-published page case is SKIPPED, and this run is not a full record");
} else {
  await propose("refusals.self.propose", refusals.mid, "E1",
                { manufacturer: "Northgate Power", model: "NG-10K3 Titan", rating: "10 kW" }, SELF_PUBLISHED,
                "An equivalent 10 kW three-phase unit is available from stock.");
  const self = await contestAndDecide("refusals.self", refusals.mid,
                                      "Nobody we can find makes or sells that unit.");
  check(self.s.status === "REFUSED",
        "a page that says everything a datasheet says, published by nobody answerable, approves nothing");
  say(`observation: publisher ${self.s.findings.publisher}, verdict ${self.s.verdict}`);
  check(self.m.schedule[0].model === "MOD 10KTL3-X", "the line is unchanged");
  await step("refusals.fourth", "INSTALLER", "propose_substitution",
             [refusals.mid, "E1", JSON.stringify({ ...FITTED, page: CATALOGUE, reason: "Once more." })],
             { refused: "the 3 substitutions they allow" });
}

// ── 3. The parties agree; no panel sits ──────────────────────────────────────

const agreed = await signedMilestone("agreed", "Isolator replacement (demonstration)", terms({
  equipment: [{ ...SIGNED, or_equivalent: false }], title: "String inverter installed",
  spec: "One three-phase string inverter on the plant room wall." }));
await propose("agreed.propose", agreed.mid, "E1", FITTED, CATALOGUE, "The 4 kW unit is what the supplier had.");
const yes = jsonFrom((await step("agreed.yes", "OWNER", "answer_substitution", [agreed.mid, true, ""])).text);
m = await readJson("get_milestone", [agreed.mid]);
check(yes.status === "AGREED" && m.schedule[0].model === "MOD 4000TL3-X" && m.substitutions[0].verdict === null,
      "the owner's yes puts a substitute in force on any line, with no panel");

// ── 4. A cure with nothing substituted: what was found in place is kept ──────

const kept = await signedMilestone("kept", "Inverter installation, second unit (demonstration)", terms({
  equipment: [{ ...SIGNED, ...FITTED, or_equivalent: false }], title: "String inverter installed and identifiable",
  spec: "One three-phase string inverter on the plant room wall, its d.c. and a.c. connections "
      + "made at the underside of the unit.", images: 1 }));
// One photograph, with no plate in it: the wall can be judged, the model cannot.
const wall = await image("kept.front", kept.mid, "growatt-inverter", "The string inverter on the plant room wall");
const short = jsonFrom((await step("kept.assess", "INSTALLER", "request_assessment",
                                   [kept.mid, JSON.stringify([wall])])).text);
say(`kept.assess: ${short.decision} lines ${JSON.stringify(short.lines)} criteria ${JSON.stringify(short.criteria)}`);
if (short.decision === "UNDETERMINED" && short.criteria.C1 === "MET" && short.lines.E1 !== "INSTALLED") {
  const label = await image("kept.plate", kept.mid, "growatt-nameplate", "The rating plate on the unit", "NAMEPLATE");
  const again = jsonFrom((await step("kept.cure", "INSTALLER", "request_cure",
                                     [kept.mid, JSON.stringify([wall, label])])).text);
  say(`kept.cure: ${again.decision} lines ${JSON.stringify(again.lines)} carried ${JSON.stringify(again.carried)}`);
  check(again.carried.criteria.includes("C1") && !again.carried.lines.includes("E1"),
        "a cure round keeps the condition the first panel found met and judges only the open line");
  check(again.decision === "ACCEPTED",
        "with the nameplate filed since, the open line is found installed and the milestone accepted");
} else {
  say(`observation: the first panel on this case found ${short.decision} with `
    + `${JSON.stringify(short.lines)} ${JSON.stringify(short.criteria)}, which is not the shape `
    + "this case was written to cure, so no claim is made from it");
}

// ── 5. A proposal taken back ─────────────────────────────────────────────────

await propose("agreed.again.propose", agreed.mid, "E1",
              { manufacturer: "Growatt", model: "MOD 5000TL3-X", rating: "5 kW" }, CATALOGUE,
              "A larger unit came into stock.");
const back = jsonFrom((await step("agreed.again.withdraw", "INSTALLER", "withdraw_substitution",
                                  [agreed.mid])).text);
m = await readJson("get_milestone", [agreed.mid]);
check(back.status === "WITHDRAWN" && m.schedule[0].model === "MOD 4000TL3-X",
      "the installer takes an open proposal back and the line stays as it was");

const stats = await readJson("get_stats", []);
say(`stats: ${JSON.stringify(stats)}`);
run.finished_at = new Date().toISOString();
save();
say(`DONE: ${run.checks.length} checks, ${Object.keys(run.steps).length} transactions, `
  + `${(run.no_consensus ?? []).length} panels without a majority`);
