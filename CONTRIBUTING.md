# Contributing to Nitro

Thanks for your interest in contributing! Nitro powers thousands of React Native libraries, so every change that lands on `main` ships to a lot of apps. This document explains how the project works, what we expect from pull requests, and the test flow that every bug fix has to follow.

> **AI assistants and automated tools:** this file is the source of truth for how to work in this repo. Read it end-to-end before making changes.

**Short version:** You have two good ways to contribute a bug report:

1. **Repro-only PR** — add a minimal failing test (compile or runtime) to this repo so CI goes red, and stop there. See [You don't need to ship a fix](#you-dont-need-to-ship-a-fix--a-clean-repro-is-enough).
2. **Repro + fix PR** — the same test, plus the fix that makes CI green again. See [The bug-fix flow](#the-bug-fix-flow).

Either is welcome. A clean, deterministic repro is often more valuable than a guessed patch.

## Philosophy

- **Selective merges.** We accept PRs, but we are opinionated about what goes into `main`. Bug fixes and well-scoped features are welcome; broad refactors, stylistic rewrites, and drive-by cleanups usually are not.
- **Proper fixes, not patches.** We would rather have a small, well-understood fix with a regression test than a larger "it seems to work now" change. Workarounds and defensive `try/catch`-style patches that paper over a root cause will not be merged.
- **No AI slop.** Generated code, unnecessary abstractions, speculative refactors, and boilerplate-heavy "test spam" are rejected on sight. Human-authored or AI-assisted is fine — but the diff has to be tight, necessary, and match the style of the surrounding code.
- **CI is the safety net.** The repo is covered by multiple CI matrices (build, harness runtime tests, lint) across iOS and Android. If CI can catch a regression, it should — we avoid anything that requires manual user testing to verify.

## Repo layout

The React Native repository is a Bun monorepo. Shared sources are maintained in [margelo/nitro](https://github.com/margelo/nitro) and consumed through the `nitro-core` and `nitrogen` packages:

- [apps/example/](apps/example) — React Native example app that hosts the runtime test harness.
- [nitro-core](https://github.com/margelo/nitro/tree/core-split/packages/nitro-core) - shared native runtime in `native/{cpp,apple,android}` and JS/TS API in `js/src/`. Its package manifest and version cover both.
- [nitrogen](https://github.com/margelo/nitro/tree/core-split/packages/nitrogen) - the code generator, maintained and published by `nitro`.
- [packages/react-native-nitro-modules/](packages/react-native-nitro-modules) - the published React Native package and its CocoaPods, Gradle, and CMake configuration. Its native sources are staged from the installed `nitro-core` package; its RN-specific JS is maintained here. Shared JS/TS comes from `nitro-core`.
- [packages/react-native-nitro-test/](packages/react-native-nitro-test) — a Nitro module full of specs used as compile-time and runtime tests.
- [packages/react-native-nitro-test-external/](packages/react-native-nitro-test-external) — a second Nitro module used to cover cross-module behavior.
- [packages/template/](packages/template) - the `npx nitrogen init` React Native library template. It stays here with the CocoaPods/Gradle/CMake integration and React Native dependencies it configures.
- [Nitro docs](https://github.com/margelo/nitro/tree/core-split/docs) - the Docusaurus site, maintained in the Nitro repository, at [nitro.margelo.com](https://nitro.margelo.com).

Setup instructions (toolchain, pods, running the example app) live in the docs contributing page: <https://nitro.margelo.com/docs/resources/contributing>. This file focuses on the contribution flow itself.

## Tooling

We use **Bun** as the package manager and task runner. Don't use `npm`, `yarn`, or `pnpm` — the lockfile and workspace scripts assume Bun.

```sh
bun bootstrap       # prepare core dependencies, install, and build
bun bootstrap:ios   # also install Bundler dependencies and example app Pods
bun sync-core       # refresh staged implementation sources
bun run build       # stage native sources and build RN and test packages
bun specs           # regenerate nitrogen output for react-native-nitro-test
bun lint-all        # run all linters (JS/TS, C++, Swift, Kotlin)
```

## Shared sources and releases

The `nitro-core` package contains both `native/` sources and the shared JS/TS API. The wrapper depends on an exact version of it and uses the matching Nitrogen version. Shared implementation changes belong in the Nitro repository. Keep RN bootstrap, views, worklets, and native build configuration here.

`bun sync-core` resolves the installed `nitro-core` package and copies `native/cpp/`, `native/apple/`, and `native/android/src/` into the wrapper's existing `cpp/`, `ios/`, and `android/src/` directories. Those generated copies are ignored by Git. The command also copies the core license, verifies the JS/native/package versions, and removes stale files only inside its output directories. Keep handwritten package and build configuration outside them. Run the native formatters in Nitro for shared sources; this repository's formatters cover its own test fixtures.

### Temporary source bootstrap

The first npm release containing the new core layout has not been published. Until it is available, this checkout retains `packages/react-native-nitro-modules/nitro/` as a pinned submodule and registers its `nitro-core` and `nitrogen` packages as workspaces. `bun bootstrap` initializes that recorded commit before installing and building. `bun run build` builds those local packages when they are registered, then uses the same installed-package staging path as an npm-based checkout.

For shared changes during this transition:

1. Edit and validate them in the Nitro repository, including `bun run build` and `bun typecheck`.
2. Commit and push Nitro first. Check out that commit in `packages/react-native-nitro-modules/nitro/`, then stage the updated gitlink with `git add packages/react-native-nitro-modules/nitro`.
3. If the version changed, run `bun update-core-version`. Run `bun install`, `bun specs`, and the relevant native builds and tests here.
4. Commit the gitlink, metadata, lockfile, and intended generated fixture changes. Push only after the Nitro commit is available remotely.

Ordinary bootstrap uses the recorded commit. Do not use `git submodule update --remote` in builds. Release snapshots remove the temporary submodule and workspace entries and use exact npm dependencies. The first successful regular release commits that transition to `main`; nightlies leave `main` unchanged. After that transition, `bun bootstrap` needs no Nitro checkout.

### Package updates and releases

Nitro's release workflows publish `nitro-core` and `nitrogen` together. This repository adopts their exact published version, updates its lockfile and version metadata, stages native sources, and validates the RN package before publishing. The RN tarball contains the native files; npm consumers do not run staging or fetch Git repositories.

Nightlies follow pushes to Nitro's `main` under npm's `nightly` tag. Official releases start only when a maintainer requests a version in Nitro. The wrapper follows both channels at the matching version. See [RELEASING.md](RELEASING.md) for the release commands, credentials, validation, and retry behavior.

`bun update-core-version` synchronizes wrapper and test-package metadata with the installed core version. It does not choose a new release version. For unreleased changes after the npm transition, pack the two Nitro packages in a separate checkout and install those local tarballs in a temporary wrapper checkout. Build and test there before publishing or committing dependency updates.

## You don't need to ship a fix — a clean repro is enough

The most useful thing you can contribute for a bug you can't fix yourself is a **PR that makes CI go red**. If you can reproduce your bug inside this repo as:

- a **compile error** — add the minimal spec to [packages/react-native-nitro-test/src/specs/](packages/react-native-nitro-test/src/specs) that causes nitrogen output to fail to build, or
- a **runtime error** — add the minimal failing assertion to one of the Harness test files in [apps/example/\_\_tests\_\_/](apps/example/__tests__) so the Harness workflows ([harness-ios.yml](.github/workflows/harness-ios.yml), [harness-android.yml](.github/workflows/harness-android.yml)) catch it,

then open a PR with just that change. Don't attempt a fix. A red CI run that deterministically pins the bug is often more valuable than a guessed patch — once the repro is in, the actual fix can be taken from there.

The rules from ["Writing good tests"](#writing-good-tests) below still apply to repros: reuse existing types, keep the addition small, don't remove other tests. A small, clean, 100% reproducible repro PR is always welcome.

## The bug-fix flow

**Every bug fix MUST ship with a test.** No exceptions. The test can take one of two forms:

### 1. Runtime test

A runtime test lives in one of the [React Native Harness](https://react-native-harness.dev) test files in [apps/example/\_\_tests\_\_/](apps/example/__tests__) (one file per area, e.g. `variants.harness.ts` or `callbacks.harness.ts`) and exercises a spec from [packages/react-native-nitro-test/src/specs/](packages/react-native-nitro-test/src/specs). Tests use `describe`/`it`/`expect` from `react-native-harness`, and `expect` is vitest's, so prefer the specific matcher (`toEqual`, `toContain`, `toThrow('...')`, `rejects`) over `expect(condition).toBe(true)` - a failure then shows the actual values. It runs:

- locally against a built and installed debug app via `bun example test:harness --harnessRunner ios` (or `android`), and
- in the example app's "Tests" tab (start Metro with `bun example start` and run the app), which runs the same runtime tests one at a time or all at once (UI tests only run through the Harness CLI), and
- in CI on both iOS and Android via the **Harness** workflows ([harness-ios.yml](.github/workflows/harness-ios.yml), [harness-android.yml](.github/workflows/harness-android.yml)).

Use a runtime test when the bug is about behavior — wrong value returned, wrong lifecycle, wrong threading, a crash, etc.

### 2. Compile-time / build test

A compile-time test lives in the specs of [react-native-nitro-test](packages/react-native-nitro-test/src/specs) (or [react-native-nitro-test-external](packages/react-native-nitro-test-external/src/specs) for cross-module cases). The "test" is that nitrogen generates code for the spec and the native build succeeds. This is covered in CI by the [build-ios.yml](.github/workflows/build-ios.yml) and [build-android.yml](.github/workflows/build-android.yml) workflows.

Use a compile-time test when the bug is about code generation — especially Swift compiler quirks. We have accumulated a lot of Swift compiler workarounds; each one is pinned in place by a spec (a specific struct, enum, tuple, protocol shape, etc.) that used to fail to compile. Once the workaround is applied, the spec can never silently regress because the native build would break.

Examples of things that belong as compile-time tests: specific generic shapes, enum payloads, variants, tuples, optional wrappers, inheritance chains, anything that previously tripped Swift/Clang/Kotlinc.

### Writing good tests

Tests must be **minimal and non-polluting**:

- **Reuse existing types.** If `Car`, `Person`, `TestObject`, `Base`, `Child`, etc. already exist in the specs, use them. Don't introduce a parallel `MyBugRepro` struct just for your test.
- **Add, don't rewrite.** Don't remove or restructure existing specs or test cases — older tests cover older bugs, and removing them drops coverage. Add the smallest new method, property, or assertion that pins your bug.
- **No spec dumps.** Do not paste a full user-reported spec into the test module to "make it fail". Distill the bug down to the one type or call that actually reproduces it.
- **One test per bug.** A new assertion in a `__tests__/*.harness.ts` file or a single new method on an existing spec is usually enough.

If a PR adds dozens of new structs, enums, or spec files to reproduce a bug, it will be asked to shrink before review.

## Workflow for a bug fix

1. **Reproduce the bug** in the example app, ideally by adding a failing test first.
2. **Add the test** — runtime (a `__tests__/*.harness.ts` test + a spec addition) or compile-time (a spec addition), per the rules above.
3. **Run nitrogen** to regenerate the native bindings:
   ```sh
   bun specs
   ```
   This runs `nitrogen` for `react-native-nitro-test` (and transitively for `react-native-nitro-test-external`). Commit the generated files.
4. **Implement the fix** in Nitro's `packages/nitro-core/` or `packages/nitrogen/` for shared changes, or in this repository for RN integration changes. Follow [shared sources and releases](#shared-sources-and-releases) to test updated core packages here. Keep regression tests and their generated bindings in this repository.
5. **Verify locally:**
   - `bun run build` — all packages build.
   - `bun typecheck` and `bun lint-all`.
   - Build and install the example app on iOS and/or Android, and run the Harness tests (`bun example test:harness --harnessRunner ios`).
6. **Open a PR.** Describe the bug, link the issue, and point at the test you added.

For new features, the same flow applies: add the spec, run `bun specs`, implement natively, cover it with a runtime assertion in `apps/example/__tests__` where possible.

## What CI runs on your PR

- **Build:** iOS and Android builds of the example app and both test modules.
- **Harness:** runtime tests from `apps/example/__tests__` executed on iOS and Android.
- **Lint:** TypeScript, C++ (clang-format), Swift (swift-format), Kotlin (ktlint).
- **Nitrogen:** regeneration check — generated output must match what's committed.

If any of these fail, the PR won't be merged. Fix the root cause; do not disable or skip checks.

### Performance tests

Performance CI runs only when requested on an open PR. Someone with **write**,
**maintain**, or **admin** access to this repository can post:

```text
@nitro-modules-bot please test performance
```

The bot adds 👍 when it accepts the request. `Nitro Performance`
appears in the PR's checks area: yellow while running, green on success, red on
failure. New requests replace this entry; older runs finishing later cannot
overwrite it. Click it to see the logs. The bot also posts a comparison table, or a
failure comment linking to the failed run. Contributors without write access can
ask a maintainer to run it for their PR; fork PRs are supported.

Each new command creates a separate run and report. Re-run the same workflow to
update its existing comment. Re-running `measure-android` or `measure-ios` and
their dependent jobs reuses the saved apps. After a new report is posted, older
performance comments from the bot are marked **Outdated**. Pushing another commit
does not start a performance run; post the command again to test that commit.

See [performance CI](.github/PERFORMANCE.md) for the measurement method and artifacts.

## Pull request checklist

Before requesting review, make sure:

- [ ] The PR targets `main` and has a clear, narrow scope.
- [ ] There is a test (runtime or compile-time) that pins the bug.
  - For **repro-only PRs**: the test fails in CI (that's the point — say so in the PR description).
  - For **fix PRs**: the test fails on `main` and passes with your fix applied.
- [ ] `bun specs` has been run and the generated files are committed.
- [ ] `bun lint-all` passes locally.
- [ ] You did not remove existing specs or test cases.
- [ ] The diff does not contain unrelated refactors, reformatting, or speculative changes.
- [ ] Commit messages follow Conventional Commits (`fix:`, `feat:`, `docs:`, `chore:`, `perf:`). The changelog is generated from these.

## Reporting bugs without a fix

See [You don't need to ship a fix](#you-dont-need-to-ship-a-fix--a-clean-repro-is-enough) above. The short version: a PR that adds a minimal failing test and makes CI red is a legitimate and very welcome contribution on its own. The [docs contributing page](https://nitro.margelo.com/docs/resources/contributing) has the reproduction walkthrough for running things locally first.

## Questions

If you are unsure whether a change fits, open a draft PR or an issue describing the approach **before** writing a lot of code. A two-line comment saving a thousand-line PR from being closed is a good trade for everyone.
