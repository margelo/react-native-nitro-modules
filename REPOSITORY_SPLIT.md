# Repository split

The complete Nitro baseline is preserved in this repository's history at `d498e237e9b4117c4abe38c023adf486c75f856a`. Its tracked-tree hash is `d5e639fb4d492f433ff70b25ec59ccf4a130a3fc`, identical to upstream Nitro. The baseline and its Git history were pushed here before the core repository was restructured. The React Native split is on this repository's `main` branch. Nitro keeps the shared-source split on `core-split`, with its `main` branch unchanged.

## Source ownership

- Nitro owns `packages/nitro-core/`, `packages/nitrogen/`, and the documentation site in `docs/`. The core package uses one manifest and version for `native/{cpp,apple,android}` and `js/`. Native sources still contain React Native-specific code.
- This repository owns the published `react-native-nitro-modules` package metadata, RN JS bootstrap, views and worklets integration, CocoaPods/Gradle/CMake integration, codegen configuration, apps, integration tests, fixtures, templates, and performance tooling. It depends on the exact matching `nitro-core` version and re-exports the shared API.
- `bun sync-core` resolves the installed `nitro-core` package and stages `native/cpp/`, `native/apple/`, and `native/android/src/` into the wrapper's existing `cpp/`, `ios/`, and `android/src/` paths, along with the MIT license. It verifies matching versions and removes stale files only within its output directories. Generated copies are ignored by Git. Shared-source formatting happens in Nitro; this repository's formatters cover its own test fixtures.

Existing RN package and native module names, namespaces, view generation, Fabric support, worklets, registration, and generated APIs remain unchanged. Nitrogen depends on `nitro-core` and is used through the installed package's CLI.

`packages/template/` stays in this repository because it creates a React Native library, including its podspec, Gradle/CMake configuration, and React Native dependencies. Nitrogen remains in Nitro and downloads this template from the React Native repository.

## Bootstrap, update, and release

```sh
# Prepare core dependencies, install packages, stage native sources and build:
bun bootstrap
# Also install macOS Ruby dependencies and example CocoaPods:
bun bootstrap:ios
# Refresh staged native files and regenerate existing fixtures:
bun sync-core
bun specs
```

The first npm release with the new `native/` and `js/` layout has not been published. This checkout therefore keeps the `packages/react-native-nitro-modules/nitro/` gitlink and its two workspace entries as a temporary source bootstrap. `bun bootstrap` initializes the exact recorded commit. Builds use those installed workspace packages; they do not follow the submodule's development branch automatically.

During this transition, build and typecheck changes in Nitro, then commit and push them before recording the new gitlink here. Run `bun update-core-version` when its version changes, then install, regenerate fixtures, and validate the native apps. Commit the updated gitlink, metadata, lockfile, and intended fixture changes together. See [CONTRIBUTING.md](CONTRIBUTING.md#shared-sources-and-releases) for the commands.

Each release snapshot removes the bootstrap submodule and workspace entries. The first successful regular release also commits that transition to `main`; nightlies leave `main` unchanged. Later updates install exact published `nitro-core` and `nitrogen` versions, update metadata and the lockfile, and stage native sources from that dependency. To test unreleased changes without a submodule, pack both packages in a Nitro checkout and install their local tarballs in a temporary wrapper checkout.

Nitro publishes matching `nitro-core` and `nitrogen` versions. Nightlies follow pushes to Nitro's `main`; official releases require a maintainer to request a version. The wrapper follows each channel at the same version after validating the installed packages and native builds. See [RELEASING.md](RELEASING.md) for triggering, npm setup, and recovery. No npm publication is needed to develop or validate this repository change.

## Package contents

The RN tarball contains staged native sources at the existing build paths, RN JS integration, compiled JS, TypeScript declarations, native build files, codegen inputs, README, and license. Its exact `nitro-core` dependency supplies the shared JS/TS API. The core tarball contains both native sources and JS/TS; Nitrogen's tarball contains the CLI and generator. All three include their license and install without Git access, a core checkout, staging scripts, or external symlinks. Tests, apps, Hermes, and build caches are excluded.

## Initial split validation

The results below record validation of the initial repository split, before the shared JS package and current core layout were introduced.

Both original packages were packed with `npm pack`, inspected, and installed with ordinary npm lifecycle handling into a fresh temporary consumer outside either repository. The consumer had no core checkout or workspace package symlinks. Existing native test fixtures and the example app supplied the consumer validation cases.

The original runtime tarball contained 290 files: actual C++/Swift/Kotlin/JNI/JS sources, CommonJS/ES module output, TypeScript declarations, native build files, the podspec, codegen inputs, README, and license. The original Nitrogen tarball contained 297 files: the executable CLI, compiled generator, TypeScript sources, README, and license. Neither includes Git metadata, the core checkout, apps, docs, test fixtures, build caches, `node_modules`, Hermes sources, or external symlinks. npm installation performs no Git fetch or core staging.

### Checks

After moving the submodule into the runtime package, a fresh clone passed `bun bootstrap` and `bun specs` without tracked changes. Workspace typechecks, lint, docs build, Metro exclusions, and React Native autolinking checks passed. The repacked runtime retained all native and generated JS files unchanged. Installing it in a separate npm consumer passed typechecking and produced identical Nitrogen output.

- Core build, typecheck, lint, frozen dependency installation, fresh bootstrap, and remote template initialization passed. All six core GitHub Actions workflows passed on the initial split commit; the repository rename only updates links and the template URL. Release version synchronization was exercised in a temporary copy with publication and Git release actions disabled.
- Wrapper build, all workspace typechecks, lint, docs typecheck/build, and generation passed. A fresh clone completed `bun bootstrap` and `bun specs` with no tracked changes and a working Nitrogen CLI. All 282 generated fixture files matched the baseline, including view bindings and autolinking.
- All 164 performance-tool tests passed before and after the split. The existing runtime Jest suite passed with its single todo and contains no runtime assertions.
- Baseline and npm consumer Android `assembleDebug` and iOS arm64 simulator builds passed. These compile the existing view and native registration fixtures using the packed runtime's headers, Prefab library, and CocoaPod.
- Android API 37 harness tests passed all 564 tests in both baseline and consumer with the existing CI setting `minSdkVersion=26`, including views, HardwareBuffer, and native registration. An initial run with the app default `minSdkVersion=24` produced the same 11 failures in both; no source changes were needed for the CI configuration.
- iOS 26.5 harness results matched: 563 passed and one failed in both baseline and consumer, with the same `createNativeArrayBuffer` external-memory-pressure assertion. The view suite passed. On iOS 27, the unchanged baseline app aborts in UIKit before tests because of scene-lifecycle adoption. That issue is deferred without changing React Native or the app in this split.

The host's Ruby 4 cannot install the locked Ruby bundle because its locked `minitest` version requires Ruby below 4. Native validation used global CocoaPods 1.17 in temporary fixtures; repository Gemfiles and lockfiles were preserved.
