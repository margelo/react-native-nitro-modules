import assert from "node:assert/strict";
import test from "node:test";
import { coordinatedReleases, selectRelease } from "./find-core-release.mjs";

const release = (version, options = {}) => ({
  tag_name: `v${version}`,
  draft: false,
  assets: [{ name: "nitro-release.json" }],
  ...options,
});
const missing = async () => null;

test("ignores legacy releases and unpublished drafts", () => {
  assert.deepEqual(
    coordinatedReleases([
      release("0.37.2", { assets: [] }),
      release("0.37.3", { draft: true }),
    ]),
    [],
  );
});

test("selects the oldest pending version, including prereleases", async () => {
  const releases = [
    release("0.38.0"),
    release("0.38.0-beta.2"),
    release("0.38.0-beta.1"),
  ];
  assert.equal(
    await selectRelease(releases, "0.37.1", "", missing),
    "v0.38.0-beta.1",
  );
});

test("resumes a draft at the version already committed on main", async () => {
  const lookup = async (tag) => (tag === "v0.37.2" ? { draft: true } : null);
  assert.equal(
    await selectRelease(
      [release("0.37.2"), release("0.37.3")],
      "0.37.2",
      "",
      lookup,
    ),
    "v0.37.2",
  );
});

test("recovers the interval between pushing a version and saving its draft", async () => {
  assert.equal(
    await selectRelease([release("0.37.2")], "0.37.2", "", missing),
    "v0.37.2",
  );
});

test("advances after a completed wrapper release", async () => {
  const lookup = async (tag) => (tag === "v0.37.2" ? { draft: false } : null);
  assert.equal(
    await selectRelease(
      [release("0.37.2"), release("0.37.3")],
      "0.37.2",
      "",
      lookup,
    ),
    "v0.37.3",
  );
});

test("does not skip an unreleased version older than main or repeat completed releases", async () => {
  await assert.rejects(
    selectRelease([release("0.37.2")], "0.37.3", "", missing),
    /older than main/,
  );
  assert.equal(
    await selectRelease([release("0.37.3")], "0.37.3", "", async () => ({
      draft: false,
    })),
    "",
  );
});

test("manual requests cannot skip a pending version or target an unmarked tag", async () => {
  const releases = [release("0.37.2"), release("0.37.3")];
  await assert.rejects(
    selectRelease(releases, "0.37.1", "v0.37.3", missing),
    /Cannot skip/,
  );
  await assert.rejects(
    selectRelease(releases, "0.37.1", "v0.37.4", missing),
    /not a published coordinated/,
  );
});

test("completed old releases can be verified again", async () => {
  assert.equal(
    await selectRelease([release("0.37.2")], "0.37.3", "v0.37.2", async () => ({
      draft: false,
    })),
    "v0.37.2",
  );
});

test("an unfinished older draft blocks later releases", async () => {
  assert.equal(
    await selectRelease(
      [release("0.37.2"), release("0.37.4")],
      "0.37.3",
      "",
      async () => ({ draft: true }),
    ),
    "v0.37.2",
  );
});

test("recovers a tag-only release even after main advances", async () => {
  assert.equal(
    await selectRelease(
      [release("0.37.2"), release("0.37.4")],
      "0.37.3",
      "",
      missing,
      new Set(["v0.37.2"]),
    ),
    "v0.37.2",
  );
});

test("rejects malformed coordinated release tags", () => {
  assert.throws(
    () => coordinatedReleases([release("0.37.02")]),
    /Invalid release version/,
  );
  assert.throws(
    () => coordinatedReleases([release("0.37.2", { tag_name: "0.37.2" })]),
    /Unexpected core release tag/,
  );
});

test("regular releases take priority over pending or failed nightlies", async () => {
  const nightly = "0.38.0-nightly.12.abcdef123456";
  const releases = [release(nightly), release("0.38.0-beta.2")];
  assert.equal(
    await selectRelease(releases, "0.38.0-beta.1", "", async (tag) =>
      tag === `v${nightly}` ? { draft: true } : null,
    ),
    "v0.38.0-beta.2",
  );
});

test("a completed newer nightly does not prevent a regular release", async () => {
  const nightly = "0.38.0-nightly.12.abcdef123456";
  assert.equal(
    await selectRelease(
      [release(nightly), release("0.38.0-beta.2")],
      "0.38.0-beta.1",
      "",
      async (tag) => (tag === `v${nightly}` ? { draft: false } : null),
    ),
    "v0.38.0-beta.2",
  );
});

test("nightlies are adopted even when their version is below main", async () => {
  const nightly = "0.37.2-nightly.12.abcdef123456";
  assert.equal(
    await selectRelease([release(nightly)], "0.38.0", "", missing),
    `v${nightly}`,
  );
});

test("nightlies prioritize the newest pending version then backfill older versions", async () => {
  const first = "0.37.2-nightly.12.abcdef123456";
  const second = "0.37.2-nightly.13.abcdef654321";
  const releases = [release(second), release(first)];
  assert.equal(
    await selectRelease(releases, "0.37.1", "", missing),
    `v${second}`,
  );
  assert.equal(
    await selectRelease(releases, "0.37.1", "", async (tag) =>
      tag === `v${second}` ? { draft: false } : null,
    ),
    `v${first}`,
  );
  assert.equal(
    await selectRelease(releases, "0.37.1", `v${first}`, missing),
    `v${first}`,
  );
});

test("a failed older nightly does not block a newer fixed nightly", async () => {
  const first = "0.37.2-nightly.12.abcdef123456";
  const second = "0.37.2-nightly.13.abcdef654321";
  assert.equal(
    await selectRelease(
      [release(first), release(second)],
      "0.37.1",
      "",
      async (tag) => (tag === `v${first}` ? { draft: true } : null),
    ),
    `v${second}`,
  );
});

test("manual nightly retries do not have to wait for regular releases", async () => {
  const nightly = "0.38.0-nightly.12.abcdef123456";
  assert.equal(
    await selectRelease(
      [release(nightly), release("0.38.0-beta.2")],
      "0.38.0-beta.1",
      `v${nightly}`,
      missing,
    ),
    `v${nightly}`,
  );
});
