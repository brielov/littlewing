## What and why

<!-- What this changes, and the problem it solves. Link the issue: Fixes #123 -->

## Checklist

- [ ] `bun run test` passes, with tests for what changed
- [ ] `bun run fmt:check` and `bun run lint` pass
- [ ] A change to what a formula means updates `SPEC.md` and adds conformance cases in `packages/littlewing/conformance`
- [ ] A change to the API updates `HOST_API.md`, and is checked with `bun run build && bun run test:package`
- [ ] A change to what users read updates `README.md` or `LANGUAGE.md`, whose examples the tests run

<!-- A formula stored with 3.x keeps its meaning across 3.x. Say so here if this could change one. -->
