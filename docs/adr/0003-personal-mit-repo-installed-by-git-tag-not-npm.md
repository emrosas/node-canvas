# A personal MIT repo, installed by git tag, not published to npm

node-canvas started inside a client repo (Granite South), was briefly moved into Erre Agency's ERRE monorepo to publish as `@erre/canvas` on npm, and was then pulled out on 2026-10-07: Erick owns it personally, keeps it open source, and wants to change it without a publishing pipeline. Projects install it with `pnpm add -D github:emrosas/node-canvas#vX.Y.Z` (the lockfile pins the commit) or copy the repo in. A release is a version bump, a CHANGELOG line and a `vX.Y.Z` tag. Do not add npm publishing or move it back into ERRE without revisiting this.

## Consequences

- Projects only move to a new version when someone changes the tag there.
- The repo must stay public, or every consumer install (including Vercel builds) needs a token.
- The name collides with Automattic's node-canvas, the Cairo drawing library. The README says so. Accepted because the package is never published to npm, where the collision would matter.
