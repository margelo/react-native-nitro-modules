import assert from "node:assert/strict";
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { readJSON, writeJSON } from "./lib.mjs";
import {
  legacySubmodule,
  removeLegacyBootstrap,
  verifyCoreTag,
  verifyInstalledSources,
  verifySourceLock,
  verifySourceMetadata,
} from "./source-packages.mjs";

const manifest = {
  repository: "margelo/nitro",
  tag: "v0.37.2",
  version: "0.37.2",
  commit: "a".repeat(40),
  packages: ["nitro-core", "nitrogen"].map((name) => ({
    name,
    version: "0.37.2",
    integrity: `sha512-${name}`,
  })),
};

function fixture(t) {
  const root = mkdtempSync(
    path.join(os.tmpdir(), "nitro-registry-release-test-"),
  );
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeJSON(path.join(root, "package.json"), {
    private: true,
    workspaces: ["packages/react-native-nitro-modules"],
    devDependencies: {
      "nitro-core": manifest.version,
      nitrogen: manifest.version,
    },
  });
  const runtime = path.join(root, "packages/react-native-nitro-modules");
  mkdirSync(runtime, { recursive: true });
  writeJSON(path.join(runtime, "package.json"), {
    name: "react-native-nitro-modules",
    version: manifest.version,
    dependencies: { "nitro-core": manifest.version },
  });
  return root;
}

function lockFixture() {
  return {
    workspaces: {
      "": {
        name: "rn-workspace",
        devDependencies: {
          "nitro-core": manifest.version,
          nitrogen: manifest.version,
        },
      },
      "packages/react-native-nitro-modules": {
        name: "react-native-nitro-modules",
        dependencies: { "nitro-core": manifest.version },
      },
    },
    packages: Object.fromEntries(
      manifest.packages.map((pkg) => [
        pkg.name,
        [`${pkg.name}@${pkg.version}`, "", {}, pkg.integrity],
      ]),
    ),
  };
}

function installedFixture(root) {
  for (const pkg of manifest.packages) {
    const directory = path.join(root, "node_modules", pkg.name);
    mkdirSync(directory, { recursive: true });
    writeJSON(path.join(directory, "package.json"), {
      name: pkg.name,
      version: pkg.version,
    });
  }
  for (const filename of [
    "native/cpp/utils/NitroDefines.hpp",
    "native/apple/views/HybridView.swift",
    "native/android/src/main/cpp/JNIOnLoad.cpp",
    "js/src/index.ts",
    "js/lib/module/index.js",
    "js/lib/commonjs/index.js",
    "LICENSE",
  ]) {
    const destination = path.join(root, "node_modules/nitro-core", filename);
    mkdirSync(path.dirname(destination), { recursive: true });
    writeFileSync(destination, "");
  }
}

test("first adoption removes only the legacy source bootstrap", (t) => {
  const root = fixture(t);
  const pkg = readJSON(path.join(root, "package.json"));
  pkg.workspaces.push(
    `${legacySubmodule}/packages/nitro-core`,
    `${legacySubmodule}/packages/nitrogen`,
    "unrelated/workspace",
  );
  writeJSON(path.join(root, "package.json"), pkg);
  const calls = [];
  removeLegacyBootstrap(root, {
    executeGit: (args, options) => {
      calls.push({ args, options });
      return args[0] === "ls-files"
        ? `160000 ${"b".repeat(40)} 0\t${legacySubmodule}`
        : "";
    },
  });
  assert.deepEqual(readJSON(path.join(root, "package.json")).workspaces, [
    "packages/react-native-nitro-modules",
    "unrelated/workspace",
  ]);
  assert.deepEqual(calls[1], {
    args: ["rm", "--", legacySubmodule],
    options: { cwd: root },
  });
});

test("bootstrap removal is idempotent after the first release", (t) => {
  const root = fixture(t);
  const calls = [];
  removeLegacyBootstrap(root, {
    executeGit: (args) => {
      calls.push(args);
      return "";
    },
  });
  assert.equal(calls.length, 1);
  verifySourceMetadata(root, manifest);
});

test("bootstrap removal refuses a normal tracked source directory", (t) => {
  const root = fixture(t);
  assert.throws(
    () =>
      removeLegacyBootstrap(root, { executeGit: () => "100644 abc 0\tpath" }),
    /must be a gitlink/,
  );
});

