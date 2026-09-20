/**
 * Live proofs on a ICARUS deployment. Every claim a proof makes is an
 * assertion here: if the contract or the panel behaves otherwise, the run
 * stops and says which assertion failed. Observations that are not asserted
 * are recorded as observations.
 *
 *   node scripts/proofs.mjs 0x…            run every proof in order (resumable)
 *
 * Results, with every transaction hash, go to .data/proofs-<address>.json;
 * a finished run is copied to docs/proofs/ by hand after review. Signers are
 * the roles in .data/keys.json (gitignored, never printed).
 */
import { createAccount, createClient } from "genlayer-js";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { EXPLORER, GEN, chain, dumpReceipt, leaderOf, loadKeys, plainFees, resultText, rpc, sleep,
         transferFees, waitFinal } from "./lib.mjs";

const ADDRESS = process.argv[2];
if (!/^0x[0-9a-fA-F]{40}$/.test(ADDRESS ?? "")) throw new Error("usage: node scripts/proofs.mjs 0x…");
const OUT = fileURLToPath(new URL(`../.data/proofs-${ADDRESS}.json`, import.meta.url));
const IMG = (name) => new Uint8Array(readFileSync(fileURLToPath(new URL(`../fixtures/images/${name}.jpg`, import.meta.url))));
const KEYS = loadKeys();
const run = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf-8")) : { address: ADDRESS, steps: {} };
const save = () => writeFileSync(OUT, JSON.stringify(run, null, 2));
const say = (m) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${m}`);
const clientFor = (role) => createClient({ chain, account: createAccount(KEYS[role].pk) });
const reader = createClient({ chain, account: createAccount(KEYS.STRANGER.pk) });

function assert(cond, message) {
  if (!cond) {
    say(`ASSERTION FAILED: ${message}`);
    process.exit(2);
  }
}

function jsonFrom(text) {
  const i = text.indexOf("{");
  return i >= 0 ? JSON.parse(text.slice(i)) : null;
}

async function read(fn, args) {
  for (let i = 0; i < 6; i++) {
    try {
      return await reader.readContract({ address: ADDRESS, functionName: fn, args });
    } catch (e) {
      if (i === 5) throw e;
      await sleep(5000 * (i + 1));
    }
  }
}

async function readJson(fn, args) {
  return JSON.parse(await read(fn, args));
}

async function balance(role) {
  const b = await rpc("eth_getBalance", [KEYS[role].addr, "latest"]);
  return BigInt(b.result ?? "0x0");
}

const ROUNDS = new Set(["request_assessment", "decide_appeal"]);
const ROUND_ATTEMPTS = 3;

/**
 * One signed write, remembered by name so a rerun skips what already landed.
 * The hash is saved the moment it is sent: a rerun after a timeout waits on
 * the same transaction instead of sending a second one.
 */
async function step(name, role, fn, args, { value = 0n, transfer = false, refused = null } = {}) {
  if (run.steps[name]) {
    say(`${name}: done earlier (${run.steps[name].hash})`);
    return run.steps[name];
  }
  run.pending ??= {};
  // A round is read and judged by a panel that must reach a majority. When it
  // cannot, the write is UNDETERMINED: nothing was recorded and the milestone
  // is untouched, so asking again is safe and draws a fresh panel. On this
  // network that happens often enough to matter, and why is measured in
  // docs/PROBE-REPORT.md. Every attempt is kept in run.no_consensus so the
  // proof log reports the rounds that failed, not only the one that carried.
  const attempts = ROUNDS.has(fn) ? ROUND_ATTEMPTS : 1;
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
      t = await waitFinal(hash, { label: name, tries: ROUNDS.has(fn) ? 450 : 150 });
      secs = Math.round((Date.now() - t0) / 1000);
      break;
    } catch (e) {
      if (!/UNDETERMINED|CANCELED/.test(e.message)) throw e;
      delete run.pending[name];
      (run.no_consensus ??= []).push({ name, hash, at: new Date().toISOString() });
      save();
      if (ask >= attempts) throw e;
      say(`${name}: no majority, so nothing was recorded; asking again `
        + `(${ask + 1} of ${attempts})`);
      await sleep(15000);
    }
  }
  delete run.pending[name];
  const leader = leaderOf(t);
  const ok = leader?.execution_result === "SUCCESS";
  const text = resultText(leader);
  say(`${name}: ${t.status} ${t.result_name} leader=${leader?.execution_result} in ${secs} s`);
  if (refused) {
    assert(!ok, `${name} should have been refused`);
    assert(text.includes(refused), `${name} refusal should say "${refused}", said "${text.slice(0, 200)}"`);
  } else {
    assert(ok, `${name} failed: ${text.slice(0, 300)}`);
  }
  const rec = { name, role, fn, hash, secs, ok, text: text.slice(0, 600), explorer: `${EXPLORER}/tx/${hash}`,
                rotations: t.consensus_history?.consensus_results?.length ?? null };
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
// Two real sites, and nothing asked of a photograph that the photograph does
// not contain. The first run of these proofs specified a ballasted flat-roof
// mounting system against an image that turned out to be an off-grid power
// room; the panel said so and the milestone did not pay, which was the right
// answer to the wrong question. The schedules below describe what is actually
// in each frame.

/** The Growatt site: one string inverter on a plant room wall, with a plate. */
const GROWATT = { role: "INVERTER", manufacturer: "Growatt", model: "MOD 4000TL3-X",
                  rating: "4000 W", quantity: 1, identify: true };
/** The same brand, a different product: the mismatch a reader skims past. */
const WRONG_MODEL = { ...GROWATT, model: "MOD 10KTL3-X", rating: "10 kW" };
const BATTERY = { role: "BATTERY", manufacturer: "Growatt", model: "ARK 2.5H-A1",
                  rating: "2.5 kWh", quantity: 1, identify: false };

/** The Kenya site: an off-grid power room. */
const OFFGRID_BATTERY = { role: "BATTERY", manufacturer: "Sealed lead acid",
                          model: "2 V cells on a steel rack", quantity: 8, identify: false };
const OFFGRID_ISOLATOR = { role: "PROTECTION", manufacturer: "Kripal",
                           model: "DC isolator switch", quantity: 1, identify: false };
const OFFGRID_INVERTER = { role: "INVERTER", manufacturer: "Alpha",
                           model: "Wall mounted hybrid inverter", quantity: 1, identify: false };

function terms({ equipment, title, criteria, images = 2, payment = 2n * GEN, days = 14,
                 type = "INVERTER_INSTALLATION", spec }) {
  return JSON.stringify({
    milestone_type: type,
    title,
    description: "Installed equipment, photographed on site for settlement.",
    requirements: "The equipment named in the schedule is installed on this site, and where "
      + "the schedule requires it, identifiable from its own markings.",
    specification: spec,
    equipment,
    criteria,
    evidence_requirements: [
      { text: "Photographs of the installed equipment", kind: "IMAGE",
        from_role: "INSTALLER", min_count: images },
    ],
    payment_wei: payment.toString(),
    deadline: new Date(Date.now() + days * 86400000).toISOString().replace(/\.\d+Z$/, "Z"),
  });
}

async function project(key, title, { escrow = 3n * GEN } = {}) {
  const params = JSON.stringify({
    title,
    description: "A demonstration written to show how the record works, not anyone's contract. "
      + "The photographs are from Wikimedia Commons; see fixtures/ATTRIBUTION.md.",
    site: "Demonstration site", system_type: "COMMERCIAL_SOLAR", capacity_kw: "4",
    installer: KEYS.INSTALLER.addr, inspector: "", appeal_window_seconds: 600,
  });
  const created = await step(`${key}.create`, "OWNER", "create_project", [params], { value: escrow });
  const pid = jsonFrom(created.text)?.project_id;
  assert(pid, `${key}: no project id`);
  return pid;
}

async function milestone(key, pid, termsJson) {
  const added = await step(`${key}.milestone`, "OWNER", "add_milestone", [pid, termsJson]);
  const mid = jsonFrom(added.text)?.milestone_id;
  assert(mid, `${key}: no milestone id`);
  await step(`${key}.sign`, "INSTALLER", "accept_project", [pid]);
  return mid;
}

async function image(key, role, mid, file, caption, { line = "", req = "R1", origin = "PHOTO" } = {}) {
  const meta = JSON.stringify({ requirement_id: req, equipment_id: line, caption, origin,
                                claimed_capture: "September 2026",
                                claimed_location: "Demonstration site" });
  const rec = await step(key, role, "submit_image", [mid, meta, IMG(file)]);
  return jsonFrom(rec.text)?.item_id;
}

async function assessment(key, mid, items) {
  const rec = await step(key, "INSTALLER", "request_assessment", [mid, JSON.stringify(items)]);
  const round = await readJson("get_round", [mid, jsonFrom(rec.text).round]);
  if (!run.steps[key].nodes) {
    const { nodes } = await dumpReceipt(rec.hash);
    run.steps[key].nodes = nodes.map((n) => ({ rotation: n.rotation, from: n.from,
                                               vote: n.vote, model: n.model }));
    save();
  }
  say(`${key}: ${round.decision}  lines ${JSON.stringify(round.lines)}  `
    + `criteria ${JSON.stringify(round.criteria)}  quality ${round.quality}`);
  return round;
}

const WALL_SPEC = "One string inverter mounted on the plant room wall, its d.c. and a.c. "
  + "connections made at the underside of the unit.";
const ROOM_SPEC = "Off-grid power room: a wall mounted hybrid inverter with its consumer unit "
  + "and d.c. isolator, and a sealed lead acid battery bank on a steel rack.";
const WALL_CRITERION = [{ text: "The inverter is mounted on a wall with its cabling connected "
                                + "at the underside of the unit." }];

// ── the proofs ───────────────────────────────────────────────────────────────

say(`proofs on ${ADDRESS}`);
const cfg = await readJson("get_config", []);
assert(cfg.ruleset === "icarus-rules-1", "unexpected ruleset");

// 1. The flagship: the plate on the wall reads the model the contract named.
const flagPid = await project("flagship", "Inverter installation, plant room (demonstration)");
const flagMid = await milestone("flagship", flagPid, terms({
  equipment: [GROWATT], criteria: WALL_CRITERION, spec: WALL_SPEC,
  title: "String inverter installed and identifiable" }));
const flagFront = await image("flagship.inverter", "INSTALLER", flagMid, "growatt-inverter",
                              "The string inverter on the plant room wall", { line: "E1" });
const flagPlate = await image("flagship.plate", "INSTALLER", flagMid, "growatt-nameplate",
                              "The rating plate on the same unit", { line: "E1", origin: "NAMEPLATE" });
const flagRound = await assessment("flagship.assess", flagMid, [flagFront, flagPlate]);
assert(flagRound.decision === "ACCEPTED",
       `flagship: ${flagRound.decision}, lines ${JSON.stringify(flagRound.lines)}`);
assert(flagRound.lines.E1 === "INSTALLED", "flagship: the inverter line was not established");
assert(flagRound.quality === "SUFFICIENT", "flagship: evidence not recorded as sufficient");

// The walls that only stand while the flagship's window is open. They run here,
// not with the others: four assessments take longer than a ten minute window,
// and a wall checked after its own deadline is not a wall.
await step("walls.finalize_early", "STRANGER", "finalize", [flagMid],
           { refused: "the appeal window is still open" });
await step("walls.installer_appeals_own_acceptance", "INSTALLER", "open_appeal",
           [flagMid, "We would like more money."],
           { refused: "only the owner appeals an acceptance" });
await step("walls.files_against_acceptance", "OWNER", "submit_document",
           [flagMid, JSON.stringify({ title: "Objection" }), "We object."],
           { refused: "to contest it, open an appeal" });

// 1b. A second acceptance, kept for the appeal, so that contesting a decision
//     never depends on which way another case happened to fail.
const appealPid = await project("appealcase", "Inverter installation, contested (demonstration)");
const appealMid = await milestone("appealcase", appealPid, terms({
  equipment: [GROWATT], criteria: WALL_CRITERION, spec: WALL_SPEC,
  title: "String inverter installed, contested by the owner" }));
const appealFront = await image("appealcase.inverter", "INSTALLER", appealMid, "growatt-inverter",
                                "The string inverter on the plant room wall", { line: "E1" });
const appealPlate = await image("appealcase.plate", "INSTALLER", appealMid, "growatt-nameplate",
                                "The rating plate on the same unit", { line: "E1", origin: "NAMEPLATE" });
const appealFirst = await assessment("appealcase.assess", appealMid, [appealFront, appealPlate]);
assert(appealFirst.decision === "ACCEPTED",
       `the appeal case did not accept: ${appealFirst.decision}`);
await step("appeal.open", "OWNER", "open_appeal",
           [appealMid, "The unit on the wall is not the one we specified."]);

// 2. The floor: the same wall, and only a document names the model.
const paperPid = await project("paper", "Inverter named on paper only (demonstration)");
const paperMid = await milestone("paper", paperPid, terms({
  equipment: [GROWATT], criteria: WALL_CRITERION, spec: WALL_SPEC, images: 1,
  title: "String inverter installed, identified by datasheet" }));
const paperFront = await image("paper.inverter", "INSTALLER", paperMid, "growatt-inverter",
                               "The string inverter on the wall", { line: "E1" });
await step("paper.datasheet", "INSTALLER", "submit_document",
           [paperMid, JSON.stringify({ title: "Inverter datasheet", reference: "DS-MOD4000",
                                       equipment_id: "E1" }),
            "Growatt PV Grid Inverter. Model name MOD 4000TL3-X. Max output power 4000 W. "
            + "Nominal output voltage 3W/N/PE 230/400 a.c.V. The unit supplied and installed "
            + "on this project is the model named above."]);
const paperRound = await assessment("paper.assess", paperMid, [paperFront]);
assert(paperRound.decision !== "ACCEPTED",
       `a paper identification paid: ${paperRound.decision}`);
assert(paperRound.lines.E1 !== "INSTALLED",
       `the inverter line stood on a document: ${paperRound.lines.E1}`);

// 3. The mismatch: same manufacturer, different product. The plate settles it.
const wrongPid = await project("mismatch", "Inverter installation, wrong model (demonstration)");
const wrongMid = await milestone("mismatch", wrongPid, terms({
  equipment: [WRONG_MODEL], criteria: WALL_CRITERION, spec: WALL_SPEC,
  title: "Ten kilowatt inverter installed" }));
const wrongFront = await image("mismatch.inverter", "INSTALLER", wrongMid, "growatt-inverter",
                               "The inverter on the wall", { line: "E1" });
const wrongPlate = await image("mismatch.plate", "INSTALLER", wrongMid, "growatt-nameplate",
                               "The rating plate on the same unit", { line: "E1", origin: "NAMEPLATE" });
const wrongRound = await assessment("mismatch.assess", wrongMid, [wrongFront, wrongPlate]);
assert(wrongRound.decision !== "ACCEPTED",
       `a plate reading another product paid: ${wrongRound.decision}`);

// 4. The missing item: the schedule adds a battery and nothing shows one.
const gapPid = await project("battery", "Inverter and storage (demonstration)");
const gapMid = await milestone("battery", gapPid, terms({
  equipment: [GROWATT, BATTERY], criteria: WALL_CRITERION, spec: WALL_SPEC,
  title: "Inverter and battery installed" }));
const gapFront = await image("battery.inverter", "INSTALLER", gapMid, "growatt-inverter",
                             "The inverter on the wall", { line: "E1" });
const gapPlate = await image("battery.plate", "INSTALLER", gapMid, "growatt-nameplate",
                             "The rating plate on the same unit", { line: "E1", origin: "NAMEPLATE" });
await step("battery.says", "INSTALLER", "submit_declaration",
           [gapMid, "The battery was delivered and commissioned with the system."]);
const gapRound = await assessment("battery.assess", gapMid, [gapFront, gapPlate]);
assert(gapRound.decision !== "ACCEPTED", `a missing battery paid: ${gapRound.decision}`);
assert(gapRound.lines.E2 !== "INSTALLED", `the battery line stood on nothing: ${gapRound.lines.E2}`);
assert(!JSON.stringify(gapRound).includes("delivered and commissioned"),
       "a declaration reached the record of a round");

// 5. A second site, judged on its own evidence: an off-grid power room.
const roomPid = await project("offgrid", "Off-grid power room (demonstration)");
const roomMid = await milestone("offgrid", roomPid, terms({
  type: "ELECTRICAL_INTEGRATION", equipment: [OFFGRID_INVERTER, OFFGRID_ISOLATOR, OFFGRID_BATTERY],
  criteria: [{ text: "The battery bank is installed on a rack and connected to the inverter." }],
  spec: ROOM_SPEC, images: 1, title: "Power room equipment installed" }));
const roomPhoto = await image("offgrid.room", "INSTALLER", roomMid, "array-kenya",
                              "The power room: inverter, isolator, consumer unit and battery bank",
                              { line: "" });
const roomRound = await assessment("offgrid.assess", roomMid, [roomPhoto]);
assert(["ACCEPTED", "REJECTED", "UNDETERMINED"].includes(roomRound.decision),
       "the power room round produced no decision");

// 6. The walls: what the contract refuses, in its own words.
await step("walls.stranger_files", "STRANGER", "submit_document",
           [flagMid, JSON.stringify({ title: "Note" }), "Let me in."],
           { refused: "only the owner, the installer and the named inspector" });
await step("walls.stranger_assessment", "STRANGER", "request_assessment",
           [flagMid, JSON.stringify([flagFront])],
           { refused: "only the installer requests an assessment" });

// 7. The appeal: its own record, because only an acceptance or a rejection
//    can be contested and the mismatch is free to fail either way. The owner
//    contests an acceptance on the same evidence that produced it.
const contested = await readJson("get_milestone", [appealMid]);
assert(contested.state === "APPEALED", `the appeal did not open: ${contested.state}`);
const appealEnds = contested.appeal.evidence_ends;
await waitUntil(appealEnds, "the appeal's evidence period");
const appealRec = await step("appeal.decide", "STRANGER", "decide_appeal", [appealMid]);
const appealRecord = await readJson("get_round", [appealMid, jsonFrom(appealRec.text).round]);
assert(appealRecord.kind === "APPEAL", "the appeal did not record an appeal round");
assert(appealRecord.reviewed_round === 1, "the appeal did not name the round it reviewed");
assert((await readJson("get_milestone", [appealMid])).state !== "APPEALED",
       "the appeal is still open after its readjudication");
say(`appeal: reviewed round 1, decided ${appealRecord.decision}, `
  + `lines ${JSON.stringify(appealRecord.lines)}`);

// 8. Settlement: the flagship pays once it can no longer be contested.
const standing = (await readJson("get_milestone", [flagMid])).standing;
await waitUntil(standing.window_ends, "the flagship's appeal window");
await step("flagship.finalize", "STRANGER", "finalize", [flagMid]);
const owed = BigInt((await readJson("get_balance", [KEYS.INSTALLER.addr])).claimable);
assert(owed >= 2n * GEN, `the installer is owed ${owed}`);
const before = await balance("INSTALLER");
await step("flagship.claim", "INSTALLER", "claim", [], { transfer: true });
const after = await balance("INSTALLER");
assert(after > before, "the claim did not reach the wallet");
say(`the installer's wallet received ${after - before} wei`);
assert((await readJson("get_balance", [KEYS.INSTALLER.addr])).claimable === "0",
       "the ledger still owes after a claim");

say(`stats ${JSON.stringify(await readJson("get_stats", []))}`);

// Rounds that reached no majority recorded nothing and were asked again. They
// are reported because a run that only shows the attempt that carried is not
// reporting what this network does.
const missed = run.no_consensus ?? [];
if (missed.length) {
  say(`${missed.length} round(s) reached no majority and were asked again:`);
  for (const r of missed) say(`  ${r.name} ${r.hash}`);
} else {
  say("every round reached a majority on its first asking");
}
say("every proof passed");
