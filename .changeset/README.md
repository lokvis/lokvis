# Changesets

Changesets manage versions and changelogs for the `@lokvis/*` packages.

## Two release channels

| Channel  | Branch | npm dist-tag | Version format        | Install command                 |
| -------- | ------ | ------------ | --------------------- | ------------------------------- |
| stable   | `main` | `latest`     | `0.2.0`               | `npm i @lokvis/schema`          |
| beta     | `dev`  | `beta`       | `0.2.0-beta.0`        | `npm i @lokvis/schema@beta`     |

The `Release` GitHub Actions workflow auto-detects the channel by checking which
branch the tag commit lives on — no manual `--tag` flag needed.

## Stable release (main)

1. **Add a changeset** when making user-facing changes:

   ```bash
   pnpm changeset
   ```

2. **Version packages** — consume pending changesets, bump versions, update CHANGELOG:

   ```bash
   pnpm version-packages
   git add . && git commit -m "chore: version packages"
   ```

3. Merge to `main`, then tag and push:

   ```bash
   git tag v0.2.0 -m "Release v0.2.0"
   git push origin v0.2.0
   ```

   CI builds + runs `pnpm changeset publish --tag latest`.

## Beta release (dev)

Use beta releases for pre-release testing before merging to `main`.

1. **Enter prerelease mode** (creates `.changeset/pre.json`):

   ```bash
   pnpm changeset pre enter beta
   ```

2. **Add changesets** and **version** — versions bump to `0.2.0-beta.0`:

   ```bash
   pnpm changeset            # describe changes
   pnpm version-packages     # bumps to 0.2.0-beta.0
   git add . && git commit -m "chore: enter beta (0.2.0-beta.0)"
   ```

3. Tag on `dev` and push:

   ```bash
   git tag v0.2.0-beta.0 -m "Beta 0.2.0-beta.0"
   git push origin v0.2.0-beta.0
   ```

   CI detects `dev` → builds + runs `pnpm changeset publish --tag beta`.

   Users install with `npm i @lokvis/schema@beta`.

4. **Iterate** — repeat step 2-3 for additional betas (`0.2.0-beta.1`, …).

5. **Exit prerelease mode** when ready for stable:

   ```bash
   pnpm changeset pre exit
   pnpm version-packages     # final bump to 0.2.0
   git add . && git commit -m "chore: exit beta, release 0.2.0"
   ```

6. Merge `dev` → `main`, then tag and push as stable (see above).

## Notes

- Private apps (`@lokvis/web`, `@lokvis/playground`, `@lokvis/docs`) are ignored — never versioned or published.
- `access: "public"` is set so scoped packages publish as public.
- Internal `workspace:*` dependencies are bumped as `patch` when a dependency releases.
- Tags on branches other than `main`/`dev` are skipped (no publish).
- `NPM_TOKEN` secret must be configured in repo Settings → Secrets and variables → Actions.
