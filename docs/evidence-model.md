# The evidence model

What counts as evidence here, what only looks like it, and why the difference
is the product.

## Three kinds of item

| Kind | What it can do | What it cannot do |
|---|---|---|
| **Image** | Establish or refute a line, and satisfy a criterion. It is the only thing that witnesses the site. | Nothing, if the panel could not see it. |
| **Document** | State what was specified, ordered, claimed or inspected. An independent inspector's report can also witness the site. | A document written by the owner or the installer can neither establish a line nor refute one. |
| **Declaration** | Be recorded, and be read by anybody looking at the milestone. | Reach a panel at all. It is never put in front of one. |

## Why a datasheet does not pay

A datasheet naming exactly the right model is a statement about what was
specified. It is not a statement about what is bolted to that wall. The two
are different facts, and an escrow that treats them as the same fact pays for
paperwork.

So the contract enforces a floor in code, after the panel reports and before
the decision is derived: a line rated `INSTALLED` whose cited basis holds no
image is downgraded to doubt, whatever the panel said about it. The line is
still shown as the panel rated it, alongside what the contract did with it,
so a reader can see the downgrade rather than only its effect.

This was proved live rather than asserted. In the proof run a milestone was
filed with a photograph of the inverter and a datasheet reading
`Model name MOD 4000TL3-X`, matching the schedule exactly. It did not pay.

## Why the floor has a mirror

A floor that only stops false acceptances protects the owner and leaves the
installer exposed. So the same rule applies to adverse findings: a line cannot
be rated `ABSENT`, and a criterion cannot be rated `NOT_MET`, unless the basis
holds an image or the inspector's report. A party cannot file their own
document saying the work was not done and have that reject a milestone.

Both directions have a mutant in the sweep that must fail the suite, so
neither can be removed without a test noticing.

## Whose document it is

The panel is told who filed every item, and the distinction it is asked to
draw is not owner-versus-installer but **party versus independent**. The
inspector is named in the project and must accept the appointment before they
can file. Their report can witness the site. Either party's own paperwork is
that party's own account of their own performance, whichever party wrote it,
and it is labelled that way in the prompt.

## Claims, labelled as claims

An image carries a capture date and a place when the original file had them.
The contract records both, and the interface says they are the filer's claims
rather than something that was checked. Nothing in the decision rests on them.

The same is true of the line a filer offers an item for. It is their claim
about which part of the schedule the item answers, and the panel is told to
judge from the content instead.

## What the contract checks when an item is filed

| Check | Reason |
|---|---|
| The filer is a party, and the inspector has accepted the role | A stranger cannot put evidence on somebody else's record. |
| The milestone is open for evidence, or an appeal's evidence period is running | Evidence cannot be added to a decision after the fact. |
| The image is PNG or JFIF-headed JPEG, and at most 400,000 bytes | The runner's decoder reads nothing else, so anything else is evidence no panel could read. |
| A named equipment line or requirement exists in the terms in force | A filer cannot answer a line the contract does not have. |
| The party is within its quota | One party cannot bury a panel under its own filings. |
| An appeal admits only a small number of new items per party | An appeal is a re-judgment, not a second chance to file a fresh case. |

## Text is fenced

A caption and a document body are content written by a party, and both reach a
prompt. Each is wrapped in a fence and every sequence that could close that
fence early is defused, so a document cannot end its own block and continue in
the contract's voice. The forged closer is left visible rather than deleted,
so a reader can see the attempt. A test files a document that tries exactly
this and checks that the prompt still contains one opening and one closing
fence.
