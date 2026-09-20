# The interface

ICARUS is dressed as an **editorial data observatory on warm paper**: a single
orange ember punctuating monochrome precision. The reference was supplied by
the project owner; this file is the contract the pages are built against, so
that a change of mind changes one file rather than forty components.

The register is deliberate. A milestone's terms are an equipment schedule and
a decision is a record of what was matched against it, so the interface reads
like a printed report with live figures in it, not like a console.

## Palette

| Token | Value | Where it is allowed |
|---|---|---|
| `--color-graphite` | `#202020` | All primary text, headings, nav, icon strokes, and the one filled button |
| `--color-canvas-white` | `#ffffff` | Page background and data cards |
| `--color-ash` | `#efefef` | Section bands, featured cards, the nav pill |
| `--color-fog` | `#f5f5f5` | Nested surfaces inside a card |
| `--color-ivory` | `#ebe6dd` | Warm wash for an editorial block: the paper stock |
| `--color-steel` | `#4d4d4d` | Body copy |
| `--color-slate` | `#828282` | Helper text and inactive controls |
| `--color-mist` | `#e8e8e8` | Hairlines |
| `--color-ember-orange` | `#ff682c` | Accent only: link underlines, a chart stroke, a small mark. **Never a button fill.** |
| `--color-brass` | `#816729` | Second accent: a chart's other stroke, a tag's text |

Pages read 95 per cent achromatic. Status is carried by words and position,
not by a palette of greens and reds, which is the discipline this reference
asks for and which suits a record whose outcomes are accepted, rejected and
undetermined rather than good and bad.

## Type

- **PolySans at weight 400 only**, for headings, nav items and button labels,
  with `-0.02em` tracking on every one. Substitute **Space Grotesk 400**.
  Never 500, never 600, never bold. The whisper weight is the signature.
- **Inter** for body copy, labels, captions and every machine value. 400 for
  paragraphs, 500 for UI labels.
- Scale: caption 14/1.43, subheading 18/1.25, heading 32/1.19/-0.64px,
  heading-lg 40/1.2/-0.8px, display 66/0.91/-1.32px.

## Shape

Three radii, and the contrast between them is the point:

- buttons **0px**
- featured cards **6px 0px 0px** (soft top-left, sharp everywhere else)
- data cards **20px**, plain cards **8px**, tags **20px**
- nav pill **200px**

**No shadows anywhere.** Depth is surface contrast: white, ash, fog, ivory.

## Layout

1200px column, 80px between sections, 40px card padding, 20px element gap.
Sections alternate white and ash. The header is a floating ash pill centred,
the wordmark left, a graphite button right.

## The shape of a page

The reference fixes the palette, the type and the radii. It does not fix the
architecture, and the first attempt borrowed one rather than finding this
product's own. What is built now:

- **The cover states one thing.** A held statement at display size, then a
  horizontal rail of live cases carrying their verdicts, and nothing else.
  Everything that explains rather than shows lives on the explainer.
- **A case is a sheet, not a stack.** The verdict is the first and largest
  object on the page. Under it the equipment schedule stands as a pinned
  index, one row per line, and selecting a row swaps the pane beside it, so a
  finding and the photographs it rests on are read together rather than a
  thousand pixels apart. This is the reference's idea that charts are the
  imagery, applied to a product whose chart is a schedule.
- **The record is an index.** Rows, not cards: site and title on the left,
  verdict on the right, the verdict underlined in ember on hover.
- **The explainer is two columns.** A rule in display type, its explanation
  beside it. Four rules and four limits, because a page that prints only the
  rules is marketing.

## No machine value reaches a page

Identifiers, addresses and digests never appear in reading flow. This needed
more than deleting them, because a panel writes in the record's own
vocabulary: it cites items as `ev-000001` and schedule lines as `E1`, since
that is what it was shown, and those sentences are quoted on the case sheet.

`writeOut` in `lib/present.ts` substitutes the words the reader already has
in front of them, and recapitalises a sentence where a substitution reopened
one. It refuses two things: altering the panel's wording, which would be
editing the record rather than presenting it, and lowercasing a model number
to fit a sentence, since the model is the thing the schedule is about.

`/verify` is the single exception, and even there the values sit behind a
disclosure: the page states in words what can be checked, and hands over the
addresses and digests to the reader who opens it.

## What else this means for ICARUS

- **Ember marks the finding, not the verdict.** An accepted milestone does
  not turn the page orange. Ember underlines the line that actually decided
  the outcome, and the one link that matters.
- **Undetermined is not a warning colour.** It is a sentence in Steel that
  says what was not established.
- **The wallet address is not page furniture.** The header button says
  connected; the account it will sign as is inside the dropdown, where
  somebody has asked.
