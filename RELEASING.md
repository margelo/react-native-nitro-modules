# Releasing React Native Nitro Modules

Start releases in [margelo/nitro](https://github.com/margelo/nitro). Until `core-split` is merged, run `bun release VERSION` there. After the merge, you can also choose the exact version in its **Release Nitro** GitHub Actions workflow. Nitro publishes `nitro-core` and `nitrogen`, then completes its GitHub release. This repository picks up that release and publishes `react-native-nitro-modules` at the same version.

All three packages share a release version. To release a wrapper-only change, such as a podspec fix, start a patch release in Nitro. The wrapper has no independent version bump.

## One-time setup

In the npm settings for `react-native-nitro-modules`, configure a GitHub Actions trusted publisher:

- Organization or user: `margelo`
- Repository: `react-native-nitro-modules`
- Workflow filename: `release.yml`
- Environment: leave empty
- Allow npm publish: enabled
- Allow npm dist-tag: not needed

The core packages need their own trusted publishers for `margelo/nitro` and `release.yml`. See Nitro's [release instructions](https://github.com/margelo/nitro/blob/core-split/RELEASING.md). The workflows use npm OIDC and do not need an npm token.

For the immediate trigger, install the existing **Nitro Modules Bot** GitHub App on this repository with **Actions: read and write** permission. Nitro uses its existing App credentials to create a short-lived token scoped to this repository and dispatch the workflow with the completed core tag. No personal access token or App private key is stored here. See the core release instructions for the variable and secret names.

Keep this workflow on `main`, the repository's default branch, so GitHub runs its schedule. Repository rules must allow its `GITHUB_TOKEN` to push the release commit to `main`, create `vVERSION`, and create GitHub releases. Release commits use `Marc Rousavy <me@mrousavy.com>`. Check branch and tag rules before the first release. If a rule rejects the push, the workflow stops before publishing.

`0.37.1` already exists on npm. The first release after the split must use a newer version.

## Automatic adoption

After publishing both core npm packages and completing its GitHub release, Nitro directly dispatches this repository's **Release** workflow on `main` with the exact `core-tag`. An hourly check recovers missed or failed notifications. GitHub can delay scheduled jobs. Both paths include prereleases and only consider releases with the `nitro-release.json` manifest produced by the coordinated core release workflow. Historical Nitro tags do not trigger it.

The scheduled check processes the oldest pending regular release, including manually chosen prereleases such as beta or RC versions. Once those are complete, it processes the newest pending nightly. A direct trigger selects its exact tag, but cannot skip an earlier pending regular release. A failed older nightly does not block newer commits or regular releases. Earlier nightlies can be backfilled when no newer version is waiting. Duplicate requests reuse existing releases and verify already-published packages. For each release, CI:

1. Verifies the core tag, manifest, tarballs, and published npm package integrities.
2. Sets exact `nitro-core` and `nitrogen` npm dependencies, adopts the release version, installs the packages, and refreshes `bun.lock`. CI verifies installed versions and the lockfile checksums against the release manifest. The first adoption also removes the temporary source submodule and its workspace entries.
3. Stages native sources from the installed `nitro-core` package, builds and typechecks the workspace, regenerates the existing specs, and runs the package tests and performance-tool tests.
4. Runs CocoaPods for both apps to update their lockfiles, including podspec checksums, then builds the example app for the iOS simulator and Android.
5. Packs the RN package and installs all three release tarballs into a temporary consumer outside the workspace. It checks package contents, real package directories, TypeScript, and generation for the existing object and view fixtures.
6. Pushes the version commit and tag together with an atomic Git push for regular releases. Nightlies push only a tag. CI then saves a draft GitHub release with the exact tarball and `nitro-rn-release.json` manifest.
7. Publishes the RN tarball to npm and completes the GitHub release.

The wrapper inherits the core release's npm tag. Stable releases normally use `latest`; a version such as `0.38.0-beta.1` normally uses `beta`. GitHub marks prereleases accordingly.

The native builds use the staged workspace sources. The temporary consumer checks package installation and generation; it does not run native builds or Harness. Continue running the existing iOS and Android Harness workflows before releasing behavior changes.

## Nightlies

Each push to Nitro's `main` starts a nightly core release for its final commit. A push containing several commits produces one nightly. Its version has the form `0.37.2-nightly.123.gabcdef123456`, where the suffix records the workflow run number and source commit. This repository adopts that completed release and publishes the matching RN package to the `nightly` npm tag.

The wrapper builds a nightly from its current `main` in a detached checkout. The version commit records the exact nightly npm dependencies, but only its Git tag is pushed. This keeps `main` on the last regular release's version and dependencies. During the initial bootstrap period, nightly migration also leaves `main`'s temporary workspace setup unchanged. The nightly manifest records the wrapper source commit separately from the generated version commit.

Nightlies pass the same package and native build checks as regular releases. Both repositories create GitHub prereleases to store saved tarballs and completion manifests; official releases require an explicit version request in Nitro. They do not update npm's `latest` tag. If a delayed retry publishes an older nightly after a newer nightly is already available, it uses a `nightly-COMMIT` npm tag to keep `nightly` pointing at the newer version. The older version can still be installed by its exact version number.

A nightly whose sources fail validation remains unpublished. Fixes in a newer core commit can release automatically without waiting for that failed build. You can select any published core nightly tag manually to retry or backfill it.

## Trigger or retry from GitHub

Open this repository's **Release** workflow and choose **Run workflow** on `main`. Leave `core-tag` empty to use the regular-release priority above, or enter an exact published core tag, such as `v0.37.2` or a nightly tag.

The equivalent commands are:

```sh
bun release
bun release v0.37.2
```

These commands dispatch GitHub Actions through `gh`; they do not publish from the local checkout. A manual regular release cannot skip an earlier pending regular release. Any marked nightly can be selected for recovery or backfill. A completed release can be selected again to verify its saved package.

For failures after the release checkpoint was saved, rerun the workflow with the same tag. CI downloads the saved tarball, verifies its integrity, and publishes it only if that exact version is still missing from npm. If npm already has the same tarball, CI completes the remaining GitHub release step. A different tarball at the same npm version stops the workflow.

If the Git tag was pushed but the draft checkpoint was not saved, retrying rebuilds and validates the tagged commit. Main is never rewound. Do not delete or move release tags, replace saved tarballs, or choose another version to work around an authentication failure.

If a build fails before the version commit was pushed, fix the wrapper on `main` and rerun the same core tag. For regular releases, resolve the failed version before proceeding with another regular release. A nightly with a core implementation bug can remain unpublished while a newer fixed nightly proceeds.

## Development commands

`bun sync-core` stages native sources from the installed `nitro-core` package. `bun update-core-version VERSION` updates package versions and exact dependencies before installation; `bun update-core-version --check` verifies the installed packages afterwards. Without a version argument, it adopts the installed core version. It never changes the generated native header. The release workflow runs these commands.

Until the first source-containing core package is published, the development checkout retains a temporary submodule/workspace bootstrap. The release workflow removes only that legacy source gitlink and its workspace declarations before installing the first published version. Release automation itself has no dependency on that checkout.

For development, follow [CONTRIBUTING.md](CONTRIBUTING.md#shared-sources-and-releases) to test a core commit before it has a release tag. After adoption, ordinary builds use the committed exact npm versions and lockfile. Installing a packed RN package never initializes a submodule or runs source staging.
