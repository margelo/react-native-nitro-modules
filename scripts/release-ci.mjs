import assert from "node:assert/strict";
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertCI,
  assertClean,
  assertPublishedPackages,
  compareVersions,
  downloadRelease,
  finishRelease,
  getRelease,
  git,
  packPackage,
  publishPackages,
  readJSON,
  run,
  saveDraft,
  validateManifest,
  writeJSON,
} from "../packages/react-native-nitro-modules/nitro/scripts/releases/lib.mjs";
import {
  coreManifestName,
  coreRepository,
  findCoreRelease,
  isNightlyVersion,
  manifestName,
  repository,
} from "./find-core-release.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const submodule = "packages/react-native-nitro-modules/nitro";
const packageDirectory = "packages/react-native-nitro-modules";

export async function verifyConsumer(
  manifest,
  directory,
  coreManifest,
  coreDirectory,
) {
  const consumer = mkdtempSync(
    path.join(os.tmpdir(), "nitro-release-consumer-"),
  );
  try {
    const toolchain = readJSON(path.join(root, "apps/example/package.json"));
    const dependencies = {
      react: toolchain.dependencies.react,
      "react-native": toolchain.dependencies["react-native"],
      "@types/react": readJSON(path.join(root, "package.json")).devDependencies[
        "@types/react"
      ],
      typescript: readJSON(path.join(root, "package.json")).devDependencies
        .typescript,
    };
    for (const [release, source] of [
      [coreManifest, coreDirectory],
      [manifest, directory],
    ]) {
      for (const pkg of release.packages) {
        const tarball = path.join(source, pkg.filename);
        dependencies[pkg.name] = `file:${tarball}`;
        const entries = run("tar", ["-tzf", tarball], { capture: true }).split(
          "\n",
        );
        assert(
          !entries.some(
            (entry) =>
              /^package\/(?:nitro|apps|docs|hermes)\//.test(entry) ||
              /\/(?:\.git|node_modules|__tests__|\.gradle|\.cxx)\//.test(entry),
          ),
          `Development files in ${pkg.filename}`,
        );
      }
    }
    writeJSON(path.join(consumer, "package.json"), {
      name: "nitro-release-consumer",
      private: true,
      dependencies,
    });
    // Ordinary installation exercises the published package's consumer lifecycle.
    run("npm", ["install", "--no-audit", "--no-fund"], { cwd: consumer });
    for (const name of [
      "nitro-core",
      "nitrogen",
      "react-native-nitro-modules",
    ]) {
      const installed = path.join(consumer, "node_modules", name);
      assert(
        !lstatSync(installed).isSymbolicLink(),
        `${name} must be a real installed package`,
      );
      assert.equal(
        readJSON(path.join(installed, "package.json")).version,
        manifest.version,
      );
    }
    const installed = path.join(
      consumer,
      "node_modules/react-native-nitro-modules",
    );
    for (const file of [
      "NitroModules.podspec",
      "apple/nitro_pod_utils.rb",
      "cpp/entrypoint/InstallNitro.hpp",
      "ios/views/HybridView.swift",
      "android/src/main/cpp/JNIOnLoad.cpp",
      "android/build.gradle",
      "android/CMakeLists.txt",
      "src/index.ts",
      "lib/typescript/index.d.ts",
      "LICENSE",
    ])
      assert(
        lstatSync(path.join(installed, file)).isFile(),
        `Missing package file: ${file}`,
      );
    assert(
      !existsSync(path.join(installed, "nitro")),
      "The core checkout must not be packed",
    );
    mkdirSync(path.join(consumer, "src"));
    copyFileSync(
      path.join(
        root,
        "packages/react-native-nitro-test/src/specs/TestView.nitro.ts",
      ),
      path.join(consumer, "src/TestView.nitro.ts"),
    );
    copyFileSync(
      path.join(
        root,
        "packages/react-native-nitro-test-external/src/specs/SomeExternalObject.nitro.ts",
      ),
      path.join(consumer, "src/SomeExternalObject.nitro.ts"),
    );
    writeJSON(path.join(consumer, "tsconfig.json"), {
      compilerOptions: {
        strict: true,
        noEmit: true,
        skipLibCheck: true,
        target: "ESNext",
        module: "ESNext",
        moduleResolution: "Bundler",
        jsx: "react-jsx",
      },
      include: ["src"],
    });
    const config = readJSON(
      path.join(root, "packages/react-native-nitro-test/nitro.json"),
    );
    config.autolinking = {
      TestView: config.autolinking.TestView,
      SomeExternalObject: readJSON(
        path.join(root, "packages/react-native-nitro-test-external/nitro.json"),
      ).autolinking.SomeExternalObject,
    };
    writeJSON(path.join(consumer, "nitro.json"), config);
    run(path.join(consumer, "node_modules/.bin/tsc"), ["--noEmit"], {
      cwd: consumer,
    });
    run(path.join(consumer, "node_modules/.bin/nitrogen"), [], {
      cwd: consumer,
    });
    const generated = path.join(consumer, "nitrogen/generated");
    for (const platform of ["ios", "android", "shared"])
      assert(
        readdirSync(path.join(generated, platform)).length > 0,
        `No generated ${platform} bindings`,
      );
    assert(
      existsSync(
        path.join(generated, "shared/c++/views/HybridTestViewComponent.cpp"),
      ),
      "View generation failed",
    );
    assert(
      existsSync(
        path.join(generated, "shared/c++/HybridSomeExternalObjectSpec.hpp"),
      ),
      "Object generation failed",
    );
  } finally {
    rmSync(consumer, { recursive: true, force: true });
  }
}

