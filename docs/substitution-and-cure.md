# Substitution and cure

Two rules added in `icarus-rules-2`, and narrowed in `icarus-rules-3` and
`icarus-rules-4` as set out under "What changed in rules 3" and "What changed
in rules 4". Both exist because of what happens on a
real job after the terms are signed: the product on the schedule turns out
not to be the one that arrives, and a first assessment falls short for a
reason that can be put right.

Neither rule changes what pays. A milestone still pays whole, and only on a
decision in which a panel found every line of the schedule installed and
every criterion met.

## A substitute for one line

The installer may propose a different product for one line of the schedule.
A proposal names the line, the product, a public page that documents it, and
the reason the signed product cannot be fitted.

| What happens | On a line signed for one product | On a line signed "or equivalent" |
|---|---|---|
| The owner agrees, even after objecting | The substitute is in force | The substitute is in force |
| The owner says no | The proposal is declined and the line stands | The objection is recorded and the validators can be asked at once |
| The owner says nothing | After the project's window the proposal lapses | After a short objection period the validators can be asked |
| Anyone asks for a decision | Refused until the window has passed, then it lapses | The validators decide |
| The time for work on the terms ends first | It lapses | It lapses, and no panel is asked |

"Or equivalent" is a flag on a schedule line, signed by both parties with the
rest of the terms. Without it, only the owner's own yes changes the line and
silence is never agreement. With it, the question is no longer whether the
owner consents but whether the product is an equivalent, and that question
goes to the validators.

On such a line the owner has a short objection period: a quarter of the
project's window, and never more than ten minutes. Once the owner has
objected, or that period has passed, anyone can have the validators asked.

The period is short on purpose. An earlier draft made the validators wait
for the owner's whole window, and a reviewer showed what that cost: a
rejection at the deadline leaves one window to put it right, a silent owner
uses all of it, and the clause is worth nothing exactly when it is needed. A
second draft removed the wait altogether, and the next reviewer showed the
opposite cost: the installer could propose and decide in the same minute, so
the owner's objection reached the panel only at the installer's pleasure.
The period that is left is long enough to put an objection on record and too
short to run out anybody's time.

### What the validators are asked, and what code decides

Each validator fetches the page itself. Then:

1. **Code** checks that a page came back as text, and that it writes the
   proposed model out: the model's letters and digits as whole words in a
   row, however the page punctuates between them. A page that never names the
   model is settled here and no model is asked.
2. **A model** reads a window of the page around that place and answers five
   things: whether the page documents exactly that model and not a relative
   of it, who publishes the page, whether it is equipment of the same role,
   whether its own figures meet the ratings the signed line and the terms
   state for that equipment, and any shortfalls. How the unit is fitted is
   not its question: a product page cannot show that, and photographs judge
   it later.
3. **Code** rebuilds those answers field by field into known values and
   derives the verdict.

| Verdict | When | Effect |
|---|---|---|
| Unread | No page could be read as text | Nothing is recorded and the proposal stays open |
| Unproven | The page does not name or document the model, lacks the figures, or sits on no site the terms name and has no answerable publisher | Refused; the line stands |
| Not equivalent | Another kind of equipment, or the page's figures fall short | Refused; the line stands |
| Equivalent | Every one of the answers is a clear yes | Approved; the substitute is in force |

No panel is asked once the time for work on the terms has ended. A proposal
still open then lapses, because no round could judge the new product.

Only one path approves. An answer a model leaves out counts against.

A substitute is always measured against the line as signed, including when
an earlier substitute is already in force on it. The installer's stated
rating is treated as a claim; the figures come from the page.

What the installer types for a substitute is held to the rough shape of
what it is. The model is up to forty letters and digits with at least one of
each, and code checks the page for it. The maker is a name of up to four
words. The rating is figures with their units. Those shapes keep the three
short and plain. They do not make them safe: a reviewer fitted a sentence
into each. So wherever a model is shown them they sit inside a fence, as
text a party wrote, in the proposal and in the schedule every later panel
reads.

Consensus binds two things: whether the substitute is approved, and whether
the page was read at all. An approval stands only if the validator approves
on its own reading. A refusal stands only if the validator read the page as
well, so a proposal is never closed on a page only one node says it saw.

