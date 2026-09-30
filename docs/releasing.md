# Releasing rakitin

This document describes the release process, both automated (GitHub Actions)
and manual fallback.

## Versioning

Semantic Versioning:

- **MAJOR** — breaking changes (e.g. v1.x → v2.0.0).
- **MINOR** — backward-compatible features.
- **PATCH** — backward-compatible bug fixes.

Runtime support: Node.js **`^22.13.0 || >=23.5.0`** (the intersection of
`inquirer@14` and `yargs@18` engine ranges). The package is **CJS-only** — there
is no `dist/` build and no `build` script. Pre-releases use `vX.Y.Z-rc.N`
(never published under the stable tag flow).

## Pre-conditions

1. `development` is green: `npm run lint`, `npm run typecheck`, `npm test`,
   and the tree is clean (`git status --porcelain` empty — `npm test` must not
   mutate `package.json`/`package-lock.json`).
2. `CHANGELOG.md` has a completed `[Unreleased]` section moved to the new
   version entry.
3. `package.json` version bumped by the releasing maintainer.
4. `npm pack --dry-run` inspected — the tarball must contain `lib/**`
   (including `lib/templates/**`), `bin`, `types`, `rakitin.schema.json`,
   `docs`, `README.md`, `CHANGELOG.md`, `LICENSE`.

## Automated flow (GitHub Actions)

The `Release` workflow (`.github/workflows/release.yml`) publishes whenever a
tag `v*` is pushed to `main`:

1. Requires the **`NPM_TOKEN`** repository secret (npm access token with
   `publish` scope). Without it, the publish step fails safely.
2. Typecheck runs again as a publish gate (`prepublishOnly` → `npm run
   typecheck`).
3. `npm publish --provenance` (requires OIDC; enabled by default on GitHub
   for public repos).
4. A GitHub Release is created from the tag with auto-generated notes.

> **Workflow drift to fix:** `.github/workflows/release.yml` still runs
> `npm run build && npm run typecheck`, and it pins Node 20.x — both are stale
> for v3 (no `build` script; the engine floor is `^22.13.0 || >=23.5.0`).
> The workflow must drop the build step and move to Node 22.x before the next
> tag. `npm-publish.yml` has the same Node 20 pin.

### Steps (automated)

```bash
git checkout main && git pull
git tag v2.0.0
git push origin v2.0.0
```

Then verify:

```bash
npm view rakitin version          # => 2.0.0
gh release view v2.0.0
```

## Manual fallback

If the workflow is not configured (no `NPM_TOKEN`), publish from a machine
with npm auth:

```bash
npm publish                       # runs typecheck via prepublishOnly
gh release create v3.0.0 --generate-notes --title "rakitin v3.0.0"
```

## PR-based merge (feature → main)

1. Push the release branch: `git push origin development:release/vX.Y.Z`
2. Create the PR:
   ```bash
   gh pr create --base main --head release/vX.Y.Z \
     --title "release: rakitin vX.Y.Z" --body "See CHANGELOG.md"
   ```
3. Wait for CI: `gh pr checks --watch`.
4. Merge (maintains history — do not squash if tag parity matters):
   `gh pr merge --merge`
5. Tag & publish as above, then sync back:
   ```bash
   git checkout development && git merge main && git push
   ```

## Recommended branch protection (main)

Enable in **Settings → Branches → Add rule** for `main`:

- [x] Require status checks to pass (select: `test`, `lint`, `typecheck`, `smoke`)
- [x] Require branches to be up to date before merging
- [x] Require a pull request before merging (1 approving review; `CODEOWNERS` auto-requests `@Reinvy`)
- [x] Require signed commits
- [x] Do not allow bypassing the above settings

## Post-release checklist

- [ ] `npm view rakitin version` matches the tag
- [ ] GitHub Release page exists with notes
- [ ] `development` re-synced with `main`
- [ ] `CHANGELOG.md` `[Unreleased]` section reset/created
- [ ] Announce (issue/discussion) as appropriate