# What running this on a real panel actually looks like

Measured on GenLayer Studio Next between 12:30 and 17:00 UTC on 20 September
2026, across eight live proof runs of the same four cases. None of it is
inferred from documentation; every line here is something a node did, with
the transaction it did it in. It is recorded because a build that only
reports the run that worked is not reporting.

## The adjudication does what it was built to do

| case | evidence | decision | the line |
|---|---|---|---|
| Flagship | the inverter on the wall, and its rating plate | ACCEPTED | `E1 INSTALLED` |
| Named on paper only | the same wall, plus a datasheet naming the model | UNDETERMINED | `E1 UNIDENTIFIED` |
| Wrong product | schedule says `MOD 10KTL3-X`, the plate reads `MOD 4000TL3-X` | REJECTED | `E1 ABSENT` |
| Battery in the schedule, none in evidence | inverter and plate only | UNDETERMINED | `E2 NOT_SHOWN` |
| Off-grid power room, a second site | one photograph of the room | ACCEPTED | all three lines |

The second row is the point of the build. A leader put it plainly:

> the Growatt brand name is legible on the unit itself. However, the schedule
> line requires the nameplate to be legible and specifically identifies the
> model

A document stating exactly the right model, and the milestone did not pay,
because no image showed the model on the installed unit.

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
rather than failing: a node that cannot see the evidence votes against every
outcome, so no decision is recorded by a panel that could not look at the
photographs. The cost is that a round sometimes reaches no majority at all.
Nothing is written when that happens and the milestone is untouched, so asking
again is safe and draws a fresh panel; the proof script asks up to three times
and reports every attempt that failed. If no panel decides an appeal within
three days of its evidence period, `lapse_appeal` closes it and the milestone
is undetermined, because an acceptance that was contested and never confirmed
should not pay.

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

**6. A node can receive a placeholder and describe it.** In one run every
leader accepted and every validator disagreed, reporting that the images were
"placeholders" or showed "an inverter cabinet mounted outdoors". They were
not blind by their own account, so `images_received`, which is derived from
the model's self-report, did not catch it. The contract still failed closed:
no majority, nothing written. But the guard has a hole, and it is stated here
rather than hidden: **a node that is handed the wrong image will describe the
wrong image rather than report itself unable to read.** Consensus is what
catches that, not the blindness check.

## What a run costs

A write finalizes in roughly 35 to 45 seconds. An assessment, which reads
images two at a time and then judges, takes 60 to 165 seconds when it carries
on the first leader and several minutes when it rotates. A full proof run of
six projects, five rounds, five refusal walls, an appeal and a settlement is
about 35 minutes of wall clock, most of it waiting on consensus and on the
ten-minute appeal windows the demonstration uses.

## Images

Measured: at most two images per prompt, and the runner's decoder reads PNG
and JFIF-headed JPEG only. The photographs are normalized by inserting a JFIF
segment rather than re-encoding, so the bytes a validator judges are the
photographer's own pixels. The contract caps an image at 400,000 bytes and
computes the digest itself.