### What a substitute changes

A substitute comes into force only while a round can still judge it. One
settled after the time for work on the terms has ended lapses instead: a
line no panel will ever read is left as it was, and the standing decision
stays one the installer can appeal.

When a substitute comes into force over a decision that fell short, the
cure period runs a further window from that moment. Without that, an owner
could sit on a proposal and agree in the last second: the appeal would be
gone, because the decision was about another schedule, and the time to cure
would be gone with it. It happens once: no further substitute is proposed
after the moment the period would first have ended, so the period never ends
more than one window after that, and substituting back and forth buys
nothing.

A substitute in force replaces the product a line names, for every later
round on those terms. The line keeps its role, its quantity and whether its
nameplate must be legible. The signed terms are not rewritten, the evidence
already filed stays where it is, and every round records the schedule it
judged against.

While a proposal is open no round runs and no appeal opens: the schedule a
panel judges against must not be in question while it judges. The installer
can withdraw a proposal at any time to lift that.

## The cure round

A full assessment that falls short opens a cure period: the project's window
from the decision, or the rest of the time to the deadline if that is longer.
In it the installer can file more and ask for a cure round. No period opens
when it was the last round the terms allow.

A cure round keeps every line the standing decision found installed and
every criterion it found met, and judges only what was left open. It must
rest on at least one item filed after that decision.

| Rule | Why |
|---|---|
| Only findings a panel agreed are carried | See "What consensus now binds" below |
| A substitute in force since the decision reopens its line and every criterion | What was true of the old equipment is not thereby true of the new |
| A decision that found conflict, or rated any line contradicted, is cured with nothing kept: every line is judged again, on at least the evidence the terms require | Findings resting on evidence at odds with itself are not settled, so the round is a full reading |
| No cure follows an appeal that lapsed undecided | The decision it reviewed was never confirmed |
| Cure rounds and assessments share one allowance of five per version | A cure is not a way to ask without limit |
| A cure round never renews the cure period | Asking again is not a way to buy time. Only a substitute coming into force, or an appeal, moves the end of the work |

A cured decision can be appealed like any other. An appeal judges every line
again, on everything the chain of rounds read, so a line carried forward is
never beyond the owner's reach.

An appeal that takes an acceptance away from the installer opens a cure
period too, on the same conditions. An appeal the installer brought does
not.

### What consensus now binds

Before this ruleset a validator had to reproduce a decision and the findings
it rested on: every line for an acceptance, the failing lines for a
rejection. A finding that decided nothing was free to differ, because nothing
read it.

A cure round reads it. So for any decision that falls short, a validator now
has to reproduce every line the leader calls installed, every line it calls
absent, every criterion it calls met or unmet, and must not see a conflict
the leader does not report. Whether a line is contradicted binds as well,
both ways, because it decides whether a cure keeps anything. A leader
may assert less than a validator, never more. Only the shade of a doubt is
free to differ.

The cost is liveness. A borderline line that one node reads as installed and
another as unidentified now produces no record instead of a record left in
doubt, and the round has to be asked again.

## An appeal after a substitute

A decision about one schedule is not appealed against another. If a
substitute has come into force since the standing decision, an appeal is
refused and the way on is a cure round, for which a window is left as set
out above, or a new assessment while the deadline stands. The difference matters: an appeal's
acceptance is final, and it would be the first time any panel had judged the
new product. A cure round's acceptance can still be contested by the owner.

An appeal reads, from the installer, what the appealed decision rests on and
what was filed during the appeal's own evidence period. From the owner and
the inspector it reads everything on those terms, whenever filed, as every
round does.

## What these rules do not do

- **They do not verify a publisher unless the terms name the sites.** Where
  the terms list the sites both parties accept, a page elsewhere is refused
  in code and the question is closed. Where they list none, whether a page
  is the maker's, a seller's catalogue or nobody's is a model's judgment
  from the address and the content, and a convincing page on a look-alike
  domain is stopped by the validators or not at all.
- **They do not follow where a link leads.** The address shown to the model is
  the one the installer gave. A redirect from a reputable host to somebody
  else's content is not detected in code, and cannot be: the runtime follows
  it and hands back only the destination. That holds for a named site too:
  the parties who name one are trusting where its links lead, and trusting
  that the site itself decides what appears on it. Naming a site where
  anybody can post a page names everybody.
