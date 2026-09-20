# What running this on a real panel actually looks like

Measured on GenLayer Studio Next between 11:30 and 19:00 UTC on 20 September
2026, across twelve live proof runs. None of it is inferred from
documentation; every line here is something a node did, with the transaction
it did it in. It is recorded because a build that only reports the run that
worked is not reporting.

## The adjudication does what it was built to do

Read off the deployment of record, `0x38b195DF…7823`, in the run published as
`docs/proof-run.txt`.

| case | evidence | decision | the line |
|---|---|---|---|
| Flagship | the inverter on the wall, and its rating plate | ACCEPTED, and paid | `E1 INSTALLED` |
| Named on paper only | the same wall, plus a datasheet naming the model | UNDETERMINED | `E1 UNIDENTIFIED` |
| Wrong product | schedule says `MOD 10KTL3-X`, the plate reads `MOD 4000TL3-X` | REJECTED | `E1 ABSENT` |
| Battery in the schedule, none in evidence | inverter and plate only | UNDETERMINED | `E1 INSTALLED, E2 NOT_SHOWN` |
| Off-grid power room, a second site | one photograph of the room | ACCEPTED | all three lines |
| Contested acceptance | the owner appeals, a fresh panel judges again | ACCEPTED, upheld | `E1 INSTALLED` |

The second row is the point of the build. A document stating exactly the right
model, and the milestone did not pay, because no image showed the model on the
installed unit. A leader put the distinction plainly in an earlier run:

> the Growatt brand name is legible on the unit itself. However, the schedule
> line requires the nameplate to be legible and specifically identifies the
> model

## Six things the network does that no local test shows

**1. Blind leaders are common.** In most runs the first leader reported that
it could not process the images and was rotated out; the next leader read the
plate and the round carried. The rule that a node which cannot see the
evidence cannot vote for any outcome is doing heavy lifting on this network,
not theoretical work.

**2. A leader hallucinated a nameplate.** One reported an `SMA SUNNY
TRIPOWER 15000TL` where the plate reads `Growatt MOD 4000TL3-X`. It did not
carry: the majority landed on the correct reading. This is the argument for
consensus over a single reader, demonstrated rather than asserted.

**3. The runtime rejects an answer that is valid JSON followed by prose.**
`invalid nondeterministic response: invalid JSON: Extra data` arrives before
the contract sees the text, so a contract-side tolerant parser cannot save
it. The node loses its reading, and a node that cannot read cannot vote.

**4. Rounds can fail for want of readers rather than want of agreement.** A
readjudication went to four rotations and recorded nothing. Read node by node,
its receipt says why: in the first rotation all three validators reported that
they did not receive the images, in the third two of them did, and in the
fourth the leader itself was blind and the validators disagreed for that
reason. The leaders that could see ran on `gemini-3-flash-preview` and
`gpt-5.4`; the validators that could not ran on `policy:dev-mistral`,
`policy:dev-gpt-oss` and `policy:dev-deepseek`. This is the rule working
rather than failing: no decision is recorded by a panel that could not look at
the photographs. The cost is that a round sometimes reaches no majority at
all. Nothing is written when that happens and the milestone is untouched, so
asking again is safe and draws a fresh panel; the proof script asks up to
three times and reports every attempt that failed. If no panel decides an
appeal within three days of its evidence period, `lapse_appeal` closes it and
the milestone is undetermined, because an acceptance that was contested and
never confirmed should not pay.

**5. A legible-nameplate requirement sits at the edge of what a model-diverse
panel will agree on.** In the one rotation of that readjudication where every
validator did receive the images, they still split three ways: the leader read
`MOD 4000TL3-X` off the side label and rated the line INSTALLED, two
validators reported that the unit could not be identified and rated it
UNIDENTIFIED, and one rated it ABSENT. The same milestone had been accepted on
its first assessment minutes earlier. Nothing about the evidence changed
between the two readings; what changed was which models were drawn. The
strictest line in the schedule, the one that asks for a model number to be
legible in a photograph, is also the line where raw vision quality decides the
vote.

**6. A node can receive the wrong image and describe it.** In one run every
leader accepted and every validator disagreed, reporting that the images were
"placeholders" or showed "an inverter cabinet mounted outdoors". In the
published run a validator reported "a cylindrical tank" and a label reading
`GSW-250, Therma-Stor`, a water heater component, where the rest of the panel
read a Growatt inverter; it was outvoted and the round carried correctly.
Such a node is not blind by its own account, so the blindness check cannot
catch it. The contract still fails closed, and consensus is what catches it,
not the check. **This is a real hole and it is stated here rather than
hidden.**

## The blindness rule was failing open, and how that was found

This is the defect worth reading, because nothing in the test suite or the
mutation sweep found it. It was found by reading a live receipt node by node.

A node reports whether it could see each image in a structured field. The
contract read that field with `bool(row.get("readable", True))`: **defaulting
to true when a model omitted it**. The prompt, meanwhile, never said what the
field meant or when to set it false.

On this network a validator that received no image answered `readable: true`
and used the *description* field to say so, in prose:

> No image has actually been provided in this conversation; only a text
> prompt was submitted

The contract counted that node as a sighted reader. The blindness rule, which
is one of the three this product rests on, depended on a model remembering a
field it had never been told about.

The effect was not a wrongful payment, because a blind node cannot produce a
nameplate reading. It biases the other way, toward wrongful denial: blind
nodes voting "not shown" can outvote sighted ones. Worse for the build's own
claims, the paper-only case on the previous deployment reached the right
outcome for the wrong reason, because the panel never saw the photograph at
all. The headline demonstration was hollow.

The flag now defaults to false, the prompt defines it and forbids reporting a
missing image in prose, and an empty description is not a reading either.
Three tests and two mutants hold it. On the deployment of record the
paper-only case reads `read 1 of 1 images` and finds `E1 UNIDENTIFIED`: a
panel that genuinely looked, could not identify the model from the
photograph, and was not rescued by a datasheet naming it exactly.

The proof script was changed too. Cases that turn on what a photograph shows
now assert the panel actually read the evidence, and ask again if it did not,
so a blind panel can never again be reported as proof of the rule.

## What a run costs

A write finalizes in roughly 35 to 50 seconds. An assessment, which reads
images two at a time and then judges, takes 60 to 100 seconds when it carries
on the first leader and several minutes when it rotates. A full proof run of
six projects, seven rounds, five refusal walls, an appeal and a settlement is
about 50 minutes of wall clock, most of it waiting on consensus and on the
ten-minute appeal windows the demonstration uses. Under load the node answers
`Server busy: all 8 execution slots occupied, retry later`, which the read
layer and the scripts both treat as transient.

The published run needed no retries: every round reached a majority on its
first asking.

## Images

Measured: at most two images per prompt, and the runner's decoder reads PNG
and JFIF-headed JPEG only. The photographs are normalized by inserting a JFIF
segment rather than re-encoding, so the bytes a validator judges are the
photographer's own pixels. The contract caps an image at 400,000 bytes and
computes the digest itself.
