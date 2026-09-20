/**
 * The writes the main proof run does not reach.
 *
 * scripts/proofs.mjs proves the adjudication: evidence in, a panel's reading,
 * a decision, an appeal, a settlement. It leaves eight of the contract's
 * nineteen writes untouched, because none of them are on that path. This
 * proves seven of the eight live, in one project:
 *
 *   fund_project           adding to the escrow after the project exists
 *   accept_inspector_role  the third party taking the appointment
 *   propose_version        revising a schedule after it was signed
 *   accept_version         the other party signing that revision
 *   withdraw_escrow        taking back what no milestone reserved
 *   close_milestone        closing one nobody accepted, past its deadline
 *   cancel_project         closing the project itself
 *
 * The eighth, lapse_appeal, needs three days to pass after an appeal's
 * evidence period and cannot be shown in a run; its refusal wall is proved
 * instead, and the direct suite covers the rest.
 *
 *   node scripts/paths.mjs 0x…
 */
import { createAccount, createClient } from "genlayer-js";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { GEN, chain, leaderOf, loadKeys, plainFees, resultText, sleep, waitFinal } from "./lib.mjs";

const ADDRESS = process.argv[2];
if (!/^0x[0-9a-fA-F]{40}$/.test(ADDRESS ?? "")) {
  throw new Error("usage: node scripts/paths.mjs 0x…");
}

const OUT = fileURLToPath(new URL(`../.data/paths-${ADDRESS}.json`, import.meta.url));
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

const jsonFrom = (text) => {
  const i = text.indexOf("{");
  return i >= 0 ? JSON.parse(text.slice(i)) : null;
};

async function view(fn, args) {
  for (let i = 0; ; i++) {
    try {
      return JSON.parse(await reader.readContract({ address: ADDRESS, functionName: fn, args }));
    } catch (e) {
      if (i >= 5) throw e;
      await sleep(4000 * (i + 1));
    }
  }
}

/**
 * One signed write, remembered by name so a rerun resumes rather than
 * repeats. None of these are consensus rounds, so there is no panel to
 * rotate and no no-majority case to retry: a refusal here is the contract's
 * answer, and where a refusal is the point, `refused` says what it must say.
 */
async function step(name, role, fn, args, { value = 0n, refused = null } = {}) {
  if (run.steps[name]) {
    say(`${name}: done earlier`);
    return { ...run.steps[name], fresh: false };
  }
  run.pending ??= {};
  let hash = run.pending[name];
  if (!hash) {
    const client = clientFor(role);
    for (let attempt = 0; ; attempt++) {
      try {
        hash = await client.writeContract({
          address: ADDRESS, functionName: fn, args, value, fees: await plainFees(client),
        });
        break;
      } catch (e) {
        if (attempt >= 4) throw e;
        say(`${name}: send failed (${String(e.message).slice(0, 70)}), retrying`);
        await sleep(8000 * (attempt + 1));
      }
    }
    run.pending[name] = hash;
    save();
    say(`${name}: ${role} ${fn}`);
  }

  const t = await waitFinal(hash, { label: name, tries: 150 });
  delete run.pending[name];
  const leader = leaderOf(t);
  const ok = leader?.execution_result === "SUCCESS";
  const text = resultText(leader);

  if (refused) {
    assert(!ok, `${name} should have been refused, but it succeeded`);
    assert(text.includes(refused), `${name} should say "${refused}", said "${text.slice(0, 160)}"`);
    say(`${name}: refused, "${refused}"`);
  } else {
    assert(ok, `${name} failed: ${text.slice(0, 220)}`);
    say(`${name}: ${t.status}`);
  }

  run.steps[name] = { name, role, fn, hash, ok, text, refused: !!refused };
  save();
  return { ...run.steps[name], fresh: true };
}

// ── the run ──────────────────────────────────────────────────────────────

say(`paths on ${ADDRESS}`);

