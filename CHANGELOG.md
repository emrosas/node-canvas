# Changelog

## 0.2.1 (2026-10-07)

- The client view no longer shows an internal note's id. A `[[note]]` reference to a note a view leaves out renders as plain text, and in the client view only its display text. `check` warns about references to internal notes that have no display text.
- `check` stops on a link that no view can show, such as one from a client-only note to an internal note, and on an `audience` that is not `all`, `internal` or `client`.

## 0.2.0 (2026-10-07)

- `theme.logo` puts a project's own logo (SVG, PNG, JPG or WebP, next to `map.md`) in the top bar. Without one, maps show node-canvas's own mark instead of the Erre OS logo.
- `theme.ink`, `theme.paper` and `theme.logoColor` join `theme.accent`.
- "Needs attention" keeps its orange whatever the accent is.
- The internal build links to the client build from the top bar. `dev` links both ways (`/` and `/client`).

## 0.1.0 (2026-10-07)

First release. Markdown notes in, canvas HTML out: `check`, `build` and `dev` commands, internal and client builds, JSON Canvas export.