function verifyCheckout(coreManifest) {
  const gitlink = git(["ls-tree", "HEAD", submodule]).split(/\s+/)[2];
  assert.equal(
    gitlink,
    coreManifest.commit,
    "Release gitlink does not match the core release",
  );
  assert.equal(
    readJSON(path.join(packageDirectory, "package.json")).version,
    coreManifest.version,
  );
  run("node", ["scripts/update-core-version.mjs", "--check"]);
}

function buildAndCheck() {
  run("bun", ["install", "--ignore-scripts"]);
  run("bun", ["run", "build"]);
  run("bun", ["typecheck"]);
  run("bun", ["specs"]);
  run("bun", ["nitro", "test", "--runInBand"]);
  run("bun", ["test:performance-tools"]);
  for (const app of ["example", "benchmark"]) {
    run("bundle", ["install"], { cwd: path.join(root, "apps", app) });
    run("bundle", ["exec", "pod", "install"], {
      cwd: path.join(root, "apps", app, "ios"),
    });
  }
  run(
    "xcodebuild",
    [
      "-workspace",
      "NitroExample.xcworkspace",
      "-scheme",
      "NitroExample",
      "-configuration",
      "Debug",
      "-sdk",
      "iphonesimulator",
      "-destination",
      "generic/platform=iOS Simulator",
      "-derivedDataPath",
      path.join(
        process.env.RUNNER_TEMP ?? os.tmpdir(),
        "nitro-release-derived-data",
      ),
      "ONLY_ACTIVE_ARCH=YES",
      "ARCHS=arm64",
      "CODE_SIGNING_ALLOWED=NO",
      "build",
    ],
    { cwd: path.join(root, "apps/example/ios") },
  );
  run(
    "./gradlew",
    [":app:assembleDebug", "--no-daemon", "-PreactNativeArchitectures=x86_64"],
    {
      cwd: path.join(root, "apps/example/android"),
    },
  );
}

