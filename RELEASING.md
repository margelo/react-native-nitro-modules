# Releasing React Native Nitro Modules

Start releases in [margelo/nitro](https://github.com/margelo/nitro). Until `core-split` is merged, run `bun release VERSION` there. After the merge, you can also choose the exact version in its **Release Nitro** GitHub Actions workflow. Nitro publishes `nitro-core` and `nitrogen`, then completes its GitHub release. This repository picks up that release and publishes `react-native-nitro-modules` at the same version.

All three packages share a release version. To release a wrapper-only change, such as a podspec fix, start a patch release in Nitro. The wrapper has no independent version bump.

## One-time setup

In the npm settings for `react-native-nitro-modules`, configure a GitHub Actions trusted publisher:

- Organization or user: `margelo`
- Repository: `react-native-nitro-modules`
- Workflow filename: `release.yml`
- Environment: leave empty

The core packages need their own trusted publishers for `margelo/nitro` and `release.yml`. See Nitro's [release instructions](https://github.com/margelo/nitro/blob/core-split/RELEASING.md). The workflows use npm OIDC and do not need an npm token or a token with access to both repositories.

Keep this workflow on `main`, the repository's default branch, so GitHub runs its schedule. Repository rules must allow its `GITHUB_TOKEN` to push the release commit to `main`, create `vVERSION`, and create GitHub releases. Release commits use `Marc Rousavy <me@mrousavy.com>`. Check branch and tag rules before the first release. If a rule rejects the push, the workflow stops before publishing.

`0.37.1` already exists on npm. The first release after the split must use a newer version.

## Automatic adoption

The **Release** workflow checks Nitro's published GitHub releases every 15 minutes. GitHub can delay scheduled jobs. It includes prereleases and only considers releases with the `nitro-release.json` manifest produced by the coordinated core release workflow. Historical Nitro tags do not trigger it.

Each run processes the oldest pending regular release, including manually chosen prereleases such as beta or RC versions. Once those are complete, it processes the newest pending nightly. A failed older nightly does not block newer commits or regular releases. Earlier nightlies can be backfilled when no newer version is waiting. For each release, CI:

1. Verifies the core tag, manifest, tarballs, and published npm package integrities.
2. Pins `packages/react-native-nitro-modules/nitro` to that exact commit, stages the gitlink, runs `update-core-version`, and refreshes `bun.lock`.
3. Stages the shared native sources, builds and typechecks the workspace, regenerates the existing specs, and runs the package tests and performance-tool tests.
4. Runs CocoaPods for both apps to update their lockfiles, including podspec checksums, then builds the example app for the iOS simulator and Android.
5. Packs the RN package and installs all three release tarballs into a temporary consumer outside the workspace. It checks package contents, real package directories, TypeScript, and generation for the existing object and view fixtures.
6. Pushes the version commit and tag together with an atomic Git push for regular releases. Nightlies push only a tag. CI then saves a draft GitHub release with the exact tarball and `nitro-rn-release.json` manifest.
7. Publishes the RN tarball to npm and completes the GitHub release.

The wrapper inherits the core release's npm tag. Stable releases normally use `latest`; a version such as `0.38.0-beta.1` normally uses `beta`. GitHub marks prereleases accordingly.

The native builds use the staged workspace sources. The temporary consumer checks package installation and generation; it does not run native builds or Harness. Continue running the existing iOS and Android Harness workflows before releasing behavior changes.

## Nightlies

Every commit pushed to Nitro's `main` starts a nightly core release. Its version has the form `0.37.2-nightly.123.gabcdef123456`, where the suffix records the workflow run number and source commit. This repository adopts that completed release and publishes the matching RN package to the `nightly` npm tag.

The wrapper builds a nightly from its current `main` in a detached checkout. The version commit records the nightly core pin, but only its Git tag is pushed. This keeps `main` on the last regular release's version and core pin. The nightly manifest records the wrapper source commit separately from the generated version commit.

Nightlies pass the same package and native build checks as regular releases. They do not update npm's `latest` tag. If a delayed retry publishes an older nightly after a newer nightly is already available, it uses a `nightly-COMMIT` npm tag to keep `nightly` pointing at the newer version. The older version can still be installed by its exact version number.

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

`bun sync-core` stages the native sources from the recorded submodule commit. `bun update-core-version` adopts the authoritative core version and exact JS dependency; it never changes the generated native header. The release workflow runs both commands.

For development, follow [CONTRIBUTING.md](CONTRIBUTING.md#shared-sources-and-releases) to test a core commit before it has a release tag. Ordinary builds and checkout updates always use the committed submodule SHA.