test("release metadata pins both npm packages before they are installed", (t) => {
  const root = fixture(t);
  verifySourceMetadata(root, manifest);
  const pkg = readJSON(path.join(root, "package.json"));
  pkg.devDependencies.nitrogen = "^0.37.2";
  writeJSON(path.join(root, "package.json"), pkg);
  assert.throws(
    () => verifySourceMetadata(root, manifest),
    /Root must pin nitrogen/,
  );
});

test("lock verification accepts recorded registry integrity without installed modules", () => {
  verifySourceLock(lockFixture(), manifest);
});

test("lock verification refuses workspace, tarball and stale source resolutions", () => {
  for (const resolution of [
    "nitro-core@workspace:core",
    "nitro-core@file:core.tgz",
    "nitro-core@0.37.1",
  ]) {
    const lock = lockFixture();
    lock.packages["nitro-core"][0] = resolution;
    assert.throws(
      () => verifySourceLock(lock, manifest),
      /Unexpected lockfile resolution/,
    );
  }
  const workspaceLock = lockFixture();
  workspaceLock.workspaces.core = { name: "nitro-core" };
  assert.throws(
    () => verifySourceLock(workspaceLock, manifest),
    /must not resolve to workspaces/,
  );
});

test("lock verification refuses wrong integrity, non-registry sources and duplicate versions", () => {
  const wrongIntegrity = lockFixture();
  wrongIntegrity.packages.nitrogen[3] = "sha512-other";
  assert.throws(
    () => verifySourceLock(wrongIntegrity, manifest),
    /integrity mismatch/,
  );
  const customRegistry = lockFixture();
  customRegistry.packages.nitrogen[1] = "https://example.com/nitrogen.tgz";
  assert.throws(
    () => verifySourceLock(customRegistry, manifest),
    /must use the npm registry/,
  );
  const duplicate = lockFixture();
  duplicate.packages["nitrogen/nitro-core"] = [
    "nitro-core@0.37.1",
    "",
    {},
    "sha512-other",
  ];
  assert.throws(
    () => verifySourceLock(duplicate, manifest),
    /Unexpected lockfile resolution/,
  );
});

test("lock verification refuses loose workspace references and missing packages", () => {
  const loose = lockFixture();
  loose.workspaces[""].devDependencies.nitrogen = "*";
  assert.throws(() => verifySourceLock(loose, manifest), /must be exact/);
  const missing = lockFixture();
  delete missing.packages.nitrogen;
  assert.throws(
    () => verifySourceLock(missing, manifest),
    /Missing lockfile package/,
  );
});

test("installed packages include native and JS sources and resolve one core", (t) => {
  const root = fixture(t);
  installedFixture(root);
  verifyInstalledSources(root, manifest);
});

test("installed package verification refuses stale versions and missing native sources", (t) => {
  const root = fixture(t);
  installedFixture(root);
  const nitrogen = path.join(root, "node_modules/nitrogen/package.json");
  writeJSON(nitrogen, { name: "nitrogen", version: "0.37.1" });
  assert.throws(
    () => verifyInstalledSources(root, manifest),
    /Installed version mismatch/,
  );
  writeJSON(nitrogen, { name: "nitrogen", version: manifest.version });
  rmSync(
    path.join(
      root,
      "node_modules/nitro-core/native/android/src/main/cpp/JNIOnLoad.cpp",
    ),
  );
  assert.throws(() => verifyInstalledSources(root, manifest), /ENOENT/);
});

test("installed package verification rejects external workspace symlinks", (t) => {
  const root = fixture(t);
  installedFixture(root);
  const target = path.join(root, "outside");
  mkdirSync(target);
  writeJSON(path.join(target, "package.json"), {
    name: "nitrogen",
    version: manifest.version,
  });
  rmSync(path.join(root, "node_modules/nitrogen"), { recursive: true });
  symlinkSync(target, path.join(root, "node_modules/nitrogen"));
  assert.throws(
    () => verifyInstalledSources(root, manifest),
    /not a workspace/,
  );
});

test("core tag verification checks the commit resolved by GitHub", async () => {
  await verifyCoreTag(manifest, {
    request: (endpoint) => {
      assert.equal(endpoint, "repos/margelo/nitro/commits/v0.37.2");
      return { sha: manifest.commit };
    },
  });
  await assert.rejects(
    verifyCoreTag(manifest, { request: () => ({ sha: "b".repeat(40) }) }),
    /does not match/,
  );
});
