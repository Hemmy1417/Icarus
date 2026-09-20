# End to end verification

Four layers, each checking something the others cannot, and an account of
which of the contract's writes are proved live.

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

## 4. The interface's write path

The three layers above prove the contract. None of them touches a page: a
proof run signs with the SDK, so a form that composes the wrong call passes
every one of them. That is not hypothetical, and it is why this layer exists.

A stand-in wallet is announced to the page over EIP-6963. It reports an
account and the right chain and refuses to sign anything, which is enough to
reach the point where a form has composed its contract call. The composed
`{method, args}` is then read off the React fiber, where each page builds it
as a prop before the kit encodes it. No key is involved at any point.

Driving every real form this way found seven faults that a typechecker, a
linter and 126 tests had all passed over, because a contract call is built as
an untyped array and nothing downstream knows what belongs in it:

| fault | effect |
|---|---|
| `accept_version` sent one argument, the contract takes two | signing terms failed |
| `submit_declaration` sent three, the contract takes two | filing a statement failed |
| `claim` declared as an act and never offered anywhere | an installer could not draw their payment |
| `propose_version` offered to the installer | a button that always fails |
| `request_assessment` offered to the owner | a button that always fails |
| filing and reassessment shut on a rejected or undetermined milestone | the recovery path was unreachable |
| `close_milestone` restricted to the owner, and offered before the deadline | wrong in both directions at once |

The bench is a one-off; `web/tests/calls.test.ts` is what holds. It reads the
contract's own signatures from the deployment with `gen_getContractSchema`,
commits them, and checks every composed call against them: the arity of each,
that every write is reachable from somewhere, and that value is sent to
exactly the two payable methods.

## Which writes are proved live, and which are not

The arithmetic, rather than an impression of coverage. The contract has
nineteen writes. `scripts/proofs.mjs` follows the adjudication and reaches
eleven of them; `scripts/paths.mjs` proves seven more, along with five
refusal walls.

| proved by | writes |
|---|---|
| `proofs.mjs`, the adjudication | `create_project`, `accept_project`, `add_milestone`, `submit_image`, `submit_document`, `submit_declaration`, `request_assessment`, `open_appeal`, `decide_appeal`, `finalize`, `claim` |
| `paths.mjs`, terms and escrow | `fund_project`, `accept_inspector_role`, `propose_version`, `accept_version`, `withdraw_escrow`, `close_milestone`, `cancel_project` |
| not reachable in a run | `lapse_appeal` |

`lapse_appeal` needs three days to pass after an appeal's evidence period, so
it cannot be shown in a run of any reasonable length. Its refusal wall is
proved live instead, and the direct suite covers the rest of it. That is
stated here rather than left as a gap somebody else has to find.

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
