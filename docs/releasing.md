# Releasing rakitin

This document describes the release process, both automated (GitHub Actions)
and manual fallback.

## Versioning

Semantic Versioning:

- **MAJOR** — breaking changes (e.g. v1.x → v2.0.0).
- **MINOR** — backward-compatible features.
- **PATCH** — backward-compatible bug fixes.

Runtime support: Node.js **>=18** (inquirer v12 baseline). Pre-releases use
`vX.Y.Z-rc.N` (never published under the stable tag flow).

## Pre-conditions

1. `development` is green: `npm run lint`, `npm run typecheck`, `npm test`,
   `npm run build`.
2. `CHANGELOG.md` has a completed `[Unreleased]` section moved to the new
   version entry.
3. `package.json` version bumped by the releasing maintainer.
4. `npm pack --dry-run` inspected — confirm `rakitin.schema.json` and
   `dist/` artifacts are present.

## Automated flow (GitHub Actions)

The `Release` workflow (`.github/workflows/release.yml`) publishes whenever a
tag `v*` is pushed to `main`:

1. Requires the **`NPM_TOKEN`** repository secret (npm access token with
   `publish` scope). Without it, the publish step fails safely.
2. Build + typecheck run again as publish gates.
3. `npm publish --provenance` (requires OIDC; enabled by default on GitHub
   for public repos).
4. A GitHub Release is created from the tag with auto-generated notes.

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
npm publish                       # runs build + typecheck via prepublishOnly
gh release create v2.0.0 --generate-notes --title "rakitin v2.0.0"
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