- **They do not tell a file nobody can read from a prompt that failed for
  another reason.** A prompt on the owner's or the inspector's image that
  the runtime refuses twice on one node is set aside by that node whatever
  the cause, a timeout included. A finding still needs a majority that
  reaches it on what each node read, so a legible photograph is lost only if
  most of the panel fails on it at once.
- **They do not stop every image that can cost a round its panel.** The
  stall that is closed is the file no decoder opens. An image that opens,
  from the owner or the inspector, and that draws from enough nodes, twice
  each, an answer that never says whether the image was read, still leaves
  those nodes unable to vote, and without a sighted majority nothing is
  recorded. The
  installer cannot leave such an image out. The ways out are the ones there
  were: ask again, and in the end the deadline or the appeal's lapse.
- **A cure does not reopen a line because of what a node set aside.** A line
  found installed while most of a panel had set the owner's image aside is
  kept by a cure like any other. The record of what was set aside is one
  node's report, so code does not act on it. The owner's appeal judges every
  line again and reads every item.
- **They do not pin the page.** The record keeps a digest and a length of
  what the leader read, for a later reader to compare. The page itself can
  change afterwards.
- **They do not rescue a late proposal.** A proposal settled after the work
  period has ended lapses. Making it early enough is the installer's risk.
- **They do not make a panel agree.** Stricter consensus means more rounds
  that record nothing. On this network that is measured, not assumed; see
  `docs/e2e-verification.md`.

## What changed in rules 3

Two limits stated above and in `docs/security.md` were narrowed.

**The sites the parties name.** Terms may carry `trusted_sources`: up to
eight public site names, signed with everything else. On a line signed "or
equivalent", a proposal whose page is not on one of them is refused before
anything is stored. A name covers that host and its `www` and nothing else
under it: a maker's forum or file store is a place where anybody may publish,
so parties who mean a subdomain name it. For a page that is, the
validators are told the publisher is settled, the verdict does not read
their answer to it, and the record shows the publisher as the parties'
choice. Everything else is judged as before: a named site does not make a
page document the model, be the same kind of equipment or meet the rating.
A line signed for one product is not bound by the list, because only the
owner's yes changes such a line and the owner can weigh any page. Terms
that name no site behave exactly as they did.

**An image nobody can read.** Before, any image a node could not read left
that node unable to vote, so one undecodable file from the owner stalled
every round on the milestone. Now only what the installer presents must
reach a node. An image the owner or the inspector filed is read in a prompt
of its own, and a node sets it aside when the node says outright that it
could not read it, or when the runtime refuses to run its prompt twice:
nothing that node finds may rest on it, and the round is decided on the
rest. A node whose answer about such an image comes back in the wrong shape,
or as no object at all, has failed itself, and does not vote.

Run on the network twice against a file with the outline of a JPEG and
nothing a decoder can use inside it, filed by the owner. Both rounds were
decided, which is what the rule is for. What the leading node did with the
file differed. On a disposable deployment it set the file aside. On the
deployment of record it did not: it described a cabinet of meters and
breakers that is not in the file, and cited that description for nothing.
That is the limit `docs/security.md` already states for a node handed the
wrong photograph, met in a new place: a model given nothing it can see will
sometimes describe something anyway. Such a description can ground a finding
on that node, and a finding still needs a majority that reaches it. See
`docs/substitution-cure-run.txt`. A file that is not built like an image is also
refused when it is filed, whoever files it.

What a round stores was tightened with it. The leader's account beside the
findings is rebuilt by the contract rather than stored as it came, and a
result the network hands back is checked again before it is recorded.

## What changed in rules 4

Three limits were left standing after rules 3. Two were narrowed. The third
was measured and cannot be closed in code.

**A file a decoder opens.** Rules 3 checked that a file had the outline of an
image. On the deployment of record a node then described a picture that was
not in a file with that outline. The contract now reads a file as far as a
decoder does before pixels begin. A PNG is checked whole: every chunk against
its checksum, the header for a depth and colour type that exist, and the
pixel data inflated and measured row by row against the size the header
declares, up to 64 MB. A JPEG is walked segment by segment: its quantisation
and Huffman tables must be well formed, its frame must describe an 8-bit
image of one, three or four components, and each scan must refer only to
components and tables the file defines. A file that fails is refused when it
is filed, whoever files it.

