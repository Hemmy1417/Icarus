<p align="center"><img src="https://raw.githubusercontent.com/Hemmy1417/Icarus/main/web/public/icon.svg" width="120" alt="ICARUS"/></p>

# ICARUS - Renewable energy installation milestones

**A milestone pays when the evidence shows that the equipment the contract named was actually
installed. A document saying so is not that evidence.**

An owner escrows GEN against a milestone written as an equipment schedule: a manufacturer, a
model, a rating and a quantity per line, and a note on whether the nameplate has to be legible
in a photograph. The installer files photographs, which the contract stores and hashes itself.
Validators on GenLayer each read the images for themselves and report what they found against
every line, and the contract derives the decision from those findings. No model is ever asked
whether a milestone should pay.

## What it is

- **Terms that name equipment, not outcomes:** a schedule line is a manufacturer, a model, a
  rating and a quantity. Both parties sign the schedule before any evidence is filed, so nobody
  is judged against terms they did not agree to.
- **Evidence the contract holds:** images are stored on chain and hashed when filed, so every
  validator judges the same bytes and a reader can fetch them and recompute the digest. Capture
  dates and places are recorded as the filer's claims and labelled as claims.
- **Looking separated from judging:** a node is first asked only to describe what is visible and
  transcribe any text on a label, without being shown the schedule, so it cannot read the
  expected answer into the picture. Only then is it asked to match what it read against what was
  contracted.
- **A decision derived in code:** a node reports one of five findings per line and one of three
  per criterion. Accepted, rejected and undetermined are computed from those findings, which is
  why the same findings always give the same decision.
- **One appeal, judged afresh:** the owner may contest a decision inside the window the project
  set. A fresh panel judges the milestone from the start and may read evidence filed during the
  appeal. The appellant's reason is put to the panel as argument, and the panel is told it is
  not evidence.
- **Pull payments:** a settled milestone credits the installer's balance; they withdraw it
  themselves. Nothing is pushed by a round, so a failed transfer can never wedge a decision.

## The five findings

| Finding | What the panel is saying |
|---|---|
| `INSTALLED` | An image shows an item of that role installed, and where the line asks for it, text read on a label identifies it as that manufacturer and model. |
| `UNIDENTIFIED` | An item of that role is shown, but it is not identified as the specified one where the line requires it. |
| `NOT_SHOWN` | Nothing in the evidence establishes the line either way. |
| `ABSENT` | The evidence shows that the specified item is not installed, which includes a label identifying the item in that position as a different product. |
| `CONTRADICTED` | Two pieces of evidence disagree with each other about the line. |

The contract then derives the milestone's decision:

| Findings | Decision |
|---|---|
| Any conflict between pieces of evidence | `UNDETERMINED` |
| Any line `ABSENT`, or any criterion `NOT_MET` | `REJECTED` |
| Any line `UNIDENTIFIED` or `NOT_SHOWN`, or any criterion `UNCLEAR` | `UNDETERMINED` |
| Every line `INSTALLED` and every criterion `MET` | `ACCEPTED` |

## The floors the code enforces

These are applied after the panel reports and before the decision is derived. They are not
instructions in a prompt that a model may or may not follow.

| Floor | What it does |
|---|---|
| A document cannot establish a line | A line rated `INSTALLED` whose cited basis holds no image is downgraded to doubt. Only an image, or an independent inspector's report, witnesses the site. |
| An adverse finding needs an observation too | A line cannot be rated `ABSENT`, and a criterion cannot be rated `NOT_MET`, on paperwork alone either. The floor has a mirror, so it protects both parties. |
| A party's own document is their own account | A document written by the owner or the installer can neither establish a line nor refute one, whichever party wrote it. |
| A node that cannot see cannot vote | A node counts as a reader only when it affirmatively says it saw the image and describes what it saw. A blind node votes against every outcome. |
| A declaration is never read | A statement recorded for the file is stored and shown to any reader, and never put to a panel. Its text is readable from the contract, so anybody can check that. |

## Lifecycle

```text
 AWAITING_TERMS ── installer signs ──► AWAITING_EVIDENCE
                                             │ a party requests an assessment
                                             ▼
                    ┌──────────────── assessment round ────────────────┐
                    ▼                        ▼                          ▼
                ACCEPTED                 REJECTED                  UNDETERMINED
           owner may contest         installer files more,      installer files more,
           inside the window         then reassesses            then reassesses
                    │
                    └───────► APPEALED
                          evidence period, then anyone decides:
                          ACCEPTED, REJECTED or UNDETERMINED;
                          undecided for three days: lapses to UNDETERMINED
                    │
      finalize (anyone, after the window) ──► FINALIZED ── claim
      close (the owner, after the deadline) ──► CLOSED
```

| State | Who moves it | If nobody acts |
|---|---|---|
| `AWAITING_TERMS` | the installer signs the terms in force | the owner closes it |
| `AWAITING_EVIDENCE` | a party requests an assessment, up to five per version | the owner closes it after the deadline |
| `ACCEPTED` | the owner contests it, or anyone finalizes after the window | finalize is open to anyone once the window passes |
| `REJECTED`, `UNDETERMINED` | the installer files more evidence and reassesses | the owner closes it after the deadline |
| `APPEALED` | anyone decides once the evidence period ends | anyone lapses it three days later, to `UNDETERMINED` |
| `FINALIZED`, `CLOSED` | terminal | the ledger holds the credit until it is claimed |

## Contract

