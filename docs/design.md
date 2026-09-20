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

## What this means for ICARUS specifically

- **The equipment schedule is the imagery.** Charts are this reference's
  visual language; here the equivalent is the schedule table, each line
  reading role, manufacturer, model and rating with its status set against
  it. It belongs on a white 20px data card, hairline separated, machine
  values in Inter.
- **The decision record is a printed report.** Ivory wash, PolySans 40px
  heading, the matched lines listed with what each one rested on.
- **Ember marks the finding, not the verdict.** An accepted milestone does
  not turn the page orange. Ember underlines the link to the decision and
  draws the one line on a chart that matters.
- **Undetermined is not a warning colour.** It is a sentence in Steel that
  says what was not established and what would establish it.
