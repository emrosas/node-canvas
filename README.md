# node-canvas

A map tool by Erick Mireles, in the Erre look. MIT licensed. A folder of Markdown notes becomes one HTML file: a dotted canvas you can pan and zoom, with cards in columns and rows, links between them, and a slide-over panel for each card's detail.

Not related to [Automattic/node-canvas](https://github.com/Automattic/node-canvas), the Cairo drawing library. This one draws maps from Markdown.

The notes are the source. Agents read and edit the Markdown. People open the HTML. Nothing about a map lives only in the HTML.

We use it for anything that is easier to see than to read:

- a customer journey, from first contact to closed job
- a website's pages and their sections
- what a build needs, what is done, and what waits on the client

## Use it in a project

It is not on npm. Install it straight from GitHub as a dev dependency, pinned to a release tag:

```sh
pnpm add -D github:emrosas/node-canvas#v0.1.0
```

Or copy this repo into your project. It has two dependencies (`yaml` and `marked`) and no build step.

Then add scripts for each map:

```json
{
  "scripts": {
    "maps:check": "node-canvas check docs/maps/customer-journey",
    "maps:build": "node-canvas build docs/maps/customer-journey",
    "maps:dev": "node-canvas dev docs/maps/customer-journey"
  }
}
```

- `check` validates notes and links. Run it after every edit.
- `build` writes `<map>.html` (internal) and `<map>.client.html` (for the client). Add `--canvas` for a JSON Canvas file that opens in Obsidian, `--json` for the resolved graph.
- `dev` serves the map with live reload. The internal view is at `/`, the client view at `/client`.

Commit the notes and both HTML files together.

To take a newer release, change the tag: `pnpm add -D github:emrosas/node-canvas#v0.2.0`.

The built HTML is one file with no server. It loads DM Sans and DM Mono from Google Fonts and falls back to system fonts offline.

## Working on the engine

```sh
pnpm install
pnpm test
pnpm example     # http://localhost:4321
```

To try an unreleased change in another project, point that project at your checkout for a while and switch back to a tag before you commit:

```sh
pnpm add -D link:../node-canvas                      # never commit this
pnpm add -D github:emrosas/node-canvas#v0.1.0         # back to a release
```

Releasing: bump `version` in `package.json`, add a line to `CHANGELOG.md`, commit, then `git tag vX.Y.Z && git push --tags`.

## What the canvas does

- Drag or scroll to pan. Pinch, or hold Ctrl or Cmd and scroll, to zoom. `F` fits the map, `+` and `-` zoom.
- Column and row headers stay on screen while you pan.
- The switch at the top recolors every card by a different facet, for example "what the client approved" versus "what is built".
- Click a legend entry to hide that value. "Needs attention" shows only cards with open items.
- `/` searches titles and note text. Enter opens the first match.
- Click a card to open its panel. Hovering or selecting a card lights its links and fades the rest.
- Every card has a link: `#n=<id>` opens it directly. `#f=<facet>` picks the coloring.
- The top-right switch jumps between the internal and client views. They are separate files (`<map>.html` and `<map>.client.html`), and only the internal one links to the other.
- Put your client's logo in the top bar with `theme.logo` in `map.md`. Without it, the map shows node-canvas's own mark.

## Format

See [FORMAT.md](FORMAT.md). It is short, and it is what agents should read before writing a map.

## Layout of this package

```
bin/node-canvas.mjs    CLI: check, build, dev
src/load.mjs           reads and validates a map folder
src/render.mjs         Markdown to HTML, audience filtering, JSON Canvas export
src/dev.mjs            dev server with live reload
src/viewer/            the canvas itself: template, CSS and plain JavaScript, inlined at build
src/index.mjs          programmatic API
examples/              small maps that show the format (not installed)
test/                  node --test (not installed)
docs/adr/              why it is built this way
```

The viewer has no framework and no dependencies, so the HTML stays small and keeps working for years. Build-time dependencies are `yaml` and `marked`.

## Status

Version 0.1.0, built for the Granite South customer journey (October 2026).

Not built yet:

- comments from clients on a card
- a minimap
- automatic layout for maps without a grid
- a dark theme
