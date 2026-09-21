# The state machine

Two machines, one nested in the other. A project holds parties and money; a
milestone holds terms, evidence and a decision. Every transition below is
enforced in `contracts/icarus.py` and has at least one test.

## A project

```text
  create_project
       │
       ▼
   PROPOSED ── accept_project (the installer) ──► ACTIVE
       │                                            │
       └──── cancel_project (the owner, before signing) ────┘
                            │
                            ▼
                        CANCELLED
```

A project can be cancelled only while it is still `PROPOSED`. Once the
installer has signed, it stands: the owner closes its milestones one at a
time rather than unwinding an agreement the other party has entered. Escrow that
no milestone has reserved can be withdrawn by the owner at any time; escrow a
milestone reserved is released when that milestone closes.

The inspector, if one is named, is a third party who must call
`accept_inspector_role` before they can file. Until they do, the project has
no independent witness, and the interface says so rather than leaving it
blank.

## A milestone

```text
          add_milestone (the owner, reserving its payment)
                          │
                          ▼
                  AWAITING_TERMS
                          │ accept_version (the installer)
                          ▼
                 AWAITING_EVIDENCE ◄──────────────┐
                          │                        │
                          │ request_assessment     │ evidence and
                          │ (the installer)        │ reassessment
                          ▼                        │
             ┌──── the panel reports ────┐         │
             ▼            ▼               ▼        │
         ACCEPTED     REJECTED      UNDETERMINED ──┘
             │            │               │
             │ open_appeal (the owner, inside the window, once)
             ▼
         APPEALED
             │ evidence period runs, then anyone:
             │   decide_appeal ──► ACCEPTED | REJECTED | UNDETERMINED
             │   lapse_appeal (three days later) ──► UNDETERMINED
             ▼
         ACCEPTED ── finalize (anyone, after the window) ──► FINALIZED
                                                                │
                                                          claim (the installer)

  close_milestone (anyone, once the deadline has passed) ──► CLOSED,
  releasing what it reserved to the owner's free escrow
```

## Who may move what

| Transition | Who | The condition the contract checks |
|---|---|---|
| `accept_version` | the installer | The version's own deadline has not passed, and it names the version being signed. |
| `propose_version` | the owner | The milestone is not finished, no decision stands, and the revision cap is not reached. |
| `submit_image`, `submit_document`, `submit_declaration` | a party | The milestone is not settled and no acceptance stands. A rejection or an undetermined finding is exactly where more is filed. |
| `request_assessment` | the installer | Not settled, accepted or appealed, the deadline stands, and under five assessments on this version. |
| `open_appeal` | the owner | A decision stands, it is appealable, it has not been contested, and its window has not closed. |
| `decide_appeal` | anyone | The appeal's evidence period has ended. |
| `lapse_appeal` | anyone | Three days have passed since the evidence period ended. |
| `finalize` | anyone | An acceptance stands and can no longer be contested. |
| `close_milestone` | anyone | Not settled, accepted or appealed, its deadline passed and any appeal window closed. |
| `claim` | anyone owed | Their ledger balance is above zero. |

## From an appeal to settlement

The part a reviewer found the interface had wrong, written out so it cannot
drift again. The contract keeps one `standing` record per milestone, and the
same field means different things at different moments:

| Moment | `state` | `standing.kind` | `appealable` | `appealed` | `window_ends` | `finalize` |
|---|---|---|---|---|---|---|
| An acceptance, inside its window | `ACCEPTED` | `ASSESSMENT` | true | false | a time ahead | refused: the window is open |
| The same, window passed | `ACCEPTED` | `ASSESSMENT` | true | false | a time past | **allowed** |
| The owner has appealed it | `APPEALED` | `ASSESSMENT` | true | **true** | unchanged | refused: no acceptance stands |
| A fresh panel upheld it | `ACCEPTED` | `APPEAL` | false | **false** | none | **allowed at once** |
| A fresh panel overturned it | `REJECTED` or `UNDETERMINED` | `APPEAL` | false | false | none | refused |
| Nobody decided the appeal in time | `UNDETERMINED` | `APPEAL_LAPSED` | false | true | none | refused |

`appealed` is set when an appeal OPENS and is cleared when one is decided, so
it is true while the question is open and false once it has been answered.
Reading it as "an appeal upheld this" gets both rows wrong: it offers to
settle an acceptance whose appeal is still open, and it never offers to
settle one an appeal has just confirmed, because that standing has no window
to wait for. The interface shipped with exactly that reading. It now derives
settlement from `state` and the window alone, the way `finalize()` does, and
reads where a milestone stands on appeal from `state` and `standing.kind`
(`appealStanding` in `web/lib/acts.ts`). `scripts/appeal-settlement.mjs`
proves it live by loading that same function and checking it against the
chain at each moment above.

Four of these are open to anyone on purpose. `finalize`, `decide_appeal`,
`lapse_appeal` and `close_milestone` cannot change an outcome, only carry out
one already reached or let a lapsed milestone go, so making them
permissionless means neither a payment nor a release waits on the goodwill of
the party it costs.

## Why the appeal lapses to undetermined

An appeal that no panel decides could reasonably leave the original decision
standing. It does not. An acceptance that was contested and never confirmed is
an acceptance nobody has been able to reproduce, so the milestone becomes
undetermined and nothing pays. The contract fails closed here, as it does
everywhere else that doubt is involved.

## What a round can and cannot change

A round that reaches a majority writes a decision, the findings behind it and
a snapshot of the evidence it judged. A round that reaches no majority writes
nothing at all: the milestone is exactly as it was, and the same call can be
made again against a fresh panel. That property is what makes retrying a
failed round safe, and the proof script relies on it.