Measured against a real decoder on six thousand corrupted copies of real
photographs: none that the contract took was refused by the decoder. What it
does not read is the compressed picture inside a JPEG's scans, which a
decoder reads through even when it is noise. So a file that passes opens,
and a node that looks at noise sees noise. Whether a model then describes it
truthfully is the limit `docs/security.md` has always stated, and no check
on the file reaches it.

**An answer about one image.** An image from the owner or the inspector is
read in a prompt of its own. Under rules 3 an answer about it in a slightly
wrong shape left the node unable to vote. The answer is now read for what it
says: a row that left out its number, or the list around it, can only be
about the one image in the prompt. And an answer that does not say, for
every image, whether it was read is asked for once more before it costs the
node its vote. With two images in a prompt a row must still say which one it
describes. An answer that fails twice still blinds the node: the alternative
is to set a legible photograph aside, which review round one of rules 3
found and closed.

**Redirects.** Measured on the network with a throwaway contract: a fetch of
an address that redirects comes back with status 200 and the destination's
content, and nothing in the response names where it came from. The contract
already refuses any status but 200, so if the runtime returned the redirect
it would be refused; it does not. This limit stands, and it is the
runtime's to lift.

## How it was reviewed

The contract was read before deployment by a reviewer whose only job was to
break it, and again after each set of fixes.

| Round | Worst finding | What changed |
|---|---|---|
| 1 | A cure carried findings only the leader had asserted, and paid on them | Consensus binds every favourable finding |
| 2 | An appeal skipped owner evidence filed just before it opened, a hole made by a round-one fix | An appeal reads every owner and inspector item; the wait on the owner was removed rather than patched |
| 3 | Nothing that moved money. A contradicted line rested on the leader alone; a substitute's maker and rating could carry a sentence into later prompts; the owner could be left unheard | Contradiction binds in consensus; names are held to their shapes and quoted; a short objection period |
| 4 | Nothing that moved money. A sentence still fitted a substitute's maker and rating; an owner's late yes left the installer with neither an appeal nor a cure | The names are fenced as party text wherever a model reads them; a substitute comes into force only while it can be heard, and then leaves a window to cure |
| 5 | Nothing that moved money. The round-four fix missed decisions in conflict, which had no cure | The special case was removed: a decision in conflict is cured with nothing kept, so a cure exists whenever a decision falls short. The window a substitute adds is capped at one in all |

| 6 | Clean: nothing serious or medium. Four small points, among them that a second substitute could be agreed too late to cure | No second substitute is proposed inside the window the first one added; a cure that keeps nothing is held to the evidence the terms require |

Rounds three to five each found less than the one before, and each fix after
round two removed a rule or a special case rather than adding one. The small
changes made after round six were tested and swept, and not reviewed again.

Rules 3 was reviewed the same way, three times, before its deployment.

| Round | Worst finding | What changed |
|---|---|---|
| 1 | Nothing that moved money. An answer in the wrong shape set a legible photograph aside; a named site covered every address under it, forums included | An image is set aside only on a plain statement that it could not be read, or a prompt the runtime refuses twice; a name covers its own host and its www |
| 2 | Nothing that moved money. An answer that was no object at all still passed for a refused prompt; the docs did not say an image that opens can still cost a round its panel | The runtime's refusal and an unusable answer are told apart; the limit is stated |
| 3 | Clean: nothing serious or medium. Four small points | A validator reads sight exactly as the contract does; other parties' images are asked first; the stored account says nothing about an image set aside |

The small changes made after round three were tested and swept, and not
reviewed again. One thing no review could settle from the code was how the
network treats a file no decoder opens, so it was run: on a disposable
deployment first, and again on the deployment of record. The two runs did
not agree on what a node does with such a file, only that the round is
decided, and the note above says so.

One thing the installer has to mind: a cure rests on something filed since
the decision, and each party may file only so much against one version of
the terms. An installer who has used the whole allowance cannot cure.
