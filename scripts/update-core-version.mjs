import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readCoreVersion, readJson } from "./core-package.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const check = process.argv.includes("--check");
const requested = process.argv.slice(2).find((arg) => !arg.startsWith("--"));
if (check && requested)
  throw new Error(
    "--check verifies the installed core packages; omit the version argument.",
  );
const version = requested ?? readCoreVersion(root).version;
if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version))
  throw new Error(`Invalid core version: ${version}`);

for (const file of [
  "package.json",
  "packages/react-native-nitro-modules/package.json",
  "packages/react-native-nitro-test/package.json",
  "packages/react-native-nitro-test-external/package.json",
  "apps/example/package.json",
  "apps/benchmark/package.json",
]) {
  const filename = path.join(root, file);
  const pkg = readJson(filename);
  const usesCore = pkg.dependencies?.["nitro-core"] !== undefined;
  const usesNitrogen =
    file === "package.json" || pkg.devDependencies?.nitrogen !== undefined;
  if (check) {
    if (
      pkg.version !== version ||
      (usesCore && pkg.dependencies["nitro-core"] !== version) ||
      (usesNitrogen && pkg.devDependencies?.nitrogen !== version)
    ) {
      throw new Error(
        `${file} must use core version ${version}. Run bun update-core-version.`,
      );
    }
  } else {
    pkg.version = version;
    if (usesCore) pkg.dependencies["nitro-core"] = version;
    if (usesNitrogen)
      pkg.devDependencies = { ...pkg.devDependencies, nitrogen: version };
    writeFileSync(filename, `${JSON.stringify(pkg, null, 2)}\n`);
  }
}