/*
 * close_milestone requires the deadline to have passed, and add_milestone
 * requires it to be in the future, so the only way to prove closing live is
 * to write a short deadline and wait it out.
 *
 * It is computed when the milestone is actually proposed, not at the top of
 * the run: every write on this network takes the better part of a minute, so
 * a deadline set before four of them has already expired by the time it is
 * read. The window has to outlast the six writes that follow the proposal,
 * because the refusal wall that proves closing is refused early needs the
 * deadline still standing when it runs.
 */
const DEADLINE_MS = 9 * 60_000;
let deadline = "";

const created = await step("open", "OWNER", "create_project", [
  JSON.stringify({
    title: "Terms and escrow path (demonstration)",
    description: "A project written to exercise the writes the adjudication path does not reach.",
    site: "Demonstration site",
    system_type: "COMMERCIAL_SOLAR",
    capacity_kw: "4",
    installer: KEYS.INSTALLER.addr,
    inspector: KEYS.INSPECTOR.addr,
    appeal_window_seconds: 600,
  }),
], { value: 2n * GEN });
const pid = jsonFrom(created.text)?.project_id;
assert(pid, "no project id came back");
say(`project ${pid}`);

// 1. The inspector takes the appointment. Until they do, they cannot file.
//    The precondition is only checked on a fresh run, because a resumed one
//    is resuming precisely because that write already landed.
if (!run.steps["inspector.accepts"]) {
  const before = await view("get_project", [pid]);
  assert(!before.inspector_accepted_at, "the inspector had already accepted");
}
await step("inspector.accepts", "INSPECTOR", "accept_inspector_role", [pid]);
const withInspector = await view("get_project", [pid]);
assert(withInspector.inspector_accepted_at, "the inspector's acceptance was not recorded");

// 2. The installer signs the project itself.
await step("installer.signs", "INSTALLER", "accept_project", [pid]);

// 3. More escrow, after the project exists.
const funded0 = BigInt((await view("get_project", [pid])).funded_wei);
const addition = await step("escrow.add", "OWNER", "fund_project", [pid], { value: 2n * GEN });
const funded1 = BigInt((await view("get_project", [pid])).funded_wei);
if (addition.fresh) {
  assert(funded1 === funded0 + 2n * GEN, `escrow went ${funded0} to ${funded1}`);
  say(`escrow funded from ${funded0} to ${funded1} wei`);
} else {
  assert(funded1 >= 4n * GEN, `escrow holds ${funded1} after an earlier funding`);
  say(`escrow already holds ${funded1} wei`);
}

// 4. A milestone, proposed after the signature, so it awaits its own.
const terms = (over = {}) => JSON.stringify({
  milestone_type: "INVERTER_INSTALLATION",
  title: "Inverter installed, terms revised (demonstration)",
  description: "Installed equipment, photographed on site for settlement.",
  requirements: "The equipment named in the schedule is installed on this site.",
  specification: "One string inverter mounted on the plant room wall.",
  equipment: [{ role: "INVERTER", manufacturer: "Growatt", model: "MOD 4000TL3-X",
                rating: "4000 W", quantity: 1, identify: true }],
  criteria: [{ text: "The inverter is mounted on a wall." }],
  evidence_requirements: [{ text: "Photographs of the installed equipment", kind: "IMAGE",
                            from_role: "INSTALLER", min_count: 1 }],
  payment_wei: (1n * GEN).toString(),
  deadline,
  ...over,
});

deadline = new Date(Date.now() + DEADLINE_MS).toISOString().replace(/\.\d+Z$/, "Z");
say(`the milestone's deadline is ${deadline}, to be waited out before it is closed`);
const added = await step("milestone.propose", "OWNER", "add_milestone", [pid, terms()]);
const mid = jsonFrom(added.text)?.milestone_id;
assert(mid, "no milestone id came back");
if (!run.steps["terms.sign"]) {
  const awaiting = await view("get_milestone", [mid]);
  assert(awaiting.state === "AWAITING_TERMS",
         `a milestone proposed after the signature should await terms, was ${awaiting.state}`);
}

// 5. The installer signs those terms. This is accept_version on version 1.
await step("terms.sign", "INSTALLER", "accept_version", [mid, 1]);
const signed = await view("get_milestone", [mid]);
assert(signed.state === "AWAITING_EVIDENCE", `signing left it ${signed.state}`);

