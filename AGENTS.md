# Agent notes

- Read `docs/adr/` before changing how maps are built, shipped or installed. Those decisions are deliberate.
- To write or edit a map, read `FORMAT.md` first. Edit the Markdown notes, never the built HTML.
- Run `node bin/node-canvas.mjs check <map-dir>` after every change and fix every error before building.
- The viewer (`src/viewer/`) must stay dependency-free plain JavaScript and CSS. It is inlined into every built map.
- Visual tokens follow the Erre OS look: DM Sans and DM Mono, orange accent `#e85102`, ink `#1d1c1b`, 0.5px hairlines at 15% ink. A map can override the accent with `theme.accent`.
- Run `pnpm test` after changing `src/`. Note user-visible changes in `CHANGELOG.md` and bump the version in `package.json`, then tag the release `vX.Y.Z`.
- Prose in notes and docs: plain words, no em dashes, sentence-case headings.

## Agent skills

### Issue tracker

Issues live in GitHub Issues on `emrosas/node-canvas`, via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one root `GLOSSARY.md` plus `docs/adr/`. See `docs/agents/domain.md`.
