/**
 * Publish the round transactions from a proof run into the app.
 *
 * The contract cannot know its own transaction hash, so a decision page has
 * no honest way to link to the transaction that produced it unless someone
 * records the pairing. This writes web/lib/proof-log.json: for the
 * deployment of record, which transaction decided which round. The milestone
 * id is read back out of each transaction's own calldata rather than guessed
 * from the step's name, so a renamed step cannot silently mislabel a proof.
 *
 *   node scripts/proof-log.mjs <address>
 */
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { EXPLORER, rpc } from "./lib.mjs";

const ADDRESS = process.argv[2];
if (!ADDRESS) {
  console.error("usage: node scripts/proof-log.mjs <address>");
  process.exit(1);
}

const runPath = fileURLToPath(new URL(`../.data/proofs-${ADDRESS}.json`, import.meta.url));
const outPath = fileURLToPath(new URL("../web/lib/proof-log.json", import.meta.url));
const run = JSON.parse(readFileSync(runPath, "utf-8"));

const ROUND_FNS = new Set(["request_assessment", "decide_appeal"]);

/** The milestone a round transaction was sent about, from its own calldata. */
async function milestoneOf(hash) {
  const t = (await rpc("eth_getTransactionByHash", [hash])).result;
  const b64 = t?.data?.calldata;
  if (!b64) return null;
  const text = Buffer.from(b64, "base64").toString("latin1");
  return text.match(/ms-\d{5}/)?.[0] ?? null;
}

const rounds = {};
const proofs = [];

for (const step of Object.values(run.steps)) {
  if (!step.ok || !ROUND_FNS.has(step.fn)) continue;
  let body;
  try {
    body = JSON.parse(step.text);
  } catch {
    continue;
  }
  if (typeof body.round !== "number") continue;
  const mid = await milestoneOf(step.hash);
  if (!mid) {
    console.warn(`${step.name}: no milestone in the calldata, skipped`);
    continue;
  }
  rounds[`${mid}/${body.round}`] = step.hash;
  proofs.push({
    step: step.name,
    milestone_id: mid,
    round: body.round,
    decision: body.decision ?? null,
    lines: body.lines ?? null,
    seconds: step.secs ?? null,
    hash: step.hash,
    explorer: `${EXPLORER}/tx/${step.hash}`,
  });
}

// Rounds that reached no majority recorded nothing, so they pair with no
// round number. They are published anyway: a reader who wants to check the
// claim that this network sometimes cannot agree needs the transactions.
const noConsensus = (run.no_consensus ?? []).map((r) => ({
  step: r.name,
  hash: r.hash,
  at: r.at,
  explorer: `${EXPLORER}/tx/${r.hash}`,
}));

let commit = "";
try {
  commit = execSync("git rev-parse --short HEAD", { encoding: "utf-8" }).trim();
} catch {
  /* not a checkout: the log simply does not name a commit */
}

const log = {
  address: ADDRESS,
  source_commit: commit,
  finished_at: new Date().toISOString(),
  rounds,
  proofs: proofs.sort((a, b) => a.milestone_id.localeCompare(b.milestone_id) || a.round - b.round),
  no_consensus: noConsensus,
};

writeFileSync(outPath, `${JSON.stringify(log, null, 2)}\n`);
console.log(`wrote ${Object.keys(rounds).length} rounds and ${noConsensus.length} no-majority transactions`);