// 6. The owner revises the schedule. It binds only when the installer signs.
await step("terms.revise", "OWNER", "propose_version", [mid, terms({
  title: "Ten kilowatt inverter installed (revised)",
  equipment: [{ role: "INVERTER", manufacturer: "Growatt", model: "MOD 10KTL3-X",
                rating: "10000 W", quantity: 1, identify: true }],
})]);
if (!run.steps["terms.countersign"]) {
  const pending = await view("get_milestone", [mid]);
  assert(pending.pending_version === 2, `the revision is not pending, saw ${pending.pending_version}`);
  assert(pending.current_version === 1, "a revision bound before it was signed");
  say("revised terms await the installer's signature; the old ones still stand");
}

await step("terms.countersign", "INSTALLER", "accept_version", [mid, 2]);
const revised = await view("get_milestone", [mid]);
assert(revised.current_version === 2, `the revision did not bind, at version ${revised.current_version}`);
assert(revised.pending_version === null, "a signed revision is still pending");
say("the revision binds only once both parties have signed it");

// 7. The owner takes back escrow no milestone reserved.
const held = await view("get_project", [pid]);
const free = BigInt(held.unreserved_wei);
const reservedBefore = BigInt(held.reserved_wei);
if (!run.steps["escrow.withdraw"]) assert(free > 0n, "nothing was unreserved to withdraw");
await step("escrow.withdraw", "OWNER", "withdraw_escrow", [pid,
           (free > 0n ? free : 1n).toString()]);
const after = await view("get_project", [pid]);
assert(BigInt(after.unreserved_wei) === 0n, `unreserved is ${after.unreserved_wei} after a full withdrawal`);
assert(BigInt(after.reserved_wei) === reservedBefore,
       `reserved went ${reservedBefore} to ${after.reserved_wei} during a withdrawal`);
say(`withdrew ${free} wei; the milestone's reservation was untouched`);

// 8. Walls worth proving: a stranger cannot revise or withdraw, and an
//    appeal cannot be lapsed when there is no appeal.
await step("wall.stranger_revises", "STRANGER", "propose_version", [mid, terms()],
           { refused: "only the owner proposes new terms" });
await step("wall.stranger_withdraws", "STRANGER", "withdraw_escrow", [pid, "1"],
           { refused: "only the owner withdraws escrow" });
await step("wall.lapse_without_appeal", "STRANGER", "lapse_appeal", [mid],
           { refused: "no appeal is open on this milestone" });
await step("wall.close_before_deadline", "STRANGER", "close_milestone", [mid],
           { refused: "the deadline has not passed" });

// 9. Close it once the deadline has passed. Nobody accepted it, so its
//    reservation returns to the owner's free escrow.
const left = Date.parse(deadline) - Date.now();
if (left > 0) {
  say(`waiting ${Math.ceil(left / 1000)} s for the deadline, to close a milestone nobody accepted`);
  await sleep(left + 5_000);
}
await step("milestone.close", "STRANGER", "close_milestone", [mid]);
const closed = await view("get_milestone", [mid]);
assert(closed.state === "CLOSED", `closing left it ${closed.state}`);
const released = await view("get_project", [pid]);
assert(BigInt(released.reserved_wei) === reservedBefore - 1n * GEN,
       `closing released ${reservedBefore - BigInt(released.reserved_wei)} rather than the payment`);
assert(BigInt(released.unreserved_wei) === 1n * GEN,
       `free escrow is ${released.unreserved_wei} after the reservation returned`);
say("closed by a stranger, and the reservation returned to the owner's free escrow");

// 10. The project itself, with nothing settled on it.
await step("project.cancel", "OWNER", "cancel_project", [pid]);
const cancelled = await view("get_project", [pid]);
assert(cancelled.state === "CANCELLED", `cancelling left it ${cancelled.state}`);
say("the project is cancelled");

say("");
say("proved live: fund_project, accept_inspector_role, propose_version, accept_version,");
say("withdraw_escrow, close_milestone, cancel_project, and four refusal walls.");
say("not reachable in a run: lapse_appeal, which needs three days to pass.");
say("every path passed");
