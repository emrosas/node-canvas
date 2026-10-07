# Map format

A map is a folder of Markdown files. `map.md` sets up the canvas. Every other `.md` file in the folder, at any depth, is one note: one card on the canvas. `README.md`, `AGENTS.md` and `CLAUDE.md` are skipped, so a map folder can explain itself.

Subfolders are only for people. The loader ignores folder names, so group notes however you like (by row, by page, by team).

```
my-map/
  map.md
  customer/finds-us.md
  customer/signs.md
  records/lead.md
```

Run `node-canvas check my-map` after every edit. It reports bad ids, unknown columns and rows, facet values that are not in the list, and links that point nowhere.

## map.md

YAML frontmatter, then a Markdown body. The body shows in the "About this map" panel (click the logo).

```yaml
---
title: Customer journey            # shown in the top bar
subtitle: One line under the title in the About panel.
client: Granite South              # shown in the top bar
updated: 2026-10-07
defaultFacet: spec                 # which facet colors the cards on load

columns:                           # left to right
  - id: lead
    title: Lead
    description: Shown as a tooltip on the column header.
rows:                              # top to bottom
  - id: sales
    title: Sales

facets:                            # ways to color the cards
  - id: spec
    title: Brad's spec
    description: Shown in the About panel.
    values:
      - id: locked
        label: LOCKED
        color: green
        description: Shown in the legend tooltip and the About panel.

edgeKinds:                         # optional; these merge over the defaults
  data:
    label: Creates or carries a record
    style: dashed                  # solid | dashed | dotted
    color: blue
    show: focus                    # always (default) | focus: only when a linked card is hovered or selected

theme:
  accent: "#e85102"                # optional brand color
---
```

Without `columns` and `rows`, the canvas is freeform and every note needs `x` and `y` in pixels.

**Colors** are `green`, `teal`, `blue`, `violet`, `amber`, `orange`, `red`, `gray`, `ink`, or any hex value.

**Default facet.** If `facets` is missing, the map gets one facet, `status`, with `done`, `doing`, `planned`, `blocked` and `unknown`.

**Default link kinds** are `flow` (solid ink, the default), `data` (dashed blue), `gap` (dashed red) and `planned` (dotted gray).

## A note

```markdown
---
id: lead                     # optional; defaults to the file name
title: Lead
kind: Record                 # small label above the title
summary: New, contacted, converted or lost.   # one line on the card
column: lead                 # grid maps: a column id from map.md
row: records                 # grid maps: a row id from map.md
order: 2                     # optional; stacking order inside a cell
spec: none                   # one key per facet id, holding a value id
build: built
attention:                   # optional; anything listed here flags the card
  - Calculator answers stay behind when the lead converts
links:
  - { to: customer-rec, kind: data, label: Converts into }
  - to: job
    kind: gap
    label: Calculator answers do not carry over
    note: Longer text shown under the link in the panel.
sources:                     # optional; listed at the bottom of the panel
  - CRM.md v1.1, purpose
audience: all                # all (default) | internal | client
---

The body is Markdown and shows in the slide-over panel.

Link to another note with [[job]] or [[job|custom text]].

:::internal
Only in the internal build. Use this for code paths, people's names, anything the client should not see.
:::

:::question
Renders as a blue question box. Use it for what you need the client to answer.
:::

:::conflict Optional title
Renders as a red box. Use it when two sources disagree.
:::
```

Any `:::name` block becomes a box with the class `callout-name`. Only `internal` is removed from the client build.

## Audiences

`node-canvas build` writes two files:

- `<map>.html`, the internal view, with every note, internal blocks and file paths.
- `<map>.client.html`, the client view. It drops notes marked `audience: internal`, every `:::internal` block, and the file paths.

Mark a note `audience: client` to show it only in the client view.

## Writing notes that work for both readers

- One note, one thing. If a card needs two status values in one facet, split it.
- Put the decision you need in `attention`, phrased so the client can answer it. Explain it in a `:::question` block in the body.
- Keep `summary` under about 70 characters. It is what people read when zoomed out.
- Cite where a fact came from in `sources`. People trust a map they can check.
- Link sparingly. Cards with many links turn the canvas into a hairball. Use `show: focus` on secondary link kinds.
