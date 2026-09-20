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
       └──────── cancel_project (the owner) ────────┘
                            │
                            ▼
                        CANCELLED
```

A project can be cancelled only while nothing has settled on it. Escrow that
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
                          │ (a party)              │ reassessment
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

  close_milestone (the owner) ──► CLOSED, releasing what it reserved
```

## Who may move what

| Transition | Who | The condition the contract checks |
|---|---|---|
| `accept_version` | whichever party did not propose it | The version's own deadline has not passed. |
| `propose_version` | either party | The milestone is not finished, and the revision cap is not reached. |
| `submit_image`, `submit_document`, `submit_declaration` | a party | The milestone is open for evidence, or an appeal's evidence period is running. |
| `request_assessment` | a party | Open for evidence, the deadline stands, and under five assessments on this version. |
| `open_appeal` | the owner | A decision stands, it is appealable, it has not been contested, and its window has not closed. |
| `decide_appeal` | anyone | The appeal's evidence period has ended. |
| `lapse_appeal` | anyone | Three days have passed since the evidence period ended. |
| `finalize` | anyone | An acceptance stands and can no longer be contested. |
| `close_milestone` | the owner | The milestone has not settled. |
| `claim` | anyone owed | Their ledger balance is above zero. |

Three of these are open to anyone on purpose. `finalize`, `decide_appeal` and
`lapse_appeal` cannot change an outcome, only carry out one already reached,
so making them permissionless means a payment never waits on the goodwill of
the party who owes it.

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
