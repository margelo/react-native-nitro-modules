import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
  existsSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { syncCore } from "./sync-core.mjs";

function fixture(t) {
  const root = mkdtempSync(path.join(os.tmpdir(), "nitro-staging-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const put = (file, text) => {
    const target = path.join(root, file);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(
      target,
      typeof text === "object" ? JSON.stringify(text) : text,
    );
  };
  put("package.json", { private: true });
  put("packages/react-native-nitro-modules/package.json", {
    version: "1.2.3",
    dependencies: { "nitro-core": "1.2.3" },
  });
  put("node_modules/nitro-core/package.json", {
    name: "nitro-core",
    version: "1.2.3",
  });
  put("node_modules/nitrogen/package.json", {
    name: "nitrogen",
    version: "1.2.3",
    dependencies: { "nitro-core": "^1.2.3" },
  });
  put(
    "node_modules/nitro-core/js/src/version.ts",
    "export const version = '1.2.3'\n",
  );
  put(
    "node_modules/nitro-core/native/cpp/utils/NitroDefines.hpp",
    '#define NITRO_VERSION "1.2.3"\n',
  );
  put(
    "node_modules/nitro-core/native/apple/HybridObject.swift",
    "// Swift source\n",
  );
  put(
    "node_modules/nitro-core/native/android/src/main/HybridObject.kt",
    "// Kotlin source\n",
  );
  put(
    "node_modules/nitro-core/native/android/src/main/res/values/ids.xml",
    "<resources/>\n",
  );
  put("node_modules/nitro-core/LICENSE", "MIT\n");
  return {
    root,
    put,
    wrapper: path.join(root, "packages/react-native-nitro-modules"),
  };
}

test("stages a package without Git and cleans only generated directories", (t) => {
  const { root, put, wrapper } = fixture(t);
  put(
    "packages/react-native-nitro-modules/android/src/obsolete.kt",
    "// stale",
  );
  put(
    "packages/react-native-nitro-modules/android/build.gradle",
    "// handwritten",
  );
  put("packages/react-native-nitro-modules/src/index.ts", "// RN integration");
  put("node_modules/nitro-core/native/cpp/cache.o", "build cache");
  assert.deepEqual(syncCore(root), { version: "1.2.3", files: 5 });
  assert.equal(
    readFileSync(path.join(wrapper, "ios/HybridObject.swift"), "utf8"),
    "// Swift source\n",
  );
  assert.equal(
    readFileSync(path.join(wrapper, "android/build.gradle"), "utf8"),
    "// handwritten",
  );
  assert.equal(
    readFileSync(path.join(wrapper, "src/index.ts"), "utf8"),
    "// RN integration",
  );
  assert.equal(
    existsSync(path.join(wrapper, "android/src/obsolete.kt")),
    false,
  );
  assert.equal(existsSync(path.join(wrapper, "cpp/cache.o")), false);
  assert.doesNotThrow(() => syncCore(root, { check: true }));
  put("packages/react-native-nitro-modules/cpp/stale.hpp", "// stale");
  assert.throws(() => syncCore(root, { check: true }), /stale/);
  syncCore(root);
  put(
    "packages/react-native-nitro-modules/ios/HybridObject.swift",
    "// independently changed",
  );
  assert.throws(() => syncCore(root, { check: true }), /differs/);
});

test("rejects a version mismatch before cleaning staged sources", (t) => {
  const { root, put, wrapper } = fixture(t);
  put("packages/react-native-nitro-modules/cpp/preserve.hpp", "// keep");
  put(
    "node_modules/nitro-core/js/src/version.ts",
    "export const version = '1.2.4'\n",
  );
  assert.throws(() => syncCore(root), /must match/);
  assert.equal(
    readFileSync(path.join(wrapper, "cpp/preserve.hpp"), "utf8"),
    "// keep",
  );
});

test("rejects unpinned dependencies and native source symlinks before cleaning", (t) => {
  const { root, put, wrapper } = fixture(t);
  put("packages/react-native-nitro-modules/cpp/preserve.hpp", "// keep");
  put("packages/react-native-nitro-modules/package.json", {
    version: "1.2.3",
    dependencies: { "nitro-core": "^1.2.3" },
  });
  assert.throws(() => syncCore(root), /pin nitro-core/);
  put("packages/react-native-nitro-modules/package.json", {
    version: "1.2.3",
    dependencies: { "nitro-core": "1.2.3" },
  });
  symlinkSync(
    path.join(root, "package.json"),
    path.join(root, "node_modules/nitro-core/native/cpp/outside.hpp"),
  );
  assert.throws(() => syncCore(root), /symlink/);
  assert.equal(
    readFileSync(path.join(wrapper, "cpp/preserve.hpp"), "utf8"),
    "// keep",
  );
});
