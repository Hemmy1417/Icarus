// One address everywhere: the deployment of record the app reads must be the
// one the proof logs were recorded on, the one the committed contract schema
// was fetched from, and the one the documents name. A judge clones and runs;
// a checkout whose config surfaces disagree does not reproduce what was
// judged, so this fails the build rather than leaving it to be discovered.
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// A transaction hash also begins with 40 valid hex characters, so the
// address pattern carries a right boundary.
// Two copies on purpose: a /g regex advances lastIndex on .test(), so a
// shared one would alternate between true and false down a file.
const ADDRESS = /0x[0-9a-fA-F]{40}(?![0-9a-fA-F])/g;
const HAS_ADDRESS = /0x[0-9a-fA-F]{40}(?![0-9a-fA-F])/;

const at = (path) => fileURLToPath(new URL(path, import.meta.url));
const shown = (path) => path.replace(/^(\.\.\/)+/, "");
const problems = [];

const read = (path) => {
  if (existsSync(at(path))) return readFileSync(at(path), "utf8");
  problems.push(`${shown(path)} is missing`);
  return "";
};

const config = read("../lib/config.ts").match(/RECORD_ADDRESS = "(0x[0-9a-fA-F]{40})"/)?.[1];
if (!config) {
  console.error("lib/config.ts names no RECORD_ADDRESS");
  process.exit(1);
}
const same = (a) => String(a).toLowerCase() === config.toLowerCase();

// The published pairing of a reading to the transaction that produced it.
const log = JSON.parse(read("../lib/proof-log.json") || "{}");
if (!same(log.address ?? "")) {
  problems.push(`lib/proof-log.json records ${log.address || "no address"}`);
}

// The signatures every composed call is checked against.
const schema = JSON.parse(read("../lib/contract-schema.json") || "{}");
if (!same(schema.address ?? "")) {
  problems.push(`lib/contract-schema.json was read from ${schema.address || "nowhere"}`);
}

/*
 * Every line that calls something the deployment of record and carries an
 * address must carry this one, and each document must say it at least once.
 * The proof logs are checked whole: their header names the contract they ran
 * against, and a log naming another deployment is evidence for a different
 * build.
 */
for (const doc of ["../../README.md", "../../docs/e2e-verification.md"]) {
  const text = read(doc);
  const lines = text
    .split("\n")
    .filter((l) => /deployment of record/i.test(l) && HAS_ADDRESS.test(l));
  if (text && !lines.length) problems.push(`${shown(doc)} never names the deployment of record`);
  for (const line of lines) {
    for (const addr of line.match(ADDRESS) ?? []) {
      if (!same(addr)) problems.push(`${shown(doc)} names ${addr} as the deployment of record`);
    }
  }
}

for (const doc of ["../../docs/proof-run.txt", "../../docs/paths-run.txt"]) {
  const text = read(doc);
  const found = new Set(text.match(ADDRESS) ?? []);
  if (text && !found.size) problems.push(`${shown(doc)} names no contract`);
  for (const addr of found) {
    if (!same(addr)) problems.push(`${shown(doc)} was recorded against ${addr}`);
  }
}

if (problems.length) {
  console.error(`The deployment of record is ${config}, but:\n  ${problems.join("\n  ")}`);
  process.exit(1);
}
console.log(`one address everywhere: ${config}`);