`contracts/icarus.py`, one intelligent contract: 31 methods, 12 read and 19 write.

### Write methods

| Method | Who | What it does |
|---|---|---|
| `create_project` | anyone | Opens a project naming an installer and, optionally, an inspector. |
| `fund_project` | the owner | Adds GEN to the escrow. Payable. |
| `accept_project` | the installer | Signs the project and every milestone proposed so far. |
| `accept_inspector_role` | the inspector | Accepts the appointment, which they must do before filing. |
| `cancel_project` | the owner | Closes a project on which nothing has settled. |
| `withdraw_escrow` | the owner | Takes back escrow no milestone has reserved. |
| `add_milestone` | the owner | Proposes a milestone and reserves its payment. |
| `propose_version` | either party | Proposes new terms; they bind only when the other signs. |
| `accept_version` | the other party | Signs the proposed terms. |
| `submit_image` | a party | Files a photograph. The contract stores and hashes the bytes. |
| `submit_document` | a party | Files a document's text. |
| `submit_declaration` | a party | Records a statement that no panel will read. |
| `request_assessment` | a party | Puts the evidence to a panel. |
| `open_appeal` | the owner | Contests a decision inside its window, once. |
| `decide_appeal` | anyone | Has a fresh panel judge the milestone again. |
| `lapse_appeal` | anyone | Closes an appeal no panel decided in three days. |
| `finalize` | anyone | Settles an acceptance that can no longer be contested. |
| `close_milestone` | the owner | Closes a milestone and releases what it reserved. |
| `claim` | anyone owed | Withdraws the balance the contract credited them. |

### Read methods

`get_config`, `get_stats`, `list_projects`, `projects_of`, `get_project`, `get_milestone`,
`get_round`, `get_item`, `get_item_text`, `get_image`, `get_events`, `get_balance`.

### Consensus guarantees

- A validator repeats the whole reading and the whole judgment on its own evidence, and
  disagrees when its findings would give a different decision, when the leader's grounds do not
  hold, or when either of them could not see the images.
- Storage is written only after a majority agrees, so a round that reaches no majority records
  nothing and leaves the milestone untouched.
- The decision is derived from the findings in code, so a leader cannot record an outcome its
  own findings do not support.

## Verified end to end

Every line below is a transaction on the deployment of record, not a local simulation.
`docs/proof-run.txt` is the full log and `web/lib/proof-log.json` pairs each reading with the
transaction that produced it.

| Case | Evidence | Decision | The line |
|---|---|---|---|
| Flagship | the inverter on the wall, and its rating plate | `ACCEPTED`, paid | `E1 INSTALLED` |
| Named on paper only | the same wall, plus a datasheet naming the model | `UNDETERMINED` | nothing paid on a document |
| Wrong product | schedule says `MOD 10KTL3-X`, the plate reads `MOD 4000TL3-X` | `REJECTED` | `E1 ABSENT` |
| Battery in the schedule, none in evidence | inverter and plate only | `UNDETERMINED` | `E2 NOT_SHOWN` |
| Off-grid power room | one photograph of the room | `ACCEPTED` | all three lines |
| Contested acceptance | the owner appeals, a fresh panel judges again | readjudicated | the acceptance held |

Refusals proved live: a stranger cannot file evidence or ask for an assessment, the installer
cannot contest their own acceptance, a milestone cannot be finalized inside its window, and a
decision cannot be contested after it.

## What running this on a real panel looks like

`docs/PROBE-REPORT.md` records what the network actually did across the proof runs, including
the parts that did not work: blind validators, a hallucinated nameplate that did not carry, a
runtime that rejects an answer which is valid JSON followed by prose, and rounds that reached
no majority. It is in the repository because a build that reports only the run that worked is
not reporting.

## Tech stack

| Layer | Choice |
|---|---|
| Contract | Python intelligent contract on GenLayer Studio Next, chain 61997 |
| Reading and judging | `gl.nondet.exec_prompt` with images, under `gl.vm.run_nondet` |
| Tests | 162 direct tests against a stubbed runtime, plus a 64 mutant sweep |
| Scripts | Node with `genlayer-js` 2.0.0-rc.1 |
| Interface | Next.js App Router, TypeScript strict, Tailwind, Transaction Kit rc.2 |

## Repository

```text
contracts/icarus.py        the contract
tests/direct/              162 tests against a stubbed runtime
tests/mutation/mutate.py   64 mutants, each of which must fail the suite
scripts/                   deploy, fixtures, the live proof run, the proof log
fixtures/images/           the photographs the demonstration files
docs/                      architecture, consensus, evidence, security, the probe report
web/                       the interface
```

## Getting started

```bash
python -m venv .venv && .venv/Scripts/pip install -r requirements.txt
.venv/Scripts/python -m pytest tests/direct -q
.venv/Scripts/python tests/mutation/mutate.py
```

```bash
node scripts/deploy.mjs record
node scripts/proofs.mjs <address>
node scripts/proof-log.mjs <address>
```

```bash
pnpm --dir web install && pnpm --dir web dev
```

## Security

`docs/security.md` sets out what the contract defends against and what it does not. In short:
party text is fenced and defused before it reaches a panel, so a caption cannot speak in the
contract's voice; quotas bound how much any one party can file; payments are pull-only; and
every floor above has a mutant in the sweep that must fail the suite.

## Disclaimer

This is a demonstration on a test network. It judges whether evidence shows that named
equipment was installed. It is not a safety inspection, and it does not certify workmanship.
