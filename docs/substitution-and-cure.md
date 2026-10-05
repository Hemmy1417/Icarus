# Substitution and cure

Two rules added in `icarus-rules-2`. Both exist because of what happens on a
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
| Unproven | The page does not name or document the model, has no answerable publisher, or lacks the figures | Refused; the line stands |
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

- **They do not verify a publisher.** Whether a page is the maker's, a
  seller's catalogue or nobody's is a model's judgment from the address and
  the content. Code checks only that the link is https, on a named public
  host, that a page came back and that it names the model. A convincing page
  on a look-alike domain is stopped by the validators or not at all.
- **They do not follow where a link leads.** The address shown to the model is
  the one the installer gave. A redirect from a reputable host to somebody
  else's content is not detected in code.
- **They do not pin the page.** The record keeps a digest and a length of
  what the leader read, for a later reader to compare. The page itself can
  change afterwards.
- **They do not rescue a late proposal.** A proposal settled after the work
  period has ended lapses. Making it early enough is the installer's risk.
- **They do not make a panel agree.** Stricter consensus means more rounds
  that record nothing. On this network that is measured, not assumed; see
  `docs/e2e-verification.md`.

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

One thing the installer has to mind: a cure rests on something filed since
the decision, and each party may file only so much against one version of
the terms. An installer who has used the whole allowance cannot cure.
