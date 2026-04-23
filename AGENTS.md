# AGENTS.md

This file is for agents working in this repository.

## Release workflow

Use the existing `bumpp`-based release flow for `littlewing`. Do not use `bun pm version`.

### Versioning rules

- `patch`: bug fixes, playground-only fixes, docs/build/CI/dependency cleanup, internal refactors with no public API change
- `minor`: new backward-compatible public API or user-visible language capability
- `major`: breaking API or language change

If the branch includes both patch- and minor-level changes, release a `minor`.

### Before cutting a release

Run from the repo root unless noted:

```bash
bun run fmt
bun run fmt:check
bun run lint
bun run test
bun run build
```

Notes:

- `fmt:check` is the first thing CI runs. If tooling was updated, especially `oxfmt`, run `bun run fmt` before releasing.
- The repo uses Bun workspaces with `linker = "hoisted"` in `bunfig.toml`.
- The publishable package is `packages/littlewing`.

### Commit + release procedure

1. Commit the actual work first with a normal conventional commit.
2. Cut the release from `packages/littlewing`.

Non-interactive examples:

```bash
# patch
cd packages/littlewing
bun x bumpp --release patch -y

# minor
cd packages/littlewing
bun x bumpp --release minor -y

# major
cd packages/littlewing
bun x bumpp --release major -y
```

What `bumpp` does here:

- updates `packages/littlewing/package.json`
- creates the release commit (`chore: release vX.Y.Z`)
- creates the tag (`vX.Y.Z`)
- pushes commit + tag

You can also use the package script if an interactive prompt is acceptable:

```bash
bun run --cwd packages/littlewing release
```

### After pushing a release

Watch the workflows:

- `CI` on `master`
- `CI` on the tag
- `Release` on the tag

Useful commands:

```bash
gh run list --limit 8
gh run watch <run-id> --exit-status
npm view littlewing version
```

Success criteria:

- `master` CI passes
- tag CI passes
- `Release` workflow passes
- `npm view littlewing version` shows the new version

### Failed release recovery

If a tag was pushed but publish did not complete, and npm still shows the old version:

- do **not** rewrite or delete the tag unless explicitly requested
- fix the issue on `master`
- cut the next `patch` release

Example: `v2.3.0` tag failed before publish, so the correct recovery was to fix the repo and release `v2.3.1`.

### Current workflow files

- CI: `.github/workflows/ci.yml`
- Release: `.github/workflows/release.yml`

### Current caveat

GitHub Actions currently emits a non-blocking warning that `actions/checkout@v4` and `actions/setup-node@v4` are on the Node 20 deprecation path. This does not block releases today, but the workflows should be updated before GitHub flips the default runtime.
