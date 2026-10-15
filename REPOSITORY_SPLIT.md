# Repository split

The complete Nitro baseline is preserved in this repository's history at `d498e237e9b4117c4abe38c023adf486c75f856a`. Its tracked-tree hash is `d5e639fb4d492f433ff70b25ec59ccf4a130a3fc`, identical to upstream Nitro. The baseline and its Git history were pushed here before the core repository was restructured. The React Native split is on this repository's `main` branch. Nitro keeps the shared-source split on `core-split`, with its `main` branch unchanged.

## Source ownership

The `packages/react-native-nitro-modules/nitro` gitlink records the exact Nitro commit used by this repository. Its `branch = core-split` setting helps development; builds never follow that branch automatically.

- Nitro owns `packages/nitro-core/{android,apple,cpp,js}` and `packages/nitrogen/`. The `nitro-core` npm package contains only shared JS/TS. Native sources still contain React Native-specific code.
- This repository owns the published `react-native-nitro-modules` package metadata, RN JS bootstrap, views and worklets integration, CocoaPods/Gradle/CMake integration, codegen configuration, apps, integration tests, fixtures, templates, docs, and performance tooling. It depends on the exact matching `nitro-core` version and re-exports the shared API.
- `bun sync-core` stages `packages/nitro-core/cpp/`, `packages/nitro-core/apple/`, and `packages/nitro-core/android/src/` into the existing `cpp/`, `ios/`, and `android/src/` paths, along with the MIT license. It checks the pinned commit and matching versions, removes stale files only within its three output directories, and ignores checkout caches. Generated copies are not tracked here. Native formatters edit the authoritative core sources. The wrapper maintains its own `src/` directory; shared JS/TS and Nitrogen run directly from the pinned submodule as workspace packages.

Native implementation sources remain unchanged from the baseline apart from their repository paths. Shared JS/TS now lives in `nitro-core`, which Nitrogen uses instead of depending on the React Native runtime package. Existing RN package and native module names, namespaces, view generation, Fabric support, worklets, registration, and generated APIs remain unchanged.

`packages/template/` stays in this repository because it creates a React Native library, including its podspec, Gradle/CMake configuration, and React Native dependencies. Nitrogen remains in Nitro and downloads this template from the React Native repository.

## Bootstrap, update, and release

```sh
# Clean checkout, including the pinned submodule, dependency install and build:
bun bootstrap
# Optional macOS Ruby dependencies and example CocoaPods setup:
bun bootstrap:ios
# Stage local tracked core edits and regenerate existing fixtures:
bun sync-core
bun specs
```

Build shared sources and Nitrogen in the Nitro checkout with `bun bootstrap` and `bun typecheck`. Commit and push core changes before recording them here:

```sh
git -C packages/react-native-nitro-modules/nitro fetch origin
git -C packages/react-native-nitro-modules/nitro checkout <pushed-core-sha>
git add packages/react-native-nitro-modules/nitro
bun update-core-version
bun install
bun specs
```

Commit the updated pin, metadata, lockfile, and any intended generated fixture changes here. Normal checkout updates use `git submodule update --init --recursive`, without `--remote`.

Choose release versions in Nitro's GitHub Actions workflow. It updates `nitro-core`, Nitrogen, the JS version, and `NITRO_VERSION`, then publishes both npm packages and a GitHub release. This repository polls those completed releases, pins the exact tagged commit, adopts the same version, validates the RN package, and publishes it with its own GitHub release. Native sources continue to come from the committed gitlink.

`bun update-core-version` remains the local command for adopting the pinned core's version. `bun release [core-tag]` dispatches this repository's release workflow through `gh`. See [RELEASING.md](RELEASING.md) for setup, validation, and retry behavior. No npm packages or release tags were created while implementing this automation.

Nightlies follow every commit pushed to Nitro's `main` and publish all three packages at the same nightly version. The wrapper publishes a tagged version commit without changing its `main` branch. Regular releases take priority when both channels have pending releases.

## Package contents

The RN tarball contains staged native sources at the existing build paths, RN JS integration, compiled JS, TypeScript declarations, native build files, codegen inputs, README, and license. It installs shared JS/TS through its `nitro-core` dependency. The `nitro-core` tarball contains shared JS/TS only; the Nitrogen tarball contains the CLI and generator. All three include their license and install without Git access, the core checkout, or external symlinks.

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
