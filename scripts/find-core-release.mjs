import { appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import {
  compareVersions,
  getRelease,
  github,
  parseVersion,
  readJSON,
} from "../packages/react-native-nitro-modules/nitro/scripts/releases/lib.mjs";

export const coreRepository = "margelo/nitro";
export const repository = "margelo/react-native-nitro-modules";
export const coreManifestName = "nitro-release.json";
export const manifestName = "nitro-rn-release.json";

export const isNightlyVersion = (version) =>
  parseVersion(version).prerelease[0] === "nightly";

// The manifest distinguishes coordinated releases from historical Nitro tags.
export function coordinatedReleases(releases) {
  return releases
    .filter(
      (release) =>
        !release.draft &&
        release.assets.some((asset) => asset.name === coreManifestName),
    )
    .map((release) => {
      const version = release.tag_name.replace(/^v/, "");
      parseVersion(version);
      if (release.tag_name !== `v${version}`)
        throw new Error(`Unexpected core release tag: ${release.tag_name}`);
      return { ...release, version };
    })
    .sort((a, b) => compareVersions(a.version, b.version));
}

export async function selectRelease(
  releases,
  current,
  requested = "",
  lookup = (tag) => getRelease(repository, tag),
  ownTags = new Set(),
) {
  parseVersion(current);
  const coordinated = coordinatedReleases(releases);
  const regular = coordinated.filter(
    (release) => !isNightlyVersion(release.version),
  );
  const nightlies = coordinated
    .filter((release) => isNightlyVersion(release.version))
    .reverse();
  const nextPending = async (candidates) => {
    for (const release of candidates) {
      const ownRelease = await lookup(release.tag_name);
      if (ownRelease && !ownRelease.draft) continue;
      if (
        !isNightlyVersion(release.version) &&
        compareVersions(release.version, current) < 0 &&
        !ownRelease?.draft &&
        !ownTags.has(release.tag_name)
      ) {
        throw new Error(
          `Core release ${release.tag_name} was not released here and is older than main. Resolve it before adopting another release.`,
        );
      }
      return release;
    }
  };
  if (!requested) {
    const next = (await nextPending(regular)) ?? (await nextPending(nightlies));
    return next?.tag_name ?? "";
  }
  const requestedRelease = coordinated.find(
    (release) => release.tag_name === requested,
  );
  if (!requestedRelease)
    throw new Error(
      `${requested} is not a published coordinated Nitro release.`,
    );
  const ownRelease = await lookup(requested);
  // A completed release can be checked again without moving main backwards.
  if (ownRelease && !ownRelease.draft) return requested;
  // Any specific nightly may be retried or backfilled without moving main.
  if (isNightlyVersion(requestedRelease.version)) return requested;
  const next = await nextPending(regular);
  if (requested !== next?.tag_name)
    throw new Error(
      `Release ${next?.tag_name ?? "none"} is next. Cannot skip to ${requested}.`,
    );
  return requested;
}

export async function findCoreRelease(requested = "") {
  const current = readJSON(
    "packages/react-native-nitro-modules/package.json",
  ).version;
  const releases = [];
  for (let page = 1; ; page++) {
    const items = await github(
      `repos/${coreRepository}/releases?per_page=100&page=${page}`,
    );
    releases.push(...items);
    if (items.length < 100) break;
  }
  const ownTags = new Set();
  for (let page = 1; ; page++) {
    const tags = await github(
      `repos/${repository}/tags?per_page=100&page=${page}`,
    );
    for (const tag of tags) ownTags.add(tag.name);
    if (tags.length < 100) break;
  }
  return selectRelease(releases, current, requested, undefined, ownTags);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const tag = await findCoreRelease(process.env.CORE_TAG ?? "");
  if (process.env.GITHUB_OUTPUT)
    appendFileSync(process.env.GITHUB_OUTPUT, `tag=${tag}\n`);
  console.log(tag ? `Next core release: ${tag}` : "No pending core release.");
}
