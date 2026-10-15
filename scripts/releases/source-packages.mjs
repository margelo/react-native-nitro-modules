import assert from "node:assert/strict";
import { existsSync, lstatSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { git, github, readJSON, run, writeJSON } from "./lib.mjs";

export const legacySubmodule = "packages/react-native-nitro-modules/nitro";
const legacyWorkspaces = new Set([
  `${legacySubmodule}/packages/nitro-core`,
  `${legacySubmodule}/packages/nitrogen`,
]);

// Keep the initial development bootstrap until the first registry release exists.
// The release commit removes only this bootstrap, preserving other submodules.
export function removeLegacyBootstrap(root, { executeGit = git } = {}) {
  const entry = executeGit(["ls-files", "--stage", "--", legacySubmodule], {
    cwd: root,
  });
  if (entry) {
    assert(
      entry.startsWith("160000 "),
      "The legacy source path must be a gitlink",
    );
    executeGit(["rm", "--", legacySubmodule], { cwd: root });
  }
  const filename = path.join(root, "package.json");
  const pkg = readJSON(filename);
  assert(Array.isArray(pkg.workspaces), "Expected a workspace array");
  const workspaces = pkg.workspaces.filter(
    (workspace) => !legacyWorkspaces.has(workspace),
  );
  if (workspaces.length !== pkg.workspaces.length) {
    pkg.workspaces = workspaces;
    writeJSON(filename, pkg);
  }
}

export async function verifyCoreTag(manifest, { request = github } = {}) {
  // The commits API resolves lightweight and annotated tags to their commit.
  const commit = await request(
    `repos/${manifest.repository}/commits/${encodeURIComponent(manifest.tag)}`,
  );
  assert.equal(
    commit.sha,
    manifest.commit,
    "Core tag does not match its release manifest",
  );
}

export function readLock(root) {
  return JSON.parse(
    run(
      "bun",
      [
        "-e",
        'console.log(JSON.stringify(Bun.JSONC.parse(await Bun.file("bun.lock").text())))',
      ],
      { cwd: root, capture: true },
    ),
  );
}

export function verifySourceLock(lock, manifest) {
  for (const workspace of Object.values(lock.workspaces ?? {})) {
    assert(
      !manifest.packages.some((pkg) => pkg.name === workspace.name),
      "Release source packages must not resolve to workspaces",
    );
    for (const field of [
      "dependencies",
      "devDependencies",
      "optionalDependencies",
    ]) {
      for (const pkg of manifest.packages) {
        const dependency = workspace[field]?.[pkg.name];
        if (dependency !== undefined)
          assert.equal(
            dependency,
            pkg.version,
            `Lockfile dependency on ${pkg.name} must be exact`,
          );
      }
    }
  }
  for (const pkg of manifest.packages) {
    const resolutions = Object.entries(lock.packages ?? {}).filter(
      ([key]) => key === pkg.name || key.endsWith(`/${pkg.name}`),
    );
    assert(resolutions.length > 0, `Missing lockfile package: ${pkg.name}`);
    for (const [, entry] of resolutions) {
      assert.equal(
        entry[0],
        `${pkg.name}@${pkg.version}`,
        `Unexpected lockfile resolution for ${pkg.name}`,
      );
      assert.equal(entry[1], "", `${pkg.name} must use the npm registry`);
      assert.equal(
        entry.at(-1),
        pkg.integrity,
        `Lockfile integrity mismatch for ${pkg.name}`,
      );
    }
  }
}

export function verifySourceMetadata(root, manifest) {
  const workspace = readJSON(path.join(root, "package.json"));
  assert(
    !workspace.workspaces.some((entry) => legacyWorkspaces.has(entry)),
    "Release must remove source workspaces",
  );
  assert.equal(
    workspace.devDependencies?.nitrogen,
    manifest.version,
    "Root must pin nitrogen",
  );
  const runtime = readJSON(
    path.join(root, "packages/react-native-nitro-modules/package.json"),
  );
  assert.equal(runtime.version, manifest.version);
  assert.equal(runtime.dependencies?.["nitro-core"], manifest.version);
}

export function verifyInstalledSources(root, manifest) {
  const nodeModules = realpathSync(path.join(root, "node_modules"));
  const require = createRequire(path.join(root, "package.json"));
  const runtimeRequire = createRequire(
    path.join(root, "packages/react-native-nitro-modules/package.json"),
  );
  const directories = new Map();
  for (const pkg of manifest.packages) {
    const resolver = pkg.name === "nitro-core" ? runtimeRequire : require;
    const filename = resolver.resolve(`${pkg.name}/package.json`);
    const directory = path.dirname(realpathSync(filename));
    assert(
      directory.startsWith(`${nodeModules}${path.sep}`),
      `${pkg.name} must be installed in node_modules, not a workspace`,
    );
    const installed = readJSON(filename);
    assert.equal(installed.name, pkg.name);
    assert.equal(
      installed.version,
      pkg.version,
      `Installed version mismatch for ${pkg.name}`,
    );
    directories.set(pkg.name, directory);
  }
  const core = directories.get("nitro-core");
  for (const filename of [
    "native/cpp/utils/NitroDefines.hpp",
    "native/apple/views/HybridView.swift",
    "native/android/src/main/cpp/JNIOnLoad.cpp",
    "js/src/index.ts",
    "js/lib/module/index.js",
    "js/lib/commonjs/index.js",
    "LICENSE",
  ]) {
    assert(
      lstatSync(path.join(core, filename)).isFile(),
      `Missing installed core file: ${filename}`,
    );
  }
  const nitrogen = directories.get("nitrogen");
  const nitrogenRequire = createRequire(path.join(nitrogen, "package.json"));
  assert.equal(
    realpathSync(nitrogenRequire.resolve("nitro-core/package.json")),
    path.join(core, "package.json"),
    "Nitrogen and the wrapper must resolve the same core package",
  );
  assert(
    !existsSync(path.join(root, legacySubmodule, ".git")),
    "The release checkout must not use the legacy submodule",
  );
}
