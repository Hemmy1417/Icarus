# End to end verification

Three layers, each checking something the others cannot.

## 1. The direct suite

`tests/direct/` runs the contract against a stubbed GenVM: real contract code,
a substituted runtime. Every nondeterministic call is answered from a queue,
so a test can say exactly what the leader saw, what each validator saw, and
where they differed, which is impossible against a live panel.

```bash
.venv/Scripts/python -m pytest tests/direct -q
```

162 tests. They cover the state machine, who may do what and when, quotas and
caps, the grounding floors in both directions, the derivation table, every
condition under which a validator disagrees, prompt fencing, and the
randomized walk in `test_invariants.py` that drives arbitrary legal sequences
and asserts the invariants hold at every step.

What this layer cannot tell you: whether a real model, on a real network,
behaves anything like the stub.

## 2. The mutation sweep

A passing suite proves the tests run, not that they would notice a change.

```bash
.venv/Scripts/python tests/mutation/mutate.py
```

64 mutants. Each one removes or inverts a rule that matters, and the sweep
requires the suite to **fail** for every one, plus a control run on the
unmodified contract that must pass. At the deployment of record: 64 of 64
killed, control passes.

Every floor named in `docs/security.md` has a mutant here, so none of them can
be deleted without a test noticing. Mutants that turned out to be equivalent,
where the change cannot alter behaviour, were removed with the reason written
beside them rather than left as noise.

What this layer cannot tell you: whether the rules being held are the right
rules, or whether the network cooperates.

## 3. The live proof run

```bash
node scripts/deploy.mjs record
node scripts/proofs.mjs <address>
node scripts/proof-log.mjs <address>
```

Every step is a signed transaction on Studio Next against the deployment of
record. The run is resumable: each write is remembered by name, so a segment
that stops resumes at the step that had not landed rather than repeating the
ones that had.

Two properties of the script are worth stating, because both were added after
the network taught them:

**A round that reaches no majority is asked again.** No majority means nothing
was recorded and the milestone is untouched, so resending is safe and draws a
fresh panel. The script asks up to three times and prints every attempt that
failed, so the log reports the rounds that did not carry rather than only the
one that did.

**A blind panel is not accepted as proof.** The cases whose whole point is
what a photograph shows assert that the panel actually read the evidence, and
ask again if it did not. Without this, a panel that received no image produces
the right outcome for the wrong reason, and the demonstration proves nothing.
That is not hypothetical: it happened, and it is why the blindness rule was
rewritten.

### What the run proves

| Case | What is filed | What must happen |
|---|---|---|
| Flagship | the inverter on the wall, and its rating plate | Accepted, finalized, and the payment actually reaches the installer's wallet. |
| Named on paper only | the same wall, plus a datasheet naming the model exactly | Does not pay. A document cannot establish a line. |
| Wrong product | schedule asks for `MOD 10KTL3-X`, the plate reads `MOD 4000TL3-X` | Rejected, on the plate rather than on anybody's say-so. |
| Battery in the schedule, none in evidence | the inverter and its plate only | Undetermined. One unshown line leaves the whole milestone in doubt. |
| Off-grid power room | one photograph of the room | Accepted on all three lines. |
| Contested acceptance | the owner appeals; a fresh panel judges again | The appeal is recorded as an appeal, names the round it reviewed, and closes the milestone's appealed state. |

### The refusals it proves

A stranger cannot file evidence or request an assessment. The installer cannot
contest their own acceptance. A milestone cannot be finalized inside its
window, nor contested after it. Evidence cannot be filed against a decision
that already stands. Each of these is a real transaction whose refusal text is
checked, not a local assertion.

## What is published

- `docs/proof-run.txt`, the full log of the run against the deployment of
  record, including the rounds that reached no majority.
- `web/lib/proof-log.json`, pairing each reading with the transaction that
  produced it, generated from the run's own receipts by
  `scripts/proof-log.mjs`. The milestone in each pairing is read back out of
  the transaction's calldata rather than taken from the step's name, so a
  renamed step cannot mislabel a proof.
- `docs/PROBE-REPORT.md`, what the network actually did across every run,
  including the parts that did not work.

## Verifying the deployment yourself

```bash
node scripts/deploy.mjs verify <address>
```

This fetches the contract's code from the chain, hashes it, hashes
`contracts/icarus.py`, and prints both. They match byte for byte at the
deployment of record. The interface shows the same digest on `/verify`, and
every decision page links to the explorer rather than asking to be believed.
