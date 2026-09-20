# Security

What this contract defends against, how, and what it does not defend against.
The second list is here because a page that prints only the first is
marketing.

## The threats it is built against

| Threat | Defence |
|---|---|
| **Paying for paperwork.** A party files a datasheet naming the right model and claims the milestone. | A line rated installed whose basis holds no image is downgraded to doubt in code, after the panel reports. Proved live: a datasheet reading `Model name MOD 4000TL3-X` against a schedule asking for exactly that did not pay. |
| **Rejecting on paperwork.** A party files their own statement that the work was not done. | The same floor applies to adverse findings. `ABSENT` and `NOT_MET` need an image or the inspector's report too. |
| **A party vouching for itself.** The installer files a commissioning report they wrote. | A document written by either party is that party's own account and can neither establish nor refute a line, whichever party wrote it. |
| **Prompt injection through evidence.** A caption or document body tries to instruct the panel. | Every party text is fenced, and sequences that could close a fence are defused. The forged closer is left visible so a reader can see the attempt. A test files one and checks the prompt still has exactly one opening and one closing fence. |
| **A blind node deciding.** A validator that received no image votes anyway. | A node counts as a reader only when it affirmatively says an image reached it and describes what it saw. The flag defaults to false and an empty description is not a reading. |
| **A leader recording what its own findings do not support.** | The decision is derived from the findings in code, and a validator that would reach a different decision disagrees. Storage is written only after a majority agrees. |
| **Evidence changing between rounds.** An appeal re-reads what the first round judged. | The bytes are held and hashed by the contract, not referenced by a link. |
| **Burying the panel.** One party files hundreds of items. | Per-party quotas on images and documents, a cap on how many items a round may name, and a much smaller allowance for new items during an appeal. |
| **Judging against terms a party never agreed to.** | Terms are versioned and bind only when both parties have signed. Evidence is filed against, and judged under, a specific version. |
| **A wedged payment.** A transfer fails inside a round and blocks it. | Nothing is pushed. A settled milestone credits a ledger and the installer withdraws it themselves. The balance is cleared before the transfer is emitted. |
| **Reassessment until it passes.** A party asks repeatedly until a panel agrees. | Five assessments per version. Past that, the terms have to change, which needs both signatures. |
| **An appeal that never resolves.** | It lapses three days after its evidence period, to undetermined. An acceptance that was contested and never confirmed does not pay. |
| **A stranger acting on a record.** | Filing and assessment are restricted to the parties. Finalizing, deciding an appeal and lapsing one are deliberately open to anyone, because none of them can change an outcome, only carry out one already reached. |

## Review standards

Applied to this build, with where each one is met.

| Standard | Where |
|---|---|
| Consensus decides only what has a consequence | Validators compare decisions, not wording. `_unconfirmed` in `contracts/icarus.py`. |
| A model reports findings; code derives the verdict | `_derive` and `_quality`. No prompt asks whether a milestone should pay. |
| Evidence is corroborated where it enters the record | Images are hashed at filing and judged as stored bytes. |
| Every asymmetric floor has a mirror | Grounding applies to `INSTALLED` and to `ABSENT`, to `MET` and to `NOT_MET`. |
| A party's text cannot speak in the contract's voice | Fencing and defusing, with a test that files an attack. |
| The whole user path is reachable in the interface | Every write has an act in `web/lib/acts.ts`, with the reason shown when it is unavailable. |
| Recorded accounts are the signer | Parties are keyed by the checksummed sender address. |
| A live negative control per flag the panel raises | The proof run files a wrong-model case and a paper-only case, and both fail to pay. |
| Limits are stated rather than discovered | This file, and `docs/PROBE-REPORT.md`. |

## What it does not defend against

- **A node handed the wrong image.** It will describe that image rather than
  report itself unable to read, so the blindness check cannot catch it. Only a
  diverse panel does, and in the proof runs it did. This is a real hole and it
  is stated here rather than hidden.
- **A staged photograph.** If somebody installs the right inverter, photographs
  it, and removes it, the evidence is genuine and the decision is wrong. This
  contract judges evidence, not custody of a site. Where that matters, the
  terms name an inspector.
- **A panel that cannot agree.** A legible nameplate is close to the edge of
  what a model-diverse panel agrees on. When it splits, no majority is reached
  and nothing is recorded. That is a liveness cost, not a safety one: the
  milestone is untouched and the round can be asked again.
- **A leader's prose, which consensus does not bind.** Validators agree the
  decision, that every line and criterion was rated, and that the grounds
  behind each finding hold. They do not compare the reasoning the panel
  writes, nor the per-image readings. A leader whose findings a majority
  reproduces could still record misleading wording beside them.

  This cannot move money, and the reason is worth stating precisely: nothing
  downstream reads that prose. An appeal re-reads only the evidence item ids
  and the terms version from the round it reviews, and the evidence snapshot
  is built from contract storage after consensus, carrying the digest this
  contract computed when the bytes were filed. So the record a later panel
  reconsiders was never authored by a leader. The prose is shown on the case
  sheet as the panel's own words, and that is all it is.
- **Workmanship and safety.** A photograph showing the right inverter on the
  right wall is not an electrical inspection.
- **The network itself.** This runs on a test network whose validators, fee
  policy and model routes are operated by somebody else, and whose behaviour
  is measured in `docs/PROBE-REPORT.md` rather than assumed.

## How the floors are held

Each floor above has at least one mutant in `tests/mutation/mutate.py` that
removes or inverts it. The sweep requires every mutant to make the suite fail,
and the control run to pass. At the deployment of record that is 64 of 64
mutants killed against 162 tests.

A mutation sweep only holds the floors that were built. Before the final
deployment the contract was also read end to end by a fresh reader looking for
defects the suite could not see, which found five real ones. The blindness
defect described in `docs/consensus.md` was found later still, by reading a
live receipt node by node. Neither the suite nor the sweep had caught it,
which is the honest argument for doing both.
