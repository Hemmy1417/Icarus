# How consensus is reached

A milestone is judged inside `gl.vm.run_nondet`. A leader does the work and
proposes a result; every validator does the same work on its own and votes
only on whether the leader's result is one it can stand behind. What follows
is what "the same work" means and where a validator refuses.

## Two prompts, in order, and why

**First, look.** Each node is given the images, two at a time because the
runtime accepts no more per prompt, and asked only to describe what is
visible, transcribe any text it can read on a label, and flag anything that
would matter to somebody deciding whether work was done.

This prompt is deliberately **blind to the schedule**. A node that has been
told the contract expects a `Growatt MOD 4000TL3-X` is a node that has been
told what to see. Because it does not know, the transcription it produces is
a reading of the photograph rather than a confirmation of an expectation, and
the transcription is kept in the round so a reader can see what each node
actually read.

**Then, judge.** The node is given its own reading back, the schedule, the
criteria and the text of every document, and asked to rate each line and each
criterion. It is never asked whether the milestone should pay.

Each prompt is attempted twice. Measured on this network, a node's answer is
sometimes rejected by the runtime before the contract sees it, and a route
sometimes delivers no image at all; a second attempt recovers most of those,
and a node that still cannot read is treated as blind.

## Where a validator disagrees

A validator repeats the whole reading and the whole judgment, then compares
consequences rather than words. It disagrees when:

| Condition | Why it matters |
|---|---|
| Its own findings would give a different decision | The decision is the consequence. Differing wording that gives the same decision is not disagreement. |
| The leader could not see the images | A node that cannot see the evidence must not decide it, and a validator will not endorse one that did. |
| It could not see the images itself | It cannot check the leader's work, so it withholds its endorsement rather than guessing. |
| The leader's grounds do not hold | A line the leader rated on a basis that cannot carry that finding, or a line it did not rate at all. |
| The leader reports a conflict the validator cannot see | A conflict undetermines a milestone, so an unreproduced one is a way to withhold a payment. |
| The leader withholds an acceptance the validator would grant | The mirror of the above. An asymmetric floor protects one party only. |

Each of these prints its reason to the round's output, so a disagreement on
the explorer says which of them fired.

## What the code does after the panel reports

The panel's findings are not the decision. Three deterministic steps run
between them:

1. **Grounding.** Each line and each criterion is checked against the items
   the node cited as its basis. A line rated `INSTALLED` whose basis holds no
   image is downgraded to doubt; so is a line rated `ABSENT` or a criterion
   rated `MET` or `NOT_MET` whose basis holds neither an image nor the
   inspector's report. The floor applies in both directions, so it cannot
   favour either party.
2. **Derivation.** A conflict gives `UNDETERMINED`. Otherwise any line
   `ABSENT` or criterion `NOT_MET` gives `REJECTED`; any remaining doubt
   gives `UNDETERMINED`; everything shown and met gives `ACCEPTED`.
3. **Quality.** A separate label, derived the same way, records how
   conclusive the evidence was, for the receipt.

Because all three are ordinary code, the same findings always give the same
decision, and a leader cannot record an outcome its own findings do not
support.

## Blindness

A node counts as a reader only when it says, in the structured field, that an
image reached it and it could see it, and describes what it saw. Both halves
matter and both were learned the hard way.

The flag used to default to true when a model omitted it, and the prompt never
said what the flag meant. On this network a validator that received no image
answered `readable: true` and used the description field to explain that
nothing had arrived, so the contract counted a blind node as a reader. The
flag now defaults to false, the prompt defines it, and it forbids reporting an
absent image in prose. An empty description is not a reading either.

This is the rule that makes a round fail rather than decide wrongly, and on
this network it fires often. `docs/PROBE-REPORT.md` measures how often.

## What consensus does not fix

A node handed a different image will describe that image rather than report
itself unable to read. The blindness check cannot catch that, because the node
is not blind by its own account. Only a diverse panel catches it, and in the
proof runs it did: a node that reported a cylindrical tank and a water heater
label where the others read a Growatt inverter was outvoted, and the round
carried on the correct reading.

A legible nameplate is also close to the edge of what a model-diverse panel
agrees on. When it splits, no majority is reached, nothing is recorded, and
the milestone is untouched, so the round can simply be asked again.
