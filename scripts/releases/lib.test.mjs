import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { gzipSync } from "node:zlib";
import {
  assertPublishedPackages,
  compareVersions,
  fileIntegrity,
  finishRelease,
  isNightly,
  nightlyVersion,
  npmTagFor,
  parseVersion,
  publishPackages,
  registryPackage,
  run,
  saveDraft,
  validateManifest,
} from "./lib.mjs";

function releaseFixture(t, { version = "0.37.2", npmTag = "latest" } = {}) {
  const directory = mkdtempSync(path.join(os.tmpdir(), "nitro-release-test-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const manifest = {
    schema: 1,
    repository: "margelo/nitro",
    tag: `v${version}`,
    version,
    npmTag,
    commit: "a".repeat(40),
    ...(isNightly(version) ? { sourceCommit: "b".repeat(40) } : {}),
    packages: ["nitro-core", "nitrogen"].map((name) => {
      const filename = `${name}-${version}.tgz`;
      // The release helpers hash these bytes; package inspection is tested by CI.
      writeFileSync(
        path.join(directory, filename),
        gzipSync(JSON.stringify({ name, version })),
      );
      return {
        name,
        version,
        filename,
        integrity: fileIntegrity(path.join(directory, filename)),
      };
    }),
  };
  return { directory, manifest };
}

function registryFixture(manifest) {
  const versions = new Map();
  const tags = new Map();
  const publishes = [];
  const publicationTags = [];
  const key = (name, version) => `${name}@${version}`;
  const record = (pkg) => ({
    version: pkg.version,
    dist: { integrity: pkg.integrity },
  });
  const lookup = async (name, version) =>
    versions.get(key(name, version)) ?? tags.get(key(name, version)) ?? null;
  const execute = (command, args) => {
    assert.equal(command, "npm");
    assert.equal(args[0], "publish");
    const pkg = manifest.packages.find(
      (entry) => entry.filename === path.basename(args[1]),
    );
    assert.ok(pkg, "only a recorded tarball may be published");
    const npmTag = args[3];
    assert.ok(
      npmTag === manifest.npmTag ||
        (isNightly(manifest.version) &&
          npmTag === `nightly-${manifest.commit.slice(0, 12)}`),
      "publish must use the selected channel or the older nightly fallback",
    );
    assert.deepEqual(args.slice(2), [
      "--tag",
      npmTag,
      "--access",
      "public",
      "--provenance",
      "--ignore-scripts",
    ]);
    publishes.push(pkg.name);
    publicationTags.push({ name: pkg.name, npmTag });
    versions.set(key(pkg.name, pkg.version), record(pkg));
    tags.set(key(pkg.name, npmTag), record(pkg));
  };
  return {
    versions,
    tags,
    publishes,
    publicationTags,
    lookup,
    execute,
    key,
    record,
  };
}

test("nightly versions are deterministic for a source commit and workflow run", () => {
  const source = "abcdef012345" + "a".repeat(28);
  const version = nightlyVersion("0.37.1", 42, source);
  assert.equal(version, "0.37.2-nightly.42.gabcdef012345");
  assert.equal(nightlyVersion("0.37.1", "42", source), version);
  assert.equal(
    nightlyVersion("0.38.0-beta.1", 42, source),
    "0.38.0-nightly.42.gabcdef012345",
  );
  assert.equal(
    nightlyVersion("1.0.0-rc.2", 42, source),
    "1.0.0-nightly.42.gabcdef012345",
  );
  assert.equal(
    nightlyVersion("0.37.1", 42, "001234567890" + "a".repeat(28)),
    "0.37.2-nightly.42.g001234567890",
  );
  assert.equal(
    compareVersions(nightlyVersion("0.37.1", 43, source), version),
    1,
  );
  assert.equal(compareVersions(version, "0.37.2"), -1);
  assert.ok(isNightly(version));
  assert.equal(isNightly("0.37.2"), false);
  assert.equal(isNightly("0.37.2-beta.nightly"), false);
  assert.equal(isNightly("0.37.2-nightly-other.42"), false);
});

test("nightly versions require a positive run number and full source SHA", () => {
  const source = "b".repeat(40);
  for (const runNumber of [
    0,
    -1,
    1.2,
    NaN,
    Infinity,
    Number.MAX_SAFE_INTEGER + 1,
    "",
    "01",
    "1.2",
    "1e2",
    undefined,
    null,
    true,
  ]) {
    assert.throws(
      () => nightlyVersion("0.37.1", runNumber, source),
      /positive integer/,
    );
  }
  for (const commit of [
    "",
    "main",
    "b".repeat(12),
    "g".repeat(40),
    `../${source}`,
    undefined,
  ]) {
    assert.throws(
      () => nightlyVersion("0.37.1", 1, commit),
      /source commit SHA/,
    );
  }
  assert.throws(
    () => nightlyVersion("0.37", 1, source),
    /Invalid release version/,
  );
  assert.throws(
    () => nightlyVersion(`0.0.${Number.MAX_SAFE_INTEGER}`, 1, source),
    /Invalid release version/,
  );
});

test("nightly manifests bind the nightly channel and full source commit", (t) => {
  const version = nightlyVersion("0.37.1", 42, "b".repeat(40));
  const { manifest } = releaseFixture(t, { version, npmTag: "nightly" });
  const options = {
    repository: manifest.repository,
    tag: manifest.tag,
    packages: ["nitro-core", "nitrogen"],
  };
  assert.equal(validateManifest(manifest, options), manifest);
  for (const override of [
    { sourceCommit: undefined },
    { sourceCommit: "main" },
    { npmTag: "beta" },
    { npmTag: "latest" },
  ]) {
    assert.throws(() =>
      validateManifest({ ...manifest, ...override }, options),
    );
  }
  const stable = releaseFixture(t).manifest;
  assert.throws(
    () =>
      validateManifest(
        { ...stable, npmTag: "nightly" },
        { ...options, tag: stable.tag },
      ),
    /reserved for nightly versions/,
  );
});

test("new nightlies update nightly without changing stable latest", async (t) => {
  const version = nightlyVersion("0.37.1", 42, "b".repeat(40));
  const { manifest, directory } = releaseFixture(t, {
    version,
    npmTag: "nightly",
  });
  const registry = registryFixture(manifest);
  for (const pkg of manifest.packages) {
    registry.tags.set(registry.key(pkg.name, "latest"), { version: "0.37.1" });
    registry.tags.set(registry.key(pkg.name, "nightly"), {
      version: nightlyVersion("0.37.1", 41, "c".repeat(40)),
    });
  }
  await publishPackages(manifest, directory, registry);
  for (const pkg of manifest.packages) {
    assert.equal((await registry.lookup(pkg.name, "latest")).version, "0.37.1");
    assert.equal((await registry.lookup(pkg.name, "nightly")).version, version);
  }
  assert.deepEqual(
    registry.publicationTags,
    manifest.packages.map(({ name }) => ({ name, npmTag: "nightly" })),
  );
});

test("an older nightly publishes under a commit tag without moving nightly backwards", async (t) => {
  const version = nightlyVersion("0.37.1", 41, "b".repeat(40));
  const { manifest, directory } = releaseFixture(t, {
    version,
    npmTag: "nightly",
  });
  const registry = registryFixture(manifest);
  const newer = nightlyVersion("0.37.1", 42, "c".repeat(40));
  for (const pkg of manifest.packages) {
    registry.tags.set(registry.key(pkg.name, "latest"), { version: "0.37.1" });
    registry.tags.set(registry.key(pkg.name, "nightly"), { version: newer });
  }
  await publishPackages(manifest, directory, registry);
  const fallbackTag = `nightly-${manifest.commit.slice(0, 12)}`;
  assert.deepEqual(
    registry.publicationTags,
    manifest.packages.map(({ name }) => ({ name, npmTag: fallbackTag })),
  );
  for (const pkg of manifest.packages) {
    assert.equal((await registry.lookup(pkg.name, "latest")).version, "0.37.1");
    assert.equal((await registry.lookup(pkg.name, "nightly")).version, newer);
    assert.equal(
      (await registry.lookup(pkg.name, fallbackTag)).version,
      version,
    );
  }
  await publishPackages(manifest, directory, registry);
  assert.equal(
    registry.publishes.length,
    2,
    "retry must not republish or retag the older nightly",
  );
});

test("npm provenance overrides only source commit and ref, preserving workflow identity", async (t) => {
  const { manifest, directory } = releaseFixture(t);
  const registry = registryFixture(manifest);
  const environments = [];
  await publishPackages(manifest, directory, {
    lookup: registry.lookup,
    execute: (command, args, options) => {
      environments.push(options.env);
      registry.execute(command, args);
    },
  });
  assert.deepEqual(
    environments,
    manifest.packages.map(() => ({
      GITHUB_SHA: manifest.commit,
      GITHUB_REF: `refs/tags/${manifest.tag}`,
    })),
  );
  const original = process.env.GITHUB_WORKFLOW_REF;
  process.env.GITHUB_WORKFLOW_REF =
    "margelo/nitro/.github/workflows/release.yml@refs/heads/main";
  try {
    const environment = JSON.parse(
      run(
        process.execPath,
        [
          "-e",
          "console.log(JSON.stringify({ sha: process.env.GITHUB_SHA, ref: process.env.GITHUB_REF, workflow: process.env.GITHUB_WORKFLOW_REF }))",
        ],
        {
          capture: true,
          env: environments[0],
        },
      ),
    );
    assert.deepEqual(environment, {
      sha: manifest.commit,
      ref: `refs/tags/${manifest.tag}`,
      workflow: process.env.GITHUB_WORKFLOW_REF,
    });
  } finally {
    if (original === undefined) delete process.env.GITHUB_WORKFLOW_REF;
    else process.env.GITHUB_WORKFLOW_REF = original;
  }
});

test("versions require exact SemVer without build metadata or unsafe input", () => {
  for (const version of ["0.37.2", "1.0.0-beta.1", "1.0.0-0", "1.0.0-beta-2"]) {
    assert.doesNotThrow(() => parseVersion(version));
  }
  for (const version of [
    undefined,
    null,
    1,
    "",
    "v1.0.0",
    "patch",
    "^1.0.0",
    "1.0",
    "01.0.0",
    "1.01.0",
    "1.0.00",
    "1.0.0-beta.01",
    "1.0.0+build.1",
    "1.0.0-",
    "1.0.0-beta..1",
    "9007199254740992.0.0",
    `1.0.0-${"beta".repeat(70)}`,
    "../1.0.0",
    "1.0.0\n",
    "1.0.0;echo nope",
    "$(echo 1.0.0)",
  ]) {
    assert.throws(() => parseVersion(version), undefined, String(version));
  }
});

test("version order follows SemVer prerelease precedence, including large identifiers", () => {
  const ordered = [
    "1.0.0-alpha",
    "1.0.0-alpha.1",
    "1.0.0-alpha.beta",
    "1.0.0-beta",
    "1.0.0-beta.2",
    "1.0.0-beta.11",
    "1.0.0-rc.1",
    "1.0.0",
    "1.0.1",
    "1.1.0",
    "2.0.0",
  ];
  for (let i = 0; i < ordered.length; i++) {
    assert.equal(compareVersions(ordered[i], ordered[i]), 0);
    if (i > 0) {
      assert.equal(compareVersions(ordered[i - 1], ordered[i]), -1);
      assert.equal(compareVersions(ordered[i], ordered[i - 1]), 1);
    }
  }
  assert.equal(
    compareVersions("1.0.0-9007199254740992", "1.0.0-9007199254740993"),
    -1,
  );
  assert.equal(compareVersions("1.0.0-9", "1.0.0-a"), -1);
});

test("npm tag defaults preserve stable and prerelease channels", () => {
  assert.equal(npmTagFor("0.37.2"), "latest");
  assert.equal(npmTagFor("0.38.0-beta.1"), "beta");
  assert.equal(npmTagFor("0.38.0-rc.1"), "rc");
  assert.equal(npmTagFor("0.38.0-1"), "next");
  assert.equal(npmTagFor("0.38.0-beta.1", "next"), "next");
  assert.equal(npmTagFor("0.38.0", "next"), "next");
  assert.throws(
    () => npmTagFor("0.38.0-beta.1", "latest"),
    /prereleases cannot use latest/,
  );
  for (const tag of [
    "../latest",
    "--provenance",
    "latest\n",
    "beta;echo",
    "BETA",
    "1.2.3",
    "v1",
    "x",
  ]) {
    assert.throws(() => npmTagFor("0.38.0", tag), undefined, tag);
  }
});

test("manifest validation binds artifacts to the expected repository, tag and package order", (t) => {
  const { manifest } = releaseFixture(t);
  const options = {
    repository: "margelo/nitro",
    tag: manifest.tag,
    packages: ["nitro-core", "nitrogen"],
  };
  assert.equal(validateManifest(manifest, options), manifest);
  const changes = [
    (copy) => {
      copy.schema = 2;
    },
    (copy) => {
      copy.repository = "someone/nitro";
    },
    (copy) => {
      copy.tag = "v0.37.3";
    },
    (copy) => {
      copy.commit = "main";
    },
    (copy) => {
      copy.version = "0.37.3";
    },
    (copy) => {
      copy.npmTag = "";
    },
    (copy) => {
      copy.packages.reverse();
    },
    (copy) => {
      copy.packages.pop();
    },
    (copy) => {
      copy.packages[0].version = "0.37.3";
    },
    (copy) => {
      copy.packages[0].filename = "../nitro-core-0.37.2.tgz";
    },
    (copy) => {
      copy.packages[0].integrity = "sha512-corrupt";
    },
  ];
  for (const change of changes) {
    const copy = structuredClone(manifest);
    change(copy);
    assert.throws(() => validateManifest(copy, options));
  }
});

test("registry lookup returns missing only for 404 and encodes package identifiers", async () => {
  const missing = await registryPackage(
    "@scope/core",
    "0.38.0-beta.1",
    async (url) => {
      assert.equal(
        url,
        "https://registry.npmjs.org/%40scope%2Fcore/0.38.0-beta.1",
      );
      return {
        status: 404,
        ok: false,
        json: () => assert.fail("404 has no package body"),
      };
    },
  );
  assert.equal(missing, null);
  const pkg = { name: "nitro-core", version: "0.37.2" };
  assert.equal(
    await registryPackage(pkg.name, pkg.version, async () => ({
      status: 200,
      ok: true,
      json: async () => pkg,
    })),
    pkg,
  );
});

test("registry auth, rate limit, server, network and parse failures propagate", async () => {
  for (const status of [401, 403, 429, 500, 503]) {
    await assert.rejects(
      registryPackage("nitro-core", "0.37.2", async () => ({
        status,
        ok: false,
      })),
      new RegExp(`HTTP ${status}`),
    );
  }
  await assert.rejects(
    registryPackage("nitro-core", "0.37.2", async () => {
      throw new Error("offline");
    }),
    /offline/,
  );
  await assert.rejects(
    registryPackage("nitro-core", "0.37.2", async () => ({
      status: 200,
      ok: true,
      json: async () => {
        throw new SyntaxError("bad JSON");
      },
    })),
    /bad JSON/,
  );
});

test("partial publication resumes with the same artifacts and only publishes the missing package", async (t) => {
  const { manifest, directory } = releaseFixture(t);
  const registry = registryFixture(manifest);
  const attempts = [];
  let failNitrogen = true;
  const execute = (command, args) => {
    const filename = path.basename(args[1]);
    attempts.push(filename);
    if (filename.startsWith("nitrogen-") && failNitrogen) {
      failNitrogen = false;
      throw new Error("npm temporarily unavailable");
    }
    registry.execute(command, args);
  };
  await assert.rejects(
    publishPackages(manifest, directory, { lookup: registry.lookup, execute }),
    /temporarily unavailable/,
  );
  assert.deepEqual(registry.publishes, ["nitro-core"]);
  await publishPackages(manifest, directory, {
    lookup: registry.lookup,
    execute,
  });
  assert.deepEqual(registry.publishes, ["nitro-core", "nitrogen"]);
  assert.deepEqual(attempts, [
    "nitro-core-0.37.2.tgz",
    "nitrogen-0.37.2.tgz",
    "nitrogen-0.37.2.tgz",
  ]);
  await assertPublishedPackages(manifest, { lookup: registry.lookup });
  await publishPackages(manifest, directory, {
    lookup: registry.lookup,
    execute,
  });
  assert.equal(attempts.length, 3, "a fully published release is a no-op");
});

test("a conflict in the second package prevents publishing either package", async (t) => {
  const { manifest, directory } = releaseFixture(t);
  const registry = registryFixture(manifest);
  const nitrogen = manifest.packages[1];
  registry.versions.set(registry.key(nitrogen.name, nitrogen.version), {
    version: nitrogen.version,
    dist: { integrity: "sha512-other" },
  });
  await assert.rejects(
    publishPackages(manifest, directory, registry),
    /different tarball/,
  );
  assert.deepEqual(registry.publishes, []);
});

test("corrupt saved tarballs fail before registry access or publication", async (t) => {
  const { manifest, directory } = releaseFixture(t);
  writeFileSync(path.join(directory, manifest.packages[1].filename), "corrupt");
  await assert.rejects(
    publishPackages(manifest, directory, {
      lookup: () => assert.fail("must verify files before reading npm"),
      execute: () => assert.fail("must not publish corrupt files"),
    }),
    /Tarball integrity mismatch/,
  );
});

test("preflight registry failures prevent publication", async (t) => {
  const { manifest, directory } = releaseFixture(t);
  const registry = registryFixture(manifest);
  await assert.rejects(
    publishPackages(manifest, directory, {
      lookup: async (name) => {
        if (name === "nitrogen") throw new Error("npm registry HTTP 503");
        return null;
      },
      execute: registry.execute,
    }),
    /HTTP 503/,
  );
  assert.deepEqual(registry.publishes, []);
});

test("an unpublished older release cannot move latest backwards", async (t) => {
  const { manifest, directory } = releaseFixture(t);
  const registry = registryFixture(manifest);
  registry.tags.set(registry.key("nitrogen", "latest"), { version: "0.38.0" });
  await assert.rejects(
    publishPackages(manifest, directory, registry),
    /tag backwards from 0.38.0/,
  );
  assert.deepEqual(registry.publishes, []);
});

test("an already published older release resumes without changing the newer latest tag", async (t) => {
  const { manifest, directory } = releaseFixture(t);
  const registry = registryFixture(manifest);
  for (const pkg of manifest.packages) {
    registry.versions.set(
      registry.key(pkg.name, pkg.version),
      registry.record(pkg),
    );
    registry.tags.set(registry.key(pkg.name, "latest"), { version: "0.38.0" });
  }
  await publishPackages(manifest, directory, registry);
  assert.deepEqual(registry.publishes, []);
  assert.equal(
    (await registry.lookup("nitro-core", "latest")).version,
    "0.38.0",
  );
});

test("prereleases publish only to their selected channel", async (t) => {
  const { manifest, directory } = releaseFixture(t, {
    version: "0.38.0-beta.1",
    npmTag: "beta",
  });
  const registry = registryFixture(manifest);
  registry.tags.set(registry.key("nitro-core", "latest"), { version: "1.0.0" });
  await publishPackages(manifest, directory, registry);
  assert.equal(
    (await registry.lookup("nitro-core", "latest")).version,
    "1.0.0",
  );
  assert.equal(
    (await registry.lookup("nitro-core", "beta")).version,
    manifest.version,
  );
});

test("verification after publication stops before the next package if npm serves different bytes", async (t) => {
  const { manifest, directory } = releaseFixture(t);
  const registry = registryFixture(manifest);
  await assert.rejects(
    publishPackages(manifest, directory, {
      lookup: registry.lookup,
      execute: (command, args) => {
        registry.execute(command, args);
        registry.versions.set(registry.key("nitro-core", manifest.version), {
          dist: { integrity: "sha512-other" },
        });
      },
    }),
    /npm does not contain the recorded nitro-core/,
  );
  assert.deepEqual(registry.publishes, ["nitro-core"]);
});

test("a registry outage after a successful publish resumes without publishing that version again", async (t) => {
  const { manifest, directory } = releaseFixture(t);
  const registry = registryFixture(manifest);
  let failVerification = true;
  const lookup = async (name, version) => {
    if (
      failVerification &&
      name === "nitro-core" &&
      version === manifest.version &&
      registry.publishes.length > 0
    ) {
      failVerification = false;
      throw new Error("verification connection reset");
    }
    return registry.lookup(name, version);
  };
  await assert.rejects(
    publishPackages(manifest, directory, { lookup, execute: registry.execute }),
    /connection reset/,
  );
  assert.deepEqual(registry.publishes, ["nitro-core"]);
  await publishPackages(manifest, directory, {
    lookup,
    execute: registry.execute,
  });
  assert.deepEqual(registry.publishes, ["nitro-core", "nitrogen"]);
});

test("verification requires every recorded package with matching integrity", async (t) => {
  const { manifest } = releaseFixture(t);
  const registry = registryFixture(manifest);
  await assert.rejects(
    assertPublishedPackages(manifest, { lookup: registry.lookup }),
    /npm does not contain/,
  );
  registry.versions.set(
    registry.key("nitro-core", manifest.version),
    registry.record(manifest.packages[0]),
  );
  await assert.rejects(
    assertPublishedPackages(manifest, { lookup: registry.lookup }),
    /recorded nitrogen/,
  );
  registry.versions.set(
    registry.key("nitrogen", manifest.version),
    registry.record(manifest.packages[1]),
  );
  await assertPublishedPackages(manifest, { lookup: registry.lookup });
});

test("finishing a draft promotes only stable releases newer than GitHub Latest", (t) => {
  const { manifest } = releaseFixture(t);
  for (const [current, expectedLatest] of [
    [null, true],
    [{ tag_name: "v0.37.1" }, true],
    [{ tag_name: "v0.37.2" }, true],
    [{ tag_name: "v0.38.0" }, false],
  ]) {
    const commands = [];
    finishRelease(manifest, {
      lookup: (repository, tag) => {
        assert.equal(repository, manifest.repository);
        assert.equal(tag, manifest.tag);
        return { draft: true };
      },
      request: (endpoint, options) => {
        assert.equal(endpoint, `repos/${manifest.repository}/releases/latest`);
        assert.deepEqual(options, { allowNotFound: true });
        return current;
      },
      execute: (command, args) => commands.push([command, args]),
    });
    assert.deepEqual(commands, [
      [
        "gh",
        [
          "release",
          "edit",
          manifest.tag,
          "--repo",
          manifest.repository,
          "--draft=false",
          `--latest=${expectedLatest}`,
        ],
      ],
    ]);
  }
});

test("prereleases and non-latest channels never become GitHub Latest", (t) => {
  for (const options of [
    { version: "0.38.0-beta.1", npmTag: "beta" },
    { version: "0.38.0", npmTag: "next" },
  ]) {
    const { manifest } = releaseFixture(t, options);
    const commands = [];
    finishRelease(manifest, {
      lookup: () => ({ draft: true }),
      request: () => assert.fail("no latest lookup is needed for this channel"),
      execute: (command, args) => commands.push([command, args]),
    });
    assert.equal(commands.length, 1);
    assert.ok(commands[0][1].includes("--latest=false"));
  }
});

test("completed releases are unchanged and missing checkpoints cannot be completed", (t) => {
  const { manifest } = releaseFixture(t);
  const unavailable = () => assert.fail("must not query or change GitHub");
  finishRelease(manifest, {
    lookup: () => ({ draft: false }),
    request: unavailable,
    execute: unavailable,
  });
  assert.throws(
    () =>
      finishRelease(manifest, {
        lookup: () => null,
        request: unavailable,
        execute: unavailable,
      }),
    /checkpoint is missing/,
  );
});

test("a GitHub Latest lookup failure leaves the release as a draft", (t) => {
  const { manifest } = releaseFixture(t);
  assert.throws(
    () =>
      finishRelease(manifest, {
        lookup: () => ({ draft: true }),
        request: () => {
          throw new Error("GitHub HTTP 503");
        },
        execute: () =>
          assert.fail("must not complete a release when latest is unknown"),
      }),
    /GitHub HTTP 503/,
  );
});

test("a draft checkpoint uploads every tarball before the manifest", (t) => {
  const { manifest, directory } = releaseFixture(t, {
    version: "0.38.0-beta.1",
    npmTag: "beta",
  });
  const commands = [];
  saveDraft(manifest, directory, "nitro-release.json", {
    lookup: () => null,
    execute: (command, args) => commands.push([command, args]),
  });
  assert.equal(commands.length, 4);
  assert.deepEqual(commands[0], [
    "gh",
    [
      "release",
      "create",
      manifest.tag,
      "--repo",
      manifest.repository,
      "--verify-tag",
      "--draft",
      "--title",
      manifest.tag,
      "--generate-notes",
      "--latest=false",
      "--prerelease",
    ],
  ]);
  const uploads = commands.slice(1);
  assert.deepEqual(
    uploads.map(([command, args]) => {
      assert.equal(command, "gh");
      assert.deepEqual(args.slice(0, 3), ["release", "upload", manifest.tag]);
      return path.basename(args[3]);
    }),
    [...manifest.packages.map((pkg) => pkg.filename), "nitro-release.json"],
  );
  assert.ok(uploads[0][1].includes("--clobber"));
  assert.ok(uploads[1][1].includes("--clobber"));
  assert.ok(
    !uploads[2][1].includes("--clobber"),
    "a completed checkpoint must never be replaced",
  );
  assert.deepEqual(
    JSON.parse(
      readFileSync(path.join(directory, "nitro-release.json"), "utf8"),
    ),
    manifest,
  );
});

test("drafts with a checkpoint and completed releases refuse artifact replacement", (t) => {
  const { manifest, directory } = releaseFixture(t);
  for (const release of [
    { draft: false, assets: [] },
    { draft: true, assets: [{ name: "nitro-release.json" }] },
  ]) {
    assert.throws(
      () =>
        saveDraft(manifest, directory, "nitro-release.json", {
          lookup: () => release,
          execute: () => assert.fail("saved artifacts must not be overwritten"),
        }),
      /Cannot replace|checkpoint already exists/,
    );
  }
});

test("an interrupted tarball upload leaves no remote manifest and resumes the same draft", (t) => {
  const { manifest, directory } = releaseFixture(t);
  const assets = [];
  let created = false;
  let failSecondUpload = true;
  const commands = [];
  const lookup = () =>
    created ? { draft: true, assets: assets.map((name) => ({ name })) } : null;
  const execute = (command, args) => {
    commands.push([command, args]);
    if (args[1] === "create") {
      assert.equal(created, false, "the existing draft must be reused");
      created = true;
      return;
    }
    const filename = path.basename(args[3]);
    if (filename === manifest.packages[1].filename && failSecondUpload) {
      failSecondUpload = false;
      throw new Error("upload connection reset");
    }
    if (!assets.includes(filename)) assets.push(filename);
  };
  assert.throws(
    () =>
      saveDraft(manifest, directory, "nitro-release.json", { lookup, execute }),
    /connection reset/,
  );
  assert.deepEqual(assets, [manifest.packages[0].filename]);
  assert.ok(
    !commands.some(
      ([, args]) =>
        args[1] === "upload" && args[3].endsWith("nitro-release.json"),
    ),
  );
  saveDraft(manifest, directory, "nitro-release.json", { lookup, execute });
  assert.deepEqual(assets, [
    ...manifest.packages.map((pkg) => pkg.filename),
    "nitro-release.json",
  ]);
  assert.equal(commands.filter(([, args]) => args[1] === "create").length, 1);
});