export async function release() {
  process.chdir(root);
  assertCI(repository);
  assert.equal(
    process.env.GITHUB_REF,
    "refs/heads/main",
    "Release must run on main",
  );
  assertClean(root);
  const tag = await findCoreRelease(process.env.CORE_TAG ?? "");
  if (!tag) return console.log("No pending core release.");
  const temporary = mkdtempSync(
    path.join(process.env.RUNNER_TEMP ?? os.tmpdir(), "nitro-rn-release-"),
  );
  const coreDirectory = path.join(temporary, "core");
  const directory = path.join(temporary, "rn");
  mkdirSync(directory);
  try {
    const coreRelease = await getRelease(coreRepository, tag);
    assert(
      coreRelease && !coreRelease.draft,
      "Core release must be published first",
    );
    const coreManifest = await downloadRelease(
      coreRepository,
      tag,
      coreManifestName,
      coreDirectory,
    );
    const nightly = isNightlyVersion(coreManifest.version);
    assert.equal(
      nightly,
      coreManifest.npmTag === "nightly",
      "Nightly versions must use the nightly npm tag",
    );
    await assertPublishedPackages(coreManifest);
    git(["fetch", "origin", `refs/tags/${tag}:refs/tags/${tag}`], {
      cwd: path.join(root, submodule),
    });
    assert.equal(
      git(["rev-parse", `${tag}^{commit}`], {
        cwd: path.join(root, submodule),
      }),
      coreManifest.commit,
      "Core tag does not match its release manifest",
    );

    const ownRelease = await getRelease(repository, tag);
    const remoteTag = git([
      "ls-remote",
      "--tags",
      "origin",
      `refs/tags/${tag}`,
    ]);
    let sourceCommit = git(["rev-parse", "HEAD"]);
    if (remoteTag) {
      git(["fetch", "origin", `refs/tags/${tag}:refs/tags/${tag}`]);
      const commit = git(["rev-parse", `${tag}^{commit}`]);
      if (nightly) {
        const ancestry = git([
          "rev-list",
          "--parents",
          "-n",
          "1",
          commit,
        ]).split(" ");
        assert.equal(
          ancestry.length,
          2,
          "A nightly release commit must have one parent",
        );
        sourceCommit = ancestry[1];
      }
      git([
        "merge-base",
        "--is-ancestor",
        nightly ? sourceCommit : commit,
        "origin/main",
      ]);
      git(["checkout", "--detach", tag]);
      git(["submodule", "update", "--init", "--recursive"]);
      verifyCheckout(coreManifest);
    } else {
      assert(!ownRelease, "A release exists without its Git tag");
      const current = readJSON(
        path.join(packageDirectory, "package.json"),
      ).version;
      if (nightly) git(["checkout", "--detach", sourceCommit]);
      else
        assert(
          compareVersions(coreManifest.version, current) > 0,
          "A new release must increase the wrapper version",
        );
      git(["checkout", "--detach", coreManifest.commit], {
        cwd: path.join(root, submodule),
      });
      git(["add", submodule]); // sync-core checks the index, not just the working tree.
      run("node", ["scripts/update-core-version.mjs"]);
    }

    let manifest;
    if (ownRelease?.assets.some((asset) => asset.name === manifestName)) {
      manifest = await downloadRelease(
        repository,
        tag,
        manifestName,
        directory,
      );
      assert.equal(manifest.commit, git(["rev-parse", "HEAD"]));
      assert.deepEqual(manifest.core, {
        repository: coreRepository,
        tag,
        commit: coreManifest.commit,
      });
      assert.equal(manifest.npmTag, coreManifest.npmTag);
      if (nightly) assert.equal(manifest.sourceCommit, sourceCommit);
    } else {
      assert(
        !ownRelease || ownRelease.draft,
        "Completed release is missing its checkpoint",
      );
      buildAndCheck();
      if (remoteTag) {
        assertClean(root);
      } else {
        const allowed = [
          "package.json",
          "bun.lock",
          submodule,
          `${packageDirectory}/package.json`,
          "packages/react-native-nitro-test/package.json",
          "packages/react-native-nitro-test-external/package.json",
          "apps/example/package.json",
          "apps/example/ios/Podfile.lock",
          "apps/benchmark/ios/Podfile.lock",
          "packages/react-native-nitro-test/nitrogen/generated",
          "packages/react-native-nitro-test-external/nitrogen/generated",
        ];
        git(["add", "--", ...allowed]);
        git(["diff", "--exit-code"]);
        assert.equal(
          git(["ls-files", "--others", "--exclude-standard"]),
          "",
          "Unexpected generated files",
        );
        git([
          "-c",
          "user.name=Marc Rousavy",
          "-c",
          "user.email=me@mrousavy.com",
          "commit",
          "-m",
          `chore: release ${coreManifest.version}`,
        ]);
      }
      const commit = git(["rev-parse", "HEAD"]);
      const packed = await packPackage(
        path.join(root, packageDirectory),
        directory,
      );
      manifest = {
        schema: 1,
        repository,
        version: coreManifest.version,
        tag,
        commit,
        npmTag: coreManifest.npmTag,
        ...(nightly ? { sourceCommit } : {}),
        core: { repository: coreRepository, tag, commit: coreManifest.commit },
        packages: [packed],
      };
      validateManifest(manifest, {
        repository,
        tag,
        packages: ["react-native-nitro-modules"],
      });
      await verifyConsumer(manifest, directory, coreManifest, coreDirectory);
      assertClean(root);
      if (!remoteTag) {
        git(["tag", tag, commit]);
        git([
          "push",
          "--atomic",
          "origin",
          ...(nightly ? [] : ["HEAD:refs/heads/main"]),
          `refs/tags/${tag}`,
        ]);
      }
      await saveDraft(manifest, directory, manifestName);
    }
    await publishPackages(manifest, directory);
    await finishRelease(manifest);
    console.log(
      `Released react-native-nitro-modules ${manifest.version} from ${manifest.commit}`,
    );
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  await release();
